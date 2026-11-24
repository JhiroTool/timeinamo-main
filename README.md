<p align="center">
  <img src="assets/images/TI%20ICON.png" alt="TimeInamo icon" width="144" />
</p>

<h1 align="center">TimeInamo</h1>

<p align="center"><strong>Track Time. Record Progress.</strong></p>

TimeInamo is an offline-first personal work and OJT tracker for Android. It combines attendance recording, a persistent work-session timer, daily activity journaling, and progress reporting in one local workspace.

## Download TimeInamo

[**Download TimeInamo v1.0.0-beta.2 for Android (APK)**](https://github.com/JhiroTool/timeinamo-main/releases/download/v1.0.0-beta.2/TimeInamo-v1.0.0-beta.2.apk)

SHA-256: `25a09bfec646a49959ff0beee594fa6a61432d48385dbf8dd1baed2b141cd7d1`

This repository is currently private. The APK link requires a GitHub account with access to `JhiroTool/timeinamo-main`.

TimeInamo v1.0.0-beta.2 is intended for direct Android testing and is not distributed through Google Play.

## Features

- Time In and confirmed Time Out
- Persistent work-session timer restored from saved timestamps
- Unpaid-break deductions and credited-time calculations
- Monthly attendance history, manual entries, and correction history
- OJT completed hours, remaining hours, estimates, and weekly activity
- Daily Activity Journal with search and date filtering
- SQLite offline storage
- CSV attendance export through the native share sheet
- Personal profile, schedule, timezone, date, and time configuration

## Technology

- React Native 0.88
- Expo SDK 58
- TypeScript
- SQLite through `expo-sqlite`
- Expo Router
- React Native Reanimated

## Screenshots

Genuine Android screenshots have not been committed yet because no Android device or emulator was connected during release preparation. They will be added after physical-device beta validation; mock or fabricated screenshots are intentionally not used.

## Install the Android beta

1. Open the verified APK download link in the Download section.
2. Download the APK on an Android device.
3. If Android requests it, allow installation from the browser or file manager you used.
4. Open the downloaded APK and choose **Install**.
5. Open TimeInamo.
6. Complete the first-time setup.

Android may display a warning for apps installed outside Google Play. Confirm that the APK came from this repository's official release before continuing.

## Expo Go development

Requirements:

- Node.js 22 or newer
- npm
- Expo Go compatible with Expo SDK 58

Install and start the development server:

```sh
npm install
npx expo start
```

Open Expo Go on Android and scan the QR code displayed by the Expo terminal or development page. The computer and phone must be able to reach each other on the same network. When LAN access is unavailable, use:

```sh
npx expo start --tunnel
```

Expo Go runs the development project; it does not install or validate the standalone APK. TimeInamo currently uses native modules included by the matching Expo Go SDK, including SQLite, sharing, the date/time picker, Reanimated, and safe-area support. A future native dependency not bundled with Expo Go would require a custom development build.

Useful checks:

```sh
npm run check
npx expo-doctor
```

## Offline data and privacy

TimeInamo stores profile settings, attendance records, corrections, active sessions, and journal entries in a local SQLite database on the device. The application has no account system, cloud backend, analytics service, or automatic cloud synchronization.

CSV files are created only when the user requests an export and are passed to Android's native share/save interface. The SQLite database is not advertised as encrypted. Removing the app or using **Delete All Local Data** can permanently remove local records, so users should export important attendance data periodically.

## Known beta limitations

- Single-user local workspace with no cloud backup or cross-device restore
- One non-deleted attendance session per configured workday
- Overnight sessions require manual Time Out recovery
- Completion forecasts are estimates based on the configured schedule
- CSV destinations depend on available Android share targets
- Physical-device accessibility, battery, and long-session testing remains part of the beta program

## Developers

- Gian Accel Vivas
- Jhiro Tool

## Version

`v1.0.0-beta.2`

## License and distribution

This repository currently provides TimeInamo for beta evaluation and direct testing. No Google Play release is part of this beta workflow.
