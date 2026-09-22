import { fold } from '@/domain/search';

import { PROVINCES, type Commune, type Province } from './adminUnits';

/** Tên đơn vị có loại, viết như văn bản: "xã Tân Lợi", "phường Đồng Xoài", "đặc khu Phú Quốc". */
export const communeFullName = (c: Commune) => `${c.type} ${c.name}`;
export const provinceFullName = (p: Province) => `${p.type === 'thành phố' ? 'Thành phố' : 'Tỉnh'} ${p.name}`;

/** Tên trạm y tế cấp xã theo cách gọi của ngành y tế: "Trạm Y tế xã Tân Lợi". */
export const stationName = (c: Commune) => `Trạm Y tế ${communeFullName(c)}`;

/** Dòng cơ quan chủ quản trên phiếu, báo cáo: "UBND xã Tân Lợi" (in hoa khi in). */
export const parentUnitName = (c: Commune) => `UBND ${communeFullName(c)}`;

const provinceByCode = new Map(PROVINCES.map((p) => [p.code, p]));

export function findProvince(code: string | undefined): Province | undefined {
  return code ? provinceByCode.get(code) : undefined;
}

export function findCommune(provinceCode: string | undefined, communeCode: string | undefined): Commune | undefined {
  return findProvince(provinceCode)?.communes.find((c) => c.code === communeCode);
}

/**
 * Soft check for the "Tổ trưởng" field: a person's name has 2–7 words of letters only and none of the
 * words that show a unit or form title was typed by mistake (e.g. "Phiếu sơ tuyển", "DEMO").
 */
export function looksLikePersonName(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  const words = v.split(/\s+/);
  if (words.length < 2 || words.length > 7) return false;
  if (!words.every((w) => /^\p{L}+$/u.test(w))) return false;
  return !/(^| )(phieu|tram|so tuyen|bao cao|ubnd|demo|test|y te)( |$)/.test(fold(v));
}
