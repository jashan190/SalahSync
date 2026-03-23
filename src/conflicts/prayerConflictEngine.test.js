import { describe, it, expect } from "vitest";
import { buildPrayerWindows, detectPrayerConflicts } from "./prayerConflictEngine.js";

const SAMPLE_PRAYER_TIMES = {
  Fajr: "05:55",
  Sunrise: "07:15",
  Dhuhr: "12:35",
  Asr: "16:00",
  Maghrib: "19:48",
  Isha: "21:15",
};

describe("buildPrayerWindows", () => {
  it("builds windows for the 5 tracked prayers", () => {
    const windows = buildPrayerWindows(SAMPLE_PRAYER_TIMES);
    const prayers = windows.map((w) => w.prayer);
    expect(prayers).toEqual(["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]);
  });

  it("does not include Sunrise in windows", () => {
    const windows = buildPrayerWindows(SAMPLE_PRAYER_TIMES);
    expect(windows.find((w) => w.prayer === "Sunrise")).toBeUndefined();
  });

  it("uses default 20-minute window", () => {
    const windows = buildPrayerWindows(SAMPLE_PRAYER_TIMES);
    const dhuhr = windows.find((w) => w.prayer === "Dhuhr");
    expect(dhuhr.end - dhuhr.start).toBe(20);
  });

  it("uses custom window size", () => {
    const windows = buildPrayerWindows(SAMPLE_PRAYER_TIMES, 30);
    windows.forEach((w) => expect(w.end - w.start).toBe(30));
  });

  it("computes start times in minutes from midnight", () => {
    const windows = buildPrayerWindows(SAMPLE_PRAYER_TIMES);
    const fajr = windows.find((w) => w.prayer === "Fajr");
    expect(fajr.start).toBe(5 * 60 + 55); // 355
  });

  it("returns empty array when prayerTimes is empty", () => {
    expect(buildPrayerWindows({})).toHaveLength(0);
  });
});

describe("detectPrayerConflicts — hard conflicts", () => {
  it("detects a hard conflict when class overlaps Dhuhr window", () => {
    const meetings = [
      { id: "ECS122A-A01-0", courseCode: "ECS 122A", section: "A01", days: ["M", "W", "F"], startTime: "12:30", endTime: "13:20" },
    ];
    const conflicts = detectPrayerConflicts(meetings, SAMPLE_PRAYER_TIMES);
    const dhuhrConflict = conflicts.find((c) => c.prayer === "Dhuhr");
    expect(dhuhrConflict).toBeDefined();
    expect(dhuhrConflict.severity).toBe("hard");
  });

  it("detects a hard conflict when class fully contains prayer window", () => {
    const meetings = [
      { id: "ECS010-A01-0", courseCode: "ECS 010", section: "A01", days: ["M"], startTime: "12:00", endTime: "14:00" },
    ];
    const conflicts = detectPrayerConflicts(meetings, SAMPLE_PRAYER_TIMES);
    expect(conflicts.find((c) => c.prayer === "Dhuhr" && c.severity === "hard")).toBeDefined();
  });

  it("detects hard conflict with Asr", () => {
    const meetings = [
      { id: "MAT021-A01-0", courseCode: "MAT 021A", section: "A01", days: ["T", "R"], startTime: "16:00", endTime: "17:50" },
    ];
    const conflicts = detectPrayerConflicts(meetings, SAMPLE_PRAYER_TIMES);
    expect(conflicts.find((c) => c.prayer === "Asr" && c.severity === "hard")).toBeDefined();
  });
});

describe("detectPrayerConflicts — soft conflicts", () => {
  it("detects a soft conflict when class ends just before prayer window", () => {
    // Dhuhr window: 12:35–12:55. Class ends at 12:30 → within 10-min buffer
    const meetings = [
      { id: "ECS122A-A01-0", courseCode: "ECS 122A", section: "A01", days: ["M"], startTime: "11:00", endTime: "12:30" },
    ];
    const conflicts = detectPrayerConflicts(meetings, SAMPLE_PRAYER_TIMES, { windowMinutes: 20, bufferMinutes: 10 });
    const soft = conflicts.find((c) => c.prayer === "Dhuhr" && c.severity === "soft");
    expect(soft).toBeDefined();
  });

  it("detects a soft conflict when class starts just after prayer window", () => {
    // Dhuhr window: 12:35–12:55. Class starts at 13:00 → within 10-min buffer
    const meetings = [
      { id: "MAT021-B01-0", courseCode: "MAT 021A", section: "B01", days: ["T"], startTime: "13:00", endTime: "14:50" },
    ];
    const conflicts = detectPrayerConflicts(meetings, SAMPLE_PRAYER_TIMES, { windowMinutes: 20, bufferMinutes: 10 });
    const soft = conflicts.find((c) => c.prayer === "Dhuhr" && c.severity === "soft");
    expect(soft).toBeDefined();
  });
});

describe("detectPrayerConflicts — no conflicts", () => {
  it("returns empty array when class is well clear of all prayers", () => {
    const meetings = [
      { id: "PHY009-A01-0", courseCode: "PHY 009A", section: "A01", days: ["M", "W", "F"], startTime: "08:00", endTime: "08:50" },
    ];
    const conflicts = detectPrayerConflicts(meetings, SAMPLE_PRAYER_TIMES);
    expect(conflicts).toHaveLength(0);
  });

  it("returns empty array when no meetings provided", () => {
    expect(detectPrayerConflicts([], SAMPLE_PRAYER_TIMES)).toHaveLength(0);
  });

  it("returns empty array when prayer times are empty", () => {
    const meetings = [
      { id: "ECS122A-A01-0", courseCode: "ECS 122A", section: "A01", days: ["M"], startTime: "12:30", endTime: "13:20" },
    ];
    expect(detectPrayerConflicts(meetings, {})).toHaveLength(0);
  });
});

describe("detectPrayerConflicts — conflict record shape", () => {
  it("includes expected fields in each conflict", () => {
    const meetings = [
      { id: "ECS122A-A01-0", courseCode: "ECS 122A", section: "A01", days: ["M", "W", "F"], startTime: "12:30", endTime: "13:20" },
    ];
    const [conflict] = detectPrayerConflicts(meetings, SAMPLE_PRAYER_TIMES);
    expect(conflict).toHaveProperty("id");
    expect(conflict).toHaveProperty("courseCode");
    expect(conflict).toHaveProperty("section");
    expect(conflict).toHaveProperty("days");
    expect(conflict).toHaveProperty("classInterval");
    expect(conflict).toHaveProperty("prayer");
    expect(conflict).toHaveProperty("prayerWindow");
    expect(conflict).toHaveProperty("severity");
  });

  it("classInterval is formatted as startTime-endTime", () => {
    const meetings = [
      { id: "ECS122A-A01-0", courseCode: "ECS 122A", section: "A01", days: ["M"], startTime: "12:30", endTime: "13:20" },
    ];
    const [conflict] = detectPrayerConflicts(meetings, SAMPLE_PRAYER_TIMES);
    expect(conflict.classInterval).toBe("12:30-13:20");
  });
});
