import type { Score } from './types';

/**
 * Mục II.8 Phụ lục I Thông tư 105/2023/TT-BQP.
 *
 * Số 99 – Huyết áp khi nghỉ (mmHg):
 *   HA tối đa: 110–120 → 1 · 121–130 hoặc 100–109 → 2 · 131–139 hoặc 90–99 → 3
 *              140–149 hoặc < 90 → 4 · 150–159 → 5 · ≥ 160 → 6
 *   HA tối thiểu: ≤ 80 → 1 · 81–85 → 2 · 86–89 → 3 · 90–99 → 4 · ≥ 100 → 5
 *   Mục IV Số 99: tâm thu và tâm trương khác mức thì lấy mức cao hơn.
 * Số 101 – Mạch khi nghỉ (lần/phút):
 *   60–80 → 1 · 81–85 hoặc 57–59 → 2 · 86–90 hoặc 55–56 → 3 · 50–54 → 3–4 (nghiệm pháp Lian)
 *   91–99 → 4 · ≥ 100 hoặc < 50 → 5, 6
 */

export function systolicScore(sys: number): Score {
  const v = Math.round(sys);
  if (v >= 160) return 6;
  if (v >= 150) return 5;
  if (v >= 140 || v < 90) return 4;
  if (v >= 131 || v <= 99) return 3;
  if (v >= 121 || v <= 109) return 2;
  return 1;
}

export function diastolicScore(dia: number): Score {
  const v = Math.round(dia);
  if (v >= 100) return 5;
  if (v >= 90) return 4;
  if (v >= 86) return 3;
  if (v >= 81) return 2;
  return 1;
}

export interface ScoreSuggestion {
  score: Score;
  /** Highest score the table allows for this band (e.g. 50–54 lần/phút → 3–4). */
  maxScore: Score;
  note?: string;
}

export function bloodPressureScore(sys: number, dia: number): Score {
  return Math.max(systolicScore(sys), diastolicScore(dia)) as Score;
}

export function pulseScore(bpm: number): ScoreSuggestion {
  const v = Math.round(bpm);
  if (v >= 100) return { score: 5, maxScore: 6, note: 'đo lại khi nghỉ; mạch thường xuyên khi nghỉ ≥ 90 lần/phút cần khám chuyên khoa tim mạch và nội tiết tại bệnh viện (Mục IV số 101)' };
  if (v < 50) return { score: 5, maxScore: 6, note: 'đo lại khi nghỉ; mạch thường xuyên < 50 lần/phút cần làm nghiệm pháp Atropin, khám chuyên khoa tim mạch (Mục IV số 101)' };
  if (v >= 91) return { score: 4, maxScore: 4, note: 'mạch thường xuyên khi nghỉ ≥ 90 lần/phút cần khám chuyên khoa tim mạch và nội tiết tại bệnh viện (Mục IV số 101)' };
  if (v >= 86) return { score: 3, maxScore: 3 };
  if (v >= 81) return { score: 2, maxScore: 2 };
  if (v >= 60) return { score: 1, maxScore: 1 };
  if (v >= 57) return { score: 2, maxScore: 2 };
  if (v >= 55) return { score: 3, maxScore: 3 };
  return { score: 3, maxScore: 4, note: '3–4 điểm tuỳ nghiệm pháp Lian (Mục IV số 101)' };
}

export interface RecordedBloodPressure {
  systolic: number;
  diastolic: number;
  readings: 1 | 2;
  /** Hai lần đo chênh nhau trên 10 mmHg – phải đo lại (Mục IV số 99, bước 8). */
  needsRemeasure: boolean;
}

/**
 * Mục IV số 99: đo ít nhất hai lần, cách nhau 1–2 phút; chênh trên 10 mmHg thì đo lại;
 * giá trị ghi nhận là trung bình hai lần đo cuối, không làm tròn quá hàng đơn vị.
 */
export function recordedBloodPressure(r: { systolic?: number; diastolic?: number; systolic2?: number; diastolic2?: number }): RecordedBloodPressure | undefined {
  const first = r.systolic && r.diastolic ? [r.systolic, r.diastolic] : undefined;
  const second = r.systolic2 && r.diastolic2 ? [r.systolic2, r.diastolic2] : undefined;
  if (first && second) {
    return {
      systolic: Math.round((first[0] + second[0]) / 2),
      diastolic: Math.round((first[1] + second[1]) / 2),
      readings: 2,
      needsRemeasure: Math.abs(first[0] - second[0]) > 10 || Math.abs(first[1] - second[1]) > 10,
    };
  }
  const only = first ?? second;
  return only ? { systolic: only[0], diastolic: only[1], readings: 1, needsRemeasure: false } : undefined;
}

/** Phân độ huyết áp theo Quyết định 3192/QĐ-BYT (Mục IV Số 100). */
export function bloodPressureGrade(sys: number, dia: number): string {
  if (sys >= 140 && dia < 90) return 'Tăng huyết áp tâm thu đơn độc';
  if (sys >= 180 || dia >= 110) return 'Tăng huyết áp độ 3';
  if (sys >= 160 || dia >= 100) return 'Tăng huyết áp độ 2';
  if (sys >= 140 || dia >= 90) return 'Tăng huyết áp độ 1';
  if (sys >= 130 || dia >= 85) return 'Tiền tăng huyết áp';
  if (sys >= 120 || dia >= 80) return 'Huyết áp bình thường';
  return 'Huyết áp tối ưu';
}
