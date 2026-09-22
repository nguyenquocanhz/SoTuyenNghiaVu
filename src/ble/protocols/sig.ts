/**
 * Bluetooth SIG standard GATT profiles (GATT Specification Supplement):
 *  - Weight Scale Service 0x181D / Weight Measurement 0x2A9D
 *  - Body Composition Service 0x181B / Body Composition Measurement 0x2A9C
 *  - Health Thermometer Service 0x1809 / Temperature Measurement 0x2A1C, Intermediate Temperature 0x2A1E
 * These are the profiles implemented by Continua / IEEE 11073 PHD certified
 * medical devices (e.g. A&D, Omron, Beurer).
 */
import { roundTo } from '@/domain/format';

import { ByteReader, bytesToHex, isBitSet } from '../bytes';
import type { ScaleReading, TemperatureReading, TemperatureTypeCode } from '../types';

export const LB_TO_KG = 0.45359237;
const INCH_TO_CM = 2.54;
const UNSUCCESSFUL = 0xffff;

const massToKg = (raw: number, imperial: boolean) => (imperial ? raw * 0.01 * LB_TO_KG : raw * 0.005);
const heightToCm = (raw: number, imperial: boolean) => (imperial ? raw * 0.1 * INCH_TO_CM : raw * 0.1);

/** Weight Measurement (0x2A9D). Returns null for "measurement unsuccessful". */
export function parseWeightMeasurement(bytes: Uint8Array): ScaleReading | null {
  const r = new ByteReader(bytes);
  const flags = r.u8();
  const imperial = isBitSet(flags, 0);
  const rawWeight = r.u16le();
  if (rawWeight === UNSUCCESSFUL) return null;

  const reading: ScaleReading = {
    weightKg: roundTo(massToKg(rawWeight, imperial), 3),
    // Indications are only sent for a completed (stable) measurement.
    stable: true,
    raw: bytesToHex(bytes),
  };
  if (isBitSet(flags, 1) && r.has(7)) reading.measuredAt = r.dateTime();
  if (isBitSet(flags, 2) && r.has(1)) {
    const user = r.u8();
    if (user !== 0xff) reading.userId = user;
  }
  if (isBitSet(flags, 3) && r.has(4)) {
    reading.bmi = roundTo(r.u16le() * 0.1, 1);
    const h = r.u16le();
    if (h > 0) reading.heightCm = roundTo(heightToCm(h, imperial), 1);
  }
  return reading;
}

/** Body Composition Measurement (0x2A9C). Only fields with a mapped meaning are kept. */
export function parseBodyCompositionMeasurement(bytes: Uint8Array): ScaleReading | null {
  const r = new ByteReader(bytes);
  const flags = r.u16le();
  const imperial = isBitSet(flags, 0);
  const rawFat = r.u16le();

  let measuredAt: Date | undefined;
  let userId: number | undefined;
  let impedanceOhm: number | undefined;
  let weightKg: number | undefined;
  let heightCm: number | undefined;

  if (isBitSet(flags, 1)) measuredAt = r.dateTime();
  if (isBitSet(flags, 2)) {
    const u = r.u8();
    if (u !== 0xff) userId = u;
  }
  if (isBitSet(flags, 3)) r.skip(2); // basal metabolism, kJ
  if (isBitSet(flags, 4)) r.skip(2); // muscle percentage
  if (isBitSet(flags, 5)) r.skip(2); // muscle mass
  if (isBitSet(flags, 6)) r.skip(2); // fat free mass
  if (isBitSet(flags, 7)) r.skip(2); // soft lean mass
  if (isBitSet(flags, 8)) r.skip(2); // body water mass
  if (isBitSet(flags, 9)) impedanceOhm = roundTo(r.u16le() * 0.1, 1);
  if (isBitSet(flags, 10)) weightKg = roundTo(massToKg(r.u16le(), imperial), 3);
  if (isBitSet(flags, 11)) heightCm = roundTo(heightToCm(r.u16le(), imperial), 1);

  // Without the weight field this packet carries no weight (e.g. first part of a multi-packet measurement).
  if (weightKg === undefined) return null;
  return {
    weightKg,
    stable: true,
    bodyFatPct: rawFat === UNSUCCESSFUL ? undefined : roundTo(rawFat * 0.1, 1),
    impedanceOhm,
    heightCm,
    userId,
    measuredAt,
    raw: bytesToHex(bytes),
  };
}

const TEMPERATURE_TYPES: Record<number, TemperatureTypeCode> = {
  1: 'armpit',
  2: 'body',
  3: 'ear',
  4: 'finger',
  5: 'gastrointestinal',
  6: 'mouth',
  7: 'rectum',
  8: 'toe',
  9: 'tympanum',
};

/** Temperature Measurement (0x2A1C) or Intermediate Temperature (0x2A1E). */
export function parseTemperatureMeasurement(bytes: Uint8Array, final = true): TemperatureReading | null {
  const r = new ByteReader(bytes);
  const flags = r.u8();
  const value = r.float32ieee11073();
  if (!Number.isFinite(value)) return null;
  const celsius = isBitSet(flags, 0) ? ((value - 32) * 5) / 9 : value;
  const reading: TemperatureReading = { temperatureC: roundTo(celsius, 2), final, raw: bytesToHex(bytes) };
  if (isBitSet(flags, 1) && r.has(7)) reading.measuredAt = r.dateTime();
  if (isBitSet(flags, 2) && r.has(1)) reading.type = TEMPERATURE_TYPES[r.u8()];
  return reading;
}
