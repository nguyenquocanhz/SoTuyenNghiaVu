import { Platform } from 'react-native';

import type { CccdErrorCode, CccdIdentity, CccdReadInput, CccdReadProgress, NfcAvailability } from './src/CccdNfc.types';
import NativeCccdNfc from './src/CccdNfcModule';

export * from './src/CccdNfc.types';

export class CccdError extends Error {
  constructor(
    public readonly code: CccdErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CccdError';
  }
}

export function getNfcAvailability(): NfcAvailability {
  if (!NativeCccdNfc) return { platformSupported: false, supported: false, enabled: false };
  try {
    const s = NativeCccdNfc.getNfcStatus();
    return { platformSupported: true, supported: Boolean(s.supported), enabled: Boolean(s.enabled) };
  } catch {
    return { platformSupported: true, supported: false, enabled: false };
  }
}

export function openNfcSettings(): boolean {
  return NativeCccdNfc?.openNfcSettings() ?? false;
}

export function cancelCccdRead(): void {
  NativeCccdNfc?.cancel();
}

export function addProgressListener(listener: (progress: CccdReadProgress) => void): { remove(): void } {
  if (!NativeCccdNfc) return { remove() {} };
  return NativeCccdNfc.addListener('onProgress', listener);
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested)
// ---------------------------------------------------------------------------

/** "dd/mm/yyyy" → "YYMMDD" for the BAC/PACE key. */
export function viDateToMrz(value: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return `${String(y % 100).padStart(2, '0')}${String(mo).padStart(2, '0')}${String(d).padStart(2, '0')}`;
}

/**
 * The MRZ document number of a 12-digit CCCD is its last 9 digits
 * (line 1: IDVNM + 9 digits + check digit + full 12-digit number).
 */
export function mrzDocumentNumber(idNumber: string): string | null {
  const digits = idNumber.replace(/\D/g, '');
  if (digits.length === 12) return digits.slice(3);
  if (digits.length === 9) return digits;
  return null;
}

export function maskDocumentNumber(value: string | null | undefined): string {
  if (!value) return '—';
  return `${'*'.repeat(Math.max(0, value.length - 3))}${value.slice(-3)}`;
}

/** "YYMMDD" → ISO. Birth dates resolve to the past century when the date would otherwise be in the future. */
export function mrzDateToIso(yymmdd: string | null | undefined, kind: 'birth' | 'expiry', now = new Date()): string | null {
  if (!yymmdd || !/^\d{6}$/.test(yymmdd)) return null;
  const yy = Number(yymmdd.slice(0, 2));
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  // Month/day must form a real calendar day (checked on a leap year so 29/02 is accepted here
  // and then re-checked against the resolved year below).
  if (!isCalendarDay(2000, Number(mm), Number(dd))) return null;
  const currentYY = now.getFullYear() % 100;
  // Same 2-digit year as today but a later month/day (e.g. "261231" read on 17/09/2026) is also in the future.
  const nowMmdd = (now.getMonth() + 1) * 100 + now.getDate();
  const inFuture = yy > currentYY || (yy === currentYY && Number(mm) * 100 + Number(dd) > nowMmdd);
  const century = kind === 'birth' && inFuture ? 1900 : 2000;
  if (!isCalendarDay(century + yy, Number(mm), Number(dd))) return null;
  return `${century + yy}-${mm}-${dd}`;
}

function isCalendarDay(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** "dd/MM/yyyy" (DG13) → ISO. */
export function dg13DateToIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{2})\/?(\d{2})\/?(\d{4})$/.exec(value.trim());
  if (!m || !isCalendarDay(Number(m[3]), Number(m[2]), Number(m[1]))) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function normalizeSex(dg13: unknown, mrz: unknown): 'male' | 'female' | null {
  const v = typeof dg13 === 'string' ? dg13.trim().toLowerCase() : '';
  if (v === 'nam' || v === 'male') return 'male';
  if (v === 'nữ' || v === 'nu' || v === 'female') return 'female';
  if (mrz === 'M' || mrz === 'MALE') return 'male';
  if (mrz === 'F' || mrz === 'FEMALE') return 'female';
  return null;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * Converts the raw native map into a CccdIdentity. DG13 values are preferred
 * when they are consistent with DG1 (MRZ); otherwise DG1 wins.
 *
 * Note: both groups are read over a BAC/PACE-protected channel, which only proves the reader
 * knew the MRZ key. Passive Authentication (EF.SOD signature + data-group hashes) is NOT
 * performed, so the values are not cryptographically verified as issued by the state.
 *
 * Raw keys: fullNameDg13, fullNameMrz, dateOfBirthDg13 (dd/MM/yyyy), dateOfBirthMrz (YYMMDD),
 * sexDg13 ("Nam"/"Nữ"), sexMrz ("M"/"F"/"X"), nationalityDg13, nationalityMrz,
 * dateOfExpiryDg13 (dd/MM/yyyy or text), dateOfExpiryMrz (YYMMDD), documentNumberLast3,
 * authMethod ("PACE"/"BAC"), dg13Parsed (boolean), idNumberDg13, ethnicityDg13, religionDg13,
 * placeOfOriginDg13, residenceDg13, issueDateDg13 (dd/MM/yyyy), fatherNameDg13, motherNameDg13.
 */
export function normalizeIdentity(raw: Record<string, unknown>, now = new Date()): CccdIdentity {
  const mrzName = (str(raw.fullNameMrz) ?? '').replace(/</g, ' ').replace(/\s+/g, ' ').trim();
  const dobMrz = mrzDateToIso(str(raw.dateOfBirthMrz), 'birth', now);
  const dobDg13 = dg13DateToIso(str(raw.dateOfBirthDg13));
  // Trust DG13's 4-digit year only when it agrees with the authenticated MRZ date (ignoring century).
  const dateOfBirth = dobDg13 && (!dobMrz || dobDg13.slice(2) === dobMrz.slice(2)) ? dobDg13 : (dobMrz ?? '');
  const last3 = str(raw.documentNumberLast3) ?? '';
  return {
    fullName: str(raw.fullNameDg13) ?? mrzName,
    fullNameMrz: mrzName,
    dateOfBirth,
    sex: normalizeSex(raw.sexDg13, str(raw.sexMrz)),
    nationality: str(raw.nationalityDg13) ?? str(raw.nationalityMrz),
    dateOfExpiry: dg13DateToIso(str(raw.dateOfExpiryDg13)) ?? mrzDateToIso(str(raw.dateOfExpiryMrz), 'expiry', now),
    documentNumberMasked: last3 ? `*********${last3}` : '—',
    authMethod: raw.authMethod === 'PACE' ? 'PACE' : 'BAC',
    dg13Parsed: raw.dg13Parsed === true,
    idNumber: /^\d{12}$/.test(str(raw.idNumberDg13) ?? '') ? str(raw.idNumberDg13) : null,
    ethnicity: str(raw.ethnicityDg13),
    religion: str(raw.religionDg13),
    placeOfOrigin: str(raw.placeOfOriginDg13),
    residence: str(raw.residenceDg13),
    issueDate: dg13DateToIso(str(raw.issueDateDg13)),
    fatherName: str(raw.fatherNameDg13),
    motherName: str(raw.motherNameDg13),
  };
}

const NATIVE_ERROR_CODES: CccdErrorCode[] = [
  'NFC_UNSUPPORTED',
  'NFC_DISABLED',
  'NO_ACTIVITY',
  'BUSY',
  'CANCELLED',
  'INVALID_INPUT',
  'NOT_ISO_DEP',
  'AUTH_FAILED',
  'TAG_LOST',
  'READ_FAILED',
];

/**
 * Enables NFC reader mode and resolves once a CCCD has been read.
 * Place the card flat against the back of the phone and keep it still.
 */
export async function readCccd(input: CccdReadInput): Promise<CccdIdentity> {
  if (!NativeCccdNfc) {
    throw new CccdError(
      'NFC_UNSUPPORTED',
      Platform.OS === 'ios' ? 'Đọc chip CCCD trên iOS chưa được hỗ trợ trong phiên bản này.' : 'Nền tảng này không hỗ trợ NFC.',
    );
  }
  const doc = mrzDocumentNumber(input.idNumber);
  if (!doc || !/^\d{6}$/.test(input.dateOfBirth) || !/^\d{6}$/.test(input.dateOfExpiry)) {
    throw new CccdError('INVALID_INPUT', 'Số CCCD, ngày sinh hoặc ngày hết hạn không hợp lệ.');
  }
  try {
    const raw = await NativeCccdNfc.readCard(doc, input.dateOfBirth, input.dateOfExpiry);
    return normalizeIdentity(raw);
  } catch (e) {
    const code = (e as { code?: string }).code;
    const message = e instanceof Error ? e.message : String(e);
    if (code && (NATIVE_ERROR_CODES as string[]).includes(code)) throw new CccdError(code as CccdErrorCode, message);
    throw new CccdError('READ_FAILED', message);
  }
}
