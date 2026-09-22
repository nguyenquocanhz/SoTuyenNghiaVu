import { exemptDisease } from '@/standards/exemptions';

import { formatNumber } from './format';
import { assessPhysique, type PhysiqueAssessment } from './physique';
import type { Citizen, Score, Screening, ScreeningOutcome, Severity } from './types';
import { assessVision, type VisionAssessment } from './vision';
import { bloodPressureGrade, bloodPressureScore, pulseScore, recordedBloodPressure, type RecordedBloodPressure, type ScoreSuggestion } from './vitals';

export const OUTCOME_LABELS: Record<ScreeningOutcome, string> = {
  pending: 'Chưa kết luận',
  eligible: 'Đủ điều kiện khám sức khỏe NVQS',
  exempt: 'Không đủ ĐK – thuộc diện miễn làm NVQS',
  other: 'Không đủ ĐK – lý do khác',
};

export const OUTCOME_SHORT: Record<ScreeningOutcome, string> = {
  pending: 'Chưa kết luận',
  eligible: 'Đủ điều kiện',
  exempt: 'Miễn NVQS',
  other: 'Không đủ ĐK',
};

export const OUTCOME_SEVERITY: Record<ScreeningOutcome, Severity> = {
  pending: 'unknown',
  eligible: 'normal',
  exempt: 'danger',
  other: 'warning',
};

/** Tiêu chuẩn chung thực hiện NVQS: đạt sức khỏe loại 1, 2, 3 (điểm a khoản 1 Điều 4 TT 105/2023/TT-BQP). */
export const MAX_ACCEPTED_SCORE: Score = 3;

export type FailureGroup = 'physique' | 'eye' | 'cardio' | 'disease';

/** Một chỉ tiêu bị điểm 4–6: không đạt loại 1–3 (Điều 6: loại N khi có ít nhất 1 chỉ tiêu bị điểm N). */
export interface Failure {
  group: FailureGroup;
  score: Score;
  text: string;
}

export interface ScreeningAssessment {
  physique: PhysiqueAssessment;
  vision: VisionAssessment;
  bloodPressure?: { score: Score; grade: string; recorded: RecordedBloodPressure };
  pulse?: ScoreSuggestion;
  /** Điểm cao nhất của các chỉ tiêu đã có – phân loại sơ bộ (Điều 6), chỉ để tham khảo. */
  preliminaryScore?: Score;
  preliminaryTemporary: boolean;
  failures: Failure[];
  /** Phép đo thông tư yêu cầu nhưng còn thiếu, nên chưa kết luận được. */
  missing: string[];
  suggestedOutcome: ScreeningOutcome;
  suggestedReason?: string;
  warnings: string[];
}

const tenths = (v: number) => `${formatNumber(v, Number.isInteger(v) ? 0 : 1)}/10`;
const diopterText = (d: number) => `${d > 0 ? '+' : ''}${formatNumber(d, Number.isInteger(d) ? 0 : 2)}D`;

/** "có kính MP 7/10, MT 7/10; cận thị MP -4D, MT -4D". */
export function visionDetails(v: Screening['vision']): string {
  const parts: string[] = [];
  if (v.rightUncorrected !== undefined && v.leftUncorrected !== undefined) {
    parts.push(`không kính MP ${tenths(v.rightUncorrected)}, MT ${tenths(v.leftUncorrected)}`);
  }
  if (v.rightCorrected !== undefined && v.leftCorrected !== undefined) {
    parts.push(`có kính MP ${tenths(v.rightCorrected)}, MT ${tenths(v.leftCorrected)}`);
  }
  const eyes = (
    [
      ['MP', v.rightDiopter],
      ['MT', v.leftDiopter],
    ] as const
  ).filter((e): e is readonly ['MP' | 'MT', number] => e[1] !== undefined && e[1] !== 0);
  if (eyes.length) {
    const kind = eyes.every(([, d]) => d < 0) ? 'cận thị' : eyes.every(([, d]) => d > 0) ? 'viễn thị' : 'tật khúc xạ';
    parts.push(`${kind} ${eyes.map(([eye, d]) => `${eye} ${diopterText(d)}`).join(', ')}`);
  }
  return parts.join('; ');
}

export function assessScreening(citizen: Pick<Citizen, 'sex'>, s: Screening): ScreeningAssessment {
  const physique = assessPhysique({ sex: citizen.sex, heightCm: s.heightCm, weightKg: s.weightKg, chestCm: s.chestCm });
  const vision = assessVision(s.vision);
  const recorded = recordedBloodPressure(s);
  const bloodPressure = recorded
    ? { score: bloodPressureScore(recorded.systolic, recorded.diastolic), grade: bloodPressureGrade(recorded.systolic, recorded.diastolic), recorded }
    : undefined;
  const pulse = s.pulse ? pulseScore(s.pulse) : undefined;

  const failures: Failure[] = [];
  const missing: string[] = [];
  const warnings: string[] = [];

  // Mục I – thể lực.
  if (physique.score && physique.score > MAX_ACCEPTED_SCORE) {
    const weak = physique.components.filter((c) => c.score > MAX_ACCEPTED_SCORE);
    failures.push({
      group: 'physique',
      score: physique.score,
      text: `Thể lực loại ${physique.score} (${weak.map((c) => `${c.label} ${formatNumber(c.value, c.criterion === 'bmi' ? 1 : 0)} ${c.unit}`).join(', ')})`,
    });
  }
  const missingPhysique = physique.missing.map((m) => ({ height: 'chiều cao', weight: 'cân nặng', chest: 'vòng ngực', bmi: 'BMI' })[m]);
  if (missingPhysique.length) missing.push(`Chưa đo ${missingPhysique.join(', ')} (Mục I Phụ lục I)`);

  // Mục II.1 – thị lực, tật khúc xạ (số 1–3, sửa đổi bởi TT 106/2025).
  if (vision.score && vision.score > MAX_ACCEPTED_SCORE) {
    failures.push({ group: 'eye', score: vision.score, text: `Thị lực ${vision.score} điểm (${visionDetails(s.vision)})` });
  } else if (vision.needsCorrection) {
    missing.push('Tổng thị lực không kính dưới 19/10 – phải đo thị lực sau chỉnh kính tối đa (TT 106/2025)');
  }

  // Mục II.8 – huyết áp (số 99), mạch (số 101).
  if (bloodPressure) {
    const { systolic, diastolic, readings, needsRemeasure } = bloodPressure.recorded;
    const bp = `${systolic}/${diastolic} mmHg${readings === 2 ? ' (trung bình 2 lần đo)' : ''}`;
    if (needsRemeasure) {
      missing.push('Huyết áp 2 lần đo chênh nhau trên 10 mmHg – nghỉ trên 5 phút rồi đo lại (Mục IV số 99)');
    } else if (bloodPressure.score > MAX_ACCEPTED_SCORE) {
      failures.push({ group: 'cardio', score: bloodPressure.score, text: `Huyết áp ${bp} – ${bloodPressure.grade} (${bloodPressure.score} điểm)` });
      if (readings === 1) warnings.push('Huyết áp mới đo 1 lần: nên đo lần 2 cách 1–2 phút và lấy trung bình (Mục IV số 99).');
    }
  }
  if (pulse) {
    if (pulse.score > MAX_ACCEPTED_SCORE) failures.push({ group: 'cardio', score: pulse.score, text: `Mạch ${s.pulse} lần/phút (${pulse.score}${pulse.maxScore > pulse.score ? `–${pulse.maxScore}` : ''} điểm)` });
    if (pulse.note) warnings.push(`Mạch ${s.pulse} lần/phút: ${pulse.note}.`);
  }

  // Mục II – bệnh, tật, dị tật, dị dạng đã ghi nhận.
  for (const f of s.findings) {
    if (f.score > MAX_ACCEPTED_SCORE) failures.push({ group: 'disease', score: f.score, text: `${f.label} (${f.score}${f.temporary ? 'T' : ''} điểm)` });
    if (f.temporary) warnings.push(`${f.label}: ${f.score}T – bệnh có thể thay đổi sau điều trị, hướng dẫn công dân đến cơ sở y tế (khoản 3 Điều 9).`);
  }

  const scored: { score: Score; temporary: boolean }[] = [];
  if (physique.score) scored.push({ score: physique.score, temporary: false });
  if (vision.score) scored.push({ score: vision.score, temporary: false });
  if (bloodPressure && !bloodPressure.recorded.needsRemeasure) scored.push({ score: bloodPressure.score, temporary: false });
  if (pulse) scored.push({ score: pulse.score, temporary: false });
  for (const f of s.findings) scored.push({ score: f.score, temporary: f.temporary });
  const preliminaryScore = scored.length ? (Math.max(...scored.map((x) => x.score)) as Score) : undefined;
  const preliminaryTemporary = preliminaryScore !== undefined && scored.some((x) => x.score === preliminaryScore && x.temporary);

  let suggestedOutcome: ScreeningOutcome;
  let suggestedReason: string | undefined;
  const exemptNames = s.exemptionIds.map((id) => exemptDisease(id)?.name ?? id);
  if (exemptNames.length) {
    suggestedOutcome = 'exempt';
    suggestedReason = `Mắc bệnh thuộc danh mục miễn đăng ký NVQS: ${exemptNames.join('; ')}`;
  } else if (failures.length) {
    suggestedOutcome = 'other';
    suggestedReason = failures.map((f) => f.text).join('; ');
  } else if (missing.length) {
    suggestedOutcome = 'pending';
    suggestedReason = missing.join('; ');
  } else {
    suggestedOutcome = 'eligible';
  }

  return { physique, vision, bloodPressure, pulse, preliminaryScore, preliminaryTemporary, failures, missing, suggestedOutcome, suggestedReason, warnings };
}

/**
 * Dòng "Tình trạng sức khỏe và bệnh tật" trên Mẫu 2 / Mẫu 2k: bệnh Mục III, các chỉ tiêu đo được
 * bị điểm 4–6 (thể lực, thị lực, huyết áp, mạch), bệnh tật đã chọn và ghi chú.
 */
export function healthStatusText(citizen: Pick<Citizen, 'sex'>, s: Screening): string {
  const parts: string[] = [];
  for (const id of s.exemptionIds) {
    const d = exemptDisease(id);
    if (d) parts.push(d.icd10 ? `${d.name} (${d.icd10})` : d.name);
  }
  const a = assessScreening(citizen, s);
  for (const f of a.failures.filter((x) => x.group !== 'disease')) parts.push(f.text);
  for (const f of s.findings) parts.push(`${f.label}${f.note ? ` – ${f.note}` : ''}`);
  if (s.healthNote?.trim()) parts.push(s.healthNote.trim());
  return parts.length ? parts.join('; ') : 'Chưa phát hiện bệnh, tật';
}

/** "Ý kiến tổ sơ tuyển" ứng với kết luận. */
export function opinionFor(outcome: ScreeningOutcome, reason: string): string {
  switch (outcome) {
    case 'eligible':
      return 'Đủ điều kiện khám sức khỏe nghĩa vụ quân sự.';
    case 'exempt':
      return `Không đủ điều kiện khám sức khỏe nghĩa vụ quân sự – thuộc diện miễn làm nghĩa vụ quân sự${reason ? `: ${reason}` : ''}.`;
    case 'other':
      return `Không đủ điều kiện khám sức khỏe nghĩa vụ quân sự${reason ? `: ${reason}` : ''}.`;
    default:
      return reason ? `Chưa kết luận: ${reason}.` : '';
  }
}

export function scoreWord(score: Score): string {
  return ['một', 'hai', 'ba', 'bốn', 'năm', 'sáu'][score - 1];
}
