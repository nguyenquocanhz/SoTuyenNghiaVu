import type { AdvertisementPacket, DeviceKind, GattSubscription, ProtocolMatch, ScaleReading, TemperatureReading, TransportMode } from '../types';
import { UUID } from '../uuids';
import { okokScale, qnBroadcastScale } from './broadcastScales';
import { parseBodyCompositionMeasurement, parseTemperatureMeasurement, parseWeightMeasurement } from './sig';
import { miScaleV1, miScaleV2 } from './xiaomi';

interface ProtocolBase {
  id: string;
  name: string;
  kind: DeviceKind;
  transport: TransportMode;
  /** Recognises the device from an advertisement. */
  match(adv: AdvertisementPacket): boolean;
}

export interface AdvertisementScaleProtocol extends ProtocolBase {
  kind: 'scale';
  transport: 'advertisement';
  parse(adv: AdvertisementPacket): ScaleReading | null;
}

export interface GattProtocol<R> extends ProtocolBase {
  transport: 'gatt';
  /** Characteristics to subscribe to (only those present on the device are used). */
  subscriptions: GattSubscription[];
  parse(characteristic: string, bytes: Uint8Array): R | null;
}

export type ScaleProtocol = AdvertisementScaleProtocol | GattProtocol<ScaleReading>;
export type ThermometerProtocol = GattProtocol<TemperatureReading>;
export type Protocol = ScaleProtocol | ThermometerProtocol;

const hasService = (adv: AdvertisementPacket, uuid: string) => adv.serviceUUIDs.includes(uuid);

export const SIG_SCALE: GattProtocol<ScaleReading> = {
  id: 'sig_scale',
  name: 'Bluetooth SIG Weight Scale / Body Composition',
  kind: 'scale',
  transport: 'gatt',
  match: (adv) => hasService(adv, UUID.weightScaleService) || hasService(adv, UUID.bodyCompositionService),
  subscriptions: [
    { service: UUID.weightScaleService, characteristic: UUID.weightMeasurement },
    { service: UUID.bodyCompositionService, characteristic: UUID.bodyCompositionMeasurement },
  ],
  parse: (characteristic, bytes) =>
    characteristic === UUID.bodyCompositionMeasurement ? parseBodyCompositionMeasurement(bytes) : parseWeightMeasurement(bytes),
};

export const SIG_THERMOMETER: ThermometerProtocol = {
  id: 'sig_thermometer',
  name: 'Bluetooth SIG Health Thermometer',
  kind: 'thermometer',
  transport: 'gatt',
  match: (adv) => hasService(adv, UUID.healthThermometerService),
  subscriptions: [
    { service: UUID.healthThermometerService, characteristic: UUID.temperatureMeasurement },
    { service: UUID.healthThermometerService, characteristic: UUID.intermediateTemperature },
  ],
  parse: (characteristic, bytes) => parseTemperatureMeasurement(bytes, characteristic === UUID.temperatureMeasurement),
};

/** Order matters: broadcast formats are checked before generic GATT service UUIDs. */
export const PROTOCOLS: Protocol[] = [
  { id: 'xiaomi_v2', name: 'Xiaomi Mi Body Composition Scale 2', kind: 'scale', transport: 'advertisement', ...miScaleV2 },
  { id: 'xiaomi_v1', name: 'Xiaomi Mi Smart Scale', kind: 'scale', transport: 'advertisement', ...miScaleV1 },
  { id: 'okok', name: 'OKOK / Chipsea', kind: 'scale', transport: 'advertisement', ...okokScale },
  { id: 'qn_broadcast', name: 'QN / Renpho / FITINDEX', kind: 'scale', transport: 'advertisement', ...qnBroadcastScale },
  SIG_SCALE,
  SIG_THERMOMETER,
];

export function getProtocol(id: string): Protocol | undefined {
  return PROTOCOLS.find((p) => p.id === id);
}

export function identifyDevice(adv: AdvertisementPacket): ProtocolMatch | null {
  const p = PROTOCOLS.find((proto) => proto.match(adv));
  return p ? { protocolId: p.id, protocolName: p.name, kind: p.kind, transport: p.transport } : null;
}

/** Protocol match from the service list discovered after connecting to an unidentified device. */
export function identifyByServices(serviceUuids: string[]): ProtocolMatch | null {
  const adv: AdvertisementPacket = {
    id: '',
    name: null,
    rssi: null,
    serviceUUIDs: serviceUuids,
    serviceData: {},
    manufacturerData: null,
    receivedAt: 0,
  };
  const p = [SIG_SCALE, SIG_THERMOMETER].find((proto) => proto.match(adv));
  return p ? { protocolId: p.id, protocolName: p.name, kind: p.kind, transport: p.transport } : null;
}
