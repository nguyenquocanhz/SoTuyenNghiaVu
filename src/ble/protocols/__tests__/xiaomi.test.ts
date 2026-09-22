/// <reference types="jest" />
import { miScaleV1, miScaleV2, parseMiScaleV1, parseMiScaleV2 } from '@/ble/protocols/xiaomi';
import type { AdvertisementPacket } from '@/ble/types';
import { UUID } from '@/ble/uuids';

const u8 = (...bytes: number[]) => Uint8Array.from(bytes);
const le16 = (v: number) => [v & 0xff, (v >> 8) & 0xff];
const dt = (y: number, mo: number, d: number, h: number, mi: number, s: number) => [...le16(y), mo, d, h, mi, s];

/** v1: ctrl, weight u16 LE, Date Time (7) — 10 bytes. */
const v1 = (ctrl: number, raw: number, date = dt(2026, 9, 17, 7, 5, 0)) => u8(ctrl, ...le16(raw), ...date);
/** v2: ctrl0, ctrl1, Date Time (7), impedance u16 LE, weight u16 LE — 13 bytes. */
const v2 = (ctrl0: number, ctrl1: number, impedance: number, raw: number, date = dt(2026, 9, 17, 7, 5, 0)) =>
  u8(ctrl0, ctrl1, ...date, ...le16(impedance), ...le16(raw));

const adv = (serviceData: Record<string, Uint8Array>): AdvertisementPacket => ({
  id: 'AA:BB',
  name: 'MIBCS',
  rssi: -60,
  serviceUUIDs: [],
  serviceData,
  manufacturerData: null,
  receivedAt: 0,
});

describe('Mi Smart Scale v1 (service data 0x181D)', () => {
  it('decodes a stabilized kg reading (raw / 200)', () => {
    const r = parseMiScaleV1(v1(0x22, 14000))!;
    expect(r).toEqual({
      weightKg: 70,
      stable: true,
      removed: false,
      measuredAt: new Date(2026, 8, 17, 7, 5, 0),
      raw: '22 b0 36 ea 07 09 11 07 05 00',
    });
  });

  it('decodes a live (not stabilized) reading', () => {
    const r = parseMiScaleV1(v1(0x02, 13950))!;
    expect(r.weightKg).toBe(69.75);
    expect(r.stable).toBe(false);
    expect(r.removed).toBe(false);
  });

  it('reports the weight-removed bit', () => {
    const r = parseMiScaleV1(v1(0xa2, 14000))!;
    expect(r.removed).toBe(true);
    expect(r.stable).toBe(true);
  });

  it('decodes pounds (bit 0, raw / 100 lb)', () => {
    expect(parseMiScaleV1(v1(0x23, 15430))!.weightKg).toBe(69.989);
  });

  it('decodes jin (bit 4, raw / 100 jin = raw / 200 kg)', () => {
    const r = parseMiScaleV1(v1(0x32, 14000))!;
    expect(r.weightKg).toBe(70);
    expect(r.stable).toBe(true);
  });

  it('leaves an unset date undefined', () => {
    expect(parseMiScaleV1(v1(0x22, 14000, [0, 0, 0, 0, 0, 0, 0]))!.measuredAt).toBeUndefined();
  });

  it('rejects payloads that are not 10 bytes', () => {
    expect(parseMiScaleV1(u8(0x22, 0xb0, 0x36))).toBeNull();
    expect(parseMiScaleV1(u8(...v1(0x22, 14000), 0))).toBeNull();
    expect(parseMiScaleV1(v1(0x22, 14000).subarray(0, 9))).toBeNull();
  });

  it('matches and parses advertisements with 10-byte 0x181D service data', () => {
    const packet = adv({ [UUID.weightScaleService]: v1(0x22, 14000) });
    expect(miScaleV1.match(packet)).toBe(true);
    expect(miScaleV1.parse(packet)!.weightKg).toBe(70);
    expect(miScaleV1.match(adv({ [UUID.weightScaleService]: u8(1, 2, 3) }))).toBe(false);
    expect(miScaleV1.match(adv({}))).toBe(false);
    expect(miScaleV1.parse(adv({}))).toBeNull();
  });
});

describe('Mi Body Composition Scale 2 (service data 0x181B)', () => {
  it('decodes a stabilized kg reading with impedance', () => {
    const r = parseMiScaleV2(v2(0x02, 0x26, 500, 14000))!;
    expect(r).toEqual({
      weightKg: 70,
      stable: true,
      removed: false,
      impedanceOhm: 500,
      measuredAt: new Date(2026, 8, 17, 7, 5, 0),
      raw: '02 26 ea 07 09 11 07 05 00 f4 01 b0 36',
    });
  });

  it('omits impedance when its flag (ctrl1 bit 1) is not set', () => {
    const r = parseMiScaleV2(v2(0x02, 0x24, 500, 14000))!;
    expect(r.stable).toBe(true);
    expect(r.impedanceOhm).toBeUndefined();
  });

  it('omits impedance for live (not stabilized) readings', () => {
    const r = parseMiScaleV2(v2(0x02, 0x06, 500, 13900))!;
    expect(r.stable).toBe(false);
    expect(r.weightKg).toBe(69.5);
    expect(r.impedanceOhm).toBeUndefined();
  });

  it('reports removal and drops impedance', () => {
    const r = parseMiScaleV2(v2(0x02, 0xa6, 500, 14000))!;
    expect(r.removed).toBe(true);
    expect(r.impedanceOhm).toBeUndefined();
  });

  it('ignores implausible impedance values', () => {
    expect(parseMiScaleV2(v2(0x02, 0x26, 0, 14000))!.impedanceOhm).toBeUndefined();
    expect(parseMiScaleV2(v2(0x02, 0x26, 3000, 14000))!.impedanceOhm).toBeUndefined();
    expect(parseMiScaleV2(v2(0x02, 0x26, 0xfffe, 14000))!.impedanceOhm).toBeUndefined();
    expect(parseMiScaleV2(v2(0x02, 0x26, 2999, 14000))!.impedanceOhm).toBe(2999);
  });

  it('decodes pounds (ctrl0 bit 0) and jin (ctrl1 bit 6)', () => {
    expect(parseMiScaleV2(v2(0x03, 0x26, 500, 15430))!.weightKg).toBe(69.989);
    expect(parseMiScaleV2(v2(0x02, 0x66, 500, 14000))!.weightKg).toBe(70);
  });

  it('rejects payloads that are not 13 bytes', () => {
    expect(parseMiScaleV2(v1(0x22, 14000))).toBeNull();
    expect(parseMiScaleV2(u8(...v2(0x02, 0x26, 500, 14000), 0))).toBeNull();
  });

  it('matches and parses advertisements with 13-byte 0x181B service data', () => {
    const packet = adv({ [UUID.bodyCompositionService]: v2(0x02, 0x26, 500, 14000) });
    expect(miScaleV2.match(packet)).toBe(true);
    expect(miScaleV2.parse(packet)!.impedanceOhm).toBe(500);
    expect(miScaleV2.match(adv({ [UUID.bodyCompositionService]: v1(0x22, 14000) }))).toBe(false);
    expect(miScaleV2.parse(adv({}))).toBeNull();
  });
});
