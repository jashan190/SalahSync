import { parseUcdScheduleInput } from "../parser/ucdScheduleParser.js";

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

// Matches a section code: 001, A01, B02, etc.
const SECTION_RE = /\b([A-Z]\d{2}|\d{3})\b/;

// UC Davis weekday codes on their own line: M, T, W, R, F, MWF, TR, etc.
const DAY_LINE_RE = /^[MTWRF]{1,5}$/;

/**
 * Scans the Schedule Builder page for course meeting times.
 *
 * Each course lives in a .CourseItem element. Scoping to individual course
 * blocks avoids cross-course look-back issues and sidesteps the Angular SPA
 * quirk where document.body.innerText is unreliable.
 *
 * Course code + section come from the .classTitle child element (reliable DOM).
 * Meeting times are read from the block's textContent (always populated).
 */
export function scanPageForClasses() {
  const container = getScheduleContainer();
  const meetings = [];
  const seen = new Set();

  container.querySelectorAll(".CourseItem").forEach((courseEl) => {
    // Get course identity from the title element
    const titleEl = courseEl.querySelector(".classTitle");
    if (!titleEl) return;

    const titleText = titleEl.textContent.replace(/\s+/g, " ").trim();
    const cm = titleText.match(COURSE_RE);
    if (!cm) return;

    const courseCode = cm[1].replace(/\s+/, " ").trim();
    const afterCourse = titleText.slice(cm.index + cm[0].length);
    const sm = afterCourse.match(SECTION_RE);
    if (!sm) return; // no section number → saved/suggested course, skip

    const section = sm[1];

    // innerText respects CSS visibility (preferred); fall back to textContent
    // which always works but includes Angular template whitespace
    const blockText = courseEl.innerText || courseEl.textContent || "";
    const lines = blockText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    for (let i = 0; i + 1 < lines.length; i++) {
      const timeMatch = lines[i].match(TIME_RANGE_RE);
      if (!timeMatch) continue;

      const dayLine = lines[i + 1].trim();
      if (!DAY_LINE_RE.test(dayLine)) continue;

      const key = `${courseCode}-${dayLine}-${timeMatch[1]}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const synthetic = `${courseCode} ${section} ${dayLine} ${timeMatch[1]} - ${timeMatch[2]}`;
      const { meetings: m } = parseUcdScheduleInput(synthetic);
      meetings.push(...m);
    }
  });

  return meetings;
}
