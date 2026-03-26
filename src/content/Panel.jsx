import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { detectPrayerConflicts } from "../conflicts/prayerConflictEngine";
import { scanPageForClasses, expandCourseDetails } from "./pageParser";

// ── Helpers ───────────────────────────────────────────────────────────────────
function to12h(time24) {
  const m = String(time24).match(/(\d{1,2}):(\d{2})/);
  if (!m) return time24;
  let h = Number(m[1]);
  const min = m[2];
  const ampm = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${min} ${ampm}`;
}

function formatInterval(interval) {
  const [start, end] = interval.split("-");
  return `${to12h(start)} – ${to12h(end)}`;
}

// ── Cache helpers ─────────────────────────────────────────────────────────────
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
  const [classMeetings, setClassMeetings] = useState([]);
  const scanTimerRef = useRef(null);

  // ── Prayer times ────────────────────────────────────────────────────────────
  const fetchPrayerTimes = useCallback(async () => {
    const cached = await readCache();
    if (isCacheForToday(cached)) { setPrayerTimes(cached.timings); return; }
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
      if (cached?.timings) { setPrayerTimes(cached.timings); setCacheStatus("stale"); }
      else setCacheStatus("error");
    }
  }, []);

  useEffect(() => {
    fetchPrayerTimes();
    const id = setInterval(fetchPrayerTimes, 6 * 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchPrayerTimes]);

  // ── Page scanner ────────────────────────────────────────────────────────────
  const runScan = useCallback(() => {
    const meetings = scanPageForClasses();
    setClassMeetings(meetings);
  }, []);

  useEffect(() => {
    // Expand all collapsed course detail sections, then scan.
    // Called on mount and whenever the DOM changes (e.g. user adds a course).
    const expandAndScan = () => {
      expandCourseDetails();
      // Delay scan so the expansion DOM updates can settle first
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = setTimeout(runScan, 800);
    };

    // Initial expand + scan after SPA finishes rendering
    const initTimer = setTimeout(expandAndScan, 800);

    // Re-expand + re-scan whenever Schedule Builder DOM changes
    const observer = new MutationObserver(() => {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = setTimeout(expandAndScan, 600);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      clearTimeout(scanTimerRef.current);
      clearTimeout(initTimer);
    };
  }, [runScan]);

  // ── Conflict detection ──────────────────────────────────────────────────────
  const iqamahTimes = useMemo(() => computeIqamahTimes(prayerTimes), [prayerTimes]);

  const conflicts = useMemo(
    () => detectPrayerConflicts(classMeetings, prayerTimes, iqamahTimes),
    [classMeetings, prayerTimes, iqamahTimes]
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="ss-card">
      <div className="ss-header">
        <span className="ss-title">SalahSync</span>
        <span className="ss-subtitle">
          Prayer conflict checker · Islamic Center of Davis iqamah times
          {classMeetings.length > 0 && ` · ${classMeetings.length} class(es) detected`}
        </span>
        {cacheStatus === "stale" && <span className="ss-badge stale">Offline — cached times</span>}
        {cacheStatus === "error" && <span className="ss-badge error">Could not load prayer times</span>}
      </div>

      {classMeetings.length === 0 ? (
        <div className="ss-alert info">
          Add classes to your schedule — SalahSync will automatically check for prayer conflicts.
        </div>
      ) : conflicts.length === 0 ? (
        <div className="ss-alert ok">
          No prayer conflicts found for your {classMeetings.length} class meeting(s).
        </div>
      ) : (
        <div className="ss-conflicts">
          {conflicts.map((c) => (
            <div key={c.id} className={`ss-conflict ${c.severity}`}>
              <div className="ss-conflict-main">
                <strong>{c.courseCode} {c.section}</strong>
                <span className="ss-days">({c.days.join("")})</span>
                <span className={`ss-badge ${c.severity}`}>
                  {c.severity === "critical" ? "CRITICAL" : c.severity === "likely" ? "LIKELY MISS" : "IQAMAH"}
                </span>
              </div>
              <div className="ss-conflict-detail">
                {c.severity === "critical" && `${c.prayer} period blocked · ${c.beforeClass}m before / ${c.afterClass}m after`}
                {c.severity === "likely"   && `${c.prayer} window tight · ${c.beforeClass}m before / ${c.afterClass}m after`}
                {c.severity === "iqamah"   && `Misses ${c.prayer} iqamah at Islamic Center of Davis`}
                &nbsp;·&nbsp; {formatInterval(c.classInterval)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
