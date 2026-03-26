import { useState, useEffect, useCallback, useMemo } from "react";
import { parseUcdScheduleInput } from "../parser/ucdScheduleParser";
import { detectPrayerConflicts } from "../conflicts/prayerConflictEngine";

const CACHE_KEY = "salahsync_prayer_cache";

async function readCache() {
  try {
    if (globalThis.chrome?.storage?.local) {
      return new Promise((resolve) =>
        chrome.storage.local.get(CACHE_KEY, (r) => resolve(r[CACHE_KEY] ?? null))
      );
    }
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function writeCache(timings) {
  const entry = { date: new Date().toDateString(), timings };
  try {
    if (globalThis.chrome?.storage?.local) {
      chrome.storage.local.set({ [CACHE_KEY]: entry });
    } else {
      localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
    }
  } catch {}
}

function isCacheForToday(entry) {
  return entry?.date === new Date().toDateString() && !!entry?.timings;
}

async function fetchWithRetry(url, maxRetries = 3) {
  let delay = 1000;
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (attempt < maxRetries) await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
    }
  }
  throw lastErr;
}

const DAVIS_COORDS = { latitude: 38.5465, longitude: -121.7563, label: "Davis, CA" };

const IQAMAH_OFFSETS = { Fajr: 25, Dhuhr: 10, Asr: 10, Maghrib: 10, Isha: 20 };

function computeIqamahTimes(athanTimes) {
  const result = {};
  for (const [prayer, offsetMin] of Object.entries(IQAMAH_OFFSETS)) {
    const athan = athanTimes[prayer];
    if (!athan) continue;
    const match = String(athan).match(/(\d{1,2}):(\d{2})/);
    if (!match) continue;
    const totalMin = Number(match[1]) * 60 + Number(match[2]) + offsetMin;
    const h = String(Math.floor(totalMin / 60) % 24).padStart(2, "0");
    const m = String(totalMin % 60).padStart(2, "0");
    result[prayer] = `${h}:${m}`;
  }
  return result;
}

const filterPrayerTimes = (timings) =>
  Object.fromEntries(
    Object.entries(timings).filter(
      ([k]) => !["Midnight", "Imsak", "Firstthird", "Lastthird", "Sunset"].includes(k)
    )
  );

export default function Panel() {
  const [open, setOpen] = useState(false);
  const [prayerTimes, setPrayerTimes] = useState({});
  const [cacheStatus, setCacheStatus] = useState(null);
  const [scheduleInput, setScheduleInput] = useState("");
  const [classMeetings, setClassMeetings] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);

  const fetchPrayerTimes = useCallback(async () => {
    const cached = await readCache();
    if (isCacheForToday(cached)) {
      setPrayerTimes(cached.timings);
      setCacheStatus(null);
      return;
    }
    try {
      const json = await fetchWithRetry(
        `https://api.aladhan.com/v1/timings?latitude=${DAVIS_COORDS.latitude}&longitude=${DAVIS_COORDS.longitude}&method=2`
      );
      const times = filterPrayerTimes(json.data.timings);
      await writeCache(times);
      setPrayerTimes(times);
      setCacheStatus(null);
    } catch (e) {
      console.error("SalahSync: prayer time fetch failed", e);
      if (cached?.timings) {
        setPrayerTimes(cached.timings);
        setCacheStatus("stale");
      } else {
        setCacheStatus("error");
      }
    }
  }, []);

  useEffect(() => {
    fetchPrayerTimes();
    const id = setInterval(fetchPrayerTimes, 6 * 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchPrayerTimes]);

  const iqamahTimes = useMemo(() => computeIqamahTimes(prayerTimes), [prayerTimes]);

  const conflicts = useMemo(
    () => detectPrayerConflicts(classMeetings, iqamahTimes, { windowMinutes: 20, bufferMinutes: 10 }),
    [classMeetings, iqamahTimes]
  );

  const handleParse = () => {
    const { meetings, errors } = parseUcdScheduleInput(scheduleInput);
    setClassMeetings(meetings);
    setParseErrors(errors);
  };

  return (
    <>
      <button className="ss-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? "✕" : "Salah\nSync"}
      </button>

      {open && (
        <div className="ss-panel">
          <div className="ss-header">
            <span className="ss-title">SalahSync</span>
            <span className="ss-subtitle">UC Davis Prayer Conflict Checker</span>
          </div>

          <div className="ss-section">
            <div className="ss-section-title">Paste Your Schedule</div>
            <textarea
              className="ss-input"
              value={scheduleInput}
              onChange={(e) => setScheduleInput(e.target.value)}
              placeholder={"ECS 122A A01 MWF 10:00 AM - 10:50 AM\nMAT 021A B01 TR 1:10 PM - 3:00 PM"}
            />
            <button className="ss-btn" onClick={handleParse}>
              Check for Conflicts
            </button>
            {parseErrors.length > 0 && <div className="ss-msg-error">{parseErrors[0]}</div>}
            {classMeetings.length > 0 && (
              <div className="ss-msg-success">Parsed {classMeetings.length} class meeting(s).</div>
            )}
          </div>

          <div className="ss-section">
            <div className="ss-section-title">Prayer Conflicts</div>
            {conflicts.length === 0 ? (
              <div className="ss-no-conflicts">
                {classMeetings.length === 0
                  ? "Paste your schedule above to check."
                  : "No conflicts detected."}
              </div>
            ) : (
              conflicts.map((c) => (
                <div key={c.id} className={`ss-conflict ${c.severity}`}>
                  <span>{c.courseCode} {c.section} ({c.days.join("")})</span>
                  <span>{c.prayer}: {c.classInterval}</span>
                  <span className="ss-conflict-badge">{c.severity.toUpperCase()}</span>
                </div>
              ))
            )}
          </div>

          <div className="ss-footer">
            {DAVIS_COORDS.label} · Islamic Center of Davis iqamah times
            {cacheStatus === "stale" && (
              <div className="ss-cache-notice stale">Offline — cached times</div>
            )}
            {cacheStatus === "error" && (
              <div className="ss-cache-notice error">Could not load prayer times</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
