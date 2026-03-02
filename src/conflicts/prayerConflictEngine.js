function toMinutes(time24) {
  if (!time24) return null;
  const match = String(time24).match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  return hh * 60 + mm;
}

export function buildPrayerWindows(prayerTimes, windowMinutes = 20) {
  const tracked = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
  return tracked
    .map((prayer) => {
      const start = toMinutes(prayerTimes[prayer]);
      if (start === null) return null;
      return {
        prayer,
        start,
        end: start + windowMinutes,
      };
    })
    .filter(Boolean);
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}

export function detectPrayerConflicts(
  classMeetings,
  prayerTimes,
  options = { windowMinutes: 20, bufferMinutes: 10 }
) {
  const { windowMinutes = 20, bufferMinutes = 10 } = options;
  const windows = buildPrayerWindows(prayerTimes, windowMinutes);
  const conflicts = [];

  classMeetings.forEach((meeting) => {
    const start = toMinutes(meeting.startTime);
    const end = toMinutes(meeting.endTime);
    if (start === null || end === null || end <= start) return;

    windows.forEach((window) => {
      const hard = overlaps(start, end, window.start, window.end);
      const soft =
        !hard &&
        overlaps(start - bufferMinutes, end + bufferMinutes, window.start, window.end);

      if (!hard && !soft) return;

      conflicts.push({
        id: `${meeting.id}-${window.prayer}`,
        courseCode: meeting.courseCode,
        section: meeting.section,
        days: meeting.days,
        classInterval: `${meeting.startTime}-${meeting.endTime}`,
        prayer: window.prayer,
        prayerWindow: `${String(Math.floor(window.start / 60)).padStart(2, "0")}:${String(
          window.start % 60
        ).padStart(2, "0")}-${String(Math.floor(window.end / 60)).padStart(2, "0")}:${String(
          window.end % 60
        ).padStart(2, "0")}`,
        severity: hard ? "hard" : "soft",
      });
    });
  });

  return conflicts;
}

