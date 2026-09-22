export type NfcAvailability = {
  /** The platform has a native implementation (Android only for now). */
  platformSupported: boolean;
  /** The device has NFC hardware. */
  supported: boolean;
  /** NFC is switched on in system settings. */
  enabled: boolean;
};

export type CccdReadStep = 'waiting_card' | 'connecting' | 'authenticating' | 'reading_dg1' | 'reading_dg13' | 'done';

export type CccdReadProgress = {
  step: CccdReadStep;
  /** 0–100 */
  percent: number;
  message: string;
};

/**
 * Identity fields needed by the military-service screening form (Mẫu 2, Phụ lục I, TT 106/2025/TT-BQP),
 * whose unstarred fields are taken from the national population data (Decree 13/2023/NĐ-CP: purpose-bound).
 */
export type CccdIdentity = {
  /** Vietnamese full name with diacritics from DG13; falls back to the MRZ name. */
  fullName: string;
  /** ASCII name from the MRZ (DG1), e.g. "NGUYEN VAN A". */
  fullNameMrz: string;
  /** ISO YYYY-MM-DD */
  dateOfBirth: string;
  sex: 'male' | 'female' | null;
  nationality: string | null;
  /** ISO YYYY-MM-DD, null when the card has no expiry. */
  dateOfExpiry: string | null;
  /** Only the last 3 digits are revealed, e.g. "*********789". */
  documentNumberMasked: string;
  authMethod: 'PACE' | 'BAC';
  /** Whether DG13 (Vietnamese citizen details) could be read and parsed. */
  dg13Parsed: boolean;
  /** Full 12-digit number from DG13, only when consistent with the MRZ document number. */
  idNumber: string | null;
  ethnicity: string | null;
  religion: string | null;
  placeOfOrigin: string | null;
  /** Nơi thường trú. */
  residence: string | null;
  /** ISO YYYY-MM-DD */
  issueDate: string | null;
  fatherName: string | null;
  motherName: string | null;
};

export type CccdErrorCode =
  | 'NFC_UNSUPPORTED'
  | 'NFC_DISABLED'
  | 'NO_ACTIVITY'
  | 'BUSY'
  | 'CANCELLED'
  | 'INVALID_INPUT'
  | 'NOT_ISO_DEP'
  | 'AUTH_FAILED'
  | 'TAG_LOST'
  | 'READ_FAILED';

export type CccdReadInput = {
  /** 12-digit CCCD number (the 9-digit MRZ document number is also accepted). */
  idNumber: string;
  /** YYMMDD */
  dateOfBirth: string;
  /** YYMMDD */
  dateOfExpiry: string;
};

export type CccdNfcModuleEvents = {
  onProgress: (progress: CccdReadProgress) => void;
};
