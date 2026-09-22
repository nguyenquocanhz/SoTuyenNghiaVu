/// <reference types="jest" />
import { planMerge, type DataSet } from '../merge';
import type { Campaign, Citizen, Screening } from '../types';

const campaign = (id: string, year: number): Campaign => ({ id, year, name: `Đợt ${year}`, startDate: `${year - 1}-09-01`, createdAt: '', updatedAt: '' });
const citizen = (id: string, cccd: string, patch: Partial<Citizen> = {}): Citizen => ({
  id,
  cccd,
  fullName: 'NGUYỄN VĂN A',
  birthDate: '2003-01-15',
  sex: 'male',
  source: 'manual',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});
const screening = (id: string, campaignId: string, citizenId: string, updatedAt: string, patch: Partial<Screening> = {}): Screening => ({
  id,
  campaignId,
  citizenId,
  screenedOn: '2026-09-17',
  vision: {},
  findings: [],
  exemptionIds: [],
  outcome: 'pending',
  createdAt: updatedAt,
  updatedAt,
  ...patch,
});

const NOW = new Date('2026-09-17T08:00:00.000Z');

describe('planMerge', () => {
  it('maps campaigns by year and adds new citizens and screenings into an existing campaign', () => {
    const current: DataSet = { campaigns: [campaign('c-phone', 2027)], citizens: [], screenings: [] };
    const incoming: DataSet = {
      campaigns: [campaign('c-file', 2027)],
      citizens: [citizen('p-file', '001203000001', { ethnicity: 'Kinh' })],
      screenings: [screening('s-file', 'c-file', 'p-file', '2026-09-17T07:00:00.000Z', { outcome: 'other' })],
    };
    const { write, counts } = planMerge(current, incoming, NOW);
    expect(counts).toMatchObject({ campaignsAdded: 0, citizensAdded: 1, screeningsAdded: 1 });
    expect(write.campaigns).toEqual([]);
    expect(write.screenings[0]).toMatchObject({ campaignId: 'c-phone', citizenId: 'p-file', outcome: 'other' });
  });

  it('matches citizens by CCCD, filling in fields without erasing existing ones', () => {
    const current: DataSet = {
      campaigns: [campaign('c1', 2027)],
      citizens: [citizen('p-phone', '001203000001', { phone: '0900000000', occupation: '' })],
      screenings: [],
    };
    const incoming: DataSet = {
      campaigns: [],
      citizens: [citizen('p-file', '001203000001', { occupation: 'Lao động tự do', phone: undefined, fatherName: 'Nguyễn Văn B' })],
      screenings: [],
    };
    const { write, counts } = planMerge(current, incoming, NOW);
    expect(counts.citizensUpdated).toBe(1);
    expect(write.citizens[0]).toMatchObject({
      id: 'p-phone',
      phone: '0900000000',
      occupation: 'Lao động tự do',
      fatherName: 'Nguyễn Văn B',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: NOW.toISOString(),
    });
  });

  it('keeps the newer screening of the same citizen and campaign', () => {
    const current: DataSet = {
      campaigns: [campaign('c1', 2027)],
      citizens: [citizen('p1', '001203000001')],
      screenings: [screening('s-phone', 'c1', 'p1', '2026-09-17T09:00:00.000Z', { outcome: 'eligible' })],
    };
    const older = planMerge(current, { campaigns: [campaign('c1', 2027)], citizens: [citizen('p1', '001203000001')], screenings: [screening('s-file', 'c1', 'p1', '2026-09-17T07:00:00.000Z')] }, NOW);
    expect(older.counts.screeningsSkipped).toBe(1);
    expect(older.write.screenings).toEqual([]);

    const newer = planMerge(current, { campaigns: [campaign('c1', 2027)], citizens: [citizen('p1', '001203000001')], screenings: [screening('s-file', 'c1', 'p1', '2026-09-17T10:00:00.000Z', { outcome: 'other' })] }, NOW);
    expect(newer.counts.screeningsUpdated).toBe(1);
    expect(newer.write.screenings[0]).toMatchObject({ id: 's-phone', outcome: 'other' });
  });

  it('adds a campaign for a new year and skips citizens without a valid CCCD', () => {
    const { write, counts } = planMerge(
      { campaigns: [], citizens: [], screenings: [] },
      { campaigns: [campaign('c2028', 2028)], citizens: [citizen('bad', '123')], screenings: [screening('s', 'c2028', 'bad', '2026-09-17T07:00:00.000Z')] },
      NOW,
    );
    expect(counts).toMatchObject({ campaignsAdded: 1, citizensInvalid: 1, screeningsSkipped: 1 });
    expect(write.campaigns.map((c) => c.year)).toEqual([2028]);
  });
});
