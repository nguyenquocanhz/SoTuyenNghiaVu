/// <reference types="jest" />
import { base64ToBytes, ByteReader, bytesToBase64, bytesToHex, FLOAT_SPECIAL, hexToBytes, isBitSet } from '@/ble/bytes';

const u8 = (...bytes: number[]) => Uint8Array.from(bytes);
const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

describe('base64', () => {
  const vectors: [string, string][] = [
    ['', ''],
    ['f', 'Zg=='],
    ['fo', 'Zm8='],
    ['foo', 'Zm9v'],
    ['foob', 'Zm9vYg=='],
    ['fooba', 'Zm9vYmE='],
    ['foobar', 'Zm9vYmFy'],
  ];

  it.each(vectors)('encodes RFC 4648 vector %p', (plain, encoded) => {
    expect(bytesToBase64(ascii(plain))).toBe(encoded);
  });

  it.each(vectors)('decodes RFC 4648 vector %p', (plain, encoded) => {
    expect(Array.from(base64ToBytes(encoded))).toEqual(Array.from(ascii(plain)));
  });

  it('decodes input without padding or with whitespace', () => {
    expect(Array.from(base64ToBytes('Zg'))).toEqual([0x66]);
    expect(Array.from(base64ToBytes('Zm8'))).toEqual([0x66, 0x6f]);
    expect(Array.from(base64ToBytes('Zm9v\nYmFy'))).toEqual(Array.from(ascii('foobar')));
    expect(Array.from(base64ToBytes(' Zm 9v '))).toEqual(Array.from(ascii('foo')));
  });

  it('returns an empty array for null, undefined and empty input', () => {
    expect(base64ToBytes(null)).toHaveLength(0);
    expect(base64ToBytes(undefined)).toHaveLength(0);
    expect(base64ToBytes('')).toHaveLength(0);
    expect(base64ToBytes('====')).toHaveLength(0);
  });

  it('decodes the URL-safe alphabet', () => {
    const bytes = u8(0xfb, 0xff, 0xbf);
    expect(bytesToBase64(bytes)).toBe('+/+/');
    expect(Array.from(base64ToBytes('+/+/'))).toEqual([0xfb, 0xff, 0xbf]);
    expect(Array.from(base64ToBytes('-_-_'))).toEqual([0xfb, 0xff, 0xbf]);
    expect(Array.from(base64ToBytes('-_8'))).toEqual([0xfb, 0xff]);
  });

  it('round-trips every byte value and every padding length', () => {
    const all = Uint8Array.from({ length: 256 }, (_, i) => i);
    expect(Array.from(base64ToBytes(bytesToBase64(all)))).toEqual(Array.from(all));
    for (let n = 0; n <= 12; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 97 + 13) & 0xff);
      const encoded = bytesToBase64(bytes);
      expect(encoded.length % 4).toBe(0);
      expect(Array.from(base64ToBytes(encoded))).toEqual(Array.from(bytes));
    }
  });

  it('rejects characters outside the alphabet', () => {
    expect(() => base64ToBytes('Zm9v*')).toThrow(/Invalid base64/);
    expect(() => base64ToBytes('Zm.v')).toThrow(/Invalid base64/);
    expect(() => base64ToBytes('Zm9vé')).toThrow(/Invalid base64/);
    expect(() => base64ToBytes('Zm9v€')).toThrow(/Invalid base64/);
  });
});

describe('hex helpers', () => {
  it('formats bytes as spaced lower-case hex', () => {
    expect(bytesToHex(u8(0x01, 0xab, 0x00, 0xff))).toBe('01 ab 00 ff');
    expect(bytesToHex(u8())).toBe('');
  });

  it('parses hex with or without separators', () => {
    expect(Array.from(hexToBytes('01 AB ff'))).toEqual([0x01, 0xab, 0xff]);
    expect(Array.from(hexToBytes('01abff'))).toEqual([0x01, 0xab, 0xff]);
    expect(Array.from(hexToBytes('01:ab:ff'))).toEqual([0x01, 0xab, 0xff]);
    expect(Array.from(hexToBytes(bytesToHex(u8(9, 8, 7))))).toEqual([9, 8, 7]);
  });

  it('isBitSet', () => {
    expect(isBitSet(0b1010, 1)).toBe(true);
    expect(isBitSet(0b1010, 0)).toBe(false);
    expect(isBitSet(0x80, 7)).toBe(true);
    expect(isBitSet(0x0400, 10)).toBe(true);
    expect(isBitSet(0x0400, 9)).toBe(false);
  });
});

describe('ByteReader integers', () => {
  it('reads little- and big-endian integers and tracks the position', () => {
    const r = new ByteReader(u8(0x7f, 0x34, 0x12, 0x34, 0x12, 0x56, 0x34, 0x12, 0x78, 0x56, 0x34, 0x12));
    expect(r.remaining).toBe(12);
    expect(r.u8()).toBe(0x7f);
    expect(r.u16le()).toBe(0x1234);
    expect(r.u16be()).toBe(0x3412);
    expect(r.position).toBe(5);
    expect(r.u24le()).toBe(0x123456);
    expect(r.u32le()).toBe(0x12345678);
    expect(r.remaining).toBe(0);
    expect(r.has(1)).toBe(false);
  });

  it('reads u32 values with the high bit set as unsigned', () => {
    expect(new ByteReader(u8(0xff, 0xff, 0xff, 0xff)).u32le()).toBe(4294967295);
    expect(new ByteReader(u8(0x00, 0x00, 0x00, 0x80)).u32le()).toBe(2147483648);
    expect(new ByteReader(u8(0xff, 0xff, 0xff)).u24le()).toBe(0xffffff);
    expect(new ByteReader(u8(0xff, 0xff)).u16le()).toBe(0xffff);
  });

  it('skips bytes and throws RangeError past the end', () => {
    const r = new ByteReader(u8(1, 2, 3));
    r.skip(2);
    expect(r.u8()).toBe(3);
    expect(() => r.u8()).toThrow(RangeError);
    expect(() => new ByteReader(u8(1)).u16le()).toThrow(RangeError);
    expect(() => new ByteReader(u8(1, 2)).u24le()).toThrow(RangeError);
    expect(() => new ByteReader(u8(1, 2, 3)).u32le()).toThrow(RangeError);
    expect(() => new ByteReader(u8(1)).skip(2)).toThrow(RangeError);
    expect(new ByteReader(u8(1, 2)).has(2)).toBe(true);
  });
});

describe('ByteReader.float32ieee11073', () => {
  const float = (...bytes: number[]) => new ByteReader(u8(...bytes)).float32ieee11073();

  it('decodes a negative exponent (36,5 = 365 × 10⁻¹)', () => {
    expect(float(0x6d, 0x01, 0x00, 0xff)).toBeCloseTo(36.5, 10);
  });

  it('decodes exponent −2 (36,51 = 3651 × 10⁻²)', () => {
    expect(float(0x43, 0x0e, 0x00, 0xfe)).toBeCloseTo(36.51, 10);
  });

  it('decodes a positive exponent (500 = 5 × 10²)', () => {
    expect(float(0x05, 0x00, 0x00, 0x02)).toBe(500);
  });

  it('decodes zero exponent and zero mantissa', () => {
    expect(float(0x25, 0x00, 0x00, 0x00)).toBe(37);
    expect(float(0x00, 0x00, 0x00, 0xff)).toBe(0);
  });

  it('decodes negative mantissas', () => {
    expect(float(0xf4, 0xff, 0xff, 0x00)).toBe(-12);
    expect(float(0x6b, 0xfe, 0xff, 0xff)).toBeCloseTo(-40.5, 10);
  });

  it('decodes the largest regular mantissa', () => {
    expect(float(0xfd, 0xff, 0x7f, 0x00)).toBe(0x7ffffd);
    expect(float(0x03, 0x00, 0x80, 0x00)).toBe(-0x7ffffd);
  });

  it('maps special values', () => {
    expect(FLOAT_SPECIAL.NaN).toBe(0x007fffff);
    expect(float(0xff, 0xff, 0x7f, 0x00)).toBeNaN();
    expect(float(0x00, 0x00, 0x80, 0x00)).toBeNaN(); // NRes
    expect(float(0x01, 0x00, 0x80, 0x00)).toBeNaN(); // reserved
    expect(float(0xfe, 0xff, 0x7f, 0x00)).toBe(Infinity);
    expect(float(0x02, 0x00, 0x80, 0x00)).toBe(-Infinity);
  });

  it('consumes exactly 4 bytes', () => {
    const r = new ByteReader(u8(0x6d, 0x01, 0x00, 0xff, 0x09));
    r.float32ieee11073();
    expect(r.position).toBe(4);
    expect(r.u8()).toBe(9);
  });
});

describe('ByteReader.dateTime', () => {
  it('decodes the 7-byte Date Time layout as local time', () => {
    const r = new ByteReader(u8(0xea, 0x07, 9, 17, 8, 30, 15));
    expect(r.dateTime()).toEqual(new Date(2026, 8, 17, 8, 30, 15));
    expect(r.position).toBe(7);
  });

  it('returns undefined when year, month or day is unknown (0) but still consumes 7 bytes', () => {
    const zeroYear = new ByteReader(u8(0, 0, 9, 17, 8, 30, 15, 0x42));
    expect(zeroYear.dateTime()).toBeUndefined();
    expect(zeroYear.u8()).toBe(0x42);
    expect(new ByteReader(u8(0xea, 0x07, 0, 17, 8, 30, 15)).dateTime()).toBeUndefined();
    expect(new ByteReader(u8(0xea, 0x07, 9, 0, 8, 30, 15)).dateTime()).toBeUndefined();
    expect(new ByteReader(u8(0, 0, 0, 0, 0, 0, 0)).dateTime()).toBeUndefined();
  });

  it('throws when fewer than 7 bytes remain', () => {
    expect(() => new ByteReader(u8(0xea, 0x07, 9, 17, 8, 30)).dateTime()).toThrow(RangeError);
  });
});
