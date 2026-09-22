/// <reference types="jest" />
import {
  addProgressListener,
  cancelCccdRead,
  CccdError,
  dg13DateToIso,
  getNfcAvailability,
  maskDocumentNumber,
  mrzDateToIso,
  mrzDocumentNumber,
  normalizeIdentity,
  normalizeSex,
  openNfcSettings,
  readCccd,
  viDateToMrz,
} from '../index';

// The native module is only present in an Android build.
jest.mock('../src/CccdNfcModule', () => ({ __esModule: true, default: null }));

const NOW = new Date(2026, 8, 17, 12, 0, 0);

describe('viDateToMrz', () => {
  it('converts dd/mm/yyyy to YYMMDD', () => {
    expect(viDateToMrz('17/09/1990')).toBe('900917');
    expect(viDateToMrz('1/2/2005')).toBe('050201');
    expect(viDateToMrz(' 01/01/2000 ')).toBe('000101');
    expect(viDateToMrz('29/02/2024')).toBe('240229');
  });

  it('rejects invalid dates and formats', () => {
    expect(viDateToMrz('31/02/2000')).toBeNull();
    expect(viDateToMrz('29/02/2023')).toBeNull();
    expect(viDateToMrz('17-09-1990')).toBeNull();
    expect(viDateToMrz('1990-09-17')).toBeNull();
    expect(viDateToMrz('17/09/90')).toBeNull();
    expect(viDateToMrz('')).toBeNull();
  });
});

describe('mrzDocumentNumber', () => {
  it('uses the last 9 digits of a 12-digit CCCD number', () => {
    expect(mrzDocumentNumber('001090012345')).toBe('090012345');
    expect(mrzDocumentNumber('001 090 012 345')).toBe('090012345');
    expect(mrzDocumentNumber('079-203-000-001')).toBe('203000001');
  });

  it('accepts the 9-digit MRZ document number as is', () => {
    expect(mrzDocumentNumber('090012345')).toBe('090012345');
  });

  it('rejects other lengths', () => {
    expect(mrzDocumentNumber('')).toBeNull();
    expect(mrzDocumentNumber('12345678')).toBeNull();
    expect(mrzDocumentNumber('0010900123')).toBeNull();
    expect(mrzDocumentNumber('0010900123456')).toBeNull();
    expect(mrzDocumentNumber('abc')).toBeNull();
  });
});

describe('maskDocumentNumber', () => {
  it('reveals only the last 3 characters', () => {
    expect(maskDocumentNumber('001090012345')).toBe('*********345');
    expect(maskDocumentNumber('090012345')).toBe('******345');
    expect(maskDocumentNumber('1234')).toBe('*234');
    expect(maskDocumentNumber('12')).toBe('12');
  });

  it('shows a dash when missing', () => {
    expect(maskDocumentNumber(null)).toBe('—');
    expect(maskDocumentNumber(undefined)).toBe('—');
    expect(maskDocumentNumber('')).toBe('—');
  });
});

describe('mrzDateToIso', () => {
  it('puts birth years that are still ahead this century in the 1900s', () => {
    expect(mrzDateToIso('900917', 'birth', NOW)).toBe('1990-09-17');
    expect(mrzDateToIso('270101', 'birth', NOW)).toBe('1927-01-01');
    expect(mrzDateToIso('991231', 'birth', NOW)).toBe('1999-12-31');
  });

  it('keeps past birth years in the 2000s', () => {
    expect(mrzDateToIso('050201', 'birth', NOW)).toBe('2005-02-01');
    expect(mrzDateToIso('000101', 'birth', NOW)).toBe('2000-01-01');
    expect(mrzDateToIso('260917', 'birth', NOW)).toBe('2026-09-17');
    expect(mrzDateToIso('260101', 'birth', NOW)).toBe('2026-01-01');
  });

  it('never returns a birth date in the future', () => {
    expect(mrzDateToIso('261231', 'birth', NOW)).toBe('1926-12-31');
    expect(mrzDateToIso('260918', 'birth', NOW)).toBe('1926-09-18');
  });

  it('depends on the reference date', () => {
    expect(mrzDateToIso('050101', 'birth', new Date(2001, 0, 1))).toBe('1905-01-01');
    expect(mrzDateToIso('050101', 'birth', new Date(2010, 0, 1))).toBe('2005-01-01');
  });

  it('always places expiry dates in the 2000s', () => {
    expect(mrzDateToIso('400917', 'expiry', NOW)).toBe('2040-09-17');
    expect(mrzDateToIso('991231', 'expiry', NOW)).toBe('2099-12-31');
    expect(mrzDateToIso('210101', 'expiry', NOW)).toBe('2021-01-01');
  });

  it('rejects malformed values', () => {
    expect(mrzDateToIso('9009', 'birth', NOW)).toBeNull();
    expect(mrzDateToIso('abcdef', 'birth', NOW)).toBeNull();
    expect(mrzDateToIso('<<<<<<', 'expiry', NOW)).toBeNull();
    expect(mrzDateToIso('9009171', 'birth', NOW)).toBeNull();
    expect(mrzDateToIso(null, 'birth', NOW)).toBeNull();
    expect(mrzDateToIso(undefined, 'expiry', NOW)).toBeNull();
    expect(mrzDateToIso('', 'birth', NOW)).toBeNull();
  });
});

describe('dg13DateToIso', () => {
  it('parses dd/MM/yyyy with or without separators', () => {
    expect(dg13DateToIso('17/09/1990')).toBe('1990-09-17');
    expect(dg13DateToIso('17091990')).toBe('1990-09-17');
    expect(dg13DateToIso(' 01/01/2040 ')).toBe('2040-01-01');
  });

  it('returns null for text or other formats', () => {
    expect(dg13DateToIso('Không thời hạn')).toBeNull();
    expect(dg13DateToIso('1/9/1990')).toBeNull();
    expect(dg13DateToIso('1990-09-17')).toBeNull();
    expect(dg13DateToIso('')).toBeNull();
    expect(dg13DateToIso(null)).toBeNull();
    expect(dg13DateToIso(undefined)).toBeNull();
  });
});

describe('normalizeSex', () => {
  it('prefers the DG13 Vietnamese value', () => {
    expect(normalizeSex('Nam', 'F')).toBe('male');
    expect(normalizeSex('Nữ', 'M')).toBe('female');
    expect(normalizeSex(' NAM ', null)).toBe('male');
    expect(normalizeSex('nu', null)).toBe('female');
    expect(normalizeSex('Female', null)).toBe('female');
    expect(normalizeSex('male', null)).toBe('male');
  });

  it('falls back to the MRZ code', () => {
    expect(normalizeSex(undefined, 'M')).toBe('male');
    expect(normalizeSex(null, 'F')).toBe('female');
    expect(normalizeSex('', 'MALE')).toBe('male');
    expect(normalizeSex('Khác', 'FEMALE')).toBe('female');
    expect(normalizeSex(42, 'M')).toBe('male');
  });

  it('returns null when unknown', () => {
    expect(normalizeSex(undefined, 'X')).toBeNull();
    expect(normalizeSex(undefined, '<')).toBeNull();
    expect(normalizeSex(null, null)).toBeNull();
  });
});

describe('normalizeIdentity', () => {
  const full = {
    fullNameDg13: 'Nguyễn Văn An',
    fullNameMrz: 'NGUYEN<<VAN<AN<<<<<<<',
    dateOfBirthDg13: '17/09/1990',
    dateOfBirthMrz: '900917',
    sexDg13: 'Nam',
    sexMrz: 'M',
    nationalityDg13: 'Việt Nam',
    nationalityMrz: 'VNM',
    dateOfExpiryDg13: '17/09/2030',
    dateOfExpiryMrz: '300917',
    documentNumberLast3: '345',
    authMethod: 'PACE',
    dg13Parsed: true,
  };

  it('uses DG13 values when they are consistent with the MRZ', () => {
    expect(normalizeIdentity(full, NOW)).toEqual({
      fullName: 'Nguyễn Văn An',
      fullNameMrz: 'NGUYEN VAN AN',
      dateOfBirth: '1990-09-17',
      sex: 'male',
      nationality: 'Việt Nam',
      dateOfExpiry: '2030-09-17',
      documentNumberMasked: '*********345',
      authMethod: 'PACE',
      dg13Parsed: true,
      idNumber: null,
      ethnicity: null,
      religion: null,
      placeOfOrigin: null,
      residence: null,
      issueDate: null,
      fatherName: null,
      motherName: null,
    });
  });

  it('returns the citizen fields used by the screening form (Mẫu 2)', () => {
    const id = normalizeIdentity(
      {
        ...full,
        idNumberDg13: '001090012345',
        ethnicityDg13: 'Kinh',
        religionDg13: 'Không',
        placeOfOriginDg13: 'Xã An Bình, Tỉnh Bắc Ninh',
        residenceDg13: 'Thôn 1, Xã An Bình, Tỉnh Bắc Ninh',
        issueDateDg13: '10/05/2021',
        fatherNameDg13: 'Nguyễn Văn Bình',
        motherNameDg13: 'Trần Thị Cúc',
      },
      NOW,
    );
    expect(id).toMatchObject({
      idNumber: '001090012345',
      ethnicity: 'Kinh',
      religion: 'Không',
      placeOfOrigin: 'Xã An Bình, Tỉnh Bắc Ninh',
      residence: 'Thôn 1, Xã An Bình, Tỉnh Bắc Ninh',
      issueDate: '2021-05-10',
      fatherName: 'Nguyễn Văn Bình',
      motherName: 'Trần Thị Cúc',
    });
  });

  it('drops an ID number that is not 12 digits', () => {
    expect(normalizeIdentity({ ...full, idNumberDg13: '090012345' }, NOW).idNumber).toBeNull();
  });

  it('falls back to MRZ values without DG13', () => {
    const raw = {
      fullNameMrz: 'TRAN<<THI<BINH',
      dateOfBirthMrz: '050201',
      sexMrz: 'F',
      nationalityMrz: 'VNM',
      dateOfExpiryMrz: '300201',
      authMethod: 'BAC',
      dg13Parsed: false,
    };
    expect(normalizeIdentity(raw, NOW)).toEqual({
      fullName: 'TRAN THI BINH',
      fullNameMrz: 'TRAN THI BINH',
      dateOfBirth: '2005-02-01',
      sex: 'female',
      nationality: 'VNM',
      dateOfExpiry: '2030-02-01',
      documentNumberMasked: '—',
      authMethod: 'BAC',
      dg13Parsed: false,
      idNumber: null,
      ethnicity: null,
      religion: null,
      placeOfOrigin: null,
      residence: null,
      issueDate: null,
      fatherName: null,
      motherName: null,
    });
  });

  it('ignores a DG13 birth date that disagrees with the authenticated MRZ', () => {
    expect(normalizeIdentity({ ...full, dateOfBirthDg13: '17/09/1991' }, NOW).dateOfBirth).toBe('1990-09-17');
    expect(normalizeIdentity({ ...full, dateOfBirthDg13: '18/09/1990' }, NOW).dateOfBirth).toBe('1990-09-17');
  });

  it('lets a consistent DG13 date resolve the MRZ century', () => {
    // MRZ "250101" alone reads as 2025; DG13 knows the person was born in 1925.
    const raw = { ...full, dateOfBirthMrz: '250101', dateOfBirthDg13: '01/01/1925' };
    expect(normalizeIdentity(raw, NOW).dateOfBirth).toBe('1925-01-01');
    expect(normalizeIdentity({ ...raw, dateOfBirthDg13: undefined }, NOW).dateOfBirth).toBe('2025-01-01');
  });

  it('uses the DG13 date when the MRZ date is missing, and an empty string when both are', () => {
    expect(normalizeIdentity({ ...full, dateOfBirthMrz: undefined }, NOW).dateOfBirth).toBe('1990-09-17');
    expect(normalizeIdentity({ ...full, dateOfBirthMrz: 'bad', dateOfBirthDg13: 'Không rõ' }, NOW).dateOfBirth).toBe('');
  });

  it('treats blank strings and non-strings as missing', () => {
    const id = normalizeIdentity({ ...full, fullNameDg13: '   ', nationalityDg13: 12, documentNumberLast3: ' ' }, NOW);
    expect(id.fullName).toBe('NGUYEN VAN AN');
    expect(id.nationality).toBe('VNM');
    expect(id.documentNumberMasked).toBe('—');
  });

  it('falls back to the MRZ expiry for cards whose DG13 expiry is text', () => {
    expect(normalizeIdentity({ ...full, dateOfExpiryDg13: 'Không thời hạn' }, NOW).dateOfExpiry).toBe('2030-09-17');
    expect(normalizeIdentity({ ...full, dateOfExpiryDg13: 'Không thời hạn', dateOfExpiryMrz: '<<<<<<' }, NOW).dateOfExpiry).toBeNull();
  });

  it('only accepts exact PACE / boolean true flags', () => {
    const id = normalizeIdentity({ ...full, authMethod: 'pace', dg13Parsed: 'true' }, NOW);
    expect(id.authMethod).toBe('BAC');
    expect(id.dg13Parsed).toBe(false);
  });

  it('handles an empty map', () => {
    expect(normalizeIdentity({}, NOW)).toEqual({
      fullName: '',
      fullNameMrz: '',
      dateOfBirth: '',
      sex: null,
      nationality: null,
      dateOfExpiry: null,
      documentNumberMasked: '—',
      authMethod: 'BAC',
      dg13Parsed: false,
      idNumber: null,
      ethnicity: null,
      religion: null,
      placeOfOrigin: null,
      residence: null,
      issueDate: null,
      fatherName: null,
      motherName: null,
    });
  });
});

describe('without the native module', () => {
  it('reports NFC as unsupported', () => {
    expect(getNfcAvailability()).toEqual({ platformSupported: false, supported: false, enabled: false });
    expect(openNfcSettings()).toBe(false);
    expect(() => cancelCccdRead()).not.toThrow();
    const sub = addProgressListener(() => {});
    expect(() => sub.remove()).not.toThrow();
  });

  it('rejects reads with NFC_UNSUPPORTED', async () => {
    const promise = readCccd({ idNumber: '001090012345', dateOfBirth: '900917', dateOfExpiry: '300917' });
    await expect(promise).rejects.toBeInstanceOf(CccdError);
    await expect(promise).rejects.toMatchObject({ code: 'NFC_UNSUPPORTED', name: 'CccdError' });
  });
});

describe('date helpers reject impossible calendar days', () => {
  const NOW = new Date(2026, 8, 17);
  it('mrzDateToIso returns null for invalid month/day', () => {
    expect(mrzDateToIso('901399', 'birth', NOW)).toBeNull();
    expect(mrzDateToIso('900231', 'birth', NOW)).toBeNull();
    expect(mrzDateToIso('000000', 'expiry', NOW)).toBeNull();
    expect(mrzDateToIso('000229', 'birth', NOW)).toBe('2000-02-29');
    expect(mrzDateToIso('010229', 'birth', NOW)).toBeNull();
  });
  it('dg13DateToIso returns null for invalid month/day', () => {
    expect(dg13DateToIso('31/02/1990')).toBeNull();
    expect(dg13DateToIso('29/02/2024')).toBe('2024-02-29');
  });
});
