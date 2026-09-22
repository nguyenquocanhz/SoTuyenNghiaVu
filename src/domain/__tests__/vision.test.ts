/// <reference types="jest" />
import { acuityScore, assessVision, refractionScore, totalAcuity } from '../vision';

describe('mục 1.1 – thị lực không kính', () => {
  it.each([
    [10, 10, 1],
    [10, 9, 1],
    [10, 8, 2],
    [9, 8, 3],
    [8, 8, 4],
    [7, 7, 5],
    [6, 7, 5],
    [7, 6, 5],
    [5, 10, 6],
    [3, 3, 6],
  ])('MP %d/10, MT %d/10 → điểm %d', (r, l, score) => {
    expect(acuityScore(r, l)).toBe(score);
  });

  it('left eye cannot compensate for the right eye', () => {
    expect(acuityScore(9, 10)).toBe(3);
    expect(acuityScore(8, 10)).toBe(4);
  });

  it('caps each eye at 10/10 (TT 106 example: 12/10 + 5/10 = 15/10)', () => {
    expect(totalAcuity(12, 5)).toBe(15);
    expect(acuityScore(12, 5)).toBe(5);
  });
});

describe('cận thị, viễn thị', () => {
  it.each([
    [-2.75, 2, undefined, 2],
    [-3, 2, undefined, 4],
    [-3.75, 2, undefined, 4],
    [-4, 2, undefined, 5],
    [-5, 2, undefined, 6],
    [-8, 2, undefined, 6],
    [1.25, undefined, 1, 1],
    [1.5, undefined, 1, 4],
    [3, undefined, 1, 5],
    [4, undefined, 1, 6],
  ] as const)('%dD → điểm %s', (d, corrected, uncorrected, expected) => {
    expect(refractionScore(d, corrected, uncorrected)).toBe(expected);
  });
});

describe('assessVision (TT 106/2025)', () => {
  it('uses uncorrected acuity when both eyes total at least 19/10', () => {
    const r = assessVision({ rightUncorrected: 10, leftUncorrected: 9 });
    expect(r.score).toBe(1);
    expect(r.needsCorrection).toBe(false);
  });

  it('cannot score yet when the uncorrected total is below 19/10 and corrected acuity is missing', () => {
    const r = assessVision({ rightUncorrected: 6, leftUncorrected: 6 });
    expect(r.score).toBeUndefined();
    expect(r.provisionalScore).toBe(6);
    expect(r.needsCorrection).toBe(true);
  });

  it('scores corrected acuity alone (có kính 7/10 + 7/10 → 5 + 1)', () => {
    const r = assessVision({ rightCorrected: 7, leftCorrected: 7, rightDiopter: -4, leftDiopter: -4 });
    expect(r.correctedScore).toBe(6);
    expect(r.refractionScore).toBe(5);
    expect(r.score).toBe(6);
    expect(r.needsCorrection).toBe(false);
  });

  it('scores corrected acuity + 1 point (mục 1.2)', () => {
    const r = assessVision({ rightUncorrected: 5, leftUncorrected: 5, rightCorrected: 10, leftCorrected: 10, rightDiopter: -1.5, leftDiopter: -1.25 });
    expect(r.correctedScore).toBe(2);
    expect(r.refractionScore).toBe(2);
    expect(r.score).toBe(2);
    expect(r.needsCorrection).toBe(false);
  });

  it('myopia from −3D scores at least 4 whatever the corrected acuity', () => {
    const r = assessVision({ rightUncorrected: 3, leftUncorrected: 4, rightCorrected: 10, leftCorrected: 10, rightDiopter: -3.5, leftDiopter: -2 });
    expect(r.score).toBe(4);
  });

  it('returns no score without data', () => {
    expect(assessVision({}).score).toBeUndefined();
  });
});
