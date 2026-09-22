import { create } from 'zustand';

import type { Finding } from '@/domain/types';
import type { CccdIdentity } from '@modules/cccd-nfc';

/**
 * In-memory hand-offs between screens. Never persisted: the identity read from the chip
 * only reaches the database after the health worker reviews and saves the citizen form.
 */
interface DraftState {
  identity: (CccdIdentity & { cccd: string }) | null;
  /** Weight measured on the Bluetooth scale, keyed by the screening form that asked for it. */
  weight: { requestKey: string; weightKg: number; source: 'ble' | 'manual' } | null;
  /** Disease row picked in the catalog for the screening form that opened the picker. */
  finding: { requestKey: string; finding: Finding } | null;
  setIdentity(identity: (CccdIdentity & { cccd: string }) | null): void;
  consumeIdentity(): (CccdIdentity & { cccd: string }) | null;
  setWeight(weight: DraftState['weight']): void;
  consumeWeight(requestKey: string): DraftState['weight'];
  setFinding(finding: DraftState['finding']): void;
  consumeFinding(requestKey: string): Finding | null;
}

export const useDraftStore = create<DraftState>()((set, get) => ({
  identity: null,
  weight: null,
  finding: null,
  setIdentity(identity) {
    set({ identity });
  },
  consumeIdentity() {
    const identity = get().identity;
    set({ identity: null });
    return identity;
  },
  setWeight(weight) {
    set({ weight });
  },
  consumeWeight(requestKey) {
    const weight = get().weight;
    if (!weight || weight.requestKey !== requestKey) return null;
    set({ weight: null });
    return weight;
  },
  setFinding(finding) {
    set({ finding });
  },
  consumeFinding(requestKey) {
    const f = get().finding;
    if (!f || f.requestKey !== requestKey) return null;
    set({ finding: null });
    return f.finding;
  },
}));
