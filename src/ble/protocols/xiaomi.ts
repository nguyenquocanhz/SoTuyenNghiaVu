/**
 * Xiaomi Mi Smart Scale (v1) and Mi Body Composition Scale 2 broadcast every
 * reading as advertisement *service data* — no connection needed.
 * Layout cross-checked against Bluetooth-Devices/xiaomi-ble, ESPHome
 * xiaomi_miscale and openScale MiScaleHandler.
 */
import { roundTo } from '@/domain/format';

import { ByteReader, bytesToHex, isBitSet } from '../bytes';
import type { AdvertisementPacket, ScaleReading } from '../types';
import { UUID } from '../uuids';
import { LB_TO_KG } from './sig';

const JIN_TO_KG = 0.5;

function toKg(raw: number, lb: boolean, jin: boolean): number {
  if (lb) return (raw / 100) * LB_TO_KG;
  if (jin) return (raw / 100) * JIN_TO_KG;
  return raw / 200;
}

/** v1, service data UUID 0x181D, 10 bytes: ctrl, weight u16, date-time (7). */
export function parseMiScaleV1(data: Uint8Array): ScaleReading | null {
  if (data.length !== 10) return null;
  const r = new ByteReader(data);
  const ctrl = r.u8();
  const raw = r.u16le();
  const measuredAt = r.dateTime();
  return {
    weightKg: roundTo(toKg(raw, isBitSet(ctrl, 0), isBitSet(ctrl, 4)), 3),
    stable: isBitSet(ctrl, 5),
    removed: isBitSet(ctrl, 7),
    measuredAt,
    raw: bytesToHex(data),
  };
}

/** v2, service data UUID 0x181B, 13 bytes: ctrl0, ctrl1, date-time (7), impedance u16, weight u16. */
export function parseMiScaleV2(data: Uint8Array): ScaleReading | null {
  if (data.length !== 13) return null;
  const r = new ByteReader(data);
  const ctrl0 = r.u8();
  const ctrl1 = r.u8();
  const measuredAt = r.dateTime();
  const impedance = r.u16le();
  const raw = r.u16le();
  const stable = isBitSet(ctrl1, 5);
  const removed = isBitSet(ctrl1, 7);
  const hasImpedance = isBitSet(ctrl1, 1) && stable && !removed && impedance > 0 && impedance < 3000;
  return {
    weightKg: roundTo(toKg(raw, isBitSet(ctrl0, 0), isBitSet(ctrl1, 6)), 3),
    stable,
    removed,
    impedanceOhm: hasImpedance ? impedance : undefined,
    measuredAt,
    raw: bytesToHex(data),
  };
}

export const miScaleV1 = {
  match: (adv: AdvertisementPacket) => adv.serviceData[UUID.weightScaleService]?.length === 10,
  parse: (adv: AdvertisementPacket) => {
    const data = adv.serviceData[UUID.weightScaleService];
    return data ? parseMiScaleV1(data) : null;
  },
};

export const miScaleV2 = {
  match: (adv: AdvertisementPacket) => adv.serviceData[UUID.bodyCompositionService]?.length === 13,
  parse: (adv: AdvertisementPacket) => {
    const data = adv.serviceData[UUID.bodyCompositionService];
    return data ? parseMiScaleV2(data) : null;
  },
};
