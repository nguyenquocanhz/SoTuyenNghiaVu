/**
 * Fallback transport used on web (react-native-ble-plx is native-only).
 * On Android/iOS Metro resolves `transport.native.ts` instead.
 * The app still works on web through the built-in simulator (demo mode).
 */
import { BleUnavailableError, type BleTransport } from './transportTypes';

const unsupported = () => Promise.reject(new BleUnavailableError('unsupported', 'Bluetooth chỉ hỗ trợ trên ứng dụng Android/iOS.'));

export const bleTransport: BleTransport = {
  isSupported: false,
  getState: () => Promise.resolve('unsupported'),
  onStateChange: (listener) => {
    listener('unsupported');
    return () => {};
  },
  requestPermissions: () => Promise.resolve(false),
  startScan: unsupported,
  connectAndSubscribe: unsupported,
  probeServices: unsupported,
};
