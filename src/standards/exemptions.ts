/**
 * Mục III Phụ lục I Thông tư 105/2023/TT-BQP – Danh mục các bệnh miễn đăng ký nghĩa vụ quân sự:
 * "Là những bệnh thuộc diện miễn đăng ký nghĩa vụ quân sự, không nhận vào quân thường trực".
 *
 * Trạm y tế cấp xã lập danh sách công dân mắc các bệnh này, báo cáo Hội đồng nghĩa vụ quân sự
 * cấp xã (điểm d khoản 3 Điều 7).
 */
export interface ExemptDisease {
  id: string;
  no: number;
  name: string;
  icd10: string;
}

export const EXEMPT_DISEASES: ExemptDisease[] = [
  { id: 'tam-than', no: 1, name: 'Tâm thần', icd10: 'F20 đến F29' },
  { id: 'dong-kinh', no: 2, name: 'Động kinh', icd10: 'G40' },
  { id: 'parkinson', no: 3, name: 'Bệnh Parkinson', icd10: 'G20' },
  { id: 'mu-mot-mat', no: 4, name: 'Mù một mắt', icd10: 'H54.4' },
  { id: 'diec', no: 5, name: 'Điếc', icd10: 'H90' },
  { id: 'lao-xuong-khop', no: 6, name: 'Di chứng do lao xương khớp', icd10: 'B90.2' },
  { id: 'phong', no: 7, name: 'Di chứng do phong', icd10: 'B92' },
  { id: 'ac-tinh', no: 8, name: 'Các bệnh lý ác tính (U ác, bệnh máu ác tính)', icd10: 'C00 đến C97; D00 đến D09; D45 đến D47' },
  { id: 'hiv', no: 9, name: 'Người nhiễm HIV', icd10: 'B20 đến B24; Z21' },
  { id: 'khuyet-tat', no: 10, name: 'Người khuyết tật mức độ đặc biệt nặng và nặng', icd10: '' },
];

const byId = new Map(EXEMPT_DISEASES.map((d) => [d.id, d]));

export function exemptDisease(id: string): ExemptDisease | undefined {
  return byId.get(id);
}
