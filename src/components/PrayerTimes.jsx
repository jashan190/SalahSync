// src/components/PrayerTimes.jsx
import React, { useState, useEffect, useCallback } from "react";
import "./PrayerTimes.css";
import { Bell,BellRing } from "lucide-react";
import { CircularProgressbar, buildStyles} from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';




export default function PrayerTimes() {
  // ─── State ──────────────────────────────────────────────────────────────
  const [prayerTimes, setPrayerTimes]     = useState({});
  const [currentPrayer, setCurrentPrayer] = useState(null);
  const [nextPrayer, setNextPrayer]       = useState(null);
  const [countdown, setCountdown]         = useState("");
  const [progress, setProgress]           = useState(0);
  const [location, setLocation]           = useState({});
  const [locationAccessGranted, setLocationAccessGranted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState({});
  const apiKey = import.meta.env.VITE_OPENCAGE_API_KEY;

  // ─── Helpers ────────────────────────────────────────────────────────────
  const filterPrayerTimes = timings =>
    Object.fromEntries(
      Object.entries(timings).filter(
        ([k]) => !["Midnight","Imsak","Firstthird","Lastthird","Sunset"].includes(k)
      )
    );

  const findCurrentPrayer = timings => {
    const now = new Date();
    const order = ["Fajr","Dhuhr","Asr","Maghrib","Isha"];
    let last = null;
    for (const name of order) {
      if (!timings[name]) continue;
      const dt = new Date(`${now.toDateString()} ${timings[name]}`);
      if (dt <= now) last = { name, time: dt };
      else break;
    }
    return last;
  };

  const findNextPrayer = timings => {
    const now = new Date();
    const order = ["Fajr","Dhuhr","Asr","Maghrib","Isha"];
    for (const name of order) {
      if (!timings[name]) continue;
      const dt = new Date(`${now.toDateString()} ${timings[name]}`);
      if (dt > now) return { name, time: dt };
    }
    // fallback to tomorrow’s Fajr at 05:55
    const nxt = new Date();
    nxt.setDate(nxt.getDate() + 1);
    nxt.setHours(5,55,0,0);
    return { name: "Fajr", time: nxt };
  };

  const updateCountdown = next => {
    if (!next?.time) return setCountdown("No upcoming prayer.");
    const diff = next.time - new Date();
    if (diff <= 0) return setCountdown("It's time to pray!");
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000)/60000);
    const s = Math.floor((diff % 60000)/1000);
    setCountdown(`${h}h ${m}m ${s}s`);
  };

  const reverseGeocode = async (lat, lon) => {
    try {
      const url = `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      const js = await res.json();
      const comp = js.results?.[0]?.components;
      if (!comp) throw new Error("no data");
      const city  = comp.city || comp.town || comp.village;
      const state = comp.state;
      return city && state ? `${city}, ${state}` : null;
    } catch {
      return null;
    }
  };

  // ─── Data fetching ──────────────────────────────────────────────────────
  const fetchPrayerTimes = useCallback(async (lat, lon) => {
    try {
      const res = await fetch(
        `https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lon}&method=2`
      );
      if (!res.ok) throw new Error(res.status);
      const { data } = await res.json();
      const times = filterPrayerTimes(data.timings);
      setPrayerTimes(times);

      const curr = findCurrentPrayer(times);
      const nxt  = findNextPrayer(times);
      setCurrentPrayer(curr);
      setNextPrayer(nxt);
      updateCountdown(nxt);

      // schedule countdown+progress updates
    } catch (e) {
      console.error("fetchPrayerTimes:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Geolocation & handlers ─────────────────────────────────────────────
  const requestGeolocation = () => {
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lon } = pos.coords;
        const locStr = await reverseGeocode(lat, lon);
        setLocation({ lat, lon, cityState: locStr });
        setLocationAccessGranted(true);
        fetchPrayerTimes(lat, lon);
      },
      () => {
        alert("Location denied");
        setLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  // Use your existing hanafiAsrTime function here:
  const hanafiAsrTime = () => {
    // e.g. re-fetch with hanafi-specific parameters
    const { lat, lon } = location;
    if (lat && lon) fetchPrayerTimes(lat, lon);
  };

  // ─── Effects ────────────────────────────────────────────────────────────
  // Chrome storage listener for external changes
  useEffect(() => {
    const listener = (changes, area) => {
      if (area==="local" && changes.prayerTimes) {
        const newTimes = changes.prayerTimes.newValue;
        setPrayerTimes(newTimes);
        const curr = findCurrentPrayer(newTimes);
        const nxt  = findNextPrayer(newTimes);
        setCurrentPrayer(curr);
        setNextPrayer(nxt);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  // countdown + progress ticker
  useEffect(() => {
    if (!nextPrayer || !currentPrayer) return;
    const id = setInterval(() => {
      updateCountdown(nextPrayer);
      const total = nextPrayer.time - currentPrayer.time;
      const elapsed = Date.now() - currentPrayer.time;
      setProgress(Math.max(0, Math.min(elapsed/total,1)));
    }, 1000);
    return () => clearInterval(id);
  }, [nextPrayer, currentPrayer]);

  const toggleNotification = name => {
  setNotifications(prev => ({ ...prev, [name]: !prev[name] }));
};

  // ─── Render ─────────────────────────────────────────────────────────────
  const fmt = dt =>
    dt.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});

  return (
    <div className="PrayerTimes-Container">
      {/* Top Bar */}
      <div className="frame">
        <div className="component-3">
        
          <div className="allow-location-access">
            <button onClick={requestGeolocation} disabled={loading}>
              {loading ? "Fetching..." : "Allow Location Access"}
            </button>
          </div>
        </div>
      </div>

      {/* Current Prayer & Progress */}
      <div className="current-salah-time-parent">
        <div className="current-salah-time">
          <b className="dhuhr">{currentPrayer?.name}</b>
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

      {/* Prayer List */}
      <div className="frame1">
        {Object.entries(prayerTimes).map(([name, time]) => {
          const isCurrent = name === currentPrayer?.name;
          const suffix    = name === "Dhuhr" ? "2" : name === "Sunrise" ? "1" : "";
          const isOn      = !!notifications[name];
          return (
            <div key={name} className={`baby ${isCurrent ? "font-bold" : ""}`}>
              <div className="fajr">{name}</div>
              <div className={`am${suffix}`}>{time}</div>
              <div className="track-shape" />
              <div className="notif-toggle" onClick={() => toggleNotification(name)}>
                {isOn ? <BellRing className="icon" /> : <Bell className="icon" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="date-location">
        <div className="wednesday-may-7">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month:   "long",
            day:     "numeric",
            year:    "numeric",
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
