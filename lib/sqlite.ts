import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

let dbPromise: Promise<SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync("prestamos.db");
  }
  return dbPromise;
}