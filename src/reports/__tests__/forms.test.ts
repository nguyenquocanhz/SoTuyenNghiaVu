/// <reference types="jest" />
import type { Campaign, Citizen, Screening } from '@/domain/types';

import { book2kCsv, book2kHtml, campaignStats, report2aHtml, screeningFormsHtml } from '../forms';
import { esc, fill } from '../html';

const unit = { parentUnit: 'UBND XÃ AN BÌNH', unitName: 'TRẠM Y TẾ XÃ AN BÌNH', placeName: 'An Bình', teamLeader: 'Nguyễn Thị Hoa' };

const campaign: Campaign = { id: 'c1', year: 2027, name: 'Sơ tuyển 2027', plannedCount: 5, startDate: '2026-09-01', createdAt: '', updatedAt: '' };

const citizen: Citizen = {
  id: 'p1',
  fullName: 'Trần Văn <Nam>',
  birthDate: '2007-03-05',
  sex: 'male',
  cccd: '001207012345',
  ethnicity: 'Kinh',
  fatherName: 'Trần Văn Bố',
  fatherBirthYear: '1980',
  currentAddress: 'Thôn 1, "An Bình"',
  source: 'manual',
  createdAt: '',
  updatedAt: '',
};

const screening = (patch: Partial<Screening>): Screening => ({
  id: 's',
  campaignId: 'c1',
  citizenId: 'p1',
  screenedOn: '2026-09-17',
  vision: {},
  findings: [],
  exemptionIds: [],
  outcome: 'eligible',
  createdAt: '',
  updatedAt: '',
  ...patch,
});

describe('html helpers', () => {
  it('escapes markup', () => {
    expect(esc('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });

  it('prints a dotted blank for empty values', () => {
    expect(fill('')).toContain('class="dots"');
    expect(fill('Kinh')).toContain('Kinh');
  });
});

describe('Mẫu 2 – phiếu sơ tuyển', () => {
  it('contains the form sections and rounded measurements', () => {
    const html = screeningFormsHtml(unit, [
      { citizen, screening: screening({ heightCm: 165.5, weightKg: 55.49, chestCm: 82, pulse: 76, systolic: 120, diastolic: 80, teamOpinion: 'Đủ điều kiện' }) },
    ]);
    expect(html).toContain('Phiếu sơ tuyển sức khỏe nghĩa vụ quân sự');
    expect(html).toContain('I. SƠ YẾU LÝ LỊCH');
    expect(html).toContain('II. KẾT QUẢ SƠ TUYỂN SỨC KHỎE');
    expect(html).toContain('III. Ý KIẾN TỔ SƠ TUYỂN');
    expect(html).toContain('Trần Văn &lt;Nam&gt;');
    expect(html).toContain('<b class="v">166</b> cm');
    expect(html).toContain('<b class="v">55</b> kg');
    expect(html).toContain('TỔ SƠ TUYỂN SỨC KHỎE');
    expect(html).toContain('Ngày 17 tháng 09 năm 2026');
  });
});

describe('Mẫu 2a / 2k', () => {
  const list = [
    screening({ id: 'a', outcome: 'eligible' }),
    screening({ id: 'b', outcome: 'exempt', exemptionIds: ['diec'] }),
    screening({ id: 'c', outcome: 'other', outcomeReason: 'Thể lực loại 5 (Cao đứng 153 cm)' }),
    screening({ id: 'd', outcome: 'pending' }),
    screening({ id: 'e', campaignId: 'other', outcome: 'eligible' }),
  ];

  it('counts results of the campaign only', () => {
    const stats = campaignStats(campaign, list);
    expect(stats).toMatchObject({ planned: 5, screened: 3, eligible: 1, exempt: 1, other: 1, pending: 1 });
    expect(stats.otherReasons).toEqual([{ reason: 'Không đạt tiêu chuẩn thể lực', count: 1 }]);
  });

  it('renders the report rows', () => {
    const html = report2aHtml(unit, campaign, campaignStats(campaign, list), new Date(2026, 8, 20), 'Ban CHQS xã');
    expect(html).toContain('Kết quả sơ tuyển sức khỏe nghĩa vụ quân sự');
    expect(html).toContain('Năm 2027');
    expect(html).toContain('An Bình, ngày 20 tháng 09 năm 2026');
    expect(html).toContain('- Ban CHQS xã');
  });

  it('marks the outcome columns of the statistics book', () => {
    const html = book2kHtml(unit, campaign, [{ citizen, screening: list[1] }]);
    expect(html).toContain('SỔ THỐNG KÊ');
    expect(html).toContain('Thuộc diện miễn làm NVQS');
    expect(html).toContain('Điếc (H90)');
  });

  it('exports CSV with BOM, quoting and a text CCCD', () => {
    const csv = book2kCsv([{ citizen, screening: list[2] }]);
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain(`"Thôn 1, ""An Bình"""`);
    expect(lines[1]).toContain("'001207012345");
  });
});
