# SalahSync

A Chrome extension for Muslim students at UC Davis that automatically checks your class schedule for prayer time conflicts — no input required.

---

## What it does

SalahSync injects a conflict panel directly into the UC Davis Schedule Builder page. When you open your schedule, it:

1. Auto-expands all course detail sections
2. Scans the page for your class meeting times
3. Checks them against today's prayer times (Islamic Center of Davis iqamah schedule)
4. Flags any conflicts with a severity rating

No popup, no copy-pasting, no buttons to click.

---

## Conflict severity levels

| Severity | Meaning |
|----------|---------|
| **CRITICAL** | Class blocks nearly the entire prayer period (< 10 min free on both sides of the adhan-to-adhan window) |
| **LIKELY MISS** | Very tight window — class leaves < 20 min on both sides, you'll probably miss salah |
| **IQAMAH** | Class overlaps the iqamah time at the Islamic Center of Davis — you'll miss congregational prayer |

Prayer periods: Fajr→Sunrise, Dhuhr→Asr, Asr→Maghrib, Maghrib→Isha, Isha→midnight.

---

## Prayer time source

- **API:** [Aladhan](https://aladhan.com) — ISNA method (Fajr 15°, Isha 15°)
- **Coordinates:** 38.5465°N, 121.7563°W (Islamic Center of Davis, 539 Russell Blvd)
- **Iqamah offsets** (verified from davismasjid.org):

| Prayer | Iqamah offset |
|--------|--------------|
| Fajr | Athan + 25 min |
| Dhuhr | Athan + 10 min |
| Asr | Athan + 10 min |
| Maghrib | Athan + 10 min |
| Isha | Athan + 20 min |

Prayer times are cached daily in `chrome.storage.local`. If the API is unreachable, the extension falls back to the last cached times and shows an offline notice.

---

## Installation

1. Clone the repo and install dependencies:
   ```sh
   git clone https://github.com/jashan190/SalahSync.git
   cd SalahSync
   npm install
   ```

2. Build:
   ```sh
   npm run build
   ```

3. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the `dist/` folder.

4. Navigate to [my.ucdavis.edu/schedulebuilder](https://my.ucdavis.edu/schedulebuilder) — the SalahSync panel appears automatically above your schedule.

### After code changes

```sh
npm run build
```

Then click the refresh icon on the SalahSync card at `chrome://extensions`.

---

## Development

```sh
npm run build       # Production build → dist/
npm run test        # Run vitest suite (43 tests)
npm run test:watch  # Vitest in watch mode
```

### Project structure

```
src/
  content/
    content.jsx         # Injects panel above #MessageContainer via shadow DOM
    Panel.jsx           # React component — prayer fetch, scan, conflict display
    pageParser.js       # DOM scanner + auto-expander for course details
    panel.css           # Shadow DOM styles
  parser/
    ucdScheduleParser.js        # CSV + freeform meeting-time parser
    ucdScheduleParser.test.js
  conflicts/
    prayerConflictEngine.js     # Adhan-to-adhan period conflict detection
    prayerConflictEngine.test.js
public/
  manifest.json         # Chrome MV3 manifest
  icons/
dist/
  content.js            # Built output (single IIFE, loaded as content script)
  manifest.json
```

---

## Tech stack

| Layer | Tech |
|-------|------|
| UI | React 18 |
| Build | Vite (IIFE lib mode) |
| Extension | Chrome MV3 content script |
| Prayer API | Aladhan API |
| Testing | Vitest |
