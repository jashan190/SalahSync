import { detectPrayerConflicts } from "../conflicts/prayerConflictEngine";

const DAVIS_COORDS = { latitude: 38.5465, longitude: -121.7563 };
const IQAMAH_OFFSETS = { Fajr: 25, Dhuhr: 10, Asr: 10, Maghrib: 10, Isha: 20 };
const QUARTER_CACHE_KEY = "salahsync_quarter_cache";
const EXCLUDE_KEYS = ["Midnight", "Imsak", "Firstthird", "Lastthird", "Sunset"];

// ── UC Davis quarter date ranges ───────────────────────────────────────────────
export function getUCDavisQuarter(today = new Date()) {
  const y = today.getFullYear();
  const m = today.getMonth() + 1; // 1-indexed
  const d = today.getDate();

  if (m >= 9 && m <= 12)
    return { name: `Fall ${y}`,   start: new Date(y, 8, 22),  end: new Date(y, 11, 12) };
  if (m === 1 || m === 2 || (m === 3 && d <= 21))
    return { name: `Winter ${y}`, start: new Date(y, 0, 6),   end: new Date(y, 2, 21) };
  if ((m === 3 && d >= 28) || m === 4 || m === 5 || (m === 6 && d <= 12))
    return { name: `Spring ${y}`, start: new Date(y, 2, 30),  end: new Date(y, 5, 12) };

  // Between quarters — cover next 10 weeks
  const start = new Date(today);
  const end = new Date(today);
  end.setDate(end.getDate() + 70);
  return { name: "Next 10 weeks", start, end };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function stripTz(timeStr) {
  // "05:30 (PDT)" → "05:30"
  return String(timeStr).replace(/\s*\(.*\)/, "").trim();
}

function filterTimings(raw) {
  return Object.fromEntries(
    Object.entries(raw)
      .filter(([k]) => !EXCLUDE_KEYS.includes(k))
      .map(([k, v]) => [k, stripTz(v)])
  );
}

function computeIqamah(timings) {
  const result = {};
  for (const [prayer, offset] of Object.entries(IQAMAH_OFFSETS)) {
    const match = String(timings[prayer] ?? "").match(/(\d{1,2}):(\d{2})/);
    if (!match) continue;
    const total = Number(match[1]) * 60 + Number(match[2]) + offset;
    result[prayer] = `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }
  return result;
}

// ── Cache ──────────────────────────────────────────────────────────────────────
async function readQuarterCache(quarterName) {
  try {
    if (globalThis.chrome?.storage?.local) {
      return new Promise((resolve) =>
        chrome.storage.local.get(QUARTER_CACHE_KEY, (r) => {
          const e = r[QUARTER_CACHE_KEY];
          resolve(e?.quarter === quarterName ? e.days : null);
        })
      );
    }
    const raw = localStorage.getItem(QUARTER_CACHE_KEY);
    if (!raw) return null;
    const e = JSON.parse(raw);
    return e?.quarter === quarterName ? e.days : null;
  } catch {
    return null;
  }
}

async function writeQuarterCache(quarterName, days) {
  const entry = { quarter: quarterName, days };
  try {
    if (globalThis.chrome?.storage?.local) {
      chrome.storage.local.set({ [QUARTER_CACHE_KEY]: entry });
    } else {
      localStorage.setItem(QUARTER_CACHE_KEY, JSON.stringify(entry));
    }
  } catch {}
}

// ── Fetch ──────────────────────────────────────────────────────────────────────
async function fetchMonthCalendar(year, month) {
  const url =
    `https://api.aladhan.com/v1/calendar/${year}/${month}` +
    `?latitude=${DAVIS_COORDS.latitude}&longitude=${DAVIS_COORDS.longitude}&method=2`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.data; // array of day objects
}

/**
 * Fetches and caches prayer times for every day in the current UC Davis quarter.
 * Returns { quarterName, days } where days is an array of { dateStr, timings, iqamah }.
 */
export async function fetchQuarterCalendar() {
  const quarter = getUCDavisQuarter();

  const cached = await readQuarterCache(quarter.name);
  if (cached) return { quarterName: quarter.name, days: cached };

  // Collect all year-month pairs within the quarter date range
  const months = [];
  const cursor = new Date(quarter.start);
  cursor.setDate(1);
  while (cursor <= quarter.end) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  // Fetch all months concurrently
  const monthData = await Promise.all(
    months.map(({ year, month }) => fetchMonthCalendar(year, month))
  );

  const startTs = quarter.start.getTime();
  const endTs = quarter.end.getTime();
  const days = [];

  for (const monthDays of monthData) {
    for (const dayObj of monthDays) {
      // aladhan gregorian date format: "DD-MM-YYYY"
      const [dd, mm, yyyy] = dayObj.date.gregorian.date.split("-").map(Number);
      const date = new Date(yyyy, mm - 1, dd);
      if (date.getTime() < startTs || date.getTime() > endTs) continue;

      const dateStr = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
      const timings = filterTimings(dayObj.timings);
      days.push({ dateStr, timings, iqamah: computeIqamah(timings) });
    }
  }

  await writeQuarterCache(quarter.name, days);
  return { quarterName: quarter.name, days };
}

// ── Quarter-wide conflict detection ───────────────────────────────────────────
const SEVERITY_RANK = { critical: 3, likely: 2, iqamah: 1 };

/**
 * Runs conflict detection across every day in the quarter.
 * Returns the worst-severity conflict per (meeting × prayer) pair,
 * annotated with the date on which that worst case occurs.
 */
export function detectQuarterConflicts(classMeetings, quarterDays) {
  const worstMap = new Map();

  for (const { dateStr, timings, iqamah } of quarterDays) {
    const dayConflicts = detectPrayerConflicts(classMeetings, timings, iqamah);
    for (const conflict of dayConflicts) {
      const existing = worstMap.get(conflict.id);
      const rank = SEVERITY_RANK[conflict.severity] ?? 0;
      if (!existing || rank > (SEVERITY_RANK[existing.severity] ?? 0)) {
        worstMap.set(conflict.id, { ...conflict, worstDate: dateStr });
      }
    }
  }

  return Array.from(worstMap.values());
}
