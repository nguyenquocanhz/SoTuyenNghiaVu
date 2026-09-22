import type { AdvertisementPacket, GattSubscription } from './types';

export type AdapterState = 'unknown' | 'unsupported' | 'unauthorized' | 'powered_off' | 'powered_on';

export interface Stoppable {
  stop(): Promise<void>;
}

export interface BleTransport {
  readonly isSupported: boolean;
  getState(): Promise<AdapterState>;
  onStateChange(listener: (state: AdapterState) => void): () => void;
  /** Runtime permissions (Android 12+: BLUETOOTH_SCAN/CONNECT, older: fine location). */
  requestPermissions(): Promise<boolean>;
  /** Scans for advertisements. `allowDuplicates` is required to follow broadcast scales live. */
  startScan(
    onPacket: (packet: AdvertisementPacket) => void,
    onError: (error: Error) => void,
    options?: { allowDuplicates?: boolean },
  ): Promise<Stoppable>;
  /** Connects, discovers services and subscribes to every listed characteristic the device exposes. */
  connectAndSubscribe(
    deviceId: string,
    subscriptions: GattSubscription[],
    onData: (characteristic: string, bytes: Uint8Array) => void,
    onDisconnect: (error?: Error) => void,
  ): Promise<Stoppable & { subscribed: string[] }>;
  /** Connects briefly to list the GATT services of an unidentified device. */
  probeServices(deviceId: string): Promise<string[]>;
}

export class BleUnavailableError extends Error {
  constructor(
    public readonly reason: AdapterState | 'permission' | 'no_characteristic',
    message: string,
  ) {
    super(message);
    this.name = 'BleUnavailableError';
  }
}

export const ADAPTER_STATE_TEXT: Record<AdapterState, string> = {
  unknown: 'Đang kiểm tra Bluetooth…',
  unsupported: 'Thiết bị hoặc nền tảng không hỗ trợ Bluetooth LE.',
  unauthorized: 'Ứng dụng chưa được cấp quyền Bluetooth.',
  powered_off: 'Bluetooth đang tắt. Hãy bật Bluetooth.',
  powered_on: 'Bluetooth sẵn sàng.',
};
