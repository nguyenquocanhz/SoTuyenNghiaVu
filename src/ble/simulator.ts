import type { ScaleReading, TemperatureReading } from './types';

/**
 * Deterministic-ish physical model of a person stepping on a bathroom scale:
 * rising load with overshoot, damped oscillation while balancing, then small
 * sensor noise. The scale sets `stable` once readings settle, like consumer
 * scales that stream live values.
 */
export function simulateScaleReading(targetKg: number, tSinceStepOnMs: number, rand: () => number = Math.random): ScaleReading {
  const t = tSinceStepOnMs / 1000;
  if (t < 0) return { weightKg: 0, stable: false };
  const rise = 1 - Math.exp(-t * 3.2);
  const sway = Math.exp(-t * 0.45) * 0.9 * Math.sin(t * 5.3);
  const noise = (rand() - 0.5) * (t > 6 ? 0.06 : 0.2);
  const weightKg = Math.max(0, targetKg * rise + sway + noise);
  return { weightKg: Math.round(weightKg * 20) / 20, stable: t > 6.5 };
}

export interface SimulatedStream {
  stop(): void;
}

export function startSimulatedScale(
  targetKg: number,
  onReading: (reading: ScaleReading) => void,
  options: { stepOnDelayMs?: number; intervalMs?: number } = {},
): SimulatedStream {
  const stepOnDelayMs = options.stepOnDelayMs ?? 2500;
  const startedAt = Date.now();
  const timer = setInterval(() => {
    onReading(simulateScaleReading(targetKg, Date.now() - startedAt - stepOnDelayMs));
  }, options.intervalMs ?? 250);
  return { stop: () => clearInterval(timer) };
}

/** Thermometer that sends intermediate readings for ~6 s and then a final one. */
export function startSimulatedThermometer(
  targetC: number,
  onReading: (reading: TemperatureReading) => void,
  options: { durationMs?: number; intervalMs?: number } = {},
): SimulatedStream {
  const durationMs = options.durationMs ?? 6000;
  const startedAt = Date.now();
  const timer = setInterval(() => {
    const elapsed = Date.now() - startedAt;
    if (elapsed >= durationMs) {
      clearInterval(timer);
      onReading({ temperatureC: targetC, final: true, type: 'armpit' });
      return;
    }
    const approach = 34 + (targetC - 34) * (1 - Math.exp(-elapsed / 1500));
    onReading({ temperatureC: Math.round(approach * 10) / 10, final: false, type: 'armpit' });
  }, options.intervalMs ?? 500);
  return { stop: () => clearInterval(timer) };
}
