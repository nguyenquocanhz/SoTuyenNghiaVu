/// <reference types="jest" />
import { decodeCccd, formatDateInput, formatMonthYearInput, isValidMonthYear, serviceAgeNote } from '../inputs';
import { fold, matchesQuery } from '../search';

describe('input helpers', () => {
  it('formats dates and month/year while typing', () => {
    expect(formatDateInput('05032007')).toBe('05/03/2007');
    expect(formatDateInput('5/3/2007')).toBe('05/03/2007');
    expect(formatMonthYearInput('022025')).toBe('02/2025');
    expect(isValidMonthYear('13/2025')).toBe(false);
    expect(isValidMonthYear('02/2025')).toBe(true);
  });

  it('decodes century, sex and birth year from a CCCD number', () => {
    expect(decodeCccd('001207012345')).toEqual({ birthYear: 2007, sex: 'male' });
    expect(decodeCccd('079305000001')).toEqual({ birthYear: 2005, sex: 'female' });
    expect(decodeCccd('001099012345')).toEqual({ birthYear: 1999, sex: 'male' });
    expect(decodeCccd('12345')).toBeNull();
  });

  it('notes ages outside 18–25 (27 with deferment)', () => {
    expect(serviceAgeNote('2007-03-05', 2027)).toBeNull();
    expect(serviceAgeNote('2010-01-01', 2027)).toContain('Chưa đủ 18');
    expect(serviceAgeNote('2000-06-01', 2027)).toContain('Trên 25');
    expect(serviceAgeNote('1995-06-01', 2027)).toContain('quá 27');
  });
});

describe('search', () => {
  it('folds Vietnamese diacritics', () => {
    expect(fold('Nguyễn Văn Đạt')).toBe('nguyen van dat');
    expect(matchesQuery('Nguyễn Văn Đạt 001207012345', 'dat 0012')).toBe(true);
    expect(matchesQuery('Nguyễn Văn Đạt', 'hung')).toBe(false);
  });
});
