import { useShallow } from 'zustand/react/shallow';

import type { Campaign, Citizen, Screening } from '@/domain/types';

import { useDataStore } from './data';
import { useSettingsStore } from './settings';

/** The campaign selected in settings, falling back to the most recent year. */
export function useActiveCampaign(): Campaign | undefined {
  const activeId = useSettingsStore((s) => s.activeCampaignId);
  return useDataStore((s) => s.campaigns.find((c) => c.id === activeId) ?? s.campaigns[0]);
}

export function useCitizen(id: string | undefined): Citizen | undefined {
  return useDataStore((s) => (id ? s.citizens.find((c) => c.id === id) : undefined));
}

export function useScreening(campaignId: string | undefined, citizenId: string | undefined): Screening | undefined {
  return useDataStore((s) => s.screenings.find((x) => x.campaignId === campaignId && x.citizenId === citizenId));
}

export function useCampaignScreenings(campaignId: string | undefined): Screening[] {
  return useDataStore(useShallow((s) => s.screenings.filter((x) => x.campaignId === campaignId)));
}
