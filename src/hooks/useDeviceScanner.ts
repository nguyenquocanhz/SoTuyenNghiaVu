import { useCallback, useEffect, useRef, useState } from 'react';

import { identifyDevice } from '@/ble/protocols';
import { bleTransport } from '@/ble/transport';
import { BleUnavailableError, type Stoppable } from '@/ble/transportTypes';
import type { AdvertisementPacket, ProtocolMatch } from '@/ble/types';

/** One device seen during a scan, merged from all of its advertisement packets. */
export interface ScannedDevice {
  id: string;
  name: string | null;
  rssi: number | null;
  lastSeen: number;
  /** Protocol recognised from the advertisement, if any. */
  match: ProtocolMatch | null;
}

/** State is flushed from the packet map to React at most this often. */
const FLUSH_INTERVAL_MS = 500;
/** Scans stop by themselves after this long to save battery. */
export const SCAN_DURATION_MS = 20_000;

/** Strongest signal first; devices without RSSI go last. */
export function compareByRssi(a: ScannedDevice, b: ScannedDevice): number {
  return (b.rssi ?? -Infinity) - (a.rssi ?? -Infinity);
}

function errorMessage(e: unknown): string {
  if (e instanceof BleUnavailableError) return e.message;
  if (e instanceof Error && e.message) return `Lỗi khi quét Bluetooth: ${e.message}`;
  return 'Không thể quét thiết bị Bluetooth. Hãy thử lại.';
}

function mergePacket(previous: ScannedDevice | undefined, packet: AdvertisementPacket): ScannedDevice {
  return {
    id: packet.id,
    // Scan responses often arrive without a name: keep the one we already know.
    name: packet.name ?? previous?.name ?? null,
    rssi: packet.rssi ?? previous?.rssi ?? null,
    lastSeen: packet.receivedAt,
    // Some scales only include their service data in a subset of packets.
    match: identifyDevice(packet) ?? previous?.match ?? null,
  };
}

/**
 * Bluetooth LE discovery for the device picker.
 * Packets are collected into a Map keyed by device id and pushed to React state
 * at most every 500 ms; the scan stops automatically after 20 s and on unmount.
 */
export function useDeviceScanner(): {
  scanning: boolean;
  devices: ScannedDevice[];
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
} {
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<ScannedDevice[]>([]);
  const [error, setError] = useState<string | null>(null);

  const seenRef = useRef<Map<string, ScannedDevice> | null>(null);
  const dirtyRef = useRef(false);
  const handleRef = useRef<Stoppable | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runIdRef = useRef(0);
  const activeRef = useRef(false);

  const seen = useCallback((): Map<string, ScannedDevice> => {
    if (!seenRef.current) seenRef.current = new Map();
    return seenRef.current;
  }, []);

  const flush = useCallback(() => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    setDevices([...seen().values()].sort(compareByRssi));
  }, [seen]);

  /** Stops timers and the native scan without touching React state. */
  const teardown = useCallback(async () => {
    activeRef.current = false;
    if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    flushTimerRef.current = null;
    stopTimerRef.current = null;
    const handle = handleRef.current;
    handleRef.current = null;
    if (handle) await handle.stop().catch(() => {});
  }, []);

  const stop = useCallback(async () => {
    runIdRef.current++;
    await teardown();
    flush();
    setScanning(false);
  }, [flush, teardown]);

  const start = useCallback(async () => {
    if (activeRef.current) return;
    const runId = ++runIdRef.current;
    activeRef.current = true;
    seen().clear();
    dirtyRef.current = false;
    setDevices([]);
    setError(null);
    setScanning(true);

    const isCurrent = () => runIdRef.current === runId;

    try {
      const handle = await bleTransport.startScan(
        (packet) => {
          if (!isCurrent()) return;
          const map = seen();
          map.set(packet.id, mergePacket(map.get(packet.id), packet));
          dirtyRef.current = true;
        },
        (scanError) => {
          if (!isCurrent()) return;
          setError(errorMessage(scanError));
          void stop();
        },
        { allowDuplicates: false },
      );
      if (!isCurrent()) {
        // stop() or unmount happened while the scan was starting.
        await handle.stop().catch(() => {});
        return;
      }
      handleRef.current = handle;
      flushTimerRef.current = setInterval(flush, FLUSH_INTERVAL_MS);
      stopTimerRef.current = setTimeout(() => {
        if (isCurrent()) void stop();
      }, SCAN_DURATION_MS);
    } catch (e) {
      if (!isCurrent()) return;
      activeRef.current = false;
      setError(errorMessage(e));
      setScanning(false);
    }
  }, [flush, seen, stop]);

  useEffect(
    () => () => {
      runIdRef.current++;
      void teardown();
    },
    [teardown],
  );

  return { scanning, devices, error, start, stop };
}
