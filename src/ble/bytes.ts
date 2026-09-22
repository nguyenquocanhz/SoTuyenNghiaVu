const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = (() => {
  const table = new Int16Array(256).fill(-1);
  for (let i = 0; i < B64.length; i++) table[B64.charCodeAt(i)] = i;
  table['-'.charCodeAt(0)] = 62; // base64url
  table['_'.charCodeAt(0)] = 63;
  return table;
})();

/** Decodes standard or URL-safe base64 (react-native-ble-plx encodes all payloads as base64). */
export function base64ToBytes(input: string | null | undefined): Uint8Array {
  if (!input) return new Uint8Array(0);
  const clean = input.replace(/[\s=]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    // Characters above 0xFF fall outside the table (undefined) and must be rejected too.
    const v = code < 256 ? LOOKUP[code] : -1;
    if (v < 0) throw new Error(`Invalid base64 character at ${i}`);
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buffer >> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-f]/gi, '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

export const isBitSet = (value: number, bit: number) => (value & (1 << bit)) !== 0;

/** IEEE 11073-20601 32-bit FLOAT special values. */
export const FLOAT_SPECIAL = {
  NaN: 0x007fffff,
  NRes: 0x00800000,
  PositiveInfinity: 0x007ffffe,
  NegativeInfinity: 0x00800002,
  Reserved: 0x00800001,
} as const;

export class ByteReader {
  private offset = 0;

  constructor(private readonly bytes: Uint8Array) {}

  get position() {
    return this.offset;
  }

  get remaining() {
    return this.bytes.length - this.offset;
  }

  has(n: number) {
    return this.remaining >= n;
  }

  private require(n: number) {
    if (!this.has(n)) throw new RangeError(`Need ${n} byte(s) at offset ${this.offset}, have ${this.remaining}`);
  }

  skip(n: number) {
    this.require(n);
    this.offset += n;
  }

  u8(): number {
    this.require(1);
    return this.bytes[this.offset++];
  }

  u16le(): number {
    this.require(2);
    const v = this.bytes[this.offset] | (this.bytes[this.offset + 1] << 8);
    this.offset += 2;
    return v;
  }

  u16be(): number {
    this.require(2);
    const v = (this.bytes[this.offset] << 8) | this.bytes[this.offset + 1];
    this.offset += 2;
    return v;
  }

  u24le(): number {
    this.require(3);
    const b = this.bytes;
    const v = b[this.offset] | (b[this.offset + 1] << 8) | (b[this.offset + 2] << 16);
    this.offset += 3;
    return v;
  }

  u32le(): number {
    this.require(4);
    const b = this.bytes;
    const v = (b[this.offset] | (b[this.offset + 1] << 8) | (b[this.offset + 2] << 16)) + b[this.offset + 3] * 0x1000000;
    this.offset += 4;
    return v;
  }

  /**
   * IEEE 11073 FLOAT: 8-bit signed exponent (MSB) + 24-bit signed mantissa.
   * Returns NaN for NaN/NRes/Reserved, ±Infinity for the infinity codes.
   */
  float32ieee11073(): number {
    const raw = this.u32le();
    const mantissaRaw = raw & 0x00ffffff;
    if (mantissaRaw === FLOAT_SPECIAL.PositiveInfinity) return Infinity;
    if (mantissaRaw === FLOAT_SPECIAL.NegativeInfinity) return -Infinity;
    if (mantissaRaw === FLOAT_SPECIAL.NaN || mantissaRaw === FLOAT_SPECIAL.NRes || mantissaRaw === FLOAT_SPECIAL.Reserved) {
      return NaN;
    }
    const mantissa = mantissaRaw >= 0x800000 ? mantissaRaw - 0x1000000 : mantissaRaw;
    const expRaw = Math.floor(raw / 0x1000000) & 0xff;
    const exponent = expRaw >= 0x80 ? expRaw - 0x100 : expRaw;
    return mantissa * 10 ** exponent;
  }

  /** Bluetooth "Date Time" characteristic layout (7 bytes). Returns undefined when year/month/day are 0 (unknown). */
  dateTime(): Date | undefined {
    const year = this.u16le();
    const month = this.u8();
    const day = this.u8();
    const hours = this.u8();
    const minutes = this.u8();
    const seconds = this.u8();
    if (year === 0 || month === 0 || day === 0) return undefined;
    return new Date(year, month - 1, day, hours, minutes, seconds);
  }
}
