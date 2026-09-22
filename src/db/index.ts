import * as SQLite from 'expo-sqlite';

import type { Campaign, Citizen, Screening } from '@/domain/types';

/**
 * Local-only storage. Each record is a JSON document plus the few columns needed for
 * lookups and uniqueness (CCCD per citizen, one screening per citizen per campaign).
 */
const SCHEMA_VERSION = 1;

let database: SQLite.SQLiteDatabase | null = null;

export function db(): SQLite.SQLiteDatabase {
  if (!database) {
    database = SQLite.openDatabaseSync('sotuyen.db');
    migrate(database);
  }
  return database;
}

function migrate(d: SQLite.SQLiteDatabase) {
  d.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = d.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version < 1) {
    d.execSync(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY NOT NULL,
        year INTEGER NOT NULL,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS citizens (
        id TEXT PRIMARY KEY NOT NULL,
        cccd TEXT NOT NULL UNIQUE,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS screenings (
        id TEXT PRIMARY KEY NOT NULL,
        campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        citizen_id TEXT NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
        data TEXT NOT NULL,
        UNIQUE (campaign_id, citizen_id)
      );
      CREATE INDEX IF NOT EXISTS screenings_citizen ON screenings(citizen_id);
    `);
  }
  if (version < SCHEMA_VERSION) d.execSync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

const parse = <T>(rows: { data: string }[]): T[] => rows.map((r) => JSON.parse(r.data) as T);

export const repo = {
  loadAll(): { campaigns: Campaign[]; citizens: Citizen[]; screenings: Screening[] } {
    const d = db();
    return {
      campaigns: parse<Campaign>(d.getAllSync('SELECT data FROM campaigns ORDER BY year DESC')),
      citizens: parse<Citizen>(d.getAllSync('SELECT data FROM citizens')),
      screenings: parse<Screening>(d.getAllSync('SELECT data FROM screenings')),
    };
  },

  saveCampaign(c: Campaign) {
    db().runSync('INSERT OR REPLACE INTO campaigns (id, year, data) VALUES (?, ?, ?)', c.id, c.year, JSON.stringify(c));
  },

  deleteCampaign(id: string) {
    db().runSync('DELETE FROM campaigns WHERE id = ?', id);
  },

  /** Throws `DuplicateCccdError` when another citizen already has this CCCD. */
  saveCitizen(c: Citizen) {
    const d = db();
    const clash = d.getFirstSync<{ id: string }>('SELECT id FROM citizens WHERE cccd = ? AND id <> ?', c.cccd, c.id);
    if (clash) throw new DuplicateCccdError(clash.id);
    d.runSync('INSERT OR REPLACE INTO citizens (id, cccd, data) VALUES (?, ?, ?)', c.id, c.cccd, JSON.stringify(c));
  },

  deleteCitizen(id: string) {
    db().runSync('DELETE FROM citizens WHERE id = ?', id);
  },

  saveScreening(s: Screening) {
    db().runSync(
      'INSERT OR REPLACE INTO screenings (id, campaign_id, citizen_id, data) VALUES (?, ?, ?, ?)',
      s.id,
      s.campaignId,
      s.citizenId,
      JSON.stringify(s),
    );
  },

  deleteScreening(id: string) {
    db().runSync('DELETE FROM screenings WHERE id = ?', id);
  },

  /** Replaces all data (backup restore) in one transaction. */
  replaceAll(data: { campaigns: Campaign[]; citizens: Citizen[]; screenings: Screening[] }) {
    const d = db();
    d.withTransactionSync(() => {
      d.execSync('DELETE FROM screenings; DELETE FROM citizens; DELETE FROM campaigns;');
      for (const c of data.campaigns) repo.saveCampaign(c);
      for (const c of data.citizens) repo.saveCitizen(c);
      for (const s of data.screenings) repo.saveScreening(s);
    });
  },

  /** Inserts or replaces the given records in one transaction (merge import). */
  writeAll(data: { campaigns: Campaign[]; citizens: Citizen[]; screenings: Screening[] }) {
    const d = db();
    d.withTransactionSync(() => {
      for (const c of data.campaigns) repo.saveCampaign(c);
      for (const c of data.citizens) repo.saveCitizen(c);
      for (const s of data.screenings) repo.saveScreening(s);
    });
  },

  wipe() {
    db().execSync('DELETE FROM screenings; DELETE FROM citizens; DELETE FROM campaigns;');
  },
};

export class DuplicateCccdError extends Error {
  constructor(public readonly existingId: string) {
    super('Số CCCD này đã có trong danh sách công dân.');
    this.name = 'DuplicateCccdError';
  }
}
