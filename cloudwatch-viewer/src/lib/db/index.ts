/**
 * SQLite 데이터베이스 싱글톤
 */

import Database from "better-sqlite3";
import path from "path";

let db: Database.Database | null = null;

/**
 * SQLite 데이터베이스 인스턴스 반환
 * 처음 호출 시 연결, 이후 재사용
 */
export function getDb(): Database.Database {
  if (db) {
    return db;
  }

  const dbPath = path.join(process.cwd(), "data", "cloudwatch-viewer.db");

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  return db;
}

/**
 * 데이터베이스 연결 종료 (테스트용)
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
