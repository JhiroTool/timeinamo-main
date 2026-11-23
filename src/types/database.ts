import type { SQLiteDatabase } from 'expo-sqlite';

export type Database = SQLiteDatabase;

export type DatabaseState =
  | { status: 'initializing' }
  | { status: 'ready'; database: Database }
  | { status: 'error'; error: Error };

