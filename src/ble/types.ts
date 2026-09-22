export type DeviceKind = 'scale' | 'thermometer';
export type TransportMode = 'advertisement' | 'gatt';

/** Normalised view of one BLE advertisement (independent of react-native-ble-plx). */
export interface AdvertisementPacket {
  id: string;
  name: string | null;
  rssi: number | null;
  /** Lower-case full 128-bit UUIDs. */
  serviceUUIDs: string[];
  /** Keys are lower-case full 128-bit UUIDs. */
  serviceData: Record<string, Uint8Array>;
  manufacturerData: Uint8Array | null;
  receivedAt: number;
}

export interface ScaleReading {
  weightKg: number;
  /** Scale reports the value as settled. */
  stable: boolean;
  /** The load was removed from the platform (reading is the last value, not a live one). */
  removed?: boolean;
  impedanceOhm?: number;
  bodyFatPct?: number;
  heightCm?: number;
  bmi?: number;
  userId?: number;
  measuredAt?: Date;
  /** Hex dump of the raw payload for diagnostics. */
  raw?: string;
}

export type TemperatureTypeCode = 'armpit' | 'body' | 'ear' | 'finger' | 'gastrointestinal' | 'mouth' | 'rectum' | 'toe' | 'tympanum';

export interface TemperatureReading {
  temperatureC: number;
  /** false for Intermediate Temperature (0x2A1E) notifications. */
  final: boolean;
  type?: TemperatureTypeCode;
  measuredAt?: Date;
  raw?: string;
}

export interface GattSubscription {
  service: string;
  characteristic: string;
}

export interface ProtocolMatch {
  protocolId: string;
  protocolName: string;
  kind: DeviceKind;
  transport: TransportMode;
}

/** A device the user selected and the app remembers. */
export interface KnownDevice extends ProtocolMatch {
  id: string;
  name: string;
}
