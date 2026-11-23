# TimeInamo

Offline-first personal Work & OJT Tracker built with Expo, React Native,
TypeScript, Expo Router, and SQLite.

## Development

```sh
npm install
npm run start
npm run check
```

The database is created locally on first launch. Migrations are applied in
order and recorded in both SQLite's `user_version` and `schema_migrations`.
No profile or other mock data is seeded.
