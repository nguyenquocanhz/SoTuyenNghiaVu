/// <reference types="jest" />
import type { ScaleReading } from '@/ble/types';
import { DEFAULT_SESSION_CONFIG, qualityFromRange, WeightSession } from '@/ble/weightSession';

const r = (weightKg: number, stable = false, extra: Partial<ScaleReading> = {}): ScaleReading => ({ weightKg, stable, ...extra });
const off = (): ScaleReading => ({ weightKg: 0, stable: false });

/** Pushes `weight(t)` every `step` ms for t in [from, to]. */
function feed(session: WeightSession, from: number, to: number, reading: (t: number, i: number) => ScaleReading, step = 500) {
  for (let t = from, i = 0; t <= to; t += step, i++) session.push(reading(t, i), t);
}

describe('defaults', () => {
  it('uses a 30 s countdown, 2 kg threshold, 5 s window and 1,5 s step-off grace', () => {
    expect(DEFAULT_SESSION_CONFIG).toEqual({ durationMs: 30_000, minWeightKg: 2, windowMs: 5_000, stepOffGraceMs: 1_500 });
  });
});

describe('waiting → measuring', () => {
  it('starts in waiting with the full countdown', () => {
    const s = new WeightSession();
    expect(s.currentPhase).toBe('waiting');
    expect(s.tick(0)).toEqual({
      phase: 'waiting',
      hint: 'step_on',
      elapsedMs: 0,
      remainingMs: 30_000,
      progress: 0,
      liveKg: undefined,
      liveStable: false,
      sampleCount: 0,
    });
  });

  it('stays waiting below minWeightKg but shows the live value', () => {
    const s = new WeightSession();
    s.push(r(1.5), 100);
    const snap = s.tick(200);
    expect(snap.phase).toBe('waiting');
    expect(snap.liveKg).toBe(1.5);
    expect(snap.sampleCount).toBe(0);
  });

  it('starts measuring on the first reading ≥ minWeightKg', () => {
    const s = new WeightSession();
    s.push(r(1.9), 500);
    s.push(r(2), 1000);
    expect(s.currentPhase).toBe('measuring');
    const snap = s.tick(1000);
    expect(snap).toMatchObject({ phase: 'measuring', hint: 'stand_still', elapsedMs: 0, remainingMs: 30_000, progress: 0, liveKg: 2, sampleCount: 1 });
    expect(s.tick(16_000)).toMatchObject({ elapsedMs: 15_000, remainingMs: 15_000, progress: 0.5 });
  });

  it('ignores removed readings while waiting', () => {
    const s = new WeightSession();
    s.push(r(70, true, { removed: true }), 0);
    const snap = s.tick(100);
    expect(snap.phase).toBe('waiting');
    expect(snap.liveKg).toBeUndefined();
  });
});

describe('completion', () => {
  it('completes exactly durationMs after the first on-scale reading', () => {
    const s = new WeightSession();
    s.push(r(0.5), 0);
    feed(s, 1000, 31_000, () => r(70)); // includes a reading exactly at the end time
    expect(s.tick(30_999).phase).toBe('measuring');
    const done = s.tick(31_000);
    expect(done.phase).toBe('completed');
    expect(done).toMatchObject({ hint: 'done', elapsedMs: 30_000, remainingMs: 0, progress: 1, liveStable: true, liveKg: 70 });
    expect(done.result).toMatchObject({ weightKg: 70, completedAt: 31_000, durationSec: 30, windowSec: 5 });
  });

  it('never reports progress above 1 while measuring', () => {
    const s = new WeightSession({ ...DEFAULT_SESSION_CONFIG, durationMs: 10_000 });
    s.push(r(70), 0);
    expect(s.snapshot(50_000)).toMatchObject({ phase: 'measuring', progress: 1, remainingMs: 0, elapsedMs: 10_000 });
  });

  it('locks the median of the readings in the last window', () => {
    const s = new WeightSession();
    // Balancing phase: noisy 75/76 kg
    feed(s, 0, 24_500, (_, i) => r(75 + (i % 2)));
    // Last 5 s window (t = 25 000 … 30 000): 11 readings
    const last = [70.0, 70.2, 70.1, 70.3, 70.1, 70.0, 70.2, 70.1, 70.2, 70.1, 70.0];
    feed(s, 25_000, 30_000, (_, i) => r(last[i]));
    const res = s.tick(30_000).result!;
    expect(res.weightKg).toBe(70.1);
    expect(res.samples).toBe(11);
    expect(res.usedStableFlag).toBe(false);
    expect(res.rangeKg).toBeCloseTo(0.3, 10);
    expect(res.quality).toBe('fair');
    expect(res.sdKg).toBeGreaterThan(0);
  });

  it('averages the two middle values for an even sample count', () => {
    const s = new WeightSession();
    s.push(r(60), 0);
    [70.0, 70.4, 70.2, 70.6].forEach((kg, i) => s.push(r(kg), 26_000 + i * 1000));
    const res = s.tick(30_000).result!;
    expect(res.samples).toBe(4);
    expect(res.weightKg).toBeCloseTo(70.3, 10);
  });

  it('ignores readings received after the countdown ended', () => {
    const s = new WeightSession();
    feed(s, 0, 30_000, () => r(70));
    s.push(r(95), 30_100);
    const res = s.tick(30_200).result!;
    expect(res.weightKg).toBe(70);
    expect(res.completedAt).toBe(30_000);
  });

  it('prefers readings flagged stable in the window', () => {
    const s = new WeightSession();
    feed(s, 0, 24_500, () => r(75));
    feed(s, 25_000, 30_000, (_, i) => (i % 3 === 0 ? r(i % 2 ? 70.1 : 70.0, true) : r(i % 2 ? 72 : 68)));
    const res = s.tick(30_000).result!;
    expect(res.usedStableFlag).toBe(true);
    expect(res.samples).toBe(4); // i = 0, 3, 6, 9
    expect(res.weightKg).toBeCloseTo(70.05, 10);
    expect(res.quality).toBe('good');
  });

  it('falls back to the last 10 stable readings when none is in the window', () => {
    const s = new WeightSession();
    feed(s, 0, 9_500, () => r(80));
    feed(s, 10_000, 19_500, (_, i) => r(i < 10 ? 60 : 65, true)); // 20 stable readings, last 10 = 65
    feed(s, 20_000, 30_000, () => r(90));
    const res = s.tick(30_000).result!;
    expect(res.usedStableFlag).toBe(true);
    expect(res.samples).toBe(10);
    expect(res.weightKg).toBe(65);
  });

  it('uses the last 5 readings when the window is empty and nothing is stable', () => {
    const s = new WeightSession();
    [70, 71, 72, 73, 74, 75].forEach((kg, i) => s.push(r(kg), i * 1000));
    const res = s.tick(30_000).result!;
    expect(res.usedStableFlag).toBe(false);
    expect(res.samples).toBe(5);
    expect(res.weightKg).toBe(73);
    expect(res.quality).toBe('poor');
  });

  it('keeps the latest body-composition extras reported during the session', () => {
    const s = new WeightSession();
    s.push(r(70, false, { impedanceOhm: 480, heightCm: 170 }), 0);
    s.push(r(70, true, { impedanceOhm: 500, bodyFatPct: 21.5, bmi: 24.2 }), 10_000);
    s.push(r(70, true), 29_000);
    const res = s.tick(30_000).result!;
    expect(res).toMatchObject({ impedanceOhm: 500, bodyFatPct: 21.5, heightCm: 170, bmi: 24.2 });
  });

  it('ignores pushes after completion', () => {
    const s = new WeightSession();
    feed(s, 0, 30_000, () => r(70, true));
    const first = s.tick(30_000);
    s.push(r(0, false, { removed: true }), 30_500);
    s.push(r(90, true), 31_000);
    const again = s.tick(40_000);
    expect(again.phase).toBe('completed');
    expect(again.result).toEqual(first.result);
  });
});

describe('stepping off', () => {
  it('keeps the session when the user steps back on within the grace period', () => {
    const s = new WeightSession();
    feed(s, 0, 10_000, () => r(70));
    s.push(off(), 10_500);
    const during = s.tick(11_000);
    expect(during.phase).toBe('measuring');
    expect(during.hint).toBe('stepped_off');
    expect(during.elapsedMs).toBe(11_000);
    s.push(r(70), 11_900);
    expect(s.tick(12_000).hint).toBe('stand_still');
    feed(s, 12_400, 30_000, () => r(70));
    expect(s.tick(30_000).phase).toBe('completed');
  });

  it('aborts when a later off-scale reading exceeds the grace period', () => {
    const s = new WeightSession();
    feed(s, 0, 10_000, () => r(70));
    s.push(off(), 10_500);
    s.push(off(), 11_999);
    expect(s.currentPhase).toBe('measuring');
    s.push(off(), 12_000);
    expect(s.currentPhase).toBe('waiting');
    const snap = s.tick(12_100);
    expect(snap).toMatchObject({ phase: 'waiting', hint: 'stepped_off', sampleCount: 0, progress: 0, elapsedMs: 0 });
  });

  it('aborts on tick once the grace period has elapsed', () => {
    const s = new WeightSession();
    feed(s, 0, 5_000, () => r(70));
    s.push(off(), 6_000);
    expect(s.tick(7_499).phase).toBe('measuring');
    expect(s.tick(7_500)).toMatchObject({ phase: 'waiting', hint: 'stepped_off' });
  });

  it('restarts the countdown when stepping on again after an abort', () => {
    const s = new WeightSession();
    feed(s, 0, 5_000, () => r(70));
    s.push(off(), 6_000);
    s.tick(8_000);
    s.push(r(70), 9_000);
    expect(s.tick(9_000)).toMatchObject({ phase: 'measuring', hint: 'stand_still', elapsedMs: 0, sampleCount: 1 });
    feed(s, 9_500, 39_000, () => r(70));
    expect(s.tick(38_999).phase).toBe('measuring');
    expect(s.tick(39_000).result!.completedAt).toBe(39_000);
  });

  it('treats the removed flag as stepping off even when a weight is reported', () => {
    const s = new WeightSession();
    feed(s, 0, 5_000, () => r(70));
    s.push(r(70, true, { removed: true }), 5_500);
    expect(s.tick(5_600).hint).toBe('stepped_off');
    s.push(r(70, true, { removed: true }), 7_000);
    expect(s.tick(7_000)).toMatchObject({ phase: 'waiting', hint: 'stepped_off', liveKg: undefined });
  });

  it('does not store off-scale readings as samples', () => {
    const s = new WeightSession();
    feed(s, 0, 25_000, () => r(70));
    s.push(off(), 29_000);
    s.push(r(70), 29_500);
    const res = s.tick(30_000).result!;
    expect(res.weightKg).toBe(70);
    expect(res.rangeKg).toBe(0);
  });

  it('completes when the countdown ended before the grace period ran out, even if the tick is late', () => {
    const s = new WeightSession();
    feed(s, 0, 29_000, () => r(70));
    s.push(off(), 29_500); // 500 ms off at the end of the countdown (grace 1 500 ms)
    const snap = s.tick(32_000);
    expect(snap.phase).toBe('completed');
    expect(snap.result!.weightKg).toBe(70);
    expect(snap.result!.completedAt).toBe(30_000);
  });

  it('completes before processing an off-scale reading that arrives after the countdown', () => {
    const s = new WeightSession();
    feed(s, 0, 29_500, () => r(70));
    s.push(off(), 29_800);
    s.push(off(), 31_400); // would exceed the grace if the countdown were ignored
    expect(s.currentPhase).toBe('completed');
    expect(s.tick(31_500).result!.completedAt).toBe(30_000);
  });

  it('still aborts when the grace period ran out before the countdown ended', () => {
    const s = new WeightSession();
    feed(s, 0, 27_000, () => r(70));
    s.push(off(), 27_500);
    const snap = s.tick(31_000);
    expect(snap).toMatchObject({ phase: 'waiting', hint: 'stepped_off' });
    expect(snap.result).toBeUndefined();
  });
});

describe('live hints', () => {
  it('asks to hold steady when the trailing window spreads more than 0,5 kg', () => {
    const s = new WeightSession();
    s.push(r(70.0), 0);
    s.push(r(70.5), 500);
    expect(s.tick(600).hint).toBe('stand_still');
    s.push(r(70.6), 1000);
    expect(s.tick(1100)).toMatchObject({ hint: 'hold_steady', liveKg: 70.6 });
    expect(s.tick(1100).liveRangeKg).toBeCloseTo(0.6, 10);
  });

  it('only looks at the trailing window for the spread', () => {
    const s = new WeightSession();
    s.push(r(60), 0);
    s.push(r(70), 500);
    expect(s.tick(600).hint).toBe('hold_steady');
    s.push(r(70), 1_500);
    s.push(r(70.1), 6_000);
    expect(s.tick(6_000)).toMatchObject({ hint: 'stand_still' });
    expect(s.tick(6_000).liveRangeKg).toBeCloseTo(0.1, 10);
  });

  it('reports the latest on-scale value and its stable flag', () => {
    const s = new WeightSession();
    s.push(r(70.2, false), 0);
    s.push(r(70.1, true), 500);
    expect(s.tick(600)).toMatchObject({ liveKg: 70.1, liveStable: true, sampleCount: 2 });
  });

  it('does not treat a 0,5 kg spread made of rounded readings as unsteady', () => {
    const s = new WeightSession();
    s.push(r(63.9), 0);
    s.push(r(64.4), 500); // 64.4 − 63.9 = 0.5000000000000071
    expect(s.tick(600).hint).toBe('stand_still');
  });
});

describe('qualityFromRange', () => {
  it('grades by the spread of the chosen samples', () => {
    expect(qualityFromRange(0, 5, false)).toBe('good');
    expect(qualityFromRange(0.2, 5, false)).toBe('good');
    expect(qualityFromRange(0.21, 5, false)).toBe('fair');
    expect(qualityFromRange(0.5, 5, true)).toBe('fair');
    expect(qualityFromRange(0.51, 5, true)).toBe('poor');
  });

  it('grades a single sample by the stable flag', () => {
    expect(qualityFromRange(0, 1, true)).toBe('good');
    expect(qualityFromRange(0, 1, false)).toBe('fair');
  });

  it('is not fooled by floating-point subtraction (70,2 − 70,0)', () => {
    expect(qualityFromRange(70.2 - 70, 5, false)).toBe('good');
    expect(qualityFromRange(64.4 - 63.9, 5, false)).toBe('fair');
    expect(qualityFromRange(0.2000001, 5, false)).toBe('fair');
  });

  it('a 0,2 kg spread in the final window yields good quality', () => {
    const s = new WeightSession();
    feed(s, 0, 30_000, (_, i) => r(i % 2 ? 70.2 : 70.0));
    const res = s.tick(30_000).result!;
    expect(res.quality).toBe('good');
    expect(res.rangeKg).toBeCloseTo(0.2, 10);
  });
});
