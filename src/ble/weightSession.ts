import type { SignalQuality, WeightStability } from '@/domain/types';

import type { ScaleReading } from './types';

/**
 * Timed weight-capture protocol:
 *  1. `waiting`   – nothing (or < minWeightKg) on the platform.
 *  2. `measuring` – load detected; a countdown of `durationMs` starts. The user
 *                   must stay on the scale. Stepping off longer than
 *                   `stepOffGraceMs` aborts back to `waiting`.
 *  3. `completed` – at the end of the countdown the weight is locked as the
 *                   median of the readings in the last `windowMs` (readings the
 *                   scale flags as stable take precedence).
 */
export interface WeightSessionConfig {
  durationMs: number;
  minWeightKg: number;
  windowMs: number;
  stepOffGraceMs: number;
}

export const DEFAULT_SESSION_CONFIG: WeightSessionConfig = {
  durationMs: 30_000,
  minWeightKg: 2,
  windowMs: 5_000,
  stepOffGraceMs: 1_500,
};

export type SessionPhase = 'waiting' | 'measuring' | 'completed';
export type SessionHint = 'step_on' | 'stand_still' | 'hold_steady' | 'stepped_off' | 'done';

interface Sample extends ScaleReading {
  t: number;
}

export interface WeightSessionResult extends WeightStability {
  weightKg: number;
  completedAt: number;
  impedanceOhm?: number;
  bodyFatPct?: number;
  heightCm?: number;
  bmi?: number;
}

export interface WeightSessionSnapshot {
  phase: SessionPhase;
  hint: SessionHint;
  elapsedMs: number;
  remainingMs: number;
  progress: number;
  liveKg?: number;
  liveStable: boolean;
  sampleCount: number;
  /** Spread (max-min) of readings in the trailing window, kg. */
  liveRangeKg?: number;
  result?: WeightSessionResult;
}

const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const stdDev = (values: number[]) => {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / (values.length - 1));
};

/** Tolerance for kg thresholds: 70.2 − 70.0 is 0.20000000000000284 in floating point. */
const KG_EPSILON = 1e-9;

export function qualityFromRange(rangeKg: number, samples: number, stableFlag: boolean): SignalQuality {
  if (samples === 1) return stableFlag ? 'good' : 'fair';
  if (rangeKg <= 0.2 + KG_EPSILON) return 'good';
  if (rangeKg <= 0.5 + KG_EPSILON) return 'fair';
  return 'poor';
}

const lastDefined = <K extends keyof Sample>(samples: Sample[], key: K): Sample[K] | undefined => {
  for (let i = samples.length - 1; i >= 0; i--) if (samples[i][key] !== undefined) return samples[i][key];
  return undefined;
};

export class WeightSession {
  private phase: SessionPhase = 'waiting';
  private startedAt?: number;
  private samples: Sample[] = [];
  private offSince?: number;
  private steppedOff = false;
  private result?: WeightSessionResult;
  private live?: Sample;

  constructor(private readonly config: WeightSessionConfig = DEFAULT_SESSION_CONFIG) {}

  push(reading: ScaleReading, t: number): void {
    // A reading can arrive after the countdown ended but before the next tick (late timer,
    // app resumed): settle the session at its end time first so it cannot be aborted retroactively.
    // A reading taken exactly at the end still belongs to the session (strict comparison).
    this.settle(t, true);
    if (this.phase === 'completed') return;
    const onScale = !reading.removed && reading.weightKg >= this.config.minWeightKg;
    this.live = { ...reading, t };

    if (this.phase === 'waiting') {
      if (onScale) {
        this.phase = 'measuring';
        this.startedAt = t;
        this.samples = [{ ...reading, t }];
        this.offSince = undefined;
        this.steppedOff = false;
      }
      return;
    }

    // measuring
    if (onScale) {
      this.offSince = undefined;
      this.samples.push({ ...reading, t });
    } else {
      this.offSince ??= t;
      if (t - this.offSince >= this.config.stepOffGraceMs) this.abort();
    }
  }

  /** Advances time; completes the session when the countdown has elapsed. */
  tick(now: number): WeightSessionSnapshot {
    this.settle(now);
    return this.snapshot(now);
  }

  /**
   * Aborts when the user has been off the platform for the grace period *before* the
   * countdown ended; otherwise completes once the countdown has elapsed. Evaluating the
   * step-off at min(now, end) keeps the outcome independent of how late `now` is observed.
   */
  private settle(now: number, onlyAfterEnd = false) {
    if (this.phase !== 'measuring' || this.startedAt === undefined) return;
    const endT = this.startedAt + this.config.durationMs;
    if (this.offSince !== undefined && Math.min(now, endT) - this.offSince >= this.config.stepOffGraceMs) {
      this.abort();
    } else if (onlyAfterEnd ? now > endT : now >= endT) {
      this.complete(endT);
    }
  }

  snapshot(now: number): WeightSessionSnapshot {
    const { durationMs, windowMs } = this.config;
    if (this.phase === 'completed' && this.result) {
      return {
        phase: 'completed',
        hint: 'done',
        elapsedMs: durationMs,
        remainingMs: 0,
        progress: 1,
        liveKg: this.result.weightKg,
        liveStable: true,
        sampleCount: this.samples.length,
        liveRangeKg: this.result.rangeKg,
        result: this.result,
      };
    }
    if (this.phase === 'waiting' || this.startedAt === undefined) {
      return {
        phase: 'waiting',
        hint: this.steppedOff ? 'stepped_off' : 'step_on',
        elapsedMs: 0,
        remainingMs: durationMs,
        progress: 0,
        liveKg: this.live && !this.live.removed ? this.live.weightKg : undefined,
        liveStable: false,
        sampleCount: 0,
      };
    }
    const elapsed = Math.min(Math.max(now - this.startedAt, 0), durationMs);
    const recent = this.samples.filter((s) => s.t >= now - windowMs).map((s) => s.weightKg);
    const liveRangeKg = recent.length ? Math.max(...recent) - Math.min(...recent) : undefined;
    const lastOnScale = this.samples[this.samples.length - 1];
    let hint: SessionHint = 'stand_still';
    if (this.offSince !== undefined) hint = 'stepped_off';
    else if (liveRangeKg !== undefined && liveRangeKg > 0.5 + KG_EPSILON) hint = 'hold_steady';
    return {
      phase: 'measuring',
      hint,
      elapsedMs: elapsed,
      remainingMs: durationMs - elapsed,
      progress: elapsed / durationMs,
      liveKg: lastOnScale?.weightKg,
      liveStable: Boolean(lastOnScale?.stable),
      sampleCount: this.samples.length,
      liveRangeKg,
    };
  }

  get currentPhase(): SessionPhase {
    return this.phase;
  }

  private abort() {
    this.phase = 'waiting';
    this.startedAt = undefined;
    this.samples = [];
    this.offSince = undefined;
    this.steppedOff = true;
  }

  private complete(endT: number) {
    const { windowMs, durationMs } = this.config;
    const inSession = this.samples.filter((s) => s.t <= endT);
    const all = inSession.length ? inSession : this.samples;
    const windowed = all.filter((s) => s.t >= endT - windowMs);
    const stableWindowed = windowed.filter((s) => s.stable);
    const stableAll = all.filter((s) => s.stable);

    let chosen: Sample[];
    let usedStableFlag = true;
    if (stableWindowed.length) chosen = stableWindowed;
    else if (stableAll.length) chosen = stableAll.slice(-10);
    else {
      usedStableFlag = false;
      chosen = windowed.length ? windowed : all.slice(-5);
    }

    const values = chosen.map((s) => s.weightKg);
    const rangeKg = Math.max(...values) - Math.min(...values);
    const sdKg = stdDev(values);
    this.result = {
      weightKg: median(values),
      samples: values.length,
      sdKg,
      rangeKg,
      windowSec: windowMs / 1000,
      durationSec: durationMs / 1000,
      quality: qualityFromRange(rangeKg, values.length, usedStableFlag),
      usedStableFlag,
      completedAt: endT,
      impedanceOhm: lastDefined(all, 'impedanceOhm'),
      bodyFatPct: lastDefined(all, 'bodyFatPct'),
      heightCm: lastDefined(all, 'heightCm'),
      bmi: lastDefined(all, 'bmi'),
    };
    this.phase = 'completed';
  }
}
