import type { Score, VisionResult } from './types';

/**
 * Mục II.1 Phụ lục I Thông tư 105/2023/TT-BQP (số 1–3), sửa đổi bởi khoản 8 Điều 1 Thông tư 106/2025/TT-BQP.
 *
 * 1.1 Thị lực không kính (thị lực mắt phải — tổng thị lực 2 mắt):
 *   10/10 — 19/10 → 1 · 10/10 — 18/10 → 2 · 9/10 — 17/10 → 3 · 8/10 — 16/10 → 4
 *   6,7/10 — 13–15/10 → 5 · 1–5/10 — 6–12/10 → 6
 * 1.2 Thị lực sau chỉnh kính: cho điểm theo 1.1 và tăng lên 1 điểm.
 * TT 106: thị lực trên 10/10 chỉ tính 10/10; mắt trái không bù cho mắt phải; nếu tổng không kính
 * chưa đạt 19/10 thì cho điểm theo thị lực sau chỉnh kính tối đa.
 * 2 Cận thị: dưới −3D theo 1.2 · −3D đến dưới −4D → 4 · −4D đến dưới −5D → 5 · từ −5D → 6.
 * 3 Viễn thị: dưới +1,5D theo 1.1 · +1,5D đến dưới +3D → 4 · +3D đến dưới +4D → 5 · +4D đến dưới +5D → 6.
 */

const cap = (v: number) => Math.min(10, Math.max(0, v));
const bump = (s: Score): Score => Math.min(6, s + 1) as Score;

function rightEyeScore(right: number): Score {
  if (right >= 10) return 1;
  if (right >= 9) return 3;
  if (right >= 8) return 4;
  if (right >= 6) return 5;
  return 6;
}

function totalScore(total: number): Score {
  if (total >= 19) return 1;
  if (total >= 18) return 2;
  if (total >= 17) return 3;
  if (total >= 16) return 4;
  if (total >= 13) return 5;
  return 6;
}

/** Điểm theo mục 1.1 cho một cặp thị lực (mắt phải, mắt trái). */
export function acuityScore(right: number, left: number): Score {
  const r = cap(right);
  const l = cap(left);
  return Math.max(rightEyeScore(r), totalScore(r + l)) as Score;
}

export function totalAcuity(right: number, left: number): number {
  return cap(right) + cap(left);
}

export function refractionScore(diopter: number, correctedScore: Score | undefined, uncorrectedScore: Score | undefined): Score | undefined {
  if (diopter < 0) {
    const d = -diopter;
    if (d >= 5) return 6;
    if (d >= 4) return 5;
    if (d >= 3) return 4;
    return correctedScore;
  }
  if (diopter > 0) {
    if (diopter >= 4) return 6;
    if (diopter >= 3) return 5;
    if (diopter >= 1.5) return 4;
    return uncorrectedScore;
  }
  return undefined;
}

export interface VisionAssessment {
  uncorrectedTotal?: number;
  uncorrectedScore?: Score;
  correctedScore?: Score;
  refractionScore?: Score;
  /**
   * Điểm chỉ tiêu thị lực theo thông tư; undefined khi chưa đủ số liệu để cho điểm
   * (tổng không kính dưới 19/10 mà chưa đo thị lực sau chỉnh kính, và độ kính chưa đủ quyết định).
   */
  score?: Score;
  /** Điểm tạm theo thị lực không kính khi còn thiếu thị lực sau chỉnh kính – chỉ để hiển thị. */
  provisionalScore?: Score;
  /** Cần đo thêm thị lực sau chỉnh kính tối đa (tổng không kính dưới 19/10). */
  needsCorrection: boolean;
  basis: string;
}

export function assessVision(v: VisionResult): VisionAssessment {
  const hasUncorrected = v.rightUncorrected !== undefined && v.leftUncorrected !== undefined;
  const hasCorrected = v.rightCorrected !== undefined && v.leftCorrected !== undefined;
  if (!hasUncorrected && !hasCorrected) return { needsCorrection: false, basis: 'Chưa đo thị lực' };

  const uncorrectedTotal = hasUncorrected ? totalAcuity(v.rightUncorrected!, v.leftUncorrected!) : undefined;
  const uncorrectedScore = hasUncorrected ? acuityScore(v.rightUncorrected!, v.leftUncorrected!) : undefined;
  const correctedScore = hasCorrected ? bump(acuityScore(v.rightCorrected!, v.leftCorrected!)) : undefined;

  // Stronger lens of the two eyes decides the refraction item.
  const diopters = [v.rightDiopter, v.leftDiopter].filter((d): d is number => d !== undefined && d !== 0);
  const worst = diopters.length ? diopters.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a)) : undefined;
  const refraction = worst !== undefined ? refractionScore(worst, correctedScore, uncorrectedScore) : undefined;

  const reachesStandard = uncorrectedTotal !== undefined && uncorrectedTotal >= 19;
  const needsCorrection = !reachesStandard && !hasCorrected;
  let acuity: Score | undefined;
  let basis: string;
  if (reachesStandard) {
    acuity = uncorrectedScore;
    basis = 'Theo thị lực không kính (tổng 2 mắt đạt 19/10)';
  } else if (correctedScore !== undefined) {
    acuity = correctedScore;
    basis = 'Theo thị lực sau chỉnh kính tối đa (mục 1.2: tăng 1 điểm)';
  } else {
    basis = 'Tổng không kính dưới 19/10 – phải đo thị lực sau chỉnh kính tối đa để cho điểm (TT 106/2025)';
  }

  // Myopia from −3D / hyperopia from +1,5D has a fixed score even before corrected acuity is known.
  const scores = [acuity, refraction].filter((s): s is Score => s !== undefined);
  return {
    uncorrectedTotal,
    uncorrectedScore,
    correctedScore,
    refractionScore: refraction,
    score: scores.length && (acuity !== undefined || (refraction ?? 0) > 3) ? (Math.max(...scores) as Score) : undefined,
    provisionalScore: needsCorrection ? uncorrectedScore : undefined,
    needsCorrection,
    basis,
  };
}
