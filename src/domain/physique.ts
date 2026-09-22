import { roundTo } from './format';
import type { Score, Sex } from './types';

/**
 * Mục I Phụ lục I Thông tư 105/2023/TT-BQP – Tiêu chuẩn phân loại theo thể lực.
 *
 * | Loại | Nam cao (cm) | Nam nặng (kg) | Vòng ngực (cm) | Nữ cao (cm) | Nữ nặng (kg) | BMI       |
 * | 1    | ≥ 163        | ≥ 51          | ≥ 81           | ≥ 154       | ≥ 48         | 18,5–24,9 |
 * | 2    | 160–162      | 47–50         | 78–80          | 152–153     | 44–47        | 25–26,9   |
 * | 3    | 157–159      | 43–46         | 75–77          | 150–151     | 42–43        | 27–29,9   |
 * | 4    | 155–156      | 41–42         | 73–74          | 148–149     | 40–41        | <18,5 hoặc 30–34,9 |
 * | 5    | 153–154      | 40            | 71–72          | 147         | 38–39        | 35–39,9   |
 * | 6    | ≤ 152        | ≤ 39          | ≤ 70           | ≤ 146       | ≤ 37         | ≥ 40      |
 *
 * Mục IV.1.a: chiều cao, vòng ngực, cân nặng từ 0,5 trở lên ghi là 1 đơn vị; từ 0,49 trở xuống thì
 * không lấy phần lẻ (152,50 cm → 153 cm; 51,49 kg → 51 kg). Values are rounded that way before scoring,
 * and BMI is computed from the recorded (rounded) values.
 */

/** Quy tròn số đo thể lực theo Mục IV.1.a Phụ lục I. */
export function recordMeasurement(value: number): number {
  return roundTo(value, 0);
}

/** Lower bounds for scores 1…5; anything below the last bound scores 6. */
type Bounds = readonly [number, number, number, number, number];

export const PHYSIQUE_BOUNDS = {
  male: { height: [163, 160, 157, 155, 153], weight: [51, 47, 43, 41, 40], chest: [81, 78, 75, 73, 71] },
  female: { height: [154, 152, 150, 148, 147], weight: [48, 44, 42, 40, 38] },
} as const satisfies Record<Sex, Record<string, Bounds>>;

function scoreByLowerBounds(value: number, bounds: Bounds): Score {
  const recorded = recordMeasurement(value);
  const index = bounds.findIndex((b) => recorded >= b);
  return (index === -1 ? 6 : index + 1) as Score;
}

export function heightScore(sex: Sex, heightCm: number): Score {
  return scoreByLowerBounds(heightCm, PHYSIQUE_BOUNDS[sex].height);
}

export function weightScore(sex: Sex, weightKg: number): Score {
  return scoreByLowerBounds(weightKg, PHYSIQUE_BOUNDS[sex].weight);
}

/** Vòng ngực chỉ có tiêu chuẩn cho nam. */
export function chestScore(sex: Sex, chestCm: number): Score | undefined {
  return sex === 'male' ? scoreByLowerBounds(chestCm, PHYSIQUE_BOUNDS.male.chest) : undefined;
}

export function computeBmi(weightKg: number, heightCm: number): number | undefined {
  if (!(weightKg > 0) || !(heightCm > 0)) return undefined;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/** BMI is rounded to one decimal first, as written on the form (Mẫu 3: "Chỉ số BMI"). */
export function bmiScore(bmi: number): Score {
  const v = roundTo(bmi, 1);
  if (v < 18.5) return 4;
  if (v < 25) return 1;
  if (v < 27) return 2;
  if (v < 30) return 3;
  if (v < 35) return 4;
  if (v < 40) return 5;
  return 6;
}

export type PhysiqueCriterion = 'height' | 'weight' | 'chest' | 'bmi';

export interface PhysiqueComponent {
  criterion: PhysiqueCriterion;
  label: string;
  value: number;
  unit: string;
  score: Score;
}

export interface PhysiqueAssessment {
  components: PhysiqueComponent[];
  bmi?: number;
  /** Điểm thể lực = điểm cao nhất trong các chỉ tiêu đã đo (Điều 6); undefined khi chưa đo gì. */
  score?: Score;
  /** Chỉ tiêu còn thiếu so với bảng (nam: cao, nặng, vòng ngực; nữ: cao, nặng). */
  missing: PhysiqueCriterion[];
}

export function assessPhysique(input: { sex: Sex; heightCm?: number; weightKg?: number; chestCm?: number }): PhysiqueAssessment {
  const rec = (v?: number) => (v !== undefined && v > 0 ? recordMeasurement(v) : undefined);
  const { sex } = input;
  const heightCm = rec(input.heightCm);
  const weightKg = rec(input.weightKg);
  const chestCm = rec(input.chestCm);
  const components: PhysiqueComponent[] = [];
  const missing: PhysiqueCriterion[] = [];

  if (heightCm) {
    components.push({ criterion: 'height', label: 'Cao đứng', value: heightCm, unit: 'cm', score: heightScore(sex, heightCm) });
  } else missing.push('height');

  if (weightKg) {
    components.push({ criterion: 'weight', label: 'Cân nặng', value: weightKg, unit: 'kg', score: weightScore(sex, weightKg) });
  } else missing.push('weight');

  if (sex === 'male') {
    if (chestCm) {
      components.push({ criterion: 'chest', label: 'Vòng ngực', value: chestCm, unit: 'cm', score: chestScore(sex, chestCm)! });
    } else missing.push('chest');
  }

  const bmi = heightCm && weightKg ? computeBmi(weightKg, heightCm) : undefined;
  if (bmi !== undefined) {
    components.push({ criterion: 'bmi', label: 'BMI', value: roundTo(bmi, 1), unit: 'kg/m²', score: bmiScore(bmi) });
  }

  const score = components.length ? (Math.max(...components.map((c) => c.score)) as Score) : undefined;
  return { components, bmi, score, missing };
}

/** Row labels of the Mục I table, used by the standards lookup screen. */
export const PHYSIQUE_TABLE: {
  score: Score;
  maleHeight: string;
  maleWeight: string;
  maleChest: string;
  femaleHeight: string;
  femaleWeight: string;
  bmi: string;
}[] = [
  { score: 1, maleHeight: '≥ 163', maleWeight: '≥ 51', maleChest: '≥ 81', femaleHeight: '≥ 154', femaleWeight: '≥ 48', bmi: '18,5 – 24,9' },
  { score: 2, maleHeight: '160 – 162', maleWeight: '47 – 50', maleChest: '78 – 80', femaleHeight: '152 – 153', femaleWeight: '44 – 47', bmi: '25 – 26,9' },
  { score: 3, maleHeight: '157 – 159', maleWeight: '43 – 46', maleChest: '75 – 77', femaleHeight: '150 – 151', femaleWeight: '42 – 43', bmi: '27 – 29,9' },
  { score: 4, maleHeight: '155 – 156', maleWeight: '41 – 42', maleChest: '73 – 74', femaleHeight: '148 – 149', femaleWeight: '40 – 41', bmi: '< 18,5 hoặc 30 – 34,9' },
  { score: 5, maleHeight: '153 – 154', maleWeight: '40', maleChest: '71 – 72', femaleHeight: '147', femaleWeight: '38 – 39', bmi: '35 – 39,9' },
  { score: 6, maleHeight: '≤ 152', maleWeight: '≤ 39', maleChest: '≤ 70', femaleHeight: '≤ 146', femaleWeight: '≤ 37', bmi: '≥ 40' },
];
