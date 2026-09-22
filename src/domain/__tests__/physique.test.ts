/// <reference types="jest" />
import { assessPhysique, bmiScore, chestScore, computeBmi, heightScore, recordMeasurement, weightScore } from '../physique';

describe('Mục I – thể lực nam', () => {
  it.each([
    [175, 1],
    [163, 1],
    [162, 2],
    [160, 2],
    [159, 3],
    [157, 3],
    [156, 4],
    [155, 4],
    [154, 5],
    [153, 5],
    [152, 6],
    [140, 6],
  ])('cao %d cm → điểm %d', (cm, score) => {
    expect(heightScore('male', cm)).toBe(score);
  });

  it.each([
    [60, 1],
    [51, 1],
    [50, 2],
    [47, 2],
    [46, 3],
    [43, 3],
    [42, 4],
    [41, 4],
    [40, 5],
    [39, 6],
  ])('nặng %d kg → điểm %d', (kg, score) => {
    expect(weightScore('male', kg)).toBe(score);
  });

  it.each([
    [90, 1],
    [81, 1],
    [80, 2],
    [78, 2],
    [77, 3],
    [75, 3],
    [74, 4],
    [73, 4],
    [72, 5],
    [71, 5],
    [70, 6],
  ])('vòng ngực %d cm → điểm %d', (cm, score) => {
    expect(chestScore('male', cm)).toBe(score);
  });
});

describe('Mục I – thể lực nữ', () => {
  it.each([
    [160, 1],
    [154, 1],
    [153, 2],
    [152, 2],
    [151, 3],
    [150, 3],
    [149, 4],
    [148, 4],
    [147, 5],
    [146, 6],
  ])('cao %d cm → điểm %d', (cm, score) => {
    expect(heightScore('female', cm)).toBe(score);
  });

  it.each([
    [55, 1],
    [48, 1],
    [47, 2],
    [44, 2],
    [43, 3],
    [42, 3],
    [41, 4],
    [40, 4],
    [39, 5],
    [38, 5],
    [37, 6],
  ])('nặng %d kg → điểm %d', (kg, score) => {
    expect(weightScore('female', kg)).toBe(score);
  });

  it('has no chest standard', () => {
    expect(chestScore('female', 60)).toBeUndefined();
  });
});

describe('Mục IV.1.a – quy tròn số đo', () => {
  it('rounds ,50 up and ,49 down (examples from the circular)', () => {
    expect(recordMeasurement(152.5)).toBe(153);
    expect(recordMeasurement(158.49)).toBe(158);
    expect(recordMeasurement(46.5)).toBe(47);
    expect(recordMeasurement(51.49)).toBe(51);
    expect(recordMeasurement(82.5)).toBe(83);
    expect(recordMeasurement(79.49)).toBe(79);
  });

  it('scores the recorded value', () => {
    expect(heightScore('male', 162.5)).toBe(1);
    expect(heightScore('male', 162.49)).toBe(2);
    expect(weightScore('male', 50.5)).toBe(1);
    expect(chestScore('male', 80.49)).toBe(2);
  });
});

describe('BMI', () => {
  it.each([
    [18.4, 4],
    [18.5, 1],
    [24.9, 1],
    [24.94, 1],
    [24.95, 2],
    [25, 2],
    [26.9, 2],
    [27, 3],
    [29.9, 3],
    [30, 4],
    [34.9, 4],
    [35, 5],
    [39.9, 5],
    [40, 6],
  ])('BMI %d → điểm %d', (bmi, score) => {
    expect(bmiScore(bmi)).toBe(score);
  });

  it('computes kg/m²', () => {
    expect(computeBmi(64, 160)).toBeCloseTo(25, 5);
    expect(computeBmi(0, 160)).toBeUndefined();
  });
});

describe('assessPhysique', () => {
  it('takes the worst criterion (Điều 6) and lists missing ones', () => {
    const r = assessPhysique({ sex: 'male', heightCm: 170, weightKg: 45.2, chestCm: undefined });
    expect(r.components.map((c) => [c.criterion, c.score])).toEqual([
      ['height', 1],
      ['weight', 3],
      ['bmi', 4],
    ]);
    expect(r.score).toBe(4);
    expect(r.missing).toEqual(['chest']);
  });

  it('computes BMI from recorded (rounded) values', () => {
    const r = assessPhysique({ sex: 'female', heightCm: 154.6, weightKg: 48.4 });
    expect(r.bmi).toBeCloseTo(48 / (1.55 * 1.55), 6);
    expect(r.missing).toEqual([]);
    expect(r.score).toBe(1);
  });

  it('is empty without measurements', () => {
    const r = assessPhysique({ sex: 'male' });
    expect(r.score).toBeUndefined();
    expect(r.missing).toEqual(['height', 'weight', 'chest']);
  });
});
