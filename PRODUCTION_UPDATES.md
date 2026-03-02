# Production Updates: UC Davis Schedule Parser (Prayer Conflict Checker)

Last updated: March 2, 2026
Owner: SalahSync
Status: Planning to Production Migration

## 1) Purpose
This document tracks production updates as SalahSync transitions from a Chrome extension into a UC Davis Schedule Builder parser that helps Muslim students avoid class-prayer conflicts.

## 2) Product Direction Change
Previous direction:
- Browser extension focused on location-based prayer time display.

New direction:
- A parser/integration for UC Davis Schedule Builder that reads planned class schedules and flags overlaps with daily prayer windows.

Primary user outcome:
- Students can build a schedule that minimizes or avoids conflicts with Salah times.

## 3) Scope for V1 (Production Target)
In scope:
- Parse course meeting times from UC Davis Schedule Builder exports/input.
- Normalize class meetings into a weekly timetable.
- Compute local prayer times for Davis, CA (or user-defined location).
- Detect overlaps between class intervals and prayer windows.
- Return conflict output with severity and recommendations.

Out of scope (V1):
- Auto-enrollment or direct registrar actions.
- Multi-campus schedule systems.
- Personalized fiqh modes beyond a single default rule set.

## 4) Core Functional Requirements
1. Import schedule data in at least one stable format (`CSV` or structured text copy-paste).
2. Parse days (`M, T, W, R, F`) and meeting intervals (`start`, `end`) with timezone safety.
3. Calculate prayer times per date using a reliable method/API and cache results.
4. Detect conflicts:
   - Hard conflict: class overlaps prayer window.
   - Soft conflict: class starts/ends near prayer window (buffer threshold).
5. Generate actionable output:
   - Conflicting class name/CRN/time.
   - Prayer impacted.
   - Suggested alternatives (if alternate section data is available).

## 5) Technical Architecture (Target)
- Input layer: Schedule Builder data ingestion (`CSV` parser first).
- Normalization layer: Convert all times to a standard weekly representation.
- Prayer engine: Daily prayer calculation service with location + date inputs.
- Conflict engine: Interval overlap checks with configurable buffers.
- Output layer: User-facing report (web page or downloadable summary).

## 6) Data Contract (Draft)
### Class Meeting Record
```json
{
  "courseCode": "ECS 122A",
  "section": "A01",
  "days": ["M", "W", "F"],
  "startTime": "10:00",
  "endTime": "10:50",
  "timezone": "America/Los_Angeles",
  "location": "Davis, CA"
}
```

### Conflict Record
```json
{
  "courseCode": "ECS 122A",
  "section": "A01",
  "prayer": "Dhuhr",
  "classInterval": "10:00-10:50",
  "prayerWindow": "10:35-10:55",
  "severity": "hard",
  "note": "Class overlaps Dhuhr prayer window by 15 minutes."
}
```

## 7) Rollout Plan
Phase 0: Discovery and input format validation
- Collect real Schedule Builder samples.
- Lock parser format and edge cases.

Phase 1: MVP parser + conflict logic
- Parse schedule data.
- Run overlap detection against prayer windows.
- Produce CLI or minimal UI conflict report.

Phase 2: Production hardening
- Add tests for parser edge cases and daylight saving transitions.
- Add monitoring/logging and error handling.
- Add caching and rate-limit protection for prayer API calls.

Phase 3: UX + adoption
- Improve output readability.
- Add share/export summary.
- Gather student feedback and tune buffer settings.

## 8) Quality Gates Before Production
- Unit test coverage for parsing and overlap logic.
- Integration tests with at least 10 real UC Davis schedule samples.
- Timezone verification across DST boundaries.
- Error handling for malformed schedule input.
- Privacy review: avoid storing personal schedule data longer than necessary.

## 9) Risks and Mitigations
- Parser breakage from Schedule Builder format changes.
  - Mitigation: versioned parser and fallback manual input mode.
- Prayer-time API reliability or rate limits.
  - Mitigation: caching + retry/backoff + offline fallback method.
- User trust for religious timing accuracy.
  - Mitigation: expose calculation method and allow configurable prayer buffers.

## 10) Update Log
Use this section for production-facing progress updates.

### 2026-03-02
- Created migration plan from extension model to UC Davis schedule parser model.
- Defined V1 scope, architecture, and rollout phases.
- Added initial data contracts for class meetings and conflict reports.

## 11) Immediate Next Build Tasks
1. Add `src/parser/ucdScheduleParser.js` with sample-based parser logic.
2. Add `src/conflicts/prayerConflictEngine.js` for interval overlap detection.
3. Add `src/data/sampleSchedules/` with anonymized test fixtures.
4. Add tests for parser and conflict detection (`vitest` or existing test runner).
5. Decide first production interface: CLI report or lightweight web form.
