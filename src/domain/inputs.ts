import { ageInYears, parseDecimal, viDateToIso } from './format';

export const collapseSpaces = (text: string) => text.trim().replace(/\s+/g, ' ');

/** Digits auto-formatted to dd/mm/yyyy (numeric keypads have no "/" key). */
export function formatDateInput(text: string): string {
  const full = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(text);
  if (full) return `${full[1].padStart(2, '0')}/${full[2].padStart(2, '0')}/${full[3]}`;
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Digits auto-formatted to mm/yyyy. */
export function formatMonthYearInput(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 6);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function isValidMonthYear(value: string): boolean {
  const m = /^(\d{2})\/(\d{4})$/.exec(value);
  return !!m && Number(m[1]) >= 1 && Number(m[1]) <= 12 && Number(m[2]) >= 1950 && Number(m[2]) <= 2100;
}

/** "mm/yyyy" → comparable number yyyymm. */
export function monthYearKey(value: string): number {
  const [m, y] = value.split('/').map(Number);
  return y * 100 + m;
}

/**
 * CCCD numbering (Thông tư 59/2021/TT-BCA): digits 1–3 province code, digit 4 sex + century
 * (0/1 → 19xx nam/nữ, 2/3 → 20xx nam/nữ, …), digits 5–6 the last two digits of the birth year.
 */
export function decodeCccd(id: string): { birthYear: number; sex: 'male' | 'female' } | null {
  if (!/^\d{12}$/.test(id)) return null;
  const d = Number(id[3]);
  return { birthYear: 1900 + Math.floor(d / 2) * 100 + Number(id.slice(4, 6)), sex: d % 2 === 0 ? 'male' : 'female' };
}

export function parseViDate(value: string): string | undefined {
  return viDateToIso(value.trim());
}

/** Optional decimal within [min, max]; returns error text when invalid. */
export function parseMeasurement(input: string, [min, max]: [number, number], label: string): { value?: number; error?: string } {
  if (!input.trim()) return {};
  const n = parseDecimal(input);
  if (n === undefined) return { error: `${label} không hợp lệ.` };
  if (n < min || n > max) return { error: `${label} phải trong khoảng ${min}–${max}.` };
  return { value: n };
}

/**
 * Độ tuổi gọi nhập ngũ (Điều 30 Luật Nghĩa vụ quân sự 2015): từ đủ 18 tuổi đến hết 25 tuổi;
 * công dân được đào tạo trình độ cao đẳng, đại học đã được tạm hoãn thì đến hết 27 tuổi.
 * Tuổi tính theo năm gọi nhập ngũ, only used for a warning.
 */
export function serviceAgeNote(birthIso: string, year: number): string | null {
  const age = ageInYears(birthIso, new Date(year, 0, 1));
  const endOfYearAge = ageInYears(birthIso, new Date(year, 11, 31));
  if (endOfYearAge < 18) return `Chưa đủ 18 tuổi trong năm ${year}.`;
  if (age > 27) return `Đã quá 27 tuổi vào năm ${year} – ngoài độ tuổi gọi nhập ngũ.`;
  if (age > 25) return `Trên 25 tuổi – chỉ gọi nhập ngũ nếu đã tạm hoãn để học cao đẳng, đại học (đến hết 27 tuổi).`;
  return null;
}
