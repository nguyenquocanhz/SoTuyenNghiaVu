/// <reference types="jest" />
import { SIG_SCALE, SIG_THERMOMETER } from '@/ble/protocols';
import { LB_TO_KG, parseBodyCompositionMeasurement, parseTemperatureMeasurement, parseWeightMeasurement } from '@/ble/protocols/sig';
import { UUID } from '@/ble/uuids';

const u8 = (...bytes: number[]) => Uint8Array.from(bytes);
const le16 = (v: number) => [v & 0xff, (v >> 8) & 0xff];
/** Bluetooth Date Time (7 bytes). */
const dt = (y: number, mo: number, d: number, h: number, mi: number, s: number) => [...le16(y), mo, d, h, mi, s];
/** IEEE 11073 FLOAT: mantissa × 10^exponent. */
const float11073 = (mantissa: number, exponent: number) => {
  const m = mantissa < 0 ? mantissa + 0x1000000 : mantissa;
  return [m & 0xff, (m >> 8) & 0xff, (m >> 16) & 0xff, exponent < 0 ? exponent + 0x100 : exponent];
};

describe('Weight Measurement (0x2A9D)', () => {
  it('decodes SI weight with 0,005 kg resolution', () => {
    const r = parseWeightMeasurement(u8(0x00, ...le16(14000)))!;
    expect(r).toEqual({ weightKg: 70, stable: true, raw: '00 b0 36' });
    expect(parseWeightMeasurement(u8(0x00, ...le16(14001)))!.weightKg).toBe(70.005);
    expect(parseWeightMeasurement(u8(0x00, ...le16(1)))!.weightKg).toBe(0.005);
  });

  it('decodes imperial weight with 0,01 lb resolution', () => {
    expect(LB_TO_KG).toBe(0.45359237);
    const r = parseWeightMeasurement(u8(0x01, ...le16(15432)))!;
    expect(r.weightKg).toBe(69.998); // 154,32 lb
    expect(parseWeightMeasurement(u8(0x01, ...le16(22046)))!.weightKg).toBe(99.999); // 220,46 lb
  });

  it('decodes the time stamp', () => {
    const r = parseWeightMeasurement(u8(0x02, ...le16(14000), ...dt(2026, 9, 17, 7, 5, 0)))!;
    expect(r.measuredAt).toEqual(new Date(2026, 8, 17, 7, 5, 0));
    expect(r.userId).toBeUndefined();
  });

  it('decodes the user ID and treats 0xFF as unknown user', () => {
    expect(parseWeightMeasurement(u8(0x04, ...le16(14000), 3))!.userId).toBe(3);
    expect(parseWeightMeasurement(u8(0x04, ...le16(14000), 0xff))!.userId).toBeUndefined();
  });

  it('decodes BMI and height in SI (0,1 BMI, 1 mm)', () => {
    const r = parseWeightMeasurement(u8(0x08, ...le16(14000), ...le16(229), ...le16(1750)))!;
    expect(r.bmi).toBe(22.9);
    expect(r.heightCm).toBe(175);
  });

  it('decodes height in inches (0,1 in) for imperial units', () => {
    const r = parseWeightMeasurement(u8(0x09, ...le16(15432), ...le16(229), ...le16(690)))!;
    expect(r.heightCm).toBe(175.3); // 69,0 in
    expect(r.bmi).toBe(22.9);
  });

  it('omits a zero height', () => {
    const r = parseWeightMeasurement(u8(0x08, ...le16(14000), ...le16(229), ...le16(0)))!;
    expect(r.bmi).toBe(22.9);
    expect(r.heightCm).toBeUndefined();
  });

  it('decodes all optional fields in order', () => {
    const r = parseWeightMeasurement(u8(0x0e, ...le16(13000), ...dt(2025, 12, 31, 23, 59, 58), 2, ...le16(212), ...le16(1755)))!;
    expect(r).toMatchObject({
      weightKg: 65,
      stable: true,
      measuredAt: new Date(2025, 11, 31, 23, 59, 58),
      userId: 2,
      bmi: 21.2,
      heightCm: 175.5,
    });
  });

  it('returns null for "measurement unsuccessful" (0xFFFF)', () => {
    expect(parseWeightMeasurement(u8(0x00, 0xff, 0xff))).toBeNull();
    expect(parseWeightMeasurement(u8(0x01, 0xff, 0xff))).toBeNull();
    expect(parseWeightMeasurement(u8(0x0e, 0xff, 0xff, ...dt(2026, 1, 1, 0, 0, 0), 1, 0, 0, 0, 0))).toBeNull();
  });

  it('tolerates a truncated optional field', () => {
    const r = parseWeightMeasurement(u8(0x02, ...le16(14000), 0xea, 0x07))!;
    expect(r.weightKg).toBe(70);
    expect(r.measuredAt).toBeUndefined();
  });

  it('keeps an unknown (zero) time stamp undefined', () => {
    expect(parseWeightMeasurement(u8(0x02, ...le16(14000), 0, 0, 0, 0, 0, 0, 0))!.measuredAt).toBeUndefined();
  });
});

describe('Body Composition Measurement (0x2A9C)', () => {
  it('decodes body fat, impedance, weight and height', () => {
    const bytes = u8(...le16(0x0e00), ...le16(215), ...le16(5000), ...le16(14000), ...le16(1750));
    expect(parseBodyCompositionMeasurement(bytes)).toEqual({
      weightKg: 70,
      stable: true,
      bodyFatPct: 21.5,
      impedanceOhm: 500,
      heightCm: 175,
      userId: undefined,
      measuredAt: undefined,
      raw: '00 0e d7 00 88 13 b0 36 d6 06',
    });
  });

  it('returns null when the weight field is absent', () => {
    expect(parseBodyCompositionMeasurement(u8(...le16(0x0200), ...le16(215), ...le16(5000)))).toBeNull();
    expect(parseBodyCompositionMeasurement(u8(...le16(0x0000), ...le16(215)))).toBeNull();
  });

  it('skips the unmapped fields and reads time stamp and user', () => {
    // bit1 time, bit2 user, bit3 basal metabolism, bit4 muscle %, bit10 weight
    const flags = 0x0002 | 0x0004 | 0x0008 | 0x0010 | 0x0400;
    const bytes = u8(...le16(flags), ...le16(215), ...dt(2026, 9, 17, 6, 0, 0), 2, 0x11, 0x22, 0x33, 0x44, ...le16(14000));
    const r = parseBodyCompositionMeasurement(bytes)!;
    expect(r.weightKg).toBe(70);
    expect(r.userId).toBe(2);
    expect(r.measuredAt).toEqual(new Date(2026, 8, 17, 6, 0, 0));
    expect(r.bodyFatPct).toBe(21.5);
    expect(r.impedanceOhm).toBeUndefined();
  });

  it('skips muscle mass, fat-free mass, soft lean mass and body water mass', () => {
    const flags = 0x0020 | 0x0040 | 0x0080 | 0x0100 | 0x0400;
    const bytes = u8(...le16(flags), ...le16(180), 1, 2, 3, 4, 5, 6, 7, 8, ...le16(20000));
    expect(parseBodyCompositionMeasurement(bytes)!.weightKg).toBe(100);
  });

  it('uses imperial units when flag bit 0 is set', () => {
    const bytes = u8(...le16(0x0c01), ...le16(215), ...le16(15432), ...le16(690));
    const r = parseBodyCompositionMeasurement(bytes)!;
    expect(r.weightKg).toBe(69.998);
    expect(r.heightCm).toBe(175.3);
  });

  it('drops an unsuccessful body-fat value and an unknown user', () => {
    const r = parseBodyCompositionMeasurement(u8(...le16(0x0404), 0xff, 0xff, 0xff, ...le16(14000)))!;
    expect(r.bodyFatPct).toBeUndefined();
    expect(r.userId).toBeUndefined();
    expect(r.weightKg).toBe(70);
  });
});

describe('Temperature Measurement (0x2A1C / 0x2A1E)', () => {
  it('decodes Celsius', () => {
    const r = parseTemperatureMeasurement(u8(0x00, ...float11073(365, -1)))!;
    expect(r).toEqual({ temperatureC: 36.5, final: true, raw: '00 6d 01 00 ff' });
  });

  it('marks intermediate readings as not final', () => {
    expect(parseTemperatureMeasurement(u8(0x00, ...float11073(365, -1)), false)!.final).toBe(false);
  });

  it('converts Fahrenheit to Celsius', () => {
    expect(parseTemperatureMeasurement(u8(0x01, ...float11073(986, -1)))!.temperatureC).toBe(37);
    expect(parseTemperatureMeasurement(u8(0x01, ...float11073(10040, -2)))!.temperatureC).toBe(38);
    expect(parseTemperatureMeasurement(u8(0x01, ...float11073(1004, -1)))!.temperatureC).toBe(38);
  });

  it('rounds to two decimals', () => {
    expect(parseTemperatureMeasurement(u8(0x00, ...float11073(36512, -3)))!.temperatureC).toBe(36.51);
    expect(parseTemperatureMeasurement(u8(0x01, ...float11073(990, -1)))!.temperatureC).toBe(37.22);
  });

  it('decodes time stamp and temperature type', () => {
    const r = parseTemperatureMeasurement(u8(0x06, ...float11073(3720, -2), ...dt(2026, 9, 17, 8, 0, 0), 1))!;
    expect(r.temperatureC).toBe(37.2);
    expect(r.measuredAt).toEqual(new Date(2026, 8, 17, 8, 0, 0));
    expect(r.type).toBe('armpit');
  });

  it('decodes Fahrenheit with time stamp and type together', () => {
    const r = parseTemperatureMeasurement(u8(0x07, ...float11073(986, -1), ...dt(2026, 1, 2, 3, 4, 5), 6))!;
    expect(r.temperatureC).toBe(37);
    expect(r.measuredAt).toEqual(new Date(2026, 0, 2, 3, 4, 5));
    expect(r.type).toBe('mouth');
  });

  it.each([
    [1, 'armpit'],
    [2, 'body'],
    [3, 'ear'],
    [4, 'finger'],
    [5, 'gastrointestinal'],
    [6, 'mouth'],
    [7, 'rectum'],
    [8, 'toe'],
    [9, 'tympanum'],
    [0, undefined],
    [10, undefined],
  ])('maps temperature type %p → %p', (code, type) => {
    expect(parseTemperatureMeasurement(u8(0x04, ...float11073(370, -1), code))!.type).toBe(type);
  });

  it('returns null for NaN / NRes / infinity values', () => {
    expect(parseTemperatureMeasurement(u8(0x00, 0xff, 0xff, 0x7f, 0x00))).toBeNull();
    expect(parseTemperatureMeasurement(u8(0x00, 0x00, 0x00, 0x80, 0x00))).toBeNull();
    expect(parseTemperatureMeasurement(u8(0x00, 0xfe, 0xff, 0x7f, 0x00))).toBeNull();
    expect(parseTemperatureMeasurement(u8(0x00, 0x02, 0x00, 0x80, 0x00))).toBeNull();
  });
});

describe('SIG GATT protocol routing', () => {
  it('routes the Body Composition characteristic to its parser', () => {
    const body = u8(...le16(0x0400), ...le16(215), ...le16(14000));
    expect(SIG_SCALE.parse(UUID.bodyCompositionMeasurement, body)!.bodyFatPct).toBe(21.5);
    expect(SIG_SCALE.parse(UUID.weightMeasurement, u8(0x00, ...le16(14000)))!.weightKg).toBe(70);
  });

  it('flags Intermediate Temperature as not final', () => {
    const bytes = u8(0x00, ...float11073(365, -1));
    expect(SIG_THERMOMETER.parse(UUID.temperatureMeasurement, bytes)!.final).toBe(true);
    expect(SIG_THERMOMETER.parse(UUID.intermediateTemperature, bytes)!.final).toBe(false);
  });

  it('subscribes to the standard characteristics', () => {
    expect(SIG_SCALE.subscriptions.map((s) => s.characteristic)).toEqual([UUID.weightMeasurement, UUID.bodyCompositionMeasurement]);
    expect(SIG_THERMOMETER.subscriptions.map((s) => s.characteristic)).toEqual([UUID.temperatureMeasurement, UUID.intermediateTemperature]);
  });
});
