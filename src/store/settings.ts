import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { KnownDevice } from '@/ble/types';

import { persistStorage } from './storage';

export interface Settings {
  /** Mã tỉnh/thành phố và mã xã/phường/đặc khu đã chọn (Quyết định 19/2025/QĐ-TTg). */
  provinceCode?: string;
  communeCode?: string;
  /** Dòng 1 góc trái phiếu/báo cáo – cơ quan chủ quản, ví dụ "UBND XÃ AN BÌNH". */
  parentUnit: string;
  /** Dòng 2 – đơn vị thực hiện, ví dụ "TRẠM Y TẾ XÃ AN BÌNH". */
  unitName: string;
  /** Địa danh ghi ở ngày tháng báo cáo. */
  placeName: string;
  /** Tổ trưởng tổ sơ tuyển sức khỏe (ký phiếu, báo cáo). */
  teamLeader: string;
  /** Người khám mặc định ghi vào phiếu. */
  examiner: string;
  activeCampaignId?: string;
  measureDurationSec: number;
  minWeightKg: number;
  /** Use the built-in simulator instead of a real Bluetooth scale. */
  demoMode: boolean;
  demoWeightKg: number;
  scaleDevice?: KnownDevice;
}

export const DEFAULT_SETTINGS: Settings = {
  parentUnit: '',
  unitName: '',
  placeName: '',
  teamLeader: '',
  examiner: '',
  measureDurationSec: 15,
  minWeightKg: 20,
  demoMode: false,
  demoWeightKg: 58.6,
};

interface SettingsState extends Settings {
  update(patch: Partial<Settings>): void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      update(patch) {
        set(patch);
      },
    }),
    { name: 'stnv.settings', storage: persistStorage, version: 1 },
  ),
);

export function unitConfigured(s: Pick<Settings, 'unitName' | 'teamLeader'>): boolean {
  return s.unitName.trim().length > 0 && s.teamLeader.trim().length > 0;
}
