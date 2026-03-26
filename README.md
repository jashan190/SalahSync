# SalahSync

A Chrome extension for Muslim students at UC Davis to check their class schedule against daily prayer times and catch conflicts before they enroll.

---

## What it does

**Prayer times (top half)**
- Displays today's Fajr, Dhuhr, Asr, Maghrib, and Isha times for Davis, CA
- Times are sourced from the Aladhan API (ISNA method, 15°/15°) using the Islamic Center of Davis coordinates, then adjusted to match the masjid's posted iqamah schedule
- Circular countdown timer to the next prayer
- Per-prayer notification bell — toggle to get a Chrome notification at prayer time
- Conflict notifications — if a class overlaps the next prayer within 45 minutes, a notification fires automatically

**Schedule parser (bottom half)**
- Paste your UC Davis Schedule Builder classes and hit **Parse Schedule**
- Supports two input formats (see below)
- Conflict panel shows every class that overlaps or nearly overlaps a prayer iqamah window
- Conflicts are rated **HARD** (direct overlap) or **SOFT** (within 10-minute buffer)

---

## Prayer time source

Times are calculated using the [Aladhan API](https://aladhan.com) with:
- **Coordinates:** 38.5465°N, 121.7563°W (Islamic Center of Davis, 539 Russell Blvd)
- **Method:** ISNA (Islamic Society of North America) — Fajr 15°, Isha 15°
- **Iqamah offsets** (verified from davismasjid.org):

| Prayer | Athan offset | Iqamah |
|--------|-------------|--------|
| Fajr | — | Athan + 25 min |
| Dhuhr | — | Athan + 10 min |
| Asr | — | Athan + 10 min |
| Maghrib | — | Athan + 10 min |
| Isha | — | Athan + 20 min |

Prayer times are cached daily in `chrome.storage.local`. If the API is unreachable, the extension falls back to the last cached times and shows an offline notice.

---

## Schedule input formats

**Freeform** (copy-paste from Schedule Builder):
```
ECS 122A A01 MWF 10:00 AM - 10:50 AM
MAT 021A B01 TR 1:10 PM - 3:00 PM
PHY 009A A02 MWF 12:10 PM - 1:00 PM
```

**CSV:**
```
course,section,days,start,end
ECS 122A,A01,MWF,10:00 AM,10:50 AM
MAT 021A,B01,TR,1:10 PM,3:00 PM
```

---

## Installation

### Load as an unpacked extension (development)

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

4. The SalahSync icon appears in your Chrome toolbar. Click it to open the popup.

### After code changes

```sh
npm run build
```

Then click the refresh icon on the SalahSync card at `chrome://extensions`.

---

## Development

```sh
npm run dev      # Vite dev server (hot reload, browser preview)
npm run build    # Production build → dist/
npm run test     # Run vitest suite (30 tests)
npm run lint     # ESLint
```

### Project structure

```
src/
  components/
    PrayerTimes.jsx       # Main UI and all logic
    PrayerTimes.css       # Tailwind + custom component styles
  parser/
    ucdScheduleParser.js        # UC Davis schedule parser (CSV + freeform)
    ucdScheduleParser.test.js
  conflicts/
    prayerConflictEngine.js     # Hard/soft conflict detection
    prayerConflictEngine.test.js
  data/
    sampleSchedules/            # Sample CSV and freeform input fixtures
public/
  manifest.json           # Chrome Extension Manifest v3
```

---

## Tech stack

| Layer | Tech |
|---|---|
| UI | React 18 + Tailwind CSS |
| Build | Vite |
| Extension | Chrome MV3 |
| Prayer API | [Aladhan API](https://aladhan.com) |
| Testing | Vitest |
