# Production Updates: UC Davis Schedule Parser (Prayer Conflict Checker)

Last updated: March 26, 2026
Owner: SalahSync
Status: Live (V1)

## 1) Purpose
Chrome extension for Muslim UC Davis students that automatically detects prayer-time conflicts with their class schedule. Injected directly into the UC Davis Schedule Builder page — no user input required.

## 2) Architecture (current)
- Single Chrome MV3 content script (`dist/content.js`) injected on `my.ucdavis.edu/schedulebuilder/*`
- Targets `#MessageContainer` inside `#SAOTServicesScheduleBuilder`, inserts conflict panel above it via shadow DOM
- Auto-expands all "SHOW IMPORTANT DETAILS" sections on page load — no manual interaction needed
- `pageParser.js` scans `#SAOTServicesScheduleBuilder.innerText` (scoped, cuts off before saved/suggested courses):
  - Pass 1: freeform parser (same-line format fallback)
  - Pass 2: UC Davis multi-line format — time range on one line, day codes on the next, looks back up to 20 lines for the nearest course code
- `MutationObserver` re-triggers expand + scan (debounced) whenever the DOM changes
- Prayer times fetched from Aladhan API (ISNA method, Davis Masjid coordinates), cached daily in `chrome.storage.local` with retry/backoff and offline fallback

## 3) Conflict Severity Levels
| Severity | Meaning | Trigger |
|----------|---------|---------|
| **CRITICAL** | Class blocks most/all of the prayer period | < 10 min free on both sides of the adhan-to-adhan window |
| **LIKELY MISS** | Very tight window — will probably miss salah | < 20 min free on both sides |
| **IQAMAH** | Misses congregational prayer at Islamic Center of Davis | Class overlaps the iqamah window (athan + offset) |

Prayer periods used: Fajr→Sunrise, Dhuhr→Asr, Asr→Maghrib, Maghrib→Isha, Isha→midnight.

## 4) Prayer Time Source
- Aladhan API (`method=2`, ISNA 15°/15°) at exact Davis Masjid coordinates: `38.5465°N, 121.7563°W`
- Iqamah times = athan + hardcoded offsets verified from davismasjid.org (March 2026):

| Prayer | Athan offset | Iqamah offset |
|--------|-------------|----------------|
| Fajr   | —           | +25 min        |
| Dhuhr  | —           | +10 min        |
| Asr    | —           | +10 min        |
| Maghrib| —           | +10 min        |
| Isha   | —           | +20 min        |

davismasjid.org is a JS-rendered SPA with no public API. Iqamah offsets are hardcoded in `Panel.jsx` (`IQAMAH_OFFSETS`) and must be updated manually when the masjid changes their schedule (e.g., Ramadan).

## 5) Key Files
| File | Role |
|------|------|
| `src/content/content.jsx` | Injects panel above `#MessageContainer` via shadow DOM |
| `src/content/Panel.jsx` | React component — fetches prayer times, runs scanner, detects conflicts |
| `src/content/pageParser.js` | DOM scanner + `expandCourseDetails()` auto-expander |
| `src/content/panel.css` | Shadow DOM styles for the conflict card |
| `src/parser/ucdScheduleParser.js` | Freeform + CSV meeting-time parser |
| `src/conflicts/prayerConflictEngine.js` | Builds prayer periods, detects conflicts, assigns severity |
| `public/manifest.json` | Chrome MV3 manifest — content script on `my.ucdavis.edu/schedulebuilder/*` |

## 6) Test Suite
- 43 tests, 100% passing (`npm test`)
- Covers: prayer period building, all three severity levels, edge cases (empty input, boundary minutes, multiple conflicts), conflict record shape

## 7) Remaining Tasks
- [ ] **DST boundary tests** — add spring-forward / fall-back edge cases to the conflict engine test suite.
- [ ] **Ramadan iqamah offsets** — `IQAMAH_OFFSETS` in `Panel.jsx` is hardcoded to standard schedule. Update when masjid posts Ramadan times, and consider adding a note in the UI when Ramadan is active.
- [ ] **davismasjid.org direct sourcing** — low priority; revisit if a public API or stable widget endpoint becomes available.

## 8) Update Log

### 2026-03-02
- Created migration plan from extension model to UC Davis schedule parser model.

### 2026-03-21
- Completed Phase 1 MVP: parser + conflict logic integrated, vitest suite (30 tests).
- Switched to Davis Masjid coordinates and iqamah-based conflict windows.
- Verified iqamah offsets from davismasjid.org.

### 2026-03-26
- Validated page scanner against real Schedule Builder DOM (`#SAOTServicesScheduleBuilder`).
- Fixed parser: UC Davis uses time-on-one-line / days-on-next-line format — updated Pass 2 regex accordingly.
- Added `expandCourseDetails()` — auto-expands all "SHOW IMPORTANT DETAILS" sections on load.
- Scoped scan to `#SAOTServicesScheduleBuilder`, cut off before saved/suggested course sections.
- Rewrote conflict engine with three semantic severity levels (critical / likely / iqamah) using full adhan-to-adhan prayer periods.
- Updated UI to 12-hour time display.
- 43 tests passing.
