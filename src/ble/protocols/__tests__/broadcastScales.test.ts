/// <reference types="jest" />
import { isOkokName, okokScale, parseOkok, parseQnBroadcast, qnBroadcastScale } from '@/ble/protocols/broadcastScales';
import { LB_TO_KG } from '@/ble/protocols/sig';
import type { AdvertisementPacket } from '@/ble/types';

const be16 = (v: number) => [(v >> 8) & 0xff, v & 0xff];
const le16 = (v: number) => [v & 0xff, (v >> 8) & 0xff];
const xor = (seed: number, bytes: number[]) => bytes.reduce((x, b) => x ^ b, seed) & 0xff;

/** OKOK V20: company 0x20CA (LE: CA 20), 19-byte payload, XOR checksum (seed 0x20) of bytes 0–11 at 12. */
function okokV20(opts: { weightRaw: number; attr: number; impedanceRaw?: number; corruptChecksum?: boolean; payloadLength?: number }) {
  const p = new Array<number>(opts.payloadLength ?? 19).fill(0);
  [0x11, 0x22, 0x33, 0x44, 0x55, 0x66].forEach((b, i) => (p[i] = b));
  p[6] = opts.attr;
  p[7] = 0x01;
  [p[8], p[9]] = be16(opts.weightRaw);
  [p[10], p[11]] = be16(opts.impedanceRaw ?? 0);
  p[12] = xor(0x20, p.slice(0, 12)) ^ (opts.corruptChecksum ? 0x01 : 0);
  for (let i = 13; i < p.length; i++) p[i] = 0xa0 + i;
  return Uint8Array.from([0xca, 0x20, ...p]);
}

/** OKOK V11: company 0x11CA (LE: CA 11), 23-byte payload, weight BE at 3–4, attributes at 9, checksum (seed CA^11) at 16. */
function okokV11(opts: { hi: number; lo: number; attr: number; corruptChecksum?: boolean }) {
  const p = new Array<number>(23).fill(0);
  p[0] = 0x05;
  p[1] = 0x06;
  p[2] = 0x07;
  p[3] = opts.hi;
  p[4] = opts.lo;
  p[9] = opts.attr;
  p[12] = 0x42;
  p[16] = xor(0xca ^ 0x11, p.slice(0, 16)) ^ (opts.corruptChecksum ? 0xff : 0);
  for (let i = 17; i < 23; i++) p[i] = i;
  return Uint8Array.from([0xca, 0x11, ...p]);
}

const v11Raw = (raw: number, attr: number) => okokV11({ hi: (raw >> 8) & 0xff, lo: raw & 0xff, attr });

/** OKOK C0: first byte 0xC0; payload after the 2-byte "company ID": weight BE 0–1, impedance BE 2–3, attr at 6. */
function okokC0(opts: { weightRaw: number; attr: number; impedanceRaw?: number; payloadLength?: number }) {
  const p = new Array<number>(opts.payloadLength ?? 13).fill(0);
  [p[0], p[1]] = be16(opts.weightRaw);
  [p[2], p[3]] = be16(opts.impedanceRaw ?? 0);
  p[6] = opts.attr;
  return Uint8Array.from([0xc0, 0x12, ...p]);
}

/** QN broadcast: company 0xFFFF, payload AA BB …, status at 15, weight LE /100 at 17–18, optional FT-26R signature 51 0E 03. */
function qn(opts: { weightRaw: number; status: number; signature?: number[]; prefix?: [number, number]; payloadLength?: number }) {
  const p = new Array<number>(opts.payloadLength ?? 19).fill(0x00);
  [p[0], p[1]] = opts.prefix ?? [0xaa, 0xbb];
  for (let i = 2; i < 15; i++) p[i] = i;
  p[15] = opts.status;
  p[16] = 0x09;
  if (p.length >= 19) [p[17], p[18]] = le16(opts.weightRaw);
  const sig = opts.signature ?? [];
  return Uint8Array.from([0xff, 0xff, ...p, ...sig]);
}

const adv = (manufacturerData: Uint8Array | null, name: string | null = null): AdvertisementPacket => ({
  id: '11:22:33:44:55:66',
  name,
  rssi: -55,
  serviceUUIDs: [],
  serviceData: {},
  manufacturerData,
  receivedAt: 0,
});

describe('OKOK names', () => {
  it('recognises OKOK / Chipsea advertising names case-insensitively', () => {
    for (const name of ['ADV', 'ADV 12', 'Chipsea-BLE', 'Yoda0', 'yoda1', 'adv']) expect(isOkokName(name)).toBe(true);
    for (const name of [null, '', 'MIBCS', 'QN-Scale', 'My ADV']) expect(isOkokName(name)).toBe(false);
  });
});

describe('OKOK V20', () => {
  it('decodes a final reading with /10 divisor and impedance', () => {
    const data = okokV20({ weightRaw: 705, attr: 0x01, impedanceRaw: 5000 });
    const r = parseOkok(data, null)!;
    expect(r.weightKg).toBe(70.5);
    expect(r.stable).toBe(true);
    expect(r.impedanceOhm).toBe(500);
    expect(r.raw).toBe(Array.from(data, (b) => b.toString(16).padStart(2, '0')).join(' '));
  });

  it('uses the /100 divisor when attribute bit 2 is set', () => {
    expect(parseOkok(okokV20({ weightRaw: 7055, attr: 0x05 }), 'ADV')!.weightKg).toBe(70.55);
  });

  it('reports live readings as not stable and omits zero impedance', () => {
    const r = parseOkok(okokV20({ weightRaw: 704, attr: 0x00 }), null)!;
    expect(r.stable).toBe(false);
    expect(r.impedanceOhm).toBeUndefined();
  });

  it('rejects a bad checksum', () => {
    expect(parseOkok(okokV20({ weightRaw: 705, attr: 0x01, corruptChecksum: true }), null)).toBeNull();
  });

  it('rejects a wrong payload length', () => {
    expect(parseOkok(okokV20({ weightRaw: 705, attr: 0x01, payloadLength: 18 }), null)).toBeNull();
  });

  it('rejects weights above 300 kg', () => {
    expect(parseOkok(okokV20({ weightRaw: 3001, attr: 0x01 }), null)).toBeNull();
  });
});

describe('OKOK V11', () => {
  it('decodes kg with the default /10 divisor (no stability flag)', () => {
    const r = parseOkok(v11Raw(705, 0x00), null)!;
    expect(r.weightKg).toBe(70.5);
    expect(r.stable).toBe(false);
    expect(r.impedanceOhm).toBeUndefined();
  });

  it('decodes the decimals field (bits 1–2)', () => {
    expect(parseOkok(v11Raw(70, 0x02), null)!.weightKg).toBe(70); // 1 → no decimals
    expect(parseOkok(v11Raw(7050, 0x04), null)!.weightKg).toBe(70.5); // 2 → /100
    expect(parseOkok(v11Raw(705, 0x06), null)!.weightKg).toBe(70.5); // 3 → /10
  });

  it('converts jin (unit 1)', () => {
    expect(parseOkok(v11Raw(1410, 0x08), null)!.weightKg).toBe(70.5);
  });

  it('converts pounds (unit 2)', () => {
    expect(parseOkok(v11Raw(1554, 0x10), null)!.weightKg).toBe(70.488);
    expect(parseOkok(v11Raw(15543, 0x14), null)!.weightKg).toBeCloseTo(155.43 * LB_TO_KG, 3);
  });

  it('converts stone + pounds (unit 3)', () => {
    // 11 st 2,0 lb
    expect(parseOkok(okokV11({ hi: 11, lo: 20, attr: 0x18 }), null)!.weightKg).toBe(70.76);
  });

  it('rejects a bad checksum', () => {
    expect(parseOkok(okokV11({ hi: 0x02, lo: 0xc1, attr: 0, corruptChecksum: true }), null)).toBeNull();
  });
});

describe('OKOK VF0', () => {
  const vf0 = (raw: number) => Uint8Array.from([0xff, 0xf0, 0x01, 0x02, ...le16(raw)]);

  it('decodes weight (u16 LE /10) only for OKOK device names', () => {
    expect(parseOkok(vf0(705), 'ADV')!.weightKg).toBe(70.5);
    expect(parseOkok(vf0(705), 'Chipsea-BLE')!.stable).toBe(false);
  });

  it('is ignored without a known name', () => {
    expect(parseOkok(vf0(705), null)).toBeNull();
    expect(parseOkok(vf0(705), 'Mi Scale')).toBeNull();
  });

  it('needs at least 4 payload bytes', () => {
    expect(parseOkok(Uint8Array.from([0xff, 0xf0, 0x01, 0x02, 0xc1]), 'ADV')).toBeNull();
  });
});

describe('OKOK C0', () => {
  it('decodes a nameless device', () => {
    const r = parseOkok(okokC0({ weightRaw: 705, attr: 0x01, impedanceRaw: 5000 }), null)!;
    expect(r.weightKg).toBe(70.5);
    expect(r.stable).toBe(true);
    expect(r.impedanceOhm).toBe(500);
  });

  it('decodes with an OKOK name and honours decimals / stability', () => {
    const r = parseOkok(okokC0({ weightRaw: 7050, attr: 0x04 }), 'Yoda0')!;
    expect(r.weightKg).toBe(70.5);
    expect(r.stable).toBe(false);
    expect(r.impedanceOhm).toBeUndefined();
  });

  it('is ignored for other named devices', () => {
    expect(parseOkok(okokC0({ weightRaw: 705, attr: 0x01 }), 'Galaxy Buds')).toBeNull();
  });

  it('needs at least 13 payload bytes', () => {
    expect(parseOkok(okokC0({ weightRaw: 705, attr: 0x01, payloadLength: 12 }), null)).toBeNull();
  });
});

describe('parseOkok – unrelated data', () => {
  it('returns null for missing, short or foreign manufacturer data', () => {
    expect(parseOkok(null, 'ADV')).toBeNull();
    expect(parseOkok(Uint8Array.from([0xca]), 'ADV')).toBeNull();
    expect(parseOkok(Uint8Array.from([0x4c, 0x00, 0x02, 0x15, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]), null)).toBeNull();
  });
});

describe('QN / Renpho broadcast', () => {
  it('decodes a stable reading (status 0x20)', () => {
    const data = qn({ weightRaw: 7050, status: 0x20 });
    const r = parseQnBroadcast(data)!;
    expect(r.weightKg).toBe(70.5);
    expect(r.stable).toBe(true);
    expect(r.raw).toBe(Array.from(data, (b) => b.toString(16).padStart(2, '0')).join(' '));
  });

  it('treats other statuses as unstable without the FT-26R signature', () => {
    expect(parseQnBroadcast(qn({ weightRaw: 7050, status: 0x01 }))!.stable).toBe(false);
    expect(parseQnBroadcast(qn({ weightRaw: 7050, status: 0x15 }))!.stable).toBe(false);
    expect(parseQnBroadcast(qn({ weightRaw: 7050, status: 0x00 }))!.stable).toBe(false);
  });

  it('accepts status 0x01 / 0x15 as stable on FT-26R (signature 51 0E 03)', () => {
    const ft26r = [0x51, 0x0e, 0x03];
    expect(parseQnBroadcast(qn({ weightRaw: 7050, status: 0x01, signature: ft26r }))!.stable).toBe(true);
    expect(parseQnBroadcast(qn({ weightRaw: 7050, status: 0x15, signature: ft26r }))!.stable).toBe(true);
    expect(parseQnBroadcast(qn({ weightRaw: 7050, status: 0x20, signature: ft26r }))!.stable).toBe(true);
    expect(parseQnBroadcast(qn({ weightRaw: 7050, status: 0x02, signature: ft26r }))!.stable).toBe(false);
    expect(parseQnBroadcast(qn({ weightRaw: 7050, status: 0x01, signature: [0x51, 0x0e, 0x04] }))!.stable).toBe(false);
  });

  it('rejects wrong company, prefix, length or implausible weight', () => {
    const good = qn({ weightRaw: 7050, status: 0x20 });
    const otherCompany = Uint8Array.from(good);
    otherCompany[1] = 0xfe;
    expect(parseQnBroadcast(otherCompany)).toBeNull();
    expect(parseQnBroadcast(qn({ weightRaw: 7050, status: 0x20, prefix: [0xaa, 0xbc] }))).toBeNull();
    expect(parseQnBroadcast(good.subarray(0, good.length - 1))).toBeNull();
    expect(parseQnBroadcast(qn({ weightRaw: 40, status: 0x20 }))).toBeNull();
    expect(parseQnBroadcast(qn({ weightRaw: 50, status: 0x20 }))!.weightKg).toBe(0.5);
    expect(parseQnBroadcast(null)).toBeNull();
  });
});

describe('advertisement protocol adapters', () => {
  it('okokScale matches by payload or by name', () => {
    expect(okokScale.match(adv(okokV20({ weightRaw: 705, attr: 1 })))).toBe(true);
    expect(okokScale.match(adv(null, 'Chipsea-BLE'))).toBe(true);
    expect(okokScale.parse(adv(null, 'Chipsea-BLE'))).toBeNull();
    expect(okokScale.match(adv(null, 'Something'))).toBe(false);
  });

  it('qnBroadcastScale matches only valid QN payloads', () => {
    expect(qnBroadcastScale.match(adv(qn({ weightRaw: 7050, status: 0x20 })))).toBe(true);
    expect(qnBroadcastScale.parse(adv(qn({ weightRaw: 7050, status: 0x20 })))!.weightKg).toBe(70.5);
    expect(qnBroadcastScale.match(adv(null, 'QN-Scale'))).toBe(false);
  });
});
