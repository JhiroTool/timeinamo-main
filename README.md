# TimeInamo

TimeInamo is an offline-first personal Work and OJT tracker for Android and iOS. It is built with Expo, React Native, TypeScript, Expo Router, and SQLite. All user data stays in the app's local SQLite database unless the user explicitly exports a CSV file through the native share sheet.

## MVP features

- Three-step first-run setup for personal details, schedule, required OJT hours, and timezone
- Five bottom tabs: Home, Attendance, Journal, Progress, and Settings
- Immediate Time In, a live `HH:MM:SS` timer, configurable unpaid break, and confirmed Time Out
- Active-session restoration after app restart or foregrounding
- Manual recovery for sessions that cross into another workday
- Monthly attendance history with completed, incomplete, and adjusted filters
- Manual attendance entry, corrections with audit history, and confirmed soft deletion
- Daily journal CRUD, search, date filtering, optional notes, and optional attendance links
- OJT totals, remaining hours, daily average, estimated remaining workdays, and weekly totals
- Attendance CSV export for all records, the current month, or a custom range
- Local-only settings and confirmed deletion of all local data

## Requirements

- Node.js 22 or newer (the database validation script uses the built-in `node:sqlite` module)
- npm
- Expo Go compatible with Expo SDK 58, or an SDK 58 development build
- Android Studio/ADB for a local Android emulator build; Xcode is required for a local iOS build

## Install and run

```sh
npm install
npm start
```

Scan the QR code with Expo Go while the computer and phone are on the same network. If LAN discovery is unavailable, run:

```sh
npx expo start --tunnel
```

Other useful commands:

```sh
npm run android
npm run ios
npm run typecheck
npm run check:db
npm run check
```

On Windows PowerShell, use `npm.cmd` or `npx.cmd` if script execution policy prevents the PowerShell shims:

```powershell
npm.cmd install
npx.cmd expo start --tunnel
npm.cmd run check
```

## Validation and production bundle checks

The standard verification command runs strict TypeScript and the SQLite/integration checks:

```sh
npm run check
```

The database check applies every migration to a temporary SQLite file and verifies constraints, duplicate prevention, duration calculations, correction history, journal CRUD/search/restart persistence, completed-hour totals, weekly grouping, and CSV escaping/formula protection.

To verify an Android production JavaScript bundle without creating an APK:

```sh
npx expo export --platform android --output-dir .expo-check
```

The generated `.expo-check` directory is disposable and should not be committed.

## Data architecture

- `profiles` and `work_settings` hold the singleton local workspace and preferences.
- `attendance_sessions` stores UTC timestamps and timezone-derived `YYYY-MM-DD` work dates.
- `attendance_corrections` retains old/new values, reasons, and UTC correction timestamps.
- `activity_logs` stores journal entries and optional attendance links.
- Versioned migrations are recorded in both SQLite `user_version` and `schema_migrations`.
- Foreign keys, partial unique indexes, and overlap triggers enforce attendance invariants.
- Completed credited time is calculated in integer seconds as elapsed time minus unpaid break.
- Active/incomplete and soft-deleted attendance records are excluded from completed totals.

No user, attendance, or journal mock records are seeded.

## CSV export safety

CSV files are generated locally in the Expo cache and passed directly to the native share/save sheet. Fields are escaped for quotes, commas, and line breaks. User-authored values beginning with spreadsheet formula characters are prefixed safely to reduce formula-injection risk.

## Known MVP limitations

- TimeInamo is single-user and has no authentication, cloud sync, backup, or cross-device restore.
- MVP permits one non-deleted attendance session per configured workday.
- Overnight active sessions require manual Time Out recovery and are never closed automatically.
- Schedule changes affect future defaults only; historical attendance is not recalculated.
- Forecast workdays are estimates based on configured scheduled credited hours.
- CSV saving destinations and available share targets depend on the device and installed apps.
- Native share-sheet behavior, notification-free background behavior, screen-reader output, and exact small-device keyboard layout require validation on physical Android and iOS devices.
