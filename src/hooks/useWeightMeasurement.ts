import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import type { DataSource, SourceStatus } from '@/ble/sources';
import type { Stoppable } from '@/ble/transportTypes';
import type { ScaleReading } from '@/ble/types';
import { DEFAULT_SESSION_CONFIG, WeightSession, type WeightSessionResult, type WeightSessionSnapshot } from '@/ble/weightSession';

export type MeasureStatus = 'idle' | 'connecting' | 'active' | 'completed' | 'error';

const TICK_MS = 200;

const idleSnapshot = (durationMs: number): WeightSessionSnapshot => ({
  phase: 'waiting',
  hint: 'step_on',
  elapsedMs: 0,
  remainingMs: durationMs,
  progress: 0,
  liveStable: false,
  sampleCount: 0,
});

export function useWeightMeasurement(params: {
  source: DataSource<ScaleReading> | null;
  durationSec: number;
  minWeightKg: number;
  onComplete?: (result: WeightSessionResult) => void;
}) {
  const { source, durationSec, minWeightKg, onComplete } = params;
  const durationMs = durationSec * 1000;
  const [status, setStatus] = useState<MeasureStatus>('idle');
  const [snapshot, setSnapshot] = useState<WeightSessionSnapshot>(() => idleSnapshot(durationMs));
  const [sourceStatus, setSourceStatus] = useState<SourceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRaw, setLastRaw] = useState<string | undefined>();

  const handleRef = useRef<Stoppable | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runIdRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  const teardown = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    const handle = handleRef.current;
    handleRef.current = null;
    if (handle) await handle.stop().catch(() => {});
  }, []);

  const start = useCallback(async () => {
    if (!source) return;
    await teardown();
    const runId = ++runIdRef.current;
    const session = new WeightSession({ ...DEFAULT_SESSION_CONFIG, durationMs, minWeightKg });
    setError(null);
    setSourceStatus(null);
    setLastRaw(undefined);
    setSnapshot(idleSnapshot(durationMs));
    setStatus('connecting');

    try {
      const handle = await source({
        onReading: (reading) => {
          if (runIdRef.current !== runId) return;
          session.push(reading, Date.now());
          if (reading.raw) setLastRaw(reading.raw);
        },
        onStatus: (s) => {
          if (runIdRef.current !== runId) return;
          setSourceStatus(s);
          if (s === 'disconnected' && session.currentPhase !== 'completed') {
            // Invalidate the run so a link that is still opening, the tick timer and late readings are dropped.
            runIdRef.current++;
            setError('Mất kết nối với cân. Hãy kiểm tra cân còn bật và ở gần điện thoại.');
            setStatus('error');
            void teardown();
          }
        },
        onError: (e) => {
          if (runIdRef.current === runId) setError(e.message);
        },
      });
      if (runIdRef.current !== runId) {
        await handle.stop().catch(() => {});
        return;
      }
      handleRef.current = handle;
      setStatus('active');
      timerRef.current = setInterval(() => {
        if (runIdRef.current !== runId) return;
        const snap = session.tick(Date.now());
        setSnapshot(snap);
        if (snap.phase === 'completed' && snap.result) {
          const result = snap.result;
          void teardown();
          setStatus('completed');
          if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          onCompleteRef.current?.(result);
        }
      }, TICK_MS);
    } catch (e) {
      if (runIdRef.current !== runId) return;
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
      await teardown();
    }
  }, [durationMs, minWeightKg, source, teardown]);

  const cancel = useCallback(async () => {
    runIdRef.current++;
    await teardown();
    setStatus('idle');
    setSourceStatus(null);
    setSnapshot(idleSnapshot(durationMs));
  }, [durationMs, teardown]);

  useEffect(
    () => () => {
      runIdRef.current++;
      void teardown();
    },
    [teardown],
  );

  return { status, snapshot, sourceStatus, error, lastRaw, start, cancel };
}
