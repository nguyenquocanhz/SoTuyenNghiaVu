/// <reference types="jest" />
import { bloodPressureGrade, bloodPressureScore, diastolicScore, pulseScore, recordedBloodPressure, systolicScore } from '../vitals';

describe('Số 99 – huyết áp', () => {
  it.each([
    [110, 1],
    [115, 1],
    [120, 1],
    [121, 2],
    [130, 2],
    [100, 2],
    [109, 2],
    [131, 3],
    [139, 3],
    [90, 3],
    [99, 3],
    [140, 4],
    [149, 4],
    [89, 4],
    [150, 5],
    [159, 5],
    [160, 6],
    [190, 6],
  ])('tối đa %d → %d', (v, s) => {
    expect(systolicScore(v)).toBe(s);
  });

  it.each([
    [60, 1],
    [80, 1],
    [81, 2],
    [85, 2],
    [86, 3],
    [89, 3],
    [90, 4],
    [99, 4],
    [100, 5],
    [120, 5],
  ])('tối thiểu %d → %d', (v, s) => {
    expect(diastolicScore(v)).toBe(s);
  });

  it('takes the higher of systolic and diastolic', () => {
    expect(bloodPressureScore(118, 88)).toBe(3);
    expect(bloodPressureScore(142, 70)).toBe(4);
  });

  it('grades by Quyết định 3192/QĐ-BYT', () => {
    expect(bloodPressureGrade(115, 75)).toBe('Huyết áp tối ưu');
    expect(bloodPressureGrade(125, 82)).toBe('Huyết áp bình thường');
    expect(bloodPressureGrade(135, 80)).toBe('Tiền tăng huyết áp');
    expect(bloodPressureGrade(145, 95)).toBe('Tăng huyết áp độ 1');
    expect(bloodPressureGrade(150, 80)).toBe('Tăng huyết áp tâm thu đơn độc');
    expect(bloodPressureGrade(165, 102)).toBe('Tăng huyết áp độ 2');
    expect(bloodPressureGrade(185, 115)).toBe('Tăng huyết áp độ 3');
  });
});

describe('Số 101 – mạch', () => {
  it.each([
    [60, 1, 1],
    [80, 1, 1],
    [81, 2, 2],
    [85, 2, 2],
    [57, 2, 2],
    [59, 2, 2],
    [86, 3, 3],
    [90, 3, 3],
    [55, 3, 3],
    [56, 3, 3],
    [50, 3, 4],
    [54, 3, 4],
    [91, 4, 4],
    [99, 4, 4],
    [100, 5, 6],
    [49, 5, 6],
  ])('%d lần/phút → %d (tối đa %d)', (bpm, score, max) => {
    const r = pulseScore(bpm);
    expect(r.score).toBe(score);
    expect(r.maxScore).toBe(max);
  });
});

describe('Mục IV số 99 – giá trị ghi nhận', () => {
  it('uses a single reading as is', () => {
    expect(recordedBloodPressure({ systolic: 150, diastolic: 90 })).toEqual({ systolic: 150, diastolic: 90, readings: 1, needsRemeasure: false });
  });

  it('averages two readings, rounded to whole mmHg', () => {
    expect(recordedBloodPressure({ systolic: 131, diastolic: 85, systolic2: 126, diastolic2: 80 })).toEqual({ systolic: 129, diastolic: 83, readings: 2, needsRemeasure: false });
  });

  it('flags readings more than 10 mmHg apart', () => {
    expect(recordedBloodPressure({ systolic: 150, diastolic: 90, systolic2: 139, diastolic2: 88 })?.needsRemeasure).toBe(true);
    expect(recordedBloodPressure({ systolic: 150, diastolic: 90, systolic2: 140, diastolic2: 80 })?.needsRemeasure).toBe(false);
  });

  it('ignores an incomplete reading', () => {
    expect(recordedBloodPressure({ systolic: 150 })).toBeUndefined();
    expect(recordedBloodPressure({ systolic: 150, systolic2: 140, diastolic2: 85 })).toEqual({ systolic: 140, diastolic: 85, readings: 1, needsRemeasure: false });
  });
});
