const BASE_SUFFIX = '-0000-1000-8000-00805f9b34fb';

/** Expands a 16/32-bit Bluetooth SIG UUID to its lower-case 128-bit form. */
export function fullUuid(uuid: string | number): string {
  if (typeof uuid === 'number') return `${uuid.toString(16).padStart(8, '0')}${BASE_SUFFIX}`;
  const u = uuid.toLowerCase().replace(/^0x/, '');
  if (u.length === 4) return `0000${u}${BASE_SUFFIX}`;
  if (u.length === 8) return `${u}${BASE_SUFFIX}`;
  return u;
}

export function sameUuid(a: string, b: string | number): boolean {
  return fullUuid(a) === fullUuid(b);
}

export const UUID = {
  weightScaleService: fullUuid(0x181d),
  weightMeasurement: fullUuid(0x2a9d),
  bodyCompositionService: fullUuid(0x181b),
  bodyCompositionMeasurement: fullUuid(0x2a9c),
  healthThermometerService: fullUuid(0x1809),
  temperatureMeasurement: fullUuid(0x2a1c),
  intermediateTemperature: fullUuid(0x2a1e),
} as const;
