/// <reference types="jest" />
import {
  ageInYears,
  createId,
  formatDate,
  formatDateTime,
  formatNumber,
  formatShortDate,
  formatTime,
  isoToViDate,
  isValidIsoDate,
  parseDecimal,
  roundTo,
  viDateToIso,
} from '@/domain/format';

describe('formatNumber', () => {
  it('uses a comma as decimal separator and 1 decimal by default', () => {
    expect(formatNumber(65.4)).toBe('65,4');
    expect(formatNumber(65)).toBe('65,0');
    expect(formatNumber(0)).toBe('0,0');
  });

  it('respects the requested number of decimals', () => {
    expect(formatNumber(65.456, 2)).toBe('65,46');
    expect(formatNumber(65.4, 0)).toBe('65');
    expect(formatNumber(36.5, 2)).toBe('36,50');
    expect(formatNumber(0.5, 0)).toBe('1');
  });

  it('groups thousands with dots', () => {
    expect(formatNumber(100, 0)).toBe('100');
    expect(formatNumber(2500, 0)).toBe('2.500');
    expect(formatNumber(1234.5)).toBe('1.234,5');
    expect(formatNumber(1234567, 0)).toBe('1.234.567');
    expect(formatNumber(1234567.891, 2)).toBe('1.234.567,89');
    expect(formatNumber(999.95, 1)).toBe('1.000,0');
  });

  it('formats negative numbers', () => {
    expect(formatNumber(-1.2)).toBe('-1,2');
    expect(formatNumber(-1.25, 1)).toBe('-1,3');
    expect(formatNumber(-1234.5)).toBe('-1.234,5');
    expect(formatNumber(-1234567, 0)).toBe('-1.234.567');
  });

  it('never shows a negative zero', () => {
    expect(formatNumber(-0.04, 1)).toBe('0,0');
    expect(formatNumber(-0.4, 0)).toBe('0');
    expect(formatNumber(-0, 2)).toBe('0,00');
  });

  it('rounds halves up like the decimal the user reads (binary noise ignored)', () => {
    // 22.95 is stored as 22.9499999…; the display must still agree with classifyBmi (23,0).
    expect(formatNumber(22.95, 1)).toBe('23,0');
    expect(formatNumber(1.005, 2)).toBe('1,01');
    expect(formatNumber(37.45, 1)).toBe('37,5');
    expect(formatNumber(390.45, 1)).toBe('390,5');
  });

  it('returns an em dash for missing or non-finite values', () => {
    expect(formatNumber(undefined)).toBe('—');
    expect(formatNumber(null)).toBe('—');
    expect(formatNumber(NaN)).toBe('—');
    expect(formatNumber(Infinity)).toBe('—');
    expect(formatNumber(-Infinity, 0)).toBe('—');
  });
});

describe('roundTo', () => {
  it('rounds to the given number of decimals', () => {
    expect(roundTo(1234.5678, 2)).toBe(1234.57);
    expect(roundTo(1234.5678, 0)).toBe(1235);
    expect(roundTo(70.0049, 2)).toBe(70);
  });

  it('rounds decimal halves away from zero despite binary representation', () => {
    expect(roundTo(22.95, 1)).toBe(23);
    expect(roundTo(22.94, 1)).toBe(22.9);
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(390.45, 1)).toBe(390.5);
    expect(roundTo(37.15 + 0.3, 1)).toBe(37.5);
    expect(roundTo(-1.25, 1)).toBe(-1.3);
    expect(roundTo(-22.95, 1)).toBe(-23);
  });

  it('returns a positive zero and passes non-finite values through', () => {
    expect(Object.is(roundTo(-0.04, 1), 0)).toBe(true);
    expect(roundTo(NaN, 1)).toBeNaN();
    expect(roundTo(Infinity, 1)).toBe(Infinity);
  });

  it('agrees with formatNumber on every 3-decimal value', () => {
    for (let k = 10_000; k <= 50_000; k += 7) {
      const v = k / 1000;
      expect(formatNumber(roundTo(v, 1), 1)).toBe(formatNumber(v, 1));
      expect(parseDecimal(formatNumber(v, 1))).toBe(roundTo(v, 1));
    }
  });
});

describe('parseDecimal', () => {
  it('accepts both comma and dot decimals', () => {
    expect(parseDecimal('65,4')).toBe(65.4);
    expect(parseDecimal('65.4')).toBe(65.4);
    expect(parseDecimal('65')).toBe(65);
    expect(parseDecimal('0,05')).toBe(0.05);
  });

  it('ignores surrounding and inner whitespace', () => {
    expect(parseDecimal('  36,6 ')).toBe(36.6);
    expect(parseDecimal('1 234,5')).toBe(1234.5);
  });

  it('accepts negative numbers', () => {
    expect(parseDecimal('-3')).toBe(-3);
    expect(parseDecimal('-0,5')).toBe(-0.5);
  });

  it('rejects malformed input', () => {
    for (const bad of ['', '   ', 'abc', '65,4,3', '1.234,5', '.5', '5.', '5,', '6e2', '+5', '--5', '65kg', 'NaN', 'Infinity']) {
      expect(parseDecimal(bad)).toBeUndefined();
    }
  });
});

describe('date formatting', () => {
  const d = new Date(2026, 8, 7, 5, 3, 59);

  it('formats date, time and both with zero padding', () => {
    expect(formatDate(d)).toBe('07/09/2026');
    expect(formatTime(d)).toBe('05:03');
    expect(formatDateTime(d)).toBe('05:03 · 07/09/2026');
    expect(formatShortDate(d)).toBe('07/09');
  });

  it('accepts ISO strings', () => {
    const iso = d.toISOString();
    expect(formatDate(iso)).toBe('07/09/2026');
    expect(formatDateTime(iso)).toBe('05:03 · 07/09/2026');
  });
});

describe('ageInYears', () => {
  it('counts completed years around the birthday', () => {
    const birth = '2000-09-17';
    expect(ageInYears(birth, new Date(2026, 8, 16, 23, 59))).toBe(25);
    expect(ageInYears(birth, new Date(2026, 8, 17, 0, 0))).toBe(26);
    expect(ageInYears(birth, new Date(2026, 8, 18))).toBe(26);
    expect(ageInYears(birth, new Date(2026, 7, 30))).toBe(25);
    expect(ageInYears(birth, new Date(2026, 9, 1))).toBe(26);
    expect(ageInYears(birth, new Date(2027, 0, 1))).toBe(26);
  });

  it('handles 29 February birthdays in non-leap years', () => {
    expect(ageInYears('2004-02-29', new Date(2025, 1, 28))).toBe(20);
    expect(ageInYears('2004-02-29', new Date(2025, 2, 1))).toBe(21);
    expect(ageInYears('2004-02-29', new Date(2028, 1, 29))).toBe(24);
  });

  it('is 0 before the first birthday', () => {
    expect(ageInYears('2026-01-15', new Date(2026, 8, 17))).toBe(0);
    expect(ageInYears('2025-12-15', new Date(2026, 8, 17))).toBe(0);
  });
});

describe('ISO / Vietnamese date conversion', () => {
  it('validates ISO calendar dates', () => {
    expect(isValidIsoDate('2024-02-29')).toBe(true);
    expect(isValidIsoDate('2023-02-29')).toBe(false);
    expect(isValidIsoDate('2024-13-01')).toBe(false);
    expect(isValidIsoDate('2024-04-31')).toBe(false);
    expect(isValidIsoDate('2024-1-01')).toBe(false);
    expect(isValidIsoDate('17/09/1990')).toBe(false);
  });

  it('converts DD/MM/YYYY to ISO', () => {
    expect(viDateToIso('17/09/1990')).toBe('1990-09-17');
    expect(viDateToIso('1/2/2005')).toBe('2005-02-01');
    expect(viDateToIso(' 01/02/2005 ')).toBe('2005-02-01');
    expect(viDateToIso('29/02/2024')).toBe('2024-02-29');
  });

  it('rejects impossible or malformed Vietnamese dates', () => {
    expect(viDateToIso('31/02/2000')).toBeUndefined();
    expect(viDateToIso('29/02/2023')).toBeUndefined();
    expect(viDateToIso('00/01/2000')).toBeUndefined();
    expect(viDateToIso('2000-02-01')).toBeUndefined();
    expect(viDateToIso('1/2/05')).toBeUndefined();
    expect(viDateToIso('')).toBeUndefined();
  });

  it('converts ISO back to DD/MM/YYYY and round-trips', () => {
    expect(isoToViDate('1990-09-17')).toBe('17/09/1990');
    for (const vi of ['01/01/2000', '31/12/1999', '29/02/2024']) {
      expect(isoToViDate(viDateToIso(vi)!)).toBe(vi);
    }
  });
});

describe('createId', () => {
  it('prefixes and generates distinct ids', () => {
    const ids = new Set(Array.from({ length: 200 }, () => createId('m_')));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id.startsWith('m_')).toBe(true);
  });
});
