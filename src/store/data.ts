import { create } from 'zustand';

import { repo } from '@/db';
import { createId } from '@/domain/format';
import { planMerge, type MergeResult } from '@/domain/merge';
import type { Campaign, Citizen, Screening } from '@/domain/types';

export type CampaignInput = Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>;
export type CitizenInput = Omit<Citizen, 'id' | 'createdAt' | 'updatedAt'>;
export type ScreeningInput = Omit<Screening, 'id' | 'createdAt' | 'updatedAt'>;

export interface Backup {
  app: 'SoTuyenNghiaVu';
  version: 1;
  exportedAt: string;
  campaigns: Campaign[];
  citizens: Citizen[];
  screenings: Screening[];
}

interface DataState {
  loaded: boolean;
  campaigns: Campaign[];
  citizens: Citizen[];
  screenings: Screening[];
  load(): void;
  saveCampaign(input: CampaignInput, id?: string): Campaign;
  deleteCampaign(id: string): void;
  /** Throws DuplicateCccdError when the CCCD belongs to another citizen. */
  saveCitizen(input: CitizenInput, id?: string): Citizen;
  deleteCitizen(id: string): void;
  saveScreening(input: ScreeningInput, id?: string): Screening;
  deleteScreening(id: string): void;
  restore(backup: Backup): void;
  /** Adds/updates records from a backup file without deleting anything. */
  merge(backup: Backup): MergeResult['counts'];
  wipe(): void;
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const next = list.slice();
  next[i] = item;
  return next;
}

/** In-memory mirror of the SQLite database; every write goes to SQLite first. */
export const useDataStore = create<DataState>()((set, get) => ({
  loaded: false,
  campaigns: [],
  citizens: [],
  screenings: [],

  load() {
    set({ ...repo.loadAll(), loaded: true });
  },

  saveCampaign(input, id) {
    const now = new Date().toISOString();
    const prev = id ? get().campaigns.find((c) => c.id === id) : undefined;
    const campaign: Campaign = { ...input, id: prev?.id ?? createId('c_'), createdAt: prev?.createdAt ?? now, updatedAt: now };
    repo.saveCampaign(campaign);
    set((s) => ({ campaigns: upsert(s.campaigns, campaign).sort((a, b) => b.year - a.year) }));
    return campaign;
  },

  deleteCampaign(id) {
    repo.deleteCampaign(id);
    set((s) => ({ campaigns: s.campaigns.filter((c) => c.id !== id), screenings: s.screenings.filter((x) => x.campaignId !== id) }));
  },

  saveCitizen(input, id) {
    const now = new Date().toISOString();
    const prev = id ? get().citizens.find((c) => c.id === id) : undefined;
    const citizen: Citizen = { ...input, id: prev?.id ?? createId('p_'), createdAt: prev?.createdAt ?? now, updatedAt: now };
    repo.saveCitizen(citizen);
    set((s) => ({ citizens: upsert(s.citizens, citizen) }));
    return citizen;
  },

  deleteCitizen(id) {
    repo.deleteCitizen(id);
    set((s) => ({ citizens: s.citizens.filter((c) => c.id !== id), screenings: s.screenings.filter((x) => x.citizenId !== id) }));
  },

  saveScreening(input, id) {
    const now = new Date().toISOString();
    const prev = id
      ? get().screenings.find((x) => x.id === id)
      : get().screenings.find((x) => x.campaignId === input.campaignId && x.citizenId === input.citizenId);
    const screening: Screening = { ...input, id: prev?.id ?? createId('s_'), createdAt: prev?.createdAt ?? now, updatedAt: now };
    repo.saveScreening(screening);
    set((s) => ({ screenings: upsert(s.screenings, screening) }));
    return screening;
  },

  deleteScreening(id) {
    repo.deleteScreening(id);
    set((s) => ({ screenings: s.screenings.filter((x) => x.id !== id) }));
  },

  restore(backup) {
    repo.replaceAll(backup);
    get().load();
  },

  merge(backup) {
    const { campaigns, citizens, screenings } = get();
    const { write, counts } = planMerge({ campaigns, citizens, screenings }, backup);
    repo.writeAll(write);
    get().load();
    return counts;
  },

  wipe() {
    repo.wipe();
    set({ campaigns: [], citizens: [], screenings: [] });
  },
}));

export function makeBackup(state: Pick<DataState, 'campaigns' | 'citizens' | 'screenings'>): Backup {
  return {
    app: 'SoTuyenNghiaVu',
    version: 1,
    exportedAt: new Date().toISOString(),
    campaigns: state.campaigns,
    citizens: state.citizens,
    screenings: state.screenings,
  };
}

export function isBackup(value: unknown): value is Backup {
  const v = value as Partial<Backup> | null;
  return (
    !!v &&
    v.app === 'SoTuyenNghiaVu' &&
    v.version === 1 &&
    Array.isArray(v.campaigns) &&
    Array.isArray(v.citizens) &&
    Array.isArray(v.screenings)
  );
}
