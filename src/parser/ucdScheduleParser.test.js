import { describe, it, expect } from "vitest";
import { parseUcdScheduleInput } from "./ucdScheduleParser.js";

describe("parseUcdScheduleInput — empty input", () => {
  it("returns error on empty string", () => {
    const { meetings, errors } = parseUcdScheduleInput("");
    expect(meetings).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("returns error on whitespace-only input", () => {
    const { meetings, errors } = parseUcdScheduleInput("   \n  ");
    expect(meetings).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("parseUcdScheduleInput — CSV format", () => {
  it("parses a single CSV row", () => {
    const input = "course,section,days,start,end\nECS 122A,A01,MWF,10:00 AM,10:50 AM";
    const { meetings, errors } = parseUcdScheduleInput(input);
    expect(errors).toHaveLength(0);
    expect(meetings).toHaveLength(1);
    expect(meetings[0].courseCode).toBe("ECS 122A");
    expect(meetings[0].section).toBe("A01");
    expect(meetings[0].days).toEqual(["M", "W", "F"]);
    expect(meetings[0].startTime).toBe("10:00");
    expect(meetings[0].endTime).toBe("10:50");
  });

  it("parses multiple CSV rows", () => {
    const input = [
      "course,section,days,start,end",
      "ECS 122A,A01,MWF,10:00 AM,10:50 AM",
      "MAT 021A,B01,TR,1:10 PM,3:00 PM",
    ].join("\n");
    const { meetings, errors } = parseUcdScheduleInput(input);
    expect(errors).toHaveLength(0);
    expect(meetings).toHaveLength(2);
    expect(meetings[1].startTime).toBe("13:10");
    expect(meetings[1].endTime).toBe("15:00");
  });

  it("handles TR days correctly", () => {
    const input = "course,section,days,start,end\nPHY 009A,A02,TR,12:10 PM,1:00 PM";
    const { meetings } = parseUcdScheduleInput(input);
    expect(meetings[0].days).toEqual(["T", "R"]);
  });

  it("converts PM times to 24h", () => {
    const input = "course,section,days,start,end\nENG 006,C01,TR,3:40 PM,5:00 PM";
    const { meetings } = parseUcdScheduleInput(input);
    expect(meetings[0].startTime).toBe("15:40");
    expect(meetings[0].endTime).toBe("17:00");
  });

  it("skips CSV rows with missing required fields", () => {
    const input = "course,section,days,start,end\n,A01,MWF,10:00 AM,10:50 AM";
    const { meetings } = parseUcdScheduleInput(input);
    expect(meetings).toHaveLength(0);
  });
});

describe("parseUcdScheduleInput — freeform format", () => {
  it("parses a standard freeform line", () => {
    const input = "ECS 122A A01 MWF 10:00 AM - 10:50 AM";
    const { meetings, errors } = parseUcdScheduleInput(input);
    expect(errors).toHaveLength(0);
    expect(meetings).toHaveLength(1);
    expect(meetings[0].courseCode).toBe("ECS 122A");
    expect(meetings[0].section).toBe("A01");
    expect(meetings[0].days).toEqual(["M", "W", "F"]);
    expect(meetings[0].startTime).toBe("10:00");
    expect(meetings[0].endTime).toBe("10:50");
  });

  it("parses multiple freeform lines", () => {
    const input = [
      "ECS 122A A01 MWF 10:00 AM - 10:50 AM",
      "MAT 021A B01 TR 1:10 PM - 3:00 PM",
    ].join("\n");
    const { meetings } = parseUcdScheduleInput(input);
    expect(meetings).toHaveLength(2);
  });

  it("normalizes courseCode to uppercase", () => {
    const input = "ecs 122a A01 MWF 10:00 AM - 10:50 AM";
    const { meetings } = parseUcdScheduleInput(input);
    expect(meetings[0].courseCode).toBe("ECS 122A");
  });

  it("handles early morning 8 AM class", () => {
    const input = "CHE 002B D01 MWF 8:00 AM - 8:50 AM";
    const { meetings } = parseUcdScheduleInput(input);
    expect(meetings[0].startTime).toBe("08:00");
    expect(meetings[0].endTime).toBe("08:50");
  });

  it("returns error when no line matches", () => {
    const { meetings, errors } = parseUcdScheduleInput("not a schedule at all");
    expect(meetings).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("parseUcdScheduleInput — edge cases", () => {
  it("prefers CSV over freeform when input has commas and valid headers", () => {
    const csvInput = "course,section,days,start,end\nECS 122A,A01,MWF,10:00 AM,10:50 AM";
    const { meetings } = parseUcdScheduleInput(csvInput);
    expect(meetings[0].courseCode).toBe("ECS 122A");
  });

  it("assigns unique IDs to each meeting", () => {
    const input = [
      "ECS 122A A01 MWF 10:00 AM - 10:50 AM",
      "MAT 021A B01 TR 1:10 PM - 3:00 PM",
    ].join("\n");
    const { meetings } = parseUcdScheduleInput(input);
    const ids = meetings.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
