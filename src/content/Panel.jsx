import { useState, useEffect, useCallback, useMemo } from "react";
import { parseUcdScheduleInput } from "../parser/ucdScheduleParser";
import { detectPrayerConflicts } from "../conflicts/prayerConflictEngine";

// ── Shared helpers (same as popup) ───────────────────────────────────────────
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

const DAVIS_COORDS = { latitude: 38.5465, longitude: -121.7563 };
const IQAMAH_OFFSETS = { Fajr: 25, Dhuhr: 10, Asr: 10, Maghrib: 10, Isha: 20 };

function computeIqamahTimes(athanTimes) {
  const result = {};
  for (const [prayer, offsetMin] of Object.entries(IQAMAH_OFFSETS)) {
    const athan = athanTimes[prayer];
    if (!athan) continue;
    const match = String(athan).match(/(\d{1,2}):(\d{2})/);
    if (!match) continue;
    const totalMin = Number(match[1]) * 60 + Number(match[2]) + offsetMin;
    result[prayer] = `${String(Math.floor(totalMin / 60) % 24).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
  }
  return result;
}

const filterPrayerTimes = (timings) =>
  Object.fromEntries(
    Object.entries(timings).filter(
      ([k]) => !["Midnight", "Imsak", "Firstthird", "Lastthird", "Sunset"].includes(k)
    )
  );

// ── Component ─────────────────────────────────────────────────────────────────
export default function Panel() {
  const [prayerTimes, setPrayerTimes] = useState({});
  const [cacheStatus, setCacheStatus] = useState(null);
  const [scheduleInput, setScheduleInput] = useState("");
  const [classMeetings, setClassMeetings] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [checked, setChecked] = useState(false);

  const fetchPrayerTimes = useCallback(async () => {
    const cached = await readCache();
    if (isCacheForToday(cached)) {
      setPrayerTimes(cached.timings);
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
      console.error("SalahSync: prayer fetch failed", e);
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

  const handleCheck = () => {
    const { meetings, errors } = parseUcdScheduleInput(scheduleInput);
    setClassMeetings(meetings);
    setParseErrors(errors);
    setChecked(true);
  };

  return (
    <div className="ss-card">
      <div className="ss-header">
        <span className="ss-title">SalahSync</span>
        <span className="ss-subtitle">Prayer conflict checker · Islamic Center of Davis iqamah times</span>
        {cacheStatus === "stale" && <span className="ss-badge stale">Offline — cached times</span>}
        {cacheStatus === "error" && <span className="ss-badge error">Could not load prayer times</span>}
      </div>

      <div className="ss-body">
        <textarea
          className="ss-input"
          value={scheduleInput}
          onChange={(e) => setScheduleInput(e.target.value)}
          placeholder={"Paste your classes. Example:\nECS 122A A01 MWF 10:00 AM - 10:50 AM\nMAT 021A B01 TR 1:10 PM - 3:00 PM"}
        />
        <button className="ss-btn" onClick={handleCheck}>
          Check for Prayer Conflicts
        </button>
      </div>

      {parseErrors.length > 0 && (
        <div className="ss-alert error">{parseErrors[0]}</div>
      )}

      {checked && classMeetings.length > 0 && conflicts.length === 0 && (
        <div className="ss-alert ok">
          No prayer conflicts found for {classMeetings.length} class meeting(s).
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="ss-conflicts">
          {conflicts.map((c) => (
            <div key={c.id} className={`ss-conflict ${c.severity}`}>
              <div className="ss-conflict-main">
                <strong>{c.courseCode} {c.section}</strong>
                <span className="ss-days">({c.days.join("")})</span>
                <span className={`ss-badge ${c.severity}`}>{c.severity.toUpperCase()}</span>
              </div>
              <div className="ss-conflict-detail">
                {c.prayer} iqamah window &nbsp;·&nbsp; class: {c.classInterval}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
