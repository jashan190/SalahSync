import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import SalahSyncLocationAccessPage from "./SalahSyncLocationAccess.jsx";
import "./PrayerTimes.css";
import { Bell, BellRing } from "lucide-react";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { parseUcdScheduleInput } from "../parser/ucdScheduleParser";
import { detectPrayerConflicts } from "../conflicts/prayerConflictEngine";

export default function PrayerTimes() {
  const [prayerTimes, setPrayerTimes] = useState({});
  const [currentPrayer, setCurrentPrayer] = useState(null);
  const [nextPrayer, setNextPrayer] = useState(null);
  const [countdown, setCountdown] = useState("");
  const [progress, setProgress] = useState(0);
  const [location, setLocation] = useState({});
  const [locationAccessGranted, setLocationAccessGranted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState({});
  const [showLanding, setShowLanding] = useState(true);
  const [scheduleInput, setScheduleInput] = useState("");
  const [classMeetings, setClassMeetings] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);

  const apiKey = import.meta.env.VITE_OPENCAGE_API_KEY;
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

  const reverseGeocode = async (lat, lon) => {
    try {
      const res = await fetch(
        `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${apiKey}`
      );
      if (!res.ok) throw new Error(String(res.status));
      const js = await res.json();
      const comp = js.results?.[0]?.components;
      if (!comp) throw new Error("no data");
      const city = comp.city || comp.town || comp.village;
      const state = comp.state;
      return city && state ? `${city}, ${state}` : null;
    } catch {
      return null;
    }
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

  const fetchPrayerTimes = useCallback(async (lat, lon) => {
    try {
      const res = await fetch(
        `https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lon}&method=2`
      );
      if (!res.ok) throw new Error(String(res.status));
      const { data } = await res.json();
      const times = filterPrayerTimes(data.timings);
      setPrayerTimes(times);

      const curr = findCurrentPrayer(times);
      const nxt = findNextPrayer(times);
      setCurrentPrayer(curr);
      setNextPrayer(nxt);
      updateCountdown(nxt);
    } catch (e) {
      console.error("fetchPrayerTimes:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const conflicts = useMemo(
    () =>
      detectPrayerConflicts(classMeetings, prayerTimes, {
        windowMinutes: 20,
        bufferMinutes: 10,
      }),
    [classMeetings, prayerTimes]
  );

  const weekdayCode = ["U", "M", "T", "W", "R", "F", "S"][new Date().getDay()];

  const requestGeolocation = () => {
    setLoading(true);
    setShowLanding(false);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        const locStr = await reverseGeocode(lat, lon);
        setLocation({ lat, lon, cityState: locStr });
        setLocationAccessGranted(true);
        fetchPrayerTimes(lat, lon);
      },
      () => {
        alert("Location denied");
        setLoading(false);
        setShowLanding(true);
      },
      { enableHighAccuracy: true }
    );
  };

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
          `Your ${prayer} prayer time has started.`,
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

  if (showLanding) {
    return <SalahSyncLocationAccessPage onRequestLocation={requestGeolocation} loading={loading} />;
  }

  return (
    <div className="PrayerTimes-Container">
      <div className="frame">
        <div className="allow-location-access">
          <button onClick={requestGeolocation} disabled={loading}>
            {loading ? "Fetching..." : "Allow Location Access"}
          </button>
        </div>
      </div>

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
        <div className="santa-clara-ca">
          {location.cityState ||
            (locationAccessGranted
              ? `${location.lat.toFixed(2)}, ${location.lon.toFixed(2)}`
              : "Unknown location")}
        </div>
      </div>
    </div>
  );
}
