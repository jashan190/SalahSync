import { parseUcdScheduleInput } from "../parser/ucdScheduleParser.js";

/**
 * Clicks all collapsed "SHOW IMPORTANT DETAILS" / "SHOW DETAILS" buttons
 * in the schedule section so the page scanner can read meeting times.
 * Safe to call repeatedly — only clicks elements that are currently collapsed.
 */
const SCHEDULE_CONTAINER_ID = "SAOTServicesScheduleBuilder";

function getScheduleContainer() {
  return document.getElementById(SCHEDULE_CONTAINER_ID) ?? document.body;
}

/**
 * Clicks all collapsed "SHOW IMPORTANT DETAILS" / "SHOW DETAILS" buttons
 * within the schedule builder so the page scanner can read meeting times.
 * Safe to call repeatedly — only clicks currently-collapsed elements.
 */
export function expandCourseDetails() {
  getScheduleContainer()
    .querySelectorAll("a, button, [role='button']")
    .forEach((el) => {
      if (/SHOW\s+(?:IMPORTANT\s+)?DETAILS/i.test(el.textContent?.trim())) {
        el.click();
      }
    });
}

// Matches a time range: "6:10 PM - 7:00 PM" or "11:00 AM - 11:50 AM"
const TIME_RANGE_RE = /(\d{1,2}:\d{2}\s*(?:AM|PM))\s*[-–]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i;

// Matches a UC Davis course code: ECS 170, UWP 104AV, PLS 007V, CLA 010, etc.
const COURSE_RE = /\b([A-Z]{2,4}\s*\d{1,3}[A-Z]{0,2})\b/;

// Matches a section code immediately after the course code: 001, A01, B02, etc.
const SECTION_RE = /\b([A-Z]\d{2}|\d{3})\b/;

// UC Davis weekday codes on their own line: M, T, W, R, F, MWF, TR, etc.
const DAY_LINE_RE = /^[MTWRF]{1,5}$/;

/**
 * Scans the Schedule Builder page for course meeting times.
 *
 * The UC Davis Schedule Builder (when "SHOW IMPORTANT DETAILS" is expanded) renders:
 *   <meeting type>       e.g. "Lecture"
 *   <time range>         e.g. "6:10 PM - 7:00 PM"
 *   <day codes>          e.g. "MWF"
 *   <location>           e.g. "Teaching and Learning Complex 1010"
 *
 * Pass 1 — feed full page text to the freeform parser (handles same-line format).
 * Pass 2 — find lines containing a time range where the NEXT line is a bare day code,
 *           then look back up to 20 lines for the closest course code.
 */
export function scanPageForClasses() {
  // Scope to #SAOTServicesScheduleBuilder to avoid nav, search results,
  // and saved-course sections outside the active schedule panel.
  const container = getScheduleContainer();

  // Cut off before "SUGGESTED COURSES" / "PREVIOUSLY SAVED COURSES" so
  // saved-course rows (which lack section numbers) don't pollute the scan.
  const fullText = container.innerText || "";
  const cutMarkers = ["SUGGESTED COURSES", "PREVIOUSLY SAVED COURSES"];
  let cutAt = fullText.length;
  for (const marker of cutMarkers) {
    const idx = fullText.indexOf(marker);
    if (idx > 0 && idx < cutAt) cutAt = idx;
  }
  const raw = fullText.slice(0, cutAt);
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Pass 1: direct freeform parse
  const { meetings: direct } = parseUcdScheduleInput(lines.join("\n"));
  if (direct.length > 0) return direct;

  // Pass 2: multi-line Schedule Builder format
  const meetings = [];
  const seen = new Set();

  for (let i = 0; i + 1 < lines.length; i++) {
    const timeMatch = lines[i].match(TIME_RANGE_RE);
    if (!timeMatch) continue;

    const dayLine = lines[i + 1].trim();
    if (!DAY_LINE_RE.test(dayLine)) continue;

    // Look back up to 20 lines for the closest course code before this time block
    let courseCode = null;
    let section = "001";
    for (let j = Math.max(0, i - 20); j < i; j++) {
      const cm = lines[j].match(COURSE_RE);
      if (cm) {
        courseCode = cm[1].replace(/\s+/, " ").trim();
        // Section comes immediately after the course code on the same line
        const afterCourse = lines[j].slice(cm.index + cm[0].length);
        const sm = afterCourse.match(SECTION_RE);
        if (sm) section = sm[1];
        // Don't break — keep iterating to get the closest (most recent) match
      }
    }

    if (!courseCode) continue;

    const key = `${courseCode}-${dayLine}-${timeMatch[1]}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Build a synthetic line the freeform parser understands
    const synthetic = `${courseCode} ${section} ${dayLine} ${timeMatch[1]} - ${timeMatch[2]}`;
    const { meetings: m } = parseUcdScheduleInput(synthetic);
    meetings.push(...m);
  }

  return meetings;
}
