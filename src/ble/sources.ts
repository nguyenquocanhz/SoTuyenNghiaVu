import { getProtocol } from './protocols';
import { startSimulatedScale, startSimulatedThermometer } from './simulator';
import { bleTransport } from './transport';
import type { Stoppable } from './transportTypes';
import type { KnownDevice, ScaleReading, TemperatureReading } from './types';

export type SourceStatus = 'connecting' | 'listening' | 'disconnected';

export interface SourceHandlers<R> {
  onReading(reading: R): void;
  onStatus(status: SourceStatus): void;
  onError(error: Error): void;
}

/** Opens a stream of readings; resolves with a handle to stop it. */
export type DataSource<R> = (handlers: SourceHandlers<R>) => Promise<Stoppable>;

export function simulatedScaleSource(targetKg: number): DataSource<ScaleReading> {
  return async ({ onReading, onStatus }) => {
    onStatus('listening');
    const sim = startSimulatedScale(targetKg, onReading);
    return { stop: async () => sim.stop() };
  };
}

export function simulatedThermometerSource(targetC: number): DataSource<TemperatureReading> {
  return async ({ onReading, onStatus }) => {
    onStatus('listening');
    const sim = startSimulatedThermometer(targetC, onReading);
    return { stop: async () => sim.stop() };
  };
}

export function bleScaleSource(device: KnownDevice): DataSource<ScaleReading> {
  return async ({ onReading, onStatus, onError }) => {
    const protocol = getProtocol(device.protocolId);
    if (!protocol || protocol.kind !== 'scale') throw new Error(`Giao thức không hỗ trợ: ${device.protocolId}`);
    onStatus('connecting');

    if (protocol.transport === 'advertisement') {
      const scan = await bleTransport.startScan(
        (packet) => {
          if (packet.id !== device.id) return;
          const reading = protocol.parse(packet);
          if (reading) onReading(reading);
        },
        onError,
        { allowDuplicates: true },
      );
      onStatus('listening');
      return scan;
    }

    const link = await bleTransport.connectAndSubscribe(
      device.id,
      protocol.subscriptions,
      (characteristic, bytes) => {
        try {
          const reading = protocol.parse(characteristic, bytes) as ScaleReading | null;
          if (reading) onReading(reading);
        } catch (e) {
          onError(e instanceof Error ? e : new Error(String(e)));
        }
      },
      (error) => {
        onStatus('disconnected');
        if (error) onError(error);
      },
    );
    onStatus('listening');
    return link;
  };
}

export function bleThermometerSource(device: KnownDevice): DataSource<TemperatureReading> {
  return async ({ onReading, onStatus, onError }) => {
    const protocol = getProtocol(device.protocolId);
    if (!protocol || protocol.kind !== 'thermometer' || protocol.transport !== 'gatt') {
      throw new Error(`Giao thức không hỗ trợ: ${device.protocolId}`);
    }
    onStatus('connecting');
    const link = await bleTransport.connectAndSubscribe(
      device.id,
      protocol.subscriptions,
      (characteristic, bytes) => {
        try {
          const reading = protocol.parse(characteristic, bytes) as TemperatureReading | null;
          if (reading) onReading(reading);
        } catch (e) {
          onError(e instanceof Error ? e : new Error(String(e)));
        }
      },
      (error) => {
        onStatus('disconnected');
        if (error) onError(error);
      },
    );
    onStatus('listening');
    return link;
  };
}
