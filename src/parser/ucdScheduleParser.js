const DAY_ALIASES = [
  ["MON", "M"],
  ["TUE", "T"],
  ["WED", "W"],
  ["THU", "R"],
  ["TH", "R"],
  ["FRI", "F"],
  ["SAT", "S"],
  ["SUN", "U"],
];

function normalizeDayToken(rawToken) {
  if (!rawToken) return [];
  let token = rawToken.toUpperCase();
  DAY_ALIASES.forEach(([from, to]) => {
    token = token.replaceAll(from, to);
  });
  token = token.replaceAll("/", "").replaceAll(",", "").replaceAll(" ", "");
  return token.split("").filter((day) => "MTWRFSU".includes(day));
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function normalizeTo24h(timeToken, meridiemToken = "") {
  const text = `${timeToken} ${meridiemToken}`.trim().toUpperCase();
  const match = text.match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3];

  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return `${pad2(hour)}:${pad2(minute)}`;
}

function parseCsv(input) {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2 || !lines[0].includes(",")) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = {
    courseCode: headers.findIndex((h) => ["course", "coursecode", "course_code"].includes(h)),
    section: headers.findIndex((h) => ["section", "sec"].includes(h)),
    days: headers.findIndex((h) => ["days", "meetingdays", "meeting_days"].includes(h)),
    startTime: headers.findIndex((h) => ["start", "starttime", "start_time"].includes(h)),
    endTime: headers.findIndex((h) => ["end", "endtime", "end_time"].includes(h)),
  };
  if (Object.values(idx).some((value) => value < 0)) return [];

  return lines.slice(1).reduce((acc, line, lineOffset) => {
    const parts = line.split(",").map((part) => part.trim());
    const courseCode = parts[idx.courseCode];
    const section = parts[idx.section] || "Unknown";
    const days = normalizeDayToken(parts[idx.days]);
    const startTime = normalizeTo24h(parts[idx.startTime]);
    const endTime = normalizeTo24h(parts[idx.endTime]);
    if (!courseCode || !days.length || !startTime || !endTime) return acc;
    acc.push({
      id: `${courseCode}-${section}-${lineOffset}`,
      courseCode,
      section,
      days,
      startTime,
      endTime,
    });
    return acc;
  }, []);
}

function parseFreeform(input) {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const matcher =
    /^([A-Za-z]{2,4}\s*\d{1,3}[A-Za-z]{0,2})\s+([A-Za-z0-9-]+)?\s*([MTWRFSU/,\s]+)\s+(\d{1,2}:\d{2})\s*(AM|PM)?\s*-\s*(\d{1,2}:\d{2})\s*(AM|PM)?$/i;

  return lines.reduce((acc, line, index) => {
    const match = line.match(matcher);
    if (!match) return acc;
    const courseCode = match[1].replace(/\s+/g, " ").trim().toUpperCase();
    const section = (match[2] || "Unknown").toUpperCase();
    const days = normalizeDayToken(match[3]);
    const startTime = normalizeTo24h(match[4], match[5]);
    const endTime = normalizeTo24h(match[6], match[7]);
    if (!days.length || !startTime || !endTime) return acc;

    acc.push({
      id: `${courseCode}-${section}-${index}`,
      courseCode,
      section,
      days,
      startTime,
      endTime,
    });
    return acc;
  }, []);
}

export function parseUcdScheduleInput(input) {
  if (!input || !input.trim()) {
    return { meetings: [], errors: ["No schedule input provided."] };
  }

  const csvMeetings = parseCsv(input);
  const meetings = csvMeetings.length ? csvMeetings : parseFreeform(input);

  if (!meetings.length) {
    return {
      meetings: [],
      errors: [
        "Could not parse schedule input. Use CSV headers (course,section,days,start,end) or lines like: ECS 122A A01 MWF 10:00 AM - 10:50 AM",
      ],
    };
  }

  return { meetings, errors: [] };
}
