import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { scanPageForClasses, expandCourseDetails } from "./pageParser";
import { fetchQuarterCalendar, detectQuarterConflicts, getUCDavisQuarter } from "./quarterCalendar";

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


// ── Component ─────────────────────────────────────────────────────────────────
export default function Panel() {
  const [quarterDays, setQuarterDays] = useState([]);
  const [quarterName, setQuarterName] = useState(() => getUCDavisQuarter().name);
  const [cacheStatus, setCacheStatus] = useState(null);
  const [classMeetings, setClassMeetings] = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const scanTimerRef = useRef(null);

  // ── Quarter prayer calendar ──────────────────────────────────────────────────
  useEffect(() => {
    fetchQuarterCalendar()
      .then(({ quarterName: name, days }) => {
        setQuarterName(name);
        setQuarterDays(days);
        setCacheStatus(null);
      })
      .catch((e) => {
        console.error("SalahSync: quarter calendar fetch failed", e);
        setCacheStatus("error");
      });
  }, []);

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

  // ── Conflict detection (quarter-wide) ───────────────────────────────────────
  const conflicts = useMemo(
    () => detectQuarterConflicts(classMeetings, quarterDays),
    [classMeetings, quarterDays]
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={`ss-card${collapsed ? " ss-collapsed" : ""}`}>
      <div className="ss-header">
        <span className="ss-title">SalahSync</span>
        <span className="ss-subtitle">
          {quarterName} · ICD iqamah times
          {quarterDays.length > 0 && ` · ${quarterDays.length}-day check`}
        </span>
        {cacheStatus === "error" && <span className="ss-badge error">Could not load prayer times</span>}
        <button
          className="ss-toggle"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand SalahSync" : "Collapse SalahSync"}
        >
          {collapsed ? "▾" : "▴"}
        </button>
      </div>

      {!collapsed && (
        classMeetings.length === 0 ? (
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
                  {c.worstDate && <span className="ss-worst-date"> · worst: {c.worstDate}</span>}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
