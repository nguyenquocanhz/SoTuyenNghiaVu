import { createId } from './format';
import type { Campaign, Citizen, Screening } from './types';

export interface DataSet {
  campaigns: Campaign[];
  citizens: Citizen[];
  screenings: Screening[];
}

export interface MergeResult {
  /** Records to write (inserted or replaced). */
  write: DataSet;
  counts: {
    campaignsAdded: number;
    citizensAdded: number;
    citizensUpdated: number;
    screeningsAdded: number;
    screeningsUpdated: number;
    screeningsSkipped: number;
    citizensInvalid: number;
  };
}

/** Keeps `base` values where `patch` has nothing (undefined / blank string). */
function fillFrom<T extends object>(base: T, patch: T): T {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch) as [keyof T, T[keyof T]][]) {
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Gộp dữ liệu từ tệp (máy sơ tuyển khác, bản sao lưu cũ) vào dữ liệu hiện có mà không xoá gì:
 * - Đợt sơ tuyển khớp theo năm gọi nhập ngũ, chưa có thì thêm.
 * - Công dân khớp theo số CCCD; đã có thì bổ sung các trường tệp có giá trị.
 * - Phiếu khớp theo (đợt, công dân); đã có thì chỉ thay khi phiếu trong tệp mới hơn.
 */
export function planMerge(current: DataSet, incoming: DataSet, now = new Date()): MergeResult {
  const stamp = now.toISOString();
  const counts: MergeResult['counts'] = {
    campaignsAdded: 0,
    citizensAdded: 0,
    citizensUpdated: 0,
    screeningsAdded: 0,
    screeningsUpdated: 0,
    screeningsSkipped: 0,
    citizensInvalid: 0,
  };
  const write: DataSet = { campaigns: [], citizens: [], screenings: [] };

  const campaigns = [...current.campaigns];
  const campaignIds = new Map<string, string>();
  for (const c of incoming.campaigns) {
    const match = campaigns.find((x) => x.id === c.id) ?? campaigns.find((x) => x.year === c.year);
    if (match) {
      campaignIds.set(c.id, match.id);
      continue;
    }
    const id = campaigns.some((x) => x.id === c.id) ? createId('c_') : c.id;
    const added: Campaign = { ...c, id };
    campaigns.push(added);
    write.campaigns.push(added);
    campaignIds.set(c.id, id);
    counts.campaignsAdded++;
  }

  const citizens = [...current.citizens];
  const citizenIds = new Map<string, string>();
  for (const c of incoming.citizens) {
    if (!/^\d{12}$/.test(c.cccd ?? '') || !c.fullName?.trim() || !c.birthDate) {
      counts.citizensInvalid++;
      continue;
    }
    const index = citizens.findIndex((x) => x.cccd === c.cccd);
    if (index >= 0) {
      const existing = citizens[index];
      const merged: Citizen = { ...fillFrom(existing, c), id: existing.id, createdAt: existing.createdAt, updatedAt: stamp };
      citizens[index] = merged;
      write.citizens.push(merged);
      citizenIds.set(c.id, existing.id);
      counts.citizensUpdated++;
    } else {
      const id = citizens.some((x) => x.id === c.id) ? createId('p_') : c.id;
      const added: Citizen = { ...c, id };
      citizens.push(added);
      write.citizens.push(added);
      citizenIds.set(c.id, id);
      counts.citizensAdded++;
    }
  }

  const screenings = [...current.screenings];
  for (const s of incoming.screenings) {
    const campaignId = campaignIds.get(s.campaignId);
    const citizenId = citizenIds.get(s.citizenId);
    if (!campaignId || !citizenId) {
      counts.screeningsSkipped++;
      continue;
    }
    const index = screenings.findIndex((x) => x.campaignId === campaignId && x.citizenId === citizenId);
    if (index >= 0) {
      const existing = screenings[index];
      if (existing.updatedAt > s.updatedAt) {
        counts.screeningsSkipped++;
        continue;
      }
      const replaced: Screening = { ...s, id: existing.id, campaignId, citizenId, createdAt: existing.createdAt };
      screenings[index] = replaced;
      write.screenings.push(replaced);
      counts.screeningsUpdated++;
    } else {
      const id = screenings.some((x) => x.id === s.id) ? createId('s_') : s.id;
      const added: Screening = { ...s, id, campaignId, citizenId };
      screenings.push(added);
      write.screenings.push(added);
      counts.screeningsAdded++;
    }
  }

  return { write, counts };
}
