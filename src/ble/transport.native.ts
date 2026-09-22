import { PermissionsAndroid, Platform } from 'react-native';
import { BleError, BleErrorCode, BleManager, ScanMode, State, type Device, type Subscription } from 'react-native-ble-plx';

import { base64ToBytes } from './bytes';
import { BleUnavailableError, type AdapterState, type BleTransport } from './transportTypes';
import type { AdvertisementPacket } from './types';
import { fullUuid } from './uuids';

let manager: BleManager | undefined;
const getManager = () => (manager ??= new BleManager());

const STATE_MAP: Record<State, AdapterState> = {
  [State.Unknown]: 'unknown',
  [State.Resetting]: 'unknown',
  [State.Unsupported]: 'unsupported',
  [State.Unauthorized]: 'unauthorized',
  [State.PoweredOff]: 'powered_off',
  [State.PoweredOn]: 'powered_on',
};

function toPacket(device: Device): AdvertisementPacket {
  const serviceData: Record<string, Uint8Array> = {};
  for (const [uuid, value] of Object.entries(device.serviceData ?? {})) {
    serviceData[fullUuid(uuid)] = base64ToBytes(value);
  }
  return {
    id: device.id,
    name: device.localName ?? device.name ?? null,
    rssi: device.rssi,
    serviceUUIDs: (device.serviceUUIDs ?? []).map(fullUuid),
    serviceData,
    manufacturerData: device.manufacturerData ? base64ToBytes(device.manufacturerData) : null,
    receivedAt: Date.now(),
  };
}

async function ensurePoweredOn(): Promise<void> {
  const state = STATE_MAP[await getManager().state()];
  if (state === 'powered_on') return;
  if (state === 'unknown') {
    // The native stack reports Unknown right after start-up; wait briefly for the real state.
    const settled = await new Promise<AdapterState>((resolve) => {
      const timer = setTimeout(() => {
        sub.remove();
        resolve('unknown');
      }, 3000);
      const sub = getManager().onStateChange((s) => {
        if (s === State.Unknown || s === State.Resetting) return;
        clearTimeout(timer);
        sub.remove();
        resolve(STATE_MAP[s]);
      }, true);
    });
    if (settled === 'powered_on') return;
    throw new BleUnavailableError(settled, messageFor(settled));
  }
  throw new BleUnavailableError(state, messageFor(state));
}

function messageFor(state: AdapterState): string {
  switch (state) {
    case 'powered_off':
      return 'Bluetooth đang tắt. Hãy bật Bluetooth rồi thử lại.';
    case 'unauthorized':
      return 'Ứng dụng chưa được cấp quyền Bluetooth trong Cài đặt hệ thống.';
    case 'unsupported':
      return 'Thiết bị không hỗ trợ Bluetooth Low Energy.';
    default:
      return 'Không xác định được trạng thái Bluetooth.';
  }
}

/**
 * react-native-ble-plx reports English native reasons ("Device ... was disconnected").
 * Every error that leaves this module is translated to a Vietnamese, user-facing message.
 */
function toUserError(error: unknown): Error {
  if (error instanceof BleUnavailableError) return error;
  if (!(error instanceof BleError)) {
    return error instanceof Error && /[à-ỹđ]/i.test(error.message) ? error : new Error('Lỗi Bluetooth không xác định. Hãy thử lại.');
  }
  switch (error.errorCode) {
    case BleErrorCode.BluetoothPoweredOff:
      return new BleUnavailableError('powered_off', messageFor('powered_off'));
    case BleErrorCode.BluetoothUnauthorized:
      return new BleUnavailableError('unauthorized', messageFor('unauthorized'));
    case BleErrorCode.BluetoothUnsupported:
      return new BleUnavailableError('unsupported', messageFor('unsupported'));
    case BleErrorCode.BluetoothInUnknownState:
    case BleErrorCode.BluetoothResetting:
    case BleErrorCode.BluetoothStateChangeFailed:
      return new BleUnavailableError('unknown', 'Bluetooth đang khởi động lại hoặc chưa sẵn sàng. Hãy thử lại sau vài giây.');
    case BleErrorCode.LocationServicesDisabled:
      return new Error('Hãy bật Vị trí (Location) của điện thoại để quét thiết bị Bluetooth.');
    case BleErrorCode.ScanStartFailed:
      return new Error('Không bắt đầu quét Bluetooth được. Hãy tắt/bật lại Bluetooth rồi thử lại.');
    case BleErrorCode.OperationCancelled:
      return new Error('Thao tác Bluetooth đã bị huỷ.');
    case BleErrorCode.OperationTimedOut:
      return new Error('Hết thời gian chờ thiết bị phản hồi. Hãy đánh thức thiết bị (bước lên cân / bật nhiệt kế) và để gần điện thoại.');
    case BleErrorCode.DeviceNotFound:
      return new Error('Không tìm thấy thiết bị. Hãy bật thiết bị và để gần điện thoại.');
    case BleErrorCode.DeviceConnectionFailed:
    case BleErrorCode.DeviceAlreadyConnected:
      return new Error('Không kết nối được với thiết bị. Hãy tắt/bật lại thiết bị rồi thử lại.');
    case BleErrorCode.DeviceDisconnected:
    case BleErrorCode.DeviceNotConnected:
      return new Error('Thiết bị đã ngắt kết nối. Hãy kiểm tra thiết bị còn bật và ở gần điện thoại.');
    case BleErrorCode.ServicesDiscoveryFailed:
    case BleErrorCode.ServicesNotDiscovered:
    case BleErrorCode.ServiceNotFound:
    case BleErrorCode.CharacteristicsDiscoveryFailed:
    case BleErrorCode.CharacteristicsNotDiscovered:
    case BleErrorCode.CharacteristicNotFound:
      return new Error('Không đọc được danh sách dịch vụ của thiết bị. Hãy thử kết nối lại.');
    case BleErrorCode.CharacteristicNotifyChangeFailed:
      return new Error('Thiết bị không cho phép đăng ký nhận số đo. Hãy thử kết nối lại.');
    default:
      return new Error(`Lỗi Bluetooth (mã ${error.errorCode}). Hãy thử lại.`);
  }
}

async function requestPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const api = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
  if (api >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return Object.values(result).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
  }
  const fine = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return fine === PermissionsAndroid.RESULTS.GRANTED;
}

async function prepare(): Promise<void> {
  if (!(await requestPermissions())) {
    throw new BleUnavailableError('permission', 'Cần cấp quyền "Thiết bị ở gần" / Bluetooth để kết nối cân và nhiệt kế.');
  }
  await ensurePoweredOn();
}

const ignore = () => {};

export const bleTransport: BleTransport = {
  isSupported: true,

  async getState() {
    return STATE_MAP[await getManager().state()];
  },

  onStateChange(listener) {
    const sub = getManager().onStateChange((s) => listener(STATE_MAP[s]), true);
    return () => sub.remove();
  },

  requestPermissions,

  async startScan(onPacket, onError, options = {}) {
    await prepare();
    const m = getManager();
    try {
      await m.startDeviceScan(
        null,
        { allowDuplicates: options.allowDuplicates ?? false, scanMode: ScanMode.LowLatency },
        (error, device) => {
          if (error) {
            onError(toUserError(error));
            return;
          }
          if (!device) return;
          let packet: AdvertisementPacket;
          try {
            packet = toPacket(device);
          } catch {
            return; // malformed advertisement payload: skip it
          }
          onPacket(packet);
        },
      );
    } catch (error) {
      throw toUserError(error);
    }
    return {
      stop: async () => {
        await m.stopDeviceScan().catch(ignore);
      },
    };
  },

  async connectAndSubscribe(deviceId, subscriptions, onData, onDisconnect) {
    await prepare();
    const m = getManager();
    await m.stopDeviceScan().catch(ignore);
    try {
      await m.connectToDevice(deviceId, { timeout: 15_000 });
    } catch (error) {
      throw toUserError(error);
    }
    const subs: Subscription[] = [];
    let closing = false;
    try {
      await m.discoverAllServicesAndCharacteristicsForDevice(deviceId);
      const services = await m.servicesForDevice(deviceId);
      const available = new Set<string>();
      for (const service of services) {
        const chars = await m.characteristicsForDevice(deviceId, service.uuid);
        chars.forEach((c) => available.add(`${fullUuid(service.uuid)}|${fullUuid(c.uuid)}`));
      }
      const wanted = subscriptions.filter((s) => available.has(`${s.service}|${s.characteristic}`));
      if (!wanted.length) {
        throw new BleUnavailableError('no_characteristic', 'Thiết bị không có dịch vụ đo tương thích (Weight Scale / Health Thermometer).');
      }
      subs.push(
        m.onDeviceDisconnected(deviceId, (error) => {
          if (!closing) onDisconnect(error ? toUserError(error) : undefined);
        }),
      );
      for (const s of wanted) {
        subs.push(
          m.monitorCharacteristicForDevice(deviceId, s.service, s.characteristic, (error, characteristic) => {
            if (error) {
              if (!closing && error.errorCode !== BleErrorCode.OperationCancelled) onDisconnect(toUserError(error));
              return;
            }
            if (!characteristic?.value) return;
            let bytes: Uint8Array;
            try {
              bytes = base64ToBytes(characteristic.value);
            } catch {
              return; // malformed notification payload: skip it
            }
            onData(s.characteristic, bytes);
          }),
        );
      }
      return {
        subscribed: wanted.map((s) => s.characteristic),
        stop: async () => {
          closing = true;
          subs.forEach((s) => s.remove());
          await m.cancelDeviceConnection(deviceId).catch(ignore);
        },
      };
    } catch (error) {
      closing = true;
      subs.forEach((s) => s.remove());
      await m.cancelDeviceConnection(deviceId).catch(ignore);
      throw toUserError(error);
    }
  },

  async probeServices(deviceId) {
    await prepare();
    const m = getManager();
    await m.stopDeviceScan().catch(ignore);
    try {
      await m.connectToDevice(deviceId, { timeout: 10_000 });
      await m.discoverAllServicesAndCharacteristicsForDevice(deviceId);
      const services = await m.servicesForDevice(deviceId);
      return services.map((s) => fullUuid(s.uuid));
    } catch (error) {
      throw toUserError(error);
    } finally {
      await m.cancelDeviceConnection(deviceId).catch(ignore);
    }
  },
};
