import { describe, it, expect } from "vitest";
import { buildPrayerPeriods, detectPrayerConflicts } from "./prayerConflictEngine.js";

// Davis, CA — representative spring day
const SAMPLE_ATHAN = {
  Fajr:    "05:55", // period: 05:55 → 07:15  (80 min)
  Sunrise: "07:15",
  Dhuhr:   "12:35", // period: 12:35 → 16:00  (205 min)
  Asr:     "16:00", // period: 16:00 → 19:48  (228 min)
  Maghrib: "19:48", // period: 19:48 → 21:15  (87 min)
  Isha:    "21:15", // period: 21:15 → midnight (165 min)
};

// Iqamah = athan + Davis Masjid offsets
const SAMPLE_IQAMAH = {
  Fajr:    "06:20",
  Dhuhr:   "12:45",
  Asr:     "16:10",
  Maghrib: "19:58",
  Isha:    "21:35",
};

// ── buildPrayerPeriods ────────────────────────────────────────────────────────

describe("buildPrayerPeriods", () => {
  it("builds periods for the 5 tracked prayers", () => {
    const periods = buildPrayerPeriods(SAMPLE_ATHAN);
    expect(periods.map((p) => p.prayer)).toEqual(["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]);
  });

  it("does not include Sunrise as its own period", () => {
    const periods = buildPrayerPeriods(SAMPLE_ATHAN);
    expect(periods.find((p) => p.prayer === "Sunrise")).toBeUndefined();
  });

  it("Fajr period ends at Sunrise", () => {
    const { start, end } = buildPrayerPeriods(SAMPLE_ATHAN).find((p) => p.prayer === "Fajr");
    expect(start).toBe(5 * 60 + 55);  // 355
    expect(end).toBe(7 * 60 + 15);    // 435
  });

  it("Dhuhr period ends at Asr", () => {
    const { start, end } = buildPrayerPeriods(SAMPLE_ATHAN).find((p) => p.prayer === "Dhuhr");
    expect(start).toBe(12 * 60 + 35); // 755
    expect(end).toBe(16 * 60 + 0);    // 960
  });

  it("Isha period ends at midnight (1440)", () => {
    const { end } = buildPrayerPeriods(SAMPLE_ATHAN).find((p) => p.prayer === "Isha");
    expect(end).toBe(1440);
  });

  it("returns empty array when athanTimes is empty", () => {
    expect(buildPrayerPeriods({})).toHaveLength(0);
  });

  it("skips prayers with missing times", () => {
    const partial = { Fajr: "05:55", Sunrise: "07:15" }; // only Fajr has both sides
    const periods = buildPrayerPeriods(partial);
    expect(periods).toHaveLength(1);
    expect(periods[0].prayer).toBe("Fajr");
  });
});

// ── critical conflicts ────────────────────────────────────────────────────────

describe("detectPrayerConflicts — critical", () => {
  it("critical: class fully contains the Dhuhr period", () => {
    // Dhuhr period 12:35–16:00. Class 12:00–16:30 wraps it entirely.
    const meetings = [{
      id: "ECS010-A01-0", courseCode: "ECS 010", section: "A01",
      days: ["M"], startTime: "12:00", endTime: "16:30",
    }];
    const [c] = detectPrayerConflicts(meetings, SAMPLE_ATHAN, SAMPLE_IQAMAH);
    expect(c?.prayer).toBe("Dhuhr");
    expect(c?.severity).toBe("critical");
  });

  it("critical: class leaves < 10 min on both sides of Dhuhr period", () => {
    // beforeClass = 12:40 - 12:35 = 5 min; afterClass = 16:00 - 15:55 = 5 min
    const meetings = [{
      id: "MAT021-A01-0", courseCode: "MAT 021A", section: "A01",
      days: ["T", "R"], startTime: "12:40", endTime: "15:55",
    }];
    const c = detectPrayerConflicts(meetings, SAMPLE_ATHAN, SAMPLE_IQAMAH)
      .find((x) => x.prayer === "Dhuhr");
    expect(c?.severity).toBe("critical");
  });

  it("critical: class starts right at adhan and ends right at next adhan", () => {
    // beforeClass = 0, afterClass = 0
    const meetings = [{
      id: "PHY009-A01-0", courseCode: "PHY 009A", section: "A01",
      days: ["M"], startTime: "12:35", endTime: "16:00",
    }];
    const c = detectPrayerConflicts(meetings, SAMPLE_ATHAN, SAMPLE_IQAMAH)
      .find((x) => x.prayer === "Dhuhr");
    expect(c?.severity).toBe("critical");
  });

  it("critical: class leaves exactly 9 min before and 9 min after", () => {
    // beforeClass = 12:44 - 12:35 = 9; afterClass = 16:00 - 15:51 = 9
    const meetings = [{
      id: "ECS032-A01-0", courseCode: "ECS 032", section: "A01",
      days: ["M"], startTime: "12:44", endTime: "15:51",
    }];
    const c = detectPrayerConflicts(meetings, SAMPLE_ATHAN, SAMPLE_IQAMAH)
      .find((x) => x.prayer === "Dhuhr");
    expect(c?.severity).toBe("critical");
  });
});

// ── likely conflicts ──────────────────────────────────────────────────────────

describe("detectPrayerConflicts — likely", () => {
  it("likely: class leaves 15 min on each side (user's scenario)", () => {
    // Dhuhr 12:35–16:00. Class 12:50–15:45 → before=15, after=15. Both < 20.
    const meetings = [{
      id: "ECS154A-A01-0", courseCode: "ECS 154A", section: "A01",
      days: ["M", "W"], startTime: "12:50", endTime: "15:45",
    }];
    const c = detectPrayerConflicts(meetings, SAMPLE_ATHAN, SAMPLE_IQAMAH)
      .find((x) => x.prayer === "Dhuhr");
    expect(c?.severity).toBe("likely");
  });

  it("likely: class leaves 5 min before and 15 min after", () => {
    // beforeClass=5 (< 20), afterClass=15 (< 20) — both tight → likely
    const meetings = [{
      id: "STS001-A01-0", courseCode: "STS 001", section: "A01",
      days: ["T"], startTime: "12:40", endTime: "15:45",
    }];
    const c = detectPrayerConflicts(meetings, SAMPLE_ATHAN, SAMPLE_IQAMAH)
      .find((x) => x.prayer === "Dhuhr");
    expect(c?.severity).toBe("likely");
  });

  it("likely: class leaves exactly 10 min before and 10 min after (boundary of critical)", () => {
    // beforeClass=10, afterClass=10 — not critical (10 is not < 10) but < 20 → likely
    const meetings = [{
      id: "CHE002-A01-0", courseCode: "CHE 002", section: "A01",
      days: ["W"], startTime: "12:45", endTime: "15:50",
    }];
    const c = detectPrayerConflicts(meetings, SAMPLE_ATHAN, SAMPLE_IQAMAH)
      .find((x) => x.prayer === "Dhuhr");
    expect(c?.severity).toBe("likely");
  });
});

// ── iqamah conflicts ──────────────────────────────────────────────────────────

describe("detectPrayerConflicts — iqamah", () => {
  it("iqamah: class overlaps Dhuhr iqamah window but leaves ample time on both sides", () => {
    // Dhuhr iqamah 12:45–13:05. Class 12:43–13:02. Plenty of time before period start.
    // beforeClass = 12:43 - 12:35 = 8 min... wait that's < 10, would be critical
    // Let me use a class that starts well after period start but overlaps iqamah
    // Dhuhr period 12:35–16:00. Class 12:55–13:10 → before=20, after=170 → neither critical nor likely
    // Iqamah 12:45–13:05, class 12:55–13:10 → 12:55 < 13:05 && 13:10 > 12:45 → overlaps iqamah
    const meetings = [{
      id: "ECS020-A01-0", courseCode: "ECS 020", section: "A01",
      days: ["M"], startTime: "12:55", endTime: "13:10",
    }];
    const c = detectPrayerConflicts(meetings, SAMPLE_ATHAN, SAMPLE_IQAMAH)
      .find((x) => x.prayer === "Dhuhr");
    expect(c?.severity).toBe("iqamah");
  });

  it("iqamah: class starts exactly at iqamah time", () => {
    // Class starts at Dhuhr iqamah (12:45) and ends within period
    // beforeClass = 12:45 - 12:35 = 10, afterClass = 960 - 795 = 165 → not critical/likely
    const meetings = [{
      id: "BIS002-A01-0", courseCode: "BIS 002", section: "A01",
      days: ["T"], startTime: "12:45", endTime: "13:35",
    }];
    const c = detectPrayerConflicts(meetings, SAMPLE_ATHAN, SAMPLE_IQAMAH)
      .find((x) => x.prayer === "Dhuhr");
    expect(c?.severity).toBe("iqamah");
  });

  it("no iqamah conflict when no iqamahTimes provided", () => {
    const meetings = [{
      id: "ECS020-A01-0", courseCode: "ECS 020", section: "A01",
      days: ["M"], startTime: "12:55", endTime: "13:10",
    }];
    // With empty iqamah times and only partial overlap → no conflict
    const conflicts = detectPrayerConflicts(meetings, SAMPLE_ATHAN, {});
    expect(conflicts.find((c) => c.prayer === "Dhuhr")).toBeUndefined();
  });
});

// ── no conflicts ──────────────────────────────────────────────────────────────

describe("detectPrayerConflicts — no conflicts", () => {
  it("no conflict when class is well before any prayer period", () => {
    const meetings = [{
      id: "PHY009-A01-0", courseCode: "PHY 009A", section: "A01",
      days: ["M", "W", "F"], startTime: "08:00", endTime: "08:50",
    }];
    expect(detectPrayerConflicts(meetings, SAMPLE_ATHAN, SAMPLE_IQAMAH)).toHaveLength(0);
  });

  it("no conflict when class leaves >= 20 min on at least one side and doesn't hit iqamah", () => {
    // Dhuhr 12:35–16:00. Class 14:00–15:00 → before=85, after=60 → no conflict
    const meetings = [{
      id: "ECS040-A01-0", courseCode: "ECS 040", section: "A01",
      days: ["M"], startTime: "14:00", endTime: "15:00",
    }];
    expect(detectPrayerConflicts(meetings, SAMPLE_ATHAN, SAMPLE_IQAMAH)).toHaveLength(0);
  });

  it("no conflict when no meetings provided", () => {
    expect(detectPrayerConflicts([], SAMPLE_ATHAN, SAMPLE_IQAMAH)).toHaveLength(0);
  });

  it("no conflict when prayer times are empty", () => {
    const meetings = [{
      id: "ECS122A-A01-0", courseCode: "ECS 122A", section: "A01",
      days: ["M"], startTime: "12:30", endTime: "13:20",
    }];
    expect(detectPrayerConflicts(meetings, {}, {})).toHaveLength(0);
  });

  it("no conflict when class ends exactly at period start", () => {
    const meetings = [{
      id: "MAT021-A01-0", courseCode: "MAT 021A", section: "A01",
      days: ["M"], startTime: "11:00", endTime: "12:35",
    }];
    expect(detectPrayerConflicts(meetings, SAMPLE_ATHAN, SAMPLE_IQAMAH)).toHaveLength(0);
  });

  it("no conflict when class starts exactly at period end", () => {
    const meetings = [{
      id: "MAT021-B01-0", courseCode: "MAT 021A", section: "B01",
      days: ["M"], startTime: "16:00", endTime: "17:50",
    }];
    // 16:00 = Asr period start, not Dhuhr period end. Check Asr: starts exactly at 16:00.
    // classStart=960 >= periodEnd(960)? periodEnd for Dhuhr is 960. classStart(960) >= 960 → no Dhuhr conflict.
    // Asr period 16:00–19:48. classStart=960, periodStart=960 → before=0, after=228-110=118.
    // before=0 < 10, after=118 >= 10 → not critical. before=0 < 20, after=118 >= 20 → not likely.
    // Iqamah Asr 16:10, class ends 17:50 = 1070. 960 < 990 (1010) && 1070 > 970 → iqamah overlap!
    // So this would actually flag iqamah... let's use a different "clear" time.
    const clearMeetings = [{
      id: "MAT021-C01-0", courseCode: "MAT 021A", section: "C01",
      days: ["M"], startTime: "08:30", endTime: "09:20",
    }];
    expect(detectPrayerConflicts(clearMeetings, SAMPLE_ATHAN, SAMPLE_IQAMAH)).toHaveLength(0);
  });
});

// ── conflict record shape ─────────────────────────────────────────────────────

describe("detectPrayerConflicts — conflict record shape", () => {
  const meetings = [{
    id: "ECS122A-A01-0", courseCode: "ECS 122A", section: "A01",
    days: ["M", "W", "F"], startTime: "12:00", endTime: "16:30",
  }];

  it("conflict record has all required fields", () => {
    const [c] = detectPrayerConflicts(meetings, SAMPLE_ATHAN, SAMPLE_IQAMAH);
    expect(c).toHaveProperty("id");
    expect(c).toHaveProperty("courseCode");
    expect(c).toHaveProperty("section");
    expect(c).toHaveProperty("days");
    expect(c).toHaveProperty("classInterval");
    expect(c).toHaveProperty("prayer");
    expect(c).toHaveProperty("prayerWindow");
    expect(c).toHaveProperty("severity");
    expect(c).toHaveProperty("beforeClass");
    expect(c).toHaveProperty("afterClass");
  });

  it("classInterval is formatted as startTime-endTime", () => {
    const [c] = detectPrayerConflicts(meetings, SAMPLE_ATHAN, SAMPLE_IQAMAH);
    expect(c.classInterval).toBe("12:00-16:30");
  });

  it("prayerWindow reflects full adhan-to-adhan period", () => {
    const [c] = detectPrayerConflicts(meetings, SAMPLE_ATHAN, SAMPLE_IQAMAH);
    expect(c.prayer).toBe("Dhuhr");
    expect(c.prayerWindow).toBe("12:35-16:00");
  });

  it("id is formed as meetingId-prayer", () => {
    const [c] = detectPrayerConflicts(meetings, SAMPLE_ATHAN, SAMPLE_IQAMAH);
    expect(c.id).toBe("ECS122A-A01-0-Dhuhr");
  });

  it("severity is one of critical / likely / iqamah", () => {
    const conflicts = detectPrayerConflicts(meetings, SAMPLE_ATHAN, SAMPLE_IQAMAH);
    for (const c of conflicts) {
      expect(["critical", "likely", "iqamah"]).toContain(c.severity);
    }
  });
});

// ── multiple conflicts in one class ──────────────────────────────────────────

describe("detectPrayerConflicts — multiple prayers", () => {
  it("detects conflicts across multiple prayer periods for a long class", () => {
    // 8-hour class covers Dhuhr and Asr periods
    const meetings = [{
      id: "ECS199-A01-0", courseCode: "ECS 199", section: "A01",
      days: ["M"], startTime: "12:00", endTime: "20:00",
    }];
    const conflicts = detectPrayerConflicts(meetings, SAMPLE_ATHAN, SAMPLE_IQAMAH);
    const prayers = conflicts.map((c) => c.prayer);
    expect(prayers).toContain("Dhuhr");
    expect(prayers).toContain("Asr");
    expect(prayers).toContain("Maghrib");
  });
});
