/**
 * Low-cost scales that broadcast weight in advertisement *manufacturer data*
 * (common in Vietnam, sold with the "OKOK International" or Renpho/FITINDEX apps).
 * Byte layouts documented by the openScale project (OkOkHandler, QNHandlerBroadcast).
 *
 * react-native-ble-plx keeps the 2-byte little-endian company ID at the start of
 * `manufacturerData`; offsets below are relative to the payload after that ID.
 */
import { roundTo } from '@/domain/format';

import { bytesToHex, isBitSet } from '../bytes';
import type { AdvertisementPacket, ScaleReading } from '../types';
import { LB_TO_KG } from './sig';

const STONE_TO_KG = 6.35029318;

interface Split {
  companyId: number;
  payload: Uint8Array;
}

function split(data: Uint8Array | null): Split | null {
  if (!data || data.length < 2) return null;
  return { companyId: data[0] | (data[1] << 8), payload: data.subarray(2) };
}

const be16 = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const le16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);

const xorRange = (seed: number, b: Uint8Array, from: number, toInclusive: number) => {
  let x = seed;
  for (let i = from; i <= toInclusive; i++) x ^= b[i];
  return x & 0xff;
};

/** Decimal places encoded in bits 1–2, unit in bits 3–4 (OKOK V11 / C0). */
function decodeWeight(hi: number, lo: number, attr: number): number | null {
  const decimals = (attr >> 1) & 0x3;
  const divisor = decimals === 1 ? 1 : decimals === 2 ? 100 : 10;
  const unit = (attr >> 3) & 0x3;
  const raw = (hi << 8) | lo;
  switch (unit) {
    case 0:
      return raw / divisor;
    case 1:
      return raw / divisor / 2; // jin
    case 2:
      return (raw / divisor) * LB_TO_KG;
    case 3:
      return hi * STONE_TO_KG + (lo / divisor) * LB_TO_KG; // stone + pounds
    default:
      return null;
  }
}

const OKOK_NAMES = /^(ADV|Chipsea-BLE|Yoda0|Yoda1)/i;

export function isOkokName(name: string | null): boolean {
  return Boolean(name && OKOK_NAMES.test(name));
}

function result(weightKg: number | null, stable: boolean, raw: Uint8Array, impedanceOhm?: number): ScaleReading | null {
  if (weightKg === null || !Number.isFinite(weightKg) || weightKg < 0 || weightKg > 300) return null;
  return { weightKg: roundTo(weightKg, 3), stable, impedanceOhm, raw: bytesToHex(raw) };
}

/** Parses any OKOK / Chipsea variant. Returns null when the packet is not one. */
export function parseOkok(manufacturerData: Uint8Array | null, name: string | null): ScaleReading | null {
  const s = split(manufacturerData);
  if (!s) return null;
  const p = s.payload;

  // V20 — company 0x20CA, 19-byte payload, checksum at 12.
  if (s.companyId === 0x20ca && p.length === 19) {
    if (xorRange(0x20, p, 0, 11) !== p[12]) return null;
    const attr = p[6];
    const divisor = isBitSet(attr, 2) ? 100 : 10;
    const impedance = be16(p, 10) / 10;
    return result(be16(p, 8) / divisor, isBitSet(attr, 0), manufacturerData!, impedance > 0 ? impedance : undefined);
  }

  // V11 — company 0x11CA, 23-byte payload, checksum at 16, no stability flag.
  if (s.companyId === 0x11ca && p.length === 23) {
    if (xorRange(0xca ^ 0x11, p, 0, 15) !== p[16]) return null;
    return result(decodeWeight(p[3], p[4], p[9]), false, manufacturerData!);
  }

  // VF0 — company 0xF0FF: weight u16 LE /10 at 2–3. Too generic to trust without a known name.
  if (s.companyId === 0xf0ff && p.length >= 4 && isOkokName(name)) {
    return result(le16(p, 2) / 10, false, manufacturerData!);
  }

  // C0 — any company ID whose low byte is 0xC0; the "company ID" high byte is really payload.
  if ((s.companyId & 0xff) === 0xc0 && p.length >= 13 && (!name || isOkokName(name))) {
    const attr = p[6];
    const impedance = be16(p, 2) / 10;
    return result(decodeWeight(p[0], p[1], attr), isBitSet(attr, 0), manufacturerData!, impedance > 0 ? impedance : undefined);
  }
  return null;
}

/** QN / Renpho / FITINDEX broadcast: company 0xFFFF, payload starts with AA BB. */
export function parseQnBroadcast(manufacturerData: Uint8Array | null): ScaleReading | null {
  const s = split(manufacturerData);
  if (!s || s.companyId !== 0xffff) return null;
  const p = s.payload;
  if (p.length < 19 || p[0] !== 0xaa || p[1] !== 0xbb) return null;
  const status = p[15];
  const isFt26r = p.length >= 22 && p[19] === 0x51 && p[20] === 0x0e && p[21] === 0x03;
  const stable = status === 0x20 || (isFt26r && (status === 0x01 || status === 0x15));
  const weightKg = le16(p, 17) / 100;
  if (weightKg < 0.5 || weightKg > 300) return null;
  return { weightKg: roundTo(weightKg, 3), stable, raw: bytesToHex(manufacturerData!) };
}

export const okokScale = {
  match: (adv: AdvertisementPacket) => parseOkok(adv.manufacturerData, adv.name) !== null || isOkokName(adv.name),
  parse: (adv: AdvertisementPacket) => parseOkok(adv.manufacturerData, adv.name),
};

export const qnBroadcastScale = {
  match: (adv: AdvertisementPacket) => parseQnBroadcast(adv.manufacturerData) !== null,
  parse: (adv: AdvertisementPacket) => parseQnBroadcast(adv.manufacturerData),
};
