import { useState, useEffect, useCallback, useMemo } from "react";
import "./PrayerTimes.css";
import { parseUcdScheduleInput } from "../parser/ucdScheduleParser";
import { detectPrayerConflicts } from "../conflicts/prayerConflictEngine";

// ── Cache helpers ────────────────────────────────────────────────────────────
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
  } catch {
    // storage failure is non-fatal
  }
}

function isCacheForToday(entry) {
  return entry?.date === new Date().toDateString() && !!entry?.timings;
}

// ── Fetch with exponential backoff ───────────────────────────────────────────
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

// ── Exact coordinates of the Islamic Center of Davis (539 Russell Blvd) ──────
const DAVIS_COORDS = {
  latitude: 38.5465,
  longitude: -121.7563,
  label: "Davis, CA",
};

// Verified iqamah offsets (minutes after athan) sourced from davismasjid.org
const IQAMAH_OFFSETS = {
  Fajr: 25,
  Dhuhr: 10,
  Asr: 10,
  Maghrib: 10,
  Isha: 20,
};

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

export default function PrayerTimes() {
  const [prayerTimes, setPrayerTimes] = useState({});
  // null = fresh | "stale" = offline fallback | "error" = no data
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
      console.error("fetchPrayerTimes failed after retries:", e);
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
    const refreshId = setInterval(fetchPrayerTimes, 6 * 60 * 60 * 1000);
    return () => clearInterval(refreshId);
  }, [fetchPrayerTimes]);

  const iqamahTimes = useMemo(() => computeIqamahTimes(prayerTimes), [prayerTimes]);

  const conflicts = useMemo(
    () =>
      detectPrayerConflicts(classMeetings, iqamahTimes, {
        windowMinutes: 20,
        bufferMinutes: 10,
      }),
    [classMeetings, iqamahTimes]
  );

  const handleParseSchedule = () => {
    const { meetings, errors } = parseUcdScheduleInput(scheduleInput);
    setClassMeetings(meetings);
    setParseErrors(errors);
  };

  return (
    <div className="PrayerTimes-Container">
      <div className="app-header">
        <span className="app-title">SalahSync</span>
        <span className="app-subtitle">UC Davis Prayer Conflict Checker</span>
      </div>

      <div className="schedule-panel">
        <div className="schedule-title">Paste Your Schedule</div>
        <textarea
          className="schedule-input"
          value={scheduleInput}
          onChange={(event) => setScheduleInput(event.target.value)}
          placeholder={
            "Paste schedule rows. Example:\nECS 122A A01 MWF 10:00 AM - 10:50 AM\nMAT 021A B01 TR 1:10 PM - 3:00 PM"
          }
        />
        <button className="schedule-parse-btn" onClick={handleParseSchedule}>
          Check for Conflicts
        </button>
        {parseErrors.length > 0 && <div className="parse-error">{parseErrors[0]}</div>}
        {classMeetings.length > 0 && (
          <div className="parse-success">Parsed {classMeetings.length} class meeting(s).</div>
        )}
      </div>

      <div className="conflict-panel">
        <div className="schedule-title">Prayer Conflict Check</div>
        {conflicts.length === 0 ? (
          <div className="no-conflicts">
            {classMeetings.length === 0
              ? "Paste your schedule above to check for conflicts."
              : "No conflicts detected with current prayer windows."}
          </div>
        ) : (
          conflicts.map((conflict) => (
            <div key={conflict.id} className={`conflict-row ${conflict.severity}`}>
              <div>
                {conflict.courseCode} {conflict.section} ({conflict.days.join("")})
              </div>
              <div>
                {conflict.prayer}: {conflict.classInterval}
              </div>
              <div className="conflict-severity">{conflict.severity.toUpperCase()}</div>
            </div>
          ))
        )}
      </div>

      <div className="date-location">
        <div className="santa-clara-ca">{DAVIS_COORDS.label}</div>
        {cacheStatus === "stale" && (
          <div className="cache-notice stale">Offline — showing cached times</div>
        )}
        {cacheStatus === "error" && (
          <div className="cache-notice error">Could not load prayer times</div>
        )}
      </div>
    </div>
  );
}
