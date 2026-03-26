import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import "./PrayerTimes.css";
import { Bell, BellRing } from "lucide-react";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
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

// Apply iqamah offsets to athan times to get the times students must arrive by
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

export default function PrayerTimes() {
  const [prayerTimes, setPrayerTimes] = useState({});
  const [currentPrayer, setCurrentPrayer] = useState(null);
  const [nextPrayer, setNextPrayer] = useState(null);
  const [countdown, setCountdown] = useState("");
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  // null = fresh data | "stale" = offline fallback | "error" = no data at all
  const [cacheStatus, setCacheStatus] = useState(null);
  const [notifications, setNotifications] = useState({});
  const [scheduleInput, setScheduleInput] = useState("");
  const [classMeetings, setClassMeetings] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);

  const reminderTimersRef = useRef([]);
  const conflictReminderLogRef = useRef(new Set());

  const filterPrayerTimes = (timings) =>
    Object.fromEntries(
      Object.entries(timings).filter(
        ([k]) => !["Midnight", "Imsak", "Firstthird", "Lastthird", "Sunset"].includes(k)
      )
    );

  const findCurrentPrayer = (timings) => {
    const now = new Date();
    const order = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
    let last = null;

    for (const name of order) {
      if (!timings[name]) continue;
      const dt = new Date(`${now.toDateString()} ${timings[name]}`);
      if (dt <= now) last = { name, time: dt };
      else break;
    }

    return last;
  };

  const findNextPrayer = (timings) => {
    const now = new Date();
    const order = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

    for (const name of order) {
      if (!timings[name]) continue;
      const dt = new Date(`${now.toDateString()} ${timings[name]}`);
      if (dt > now) return { name, time: dt };
    }

    const nxt = new Date();
    nxt.setDate(nxt.getDate() + 1);
    nxt.setHours(5, 55, 0, 0);
    return { name: "Fajr", time: nxt };
  };

  const updateCountdown = (next) => {
    if (!next?.time) {
      setCountdown("No upcoming prayer.");
      return;
    }

    const diff = next.time - new Date();
    if (diff <= 0) {
      setCountdown("It's time to pray!");
      return;
    }

    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    setCountdown(`${h}h ${m}m ${s}s`);
  };

  const toDateForToday = (timeText) => {
    const normalized = String(timeText || "").match(/\d{1,2}:\d{2}/)?.[0];
    if (!normalized) return null;

    const [hh, mm] = normalized.split(":").map(Number);
    const date = new Date();
    date.setHours(hh, mm, 0, 0);
    return date;
  };

  const requestNotificationPermission = async () => {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;

    const result = await Notification.requestPermission();
    return result === "granted";
  };

  const sendReminderNotification = (title, message, id) => {
    if (globalThis.chrome?.notifications?.create) {
      globalThis.chrome.notifications.create(id, {
        type: "basic",
        iconUrl: "SalahSync 48x48.png",
        title,
        message,
      });
      return;
    }

    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body: message });
    }
  };

  const applyTimes = useCallback((times) => {
    setPrayerTimes(times);
    const curr = findCurrentPrayer(times);
    const nxt = findNextPrayer(times);
    setCurrentPrayer(curr);
    setNextPrayer(nxt);
    updateCountdown(nxt);
  }, []);

  const fetchPrayerTimes = useCallback(async () => {
    setLoading(true);

    // 1. Serve from cache if it's already today's data
    const cached = await readCache();
    if (isCacheForToday(cached)) {
      applyTimes(cached.timings);
      setCacheStatus(null);
      setLoading(false);
      return;
    }

    // 2. Fetch fresh data with retry/backoff
    try {
      const json = await fetchWithRetry(
        `https://api.aladhan.com/v1/timings?latitude=${DAVIS_COORDS.latitude}&longitude=${DAVIS_COORDS.longitude}&method=2`
      );
      const times = filterPrayerTimes(json.data.timings);
      await writeCache(times);
      applyTimes(times);
      setCacheStatus(null);
    } catch (e) {
      console.error("fetchPrayerTimes failed after retries:", e);
      // 3. Fall back to stale cache rather than showing nothing
      if (cached?.timings) {
        applyTimes(cached.timings);
        setCacheStatus("stale");
      } else {
        setCacheStatus("error");
      }
    } finally {
      setLoading(false);
    }
  }, [applyTimes]);

  // Use iqamah times (not athan) as conflict windows — students must arrive by iqamah
  const iqamahTimes = useMemo(() => computeIqamahTimes(prayerTimes), [prayerTimes]);

  const conflicts = useMemo(
    () =>
      detectPrayerConflicts(classMeetings, iqamahTimes, {
        windowMinutes: 20,
        bufferMinutes: 10,
      }),
    [classMeetings, iqamahTimes]
  );

  const weekdayCode = ["U", "M", "T", "W", "R", "F", "S"][new Date().getDay()];

  const handleParseSchedule = () => {
    const { meetings, errors } = parseUcdScheduleInput(scheduleInput);
    setClassMeetings(meetings);
    setParseErrors(errors);
  };

  const toggleNotification = async (name) => {
    const granted = await requestNotificationPermission();
    if (!granted) return;
    setNotifications((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const fmt = (dt) =>
    dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  useEffect(() => {
    fetchPrayerTimes();
    const refreshId = setInterval(fetchPrayerTimes, 6 * 60 * 60 * 1000);
    return () => clearInterval(refreshId);
  }, [fetchPrayerTimes]);

  useEffect(() => {
    if (!nextPrayer || !currentPrayer) return;

    const id = setInterval(() => {
      updateCountdown(nextPrayer);
      const total = nextPrayer.time - currentPrayer.time;
      const elapsed = Date.now() - currentPrayer.time;
      setProgress(Math.max(0, Math.min(elapsed / total, 1)));
    }, 1000);

    return () => clearInterval(id);
  }, [nextPrayer, currentPrayer]);

  useEffect(() => {
    reminderTimersRef.current.forEach((timer) => clearTimeout(timer));
    reminderTimersRef.current = [];

    Object.entries(notifications).forEach(([prayer, enabled]) => {
      if (!enabled || !prayerTimes[prayer]) return;

      const triggerAt = toDateForToday(prayerTimes[prayer]);
      if (!triggerAt) return;

      const waitMs = triggerAt.getTime() - Date.now();
      if (waitMs <= 0) return;

      const timerId = setTimeout(() => {
        sendReminderNotification(
          `Time for ${prayer}`,
          `Your ${prayer} prayer time has started in ${DAVIS_COORDS.label}.`,
          `prayer-${prayer}-${Date.now()}`
        );
      }, waitMs);

      reminderTimersRef.current.push(timerId);
    });

    return () => {
      reminderTimersRef.current.forEach((timer) => clearTimeout(timer));
      reminderTimersRef.current = [];
    };
  }, [notifications, prayerTimes]);

  useEffect(() => {
    if (!nextPrayer) return;

    const upcomingConflict = conflicts.find(
      (conflict) =>
        conflict.days.includes(weekdayCode) &&
        conflict.prayer === nextPrayer.name &&
        conflict.severity === "hard"
    );
    if (!upcomingConflict) return;

    const reminderKey = `${new Date().toDateString()}-${upcomingConflict.id}`;
    if (conflictReminderLogRef.current.has(reminderKey)) return;

    const msUntilNextPrayer = nextPrayer.time.getTime() - Date.now();
    if (msUntilNextPrayer <= 0 || msUntilNextPrayer > 45 * 60 * 1000) return;

    conflictReminderLogRef.current.add(reminderKey);
    sendReminderNotification(
      "Class vs Prayer Conflict",
      `${upcomingConflict.courseCode} ${upcomingConflict.section} may overlap ${upcomingConflict.prayer}.`,
      `conflict-${Date.now()}`
    );
  }, [conflicts, nextPrayer, weekdayCode]);

  return (
    <div className="PrayerTimes-Container">
      <div className="current-salah-time-parent">
        <div className="current-salah-time">
          <b className="dhuhr">{currentPrayer?.name || "--"}</b>
        </div>
        <div className="group-wrapper">
          <div className="group-container">
            <div className="progress-bar-parent" style={{ width: 100, height: 100 }}>
              <CircularProgressbar
                value={progress * 100}
                text={countdown}
                strokeWidth={8}
                styles={buildStyles({
                  pathColor: "#fff",
                  trailColor: "rgba(255,255,255,0.3)",
                  textColor: "#fff",
                  textSize: "10px",
                })}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="frame1">
        {Object.entries(prayerTimes).map(([name, time]) => {
          const isCurrent = name === currentPrayer?.name;
          const suffix = name === "Dhuhr" ? "2" : name === "Sunrise" ? "1" : "";
          const isOn = !!notifications[name];
          const formatted = fmt(new Date(`${new Date().toDateString()} ${time}`));
          const [timeStr, ampm] = formatted.split(" ");

          return (
            <div key={name} className={`baby ${isCurrent ? "font-bold" : ""}`}>
              <div className="fajr">{name}</div>
              <div className={`am${suffix}`}>
                <span className="time">{timeStr}</span>
                <span className="ampm">{ampm}</span>
              </div>
              <div className="track-shape" />
              <div
                className="notif-toggle"
                onClick={() => toggleNotification(name)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter") toggleNotification(name);
                }}
              >
                {isOn ? <BellRing className="icon" /> : <Bell className="icon" />}
              </div>
            </div>
          );
        })}
      </div>

      <div className="schedule-panel">
        <div className="schedule-title">UC Davis Schedule Parser</div>
        <textarea
          className="schedule-input"
          value={scheduleInput}
          onChange={(event) => setScheduleInput(event.target.value)}
          placeholder={
            "Paste schedule rows. Example:\nECS 122A A01 MWF 10:00 AM - 10:50 AM\nMAT 021A B01 TR 1:10 PM - 3:00 PM"
          }
        />
        <button className="schedule-parse-btn" onClick={handleParseSchedule}>
          Parse Schedule
        </button>
        {parseErrors.length > 0 && <div className="parse-error">{parseErrors[0]}</div>}
        {classMeetings.length > 0 && (
          <div className="parse-success">Parsed {classMeetings.length} class meeting(s).</div>
        )}
      </div>

      <div className="conflict-panel">
        <div className="schedule-title">Prayer Conflict Check</div>
        {conflicts.length === 0 ? (
          <div className="no-conflicts">No conflicts detected with current prayer windows.</div>
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
        <div className="wednesday-may-7">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </div>
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
