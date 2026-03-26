function toMinutes(time24) {
  if (!time24) return null;
  const match = String(time24).match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function fromMinutes(totalMin) {
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Minutes of free prayer time required on each side before flagging
const MIN_PRAY_MINUTES = 10;      // critical: can't reasonably pray on either side
const COMFORTABLE_MINUTES = 20;   // likely:   tight window on both sides
const IQAMAH_DURATION = 20;       // iqamah prayer takes ~20 min

// Fajr ends at Sunrise; each other prayer ends at the next adhan; Isha ends at midnight.
const PERIOD_END_ANCHOR = {
  Fajr: "Sunrise",
  Dhuhr: "Asr",
  Asr: "Maghrib",
  Maghrib: "Isha",
  Isha: null,
};

const PRAYER_ORDER = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

/**
 * Build adhan-to-adhan prayer periods from a full timings object.
 * athanTimes must include Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha.
 * Returns [{ prayer, start, end }] in minutes from midnight.
 */
export function buildPrayerPeriods(athanTimes) {
  return PRAYER_ORDER.map((prayer) => {
    const start = toMinutes(athanTimes[prayer]);
    if (start === null) return null;

    const anchor = PERIOD_END_ANCHOR[prayer];
    const end = anchor !== null ? toMinutes(athanTimes[anchor]) : 1440;
    if (end === null) return null;

    return { prayer, start, end };
  }).filter(Boolean);
}

/**
 * Detect prayer conflicts for a list of class meetings.
 *
 * Severity levels:
 *   critical — class leaves < 10 min on BOTH sides of the full adhan-to-adhan window.
 *              You almost certainly cannot pray at all during this time slot.
 *   likely   — class leaves < 20 min on BOTH sides. Technically possible but very tight;
 *              you will likely miss prayer or have to rush.
 *   iqamah   — class overlaps the iqamah window at the Islamic Center of Davis.
 *              You will miss congregational prayer even if you can pray individually.
 *
 * @param {Array}  classMeetings  Parsed meeting objects with startTime/endTime (HH:MM 24h).
 * @param {Object} athanTimes     Full timings map including Sunrise (from Aladhan API).
 * @param {Object} iqamahTimes    Iqamah times keyed by prayer name (HH:MM 24h).
 */
export function detectPrayerConflicts(classMeetings, athanTimes, iqamahTimes = {}) {
  const periods = buildPrayerPeriods(athanTimes);
  const conflicts = [];

  classMeetings.forEach((meeting) => {
    const classStart = toMinutes(meeting.startTime);
    const classEnd = toMinutes(meeting.endTime);
    if (classStart === null || classEnd === null || classEnd <= classStart) return;

    periods.forEach(({ prayer, start: periodStart, end: periodEnd }) => {
      // No overlap with this prayer period
      if (classStart >= periodEnd || classEnd <= periodStart) return;

      // How much of the prayer period falls before/after the class
      const beforeClass = Math.max(0, classStart - periodStart);
      const afterClass = Math.max(0, periodEnd - classEnd);

      let severity;

      if (beforeClass < MIN_PRAY_MINUTES && afterClass < MIN_PRAY_MINUTES) {
        severity = "critical";
      } else if (beforeClass < COMFORTABLE_MINUTES && afterClass < COMFORTABLE_MINUTES) {
        severity = "likely";
      } else {
        // Check whether the class overlaps the iqamah window specifically
        const iqamahStart = toMinutes(iqamahTimes[prayer]);
        if (iqamahStart !== null) {
          const iqamahEnd = iqamahStart + IQAMAH_DURATION;
          if (classStart < iqamahEnd && classEnd > iqamahStart) {
            severity = "iqamah";
          }
        }
      }

      if (!severity) return;

      conflicts.push({
        id: `${meeting.id}-${prayer}`,
        courseCode: meeting.courseCode,
        section: meeting.section,
        days: meeting.days,
        classInterval: `${meeting.startTime}-${meeting.endTime}`,
        prayer,
        prayerWindow: `${fromMinutes(periodStart)}-${fromMinutes(periodEnd)}`,
        severity,
        beforeClass,
        afterClass,
      });
    });
  });

  return conflicts;
}
