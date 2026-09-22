/// <reference types="jest" />
import { CATALOG_ENTRIES, DISEASE_CATALOG, catalogEntry, entryLabel, searchCatalog } from '../catalog';
import { EXEMPT_DISEASES } from '../exemptions';
import { parseScoreText } from '../scoreText';

describe('parseScoreText', () => {
  it.each([
    ['4', { min: 4, max: 4, temporary: false }],
    ['3T', { min: 3, max: 3, temporary: true }],
    ['4 T', { min: 4, max: 4, temporary: true }],
    ['2-3', { min: 2, max: 3, temporary: false }],
    ['4-5-6', { min: 4, max: 6, temporary: false }],
    ['5, 6', { min: 5, max: 6, temporary: false }],
    ['3-4 (dựa vào nghiệm pháp Lian)', { min: 3, max: 4, temporary: false }],
  ])('%s', (text, expected) => {
    expect(parseScoreText(text)).toEqual(expected);
  });

  it('returns null for scoring rules', () => {
    expect(parseScoreText('Cho điểm theo mục 1.1 và tăng lên 1 điểm')).toBeNull();
    expect(parseScoreText('Tính điểm theo mục 137')).toBeNull();
    expect(parseScoreText('')).toBeNull();
  });
});

describe('Mục II catalog', () => {
  it('covers the 13 specialties and items 1–205', () => {
    expect(DISEASE_CATALOG).toHaveLength(13);
    const numbers = DISEASE_CATALOG.flatMap((s) => s.items.map((i) => i.no));
    expect(numbers[0]).toBe('1');
    expect(numbers[numbers.length - 1]).toBe('205');
  });

  it('every scored cell is either a 1–6 score or a rule text', () => {
    for (const e of CATALOG_ENTRIES) {
      if (!e.parsed) expect(e.scoreText).toMatch(/điểm|Lấy/);
    }
  });

  it('has unique keys that resolve back', () => {
    const keys = new Set(CATALOG_ENTRIES.map((e) => e.key));
    expect(keys.size).toBe(CATALOG_ENTRIES.length);
    expect(catalogEntry(CATALOG_ENTRIES[10].key)).toBe(CATALOG_ENTRIES[10]);
  });

  it('keeps header context for nested rows', () => {
    const [nhe] = searchCatalog('viem giac mac nhe');
    expect(nhe.scoreText).toBe('3T');
    expect(nhe.context).toContain('Viêm giác mạc');
    expect(entryLabel(nhe)).toBe('Bệnh giác mạc – Viêm giác mạc – Nhẹ');
  });

  it('searches without diacritics', () => {
    expect(searchCatalog('ban chan bet').length).toBeGreaterThan(0);
    expect(searchCatalog('mong thit do 3')[0]?.scoreText).toBe('4');
  });
});

describe('Mục III', () => {
  it('lists the 10 exemption diseases', () => {
    expect(EXEMPT_DISEASES.map((d) => d.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(EXEMPT_DISEASES.find((d) => d.id === 'dong-kinh')?.icd10).toBe('G40');
  });
});
