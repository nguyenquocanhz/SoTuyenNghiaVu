/// <reference types="jest" />
import { assessScreening, healthStatusText, opinionFor } from '../screening';
import type { Screening } from '../types';

const base: Screening = {
  id: 's1',
  campaignId: 'c1',
  citizenId: 'p1',
  screenedOn: '2026-09-17',
  vision: {},
  findings: [],
  exemptionIds: [],
  outcome: 'pending',
  createdAt: '',
  updatedAt: '',
};

const male = { sex: 'male' as const };
const fit = { ...base, heightCm: 170, weightKg: 60, chestCm: 85 };

describe('assessScreening – căn cứ Điều 4, Điều 6 (đạt loại 1, 2, 3)', () => {
  it('is pending until the Mục I measurements are complete', () => {
    expect(assessScreening(male, base).suggestedOutcome).toBe('pending');
    const noChest = assessScreening(male, { ...fit, chestCm: undefined });
    expect(noChest.suggestedOutcome).toBe('pending');
    expect(noChest.suggestedReason).toContain('vòng ngực');
    expect(assessScreening({ sex: 'female' }, { ...fit, chestCm: undefined }).suggestedOutcome).toBe('eligible');
  });

  it('suggests eligible for a fit citizen', () => {
    const r = assessScreening(male, { ...base, heightCm: 168, weightKg: 58, chestCm: 84, systolic: 118, diastolic: 76, pulse: 72, vision: { rightUncorrected: 10, leftUncorrected: 10 } });
    expect(r.suggestedOutcome).toBe('eligible');
    expect(r.preliminaryScore).toBe(1);
    expect(r.failures).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('rejects physique worse than loại 3 with the failing criteria as reason', () => {
    const r = assessScreening(male, { ...base, heightCm: 154, weightKg: 45, chestCm: 76 });
    expect(r.suggestedOutcome).toBe('other');
    expect(r.suggestedReason).toBe('Thể lực loại 5 (Cao đứng 154 cm)');
  });

  it('exemption diseases take precedence (Mục III)', () => {
    const r = assessScreening(male, { ...base, heightCm: 150, weightKg: 45, exemptionIds: ['dong-kinh'] });
    expect(r.suggestedOutcome).toBe('exempt');
    expect(r.suggestedReason).toContain('Động kinh');
  });

  it('findings above 3 points reject, including "T" scores (with treatment advice)', () => {
    const flatFeet = assessScreening(male, { ...fit, findings: [{ itemId: 'x', label: 'Bàn chân bẹt', score: 4, temporary: false }] });
    expect(flatFeet.suggestedOutcome).toBe('other');
    const acute = assessScreening(male, { ...fit, findings: [{ itemId: 'y', label: 'Viêm tai giữa cấp tính', score: 4, temporary: true }] });
    expect(acute.suggestedOutcome).toBe('other');
    expect(acute.suggestedReason).toBe('Viêm tai giữa cấp tính (4T điểm)');
    expect(acute.preliminaryTemporary).toBe(true);
    expect(acute.warnings.join(' ')).toContain('khoản 3 Điều 9');
    const mild = assessScreening(male, { ...fit, findings: [{ itemId: 'z', label: 'Viêm kết mạc cấp', score: 2, temporary: true }] });
    expect(mild.suggestedOutcome).toBe('eligible');
  });

  it('rejects blood pressure and pulse above 3 points (số 99, 101)', () => {
    const r = assessScreening(male, { ...fit, systolic: 150, diastolic: 95, pulse: 104 });
    expect(r.suggestedOutcome).toBe('other');
    expect(r.suggestedReason).toBe('Huyết áp 150/95 mmHg – Tăng huyết áp độ 1 (5 điểm); Mạch 104 lần/phút (5–6 điểm)');
    expect(r.warnings.join(' ')).toContain('đo lần 2');
  });

  it('pulse 50–54 is 3–4 points by the Lian test: not rejected, only flagged', () => {
    const r = assessScreening(male, { ...fit, pulse: 52 });
    expect(r.suggestedOutcome).toBe('eligible');
    expect(r.warnings.join(' ')).toContain('Lian');
  });

  it('averages two blood pressure readings and asks to re-measure when they differ by more than 10 mmHg', () => {
    const avg = assessScreening(male, { ...fit, systolic: 142, diastolic: 88, systolic2: 136, diastolic2: 84 });
    expect(avg.bloodPressure?.recorded).toEqual({ systolic: 139, diastolic: 86, readings: 2, needsRemeasure: false });
    expect(avg.bloodPressure?.score).toBe(3);
    expect(avg.suggestedOutcome).toBe('eligible');

    const unstable = assessScreening(male, { ...fit, systolic: 158, diastolic: 90, systolic2: 140, diastolic2: 88 });
    expect(unstable.suggestedOutcome).toBe('pending');
    expect(unstable.suggestedReason).toContain('đo lại');
  });

  it('needs corrected acuity when uncorrected total is below 19/10 (TT 106)', () => {
    const r = assessScreening(male, { ...fit, vision: { rightUncorrected: 9, leftUncorrected: 9 } });
    expect(r.vision.score).toBeUndefined();
    expect(r.vision.provisionalScore).toBe(3);
    expect(r.suggestedOutcome).toBe('pending');
    expect(r.suggestedReason).toContain('sau chỉnh kính tối đa');

    const corrected = assessScreening(male, { ...fit, vision: { rightUncorrected: 9, leftUncorrected: 9, rightCorrected: 10, leftCorrected: 10, rightDiopter: -1, leftDiopter: -1 } });
    expect(corrected.vision.score).toBe(2);
    expect(corrected.suggestedOutcome).toBe('eligible');
  });

  it('myopia from −3D rejects even before corrected acuity is measured', () => {
    const r = assessScreening(male, { ...fit, vision: { rightUncorrected: 7, leftUncorrected: 7, rightDiopter: -3, leftDiopter: -3 } });
    expect(r.vision.score).toBe(4);
    expect(r.suggestedOutcome).toBe('other');
    expect(r.suggestedReason).toBe('Thị lực 4 điểm (không kính MP 7/10, MT 7/10; cận thị MP -3D, MT -3D)');
  });

  it('169 cm, 91 kg, ngực 102 cm, HA 150/90, có kính 7/10 mỗi mắt, kính -4D mỗi bên', () => {
    const s = {
      ...base,
      heightCm: 169,
      weightKg: 91,
      chestCm: 102,
      systolic: 150,
      diastolic: 90,
      vision: { rightCorrected: 7, leftCorrected: 7, rightDiopter: -4, leftDiopter: -4 },
    };
    const r = assessScreening(male, s);
    expect(r.physique.score).toBe(4);
    expect(r.vision.correctedScore).toBe(6);
    expect(r.vision.refractionScore).toBe(5);
    expect(r.vision.score).toBe(6);
    expect(r.bloodPressure?.score).toBe(5);
    expect(r.preliminaryScore).toBe(6);
    expect(r.suggestedOutcome).toBe('other');
    expect(r.suggestedReason).toBe(
      'Thể lực loại 4 (BMI 31,9 kg/m²); Thị lực 6 điểm (có kính MP 7/10, MT 7/10; cận thị MP -4D, MT -4D); Huyết áp 150/90 mmHg – Tăng huyết áp độ 1 (5 điểm)',
    );
    expect(healthStatusText(male, s)).toBe(r.suggestedReason);
    expect(opinionFor('other', r.suggestedReason!)).toBe(`Không đủ điều kiện khám sức khỏe nghĩa vụ quân sự: ${r.suggestedReason}.`);
  });
});

describe('healthStatusText', () => {
  it('lists exemptions with ICD-10, findings and notes', () => {
    expect(
      healthStatusText(male, {
        ...base,
        exemptionIds: ['hiv'],
        findings: [{ itemId: 'a', label: 'Trĩ ngoại', score: 3, temporary: false, note: '7 giờ 0,5 cm' }],
        healthNote: 'Sẹo mổ ruột thừa',
      }),
    ).toBe('Người nhiễm HIV (B20 đến B24; Z21); Trĩ ngoại – 7 giờ 0,5 cm; Sẹo mổ ruột thừa');
  });

  it('has a default when nothing was found', () => {
    expect(healthStatusText(male, base)).toBe('Chưa phát hiện bệnh, tật');
  });
});
