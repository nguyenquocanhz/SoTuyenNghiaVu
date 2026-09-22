export type Sex = 'male' | 'female';

/** Ordered from least to most urgent (except `unknown`). */
export type Severity = 'normal' | 'info' | 'caution' | 'warning' | 'danger' | 'critical' | 'unknown';

/** Điểm sức khỏe theo Điều 6 Thông tư 105/2023/TT-BQP: 1 rất tốt … 6 rất kém. */
export type Score = 1 | 2 | 3 | 4 | 5 | 6;

/** Đợt sơ tuyển sức khỏe nghĩa vụ quân sự do Trạm y tế cấp xã tổ chức. */
export interface Campaign {
  id: string;
  /** Năm tuyển chọn, gọi công dân nhập ngũ. */
  year: number;
  name: string;
  /** Số lượng sơ tuyển theo kế hoạch (Mẫu 2a, mục 1). */
  plannedCount?: number;
  /** ISO YYYY-MM-DD */
  startDate: string;
  endDate?: string;
  /** Quyển số của Sổ thống kê (Mẫu 2k). */
  bookNumber?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export type CitizenSource = 'nfc' | 'manual' | 'import';

/** Phần I. Sơ yếu lý lịch – Mẫu 2 Phụ lục I Thông tư 106/2025/TT-BQP. */
export interface Citizen {
  id: string;
  fullName: string;
  /** ISO YYYY-MM-DD */
  birthDate: string;
  sex: Sex;
  /** Số CCCD / số định danh cá nhân, 12 chữ số. */
  cccd: string;
  occupation?: string;
  ethnicity?: string;
  religion?: string;
  /** Đã phục vụ tại ngũ: từ tháng/năm (MM/YYYY). */
  servedFrom?: string;
  servedTo?: string;
  fatherName?: string;
  fatherBirthYear?: string;
  motherName?: string;
  motherBirthYear?: string;
  /** Nơi đăng ký thường trú. */
  permanentAddress?: string;
  /** Chỗ ở hiện nay của gia đình. */
  currentAddress?: string;
  phone?: string;
  source: CitizenSource;
  createdAt: string;
  updatedAt: string;
}

/** Kết luận ghi vào Sổ thống kê sơ tuyển (Mẫu 2k). */
export type ScreeningOutcome =
  /** Chưa kết luận. */
  | 'pending'
  /** Đủ điều kiện khám sức khỏe NVQS. */
  | 'eligible'
  /** Không đủ ĐK KSK NVQS – thuộc diện miễn làm NVQS (Mục III Phụ lục I). */
  | 'exempt'
  /** Không đủ ĐK KSK NVQS – lý do khác. */
  | 'other';

export interface VisionResult {
  /** Thị lực không kính, phần mười (1–10; 12 được ghi nhưng tính là 10). */
  rightUncorrected?: number;
  leftUncorrected?: number;
  rightCorrected?: number;
  leftCorrected?: number;
  /** Độ khúc xạ của kính (D), âm là cận, dương là viễn. */
  rightDiopter?: number;
  leftDiopter?: number;
}

/** Một bệnh, tật phát hiện khi sơ tuyển, tham chiếu Mục II Phụ lục I. */
export interface Finding {
  /** Mã mục trong danh mục (xem src/standards/diseases.ts), hoặc `custom`. */
  itemId: string;
  label: string;
  score: Score;
  /** Điểm kèm chữ "T" – tạm thời (khoản 3 Điều 9). */
  temporary: boolean;
  note?: string;
}

/** Phiếu sơ tuyển sức khỏe nghĩa vụ quân sự (Mẫu 2) + dòng Sổ thống kê (Mẫu 2k). */
export interface Screening {
  id: string;
  campaignId: string;
  citizenId: string;
  /** ISO YYYY-MM-DD */
  screenedOn: string;
  heightCm?: number;
  weightKg?: number;
  weightSource?: 'ble' | 'manual';
  /** Vòng ngực trung bình (cm). */
  chestCm?: number;
  pulse?: number;
  /** Huyết áp lần đo 1 (mmHg). */
  systolic?: number;
  diastolic?: number;
  /** Huyết áp lần đo 2 – Mục IV số 99: giá trị ghi nhận là trung bình hai lần đo cuối. */
  systolic2?: number;
  diastolic2?: number;
  vision: VisionResult;
  findings: Finding[];
  /** Mã bệnh thuộc danh mục miễn đăng ký/miễn làm NVQS (Mục III Phụ lục I). */
  exemptionIds: string[];
  /** Tình trạng sức khỏe và bệnh tật (tự do, ngoài các mục đã chọn). */
  healthNote?: string;
  familyHistory?: string;
  personalHistory?: string;
  outcome: ScreeningOutcome;
  /** Lý do khi kết luận không đủ điều kiện. */
  outcomeReason?: string;
  /** III. Ý kiến tổ sơ tuyển. */
  teamOpinion?: string;
  examiner?: string;
  createdAt: string;
  updatedAt: string;
}

export type SignalQuality = 'good' | 'fair' | 'poor';

/** Stability statistics of a Bluetooth scale session (see src/ble/weightSession.ts). */
export interface WeightStability {
  samples: number;
  sdKg: number;
  rangeKg: number;
  windowSec: number;
  durationSec: number;
  quality: SignalQuality;
  usedStableFlag: boolean;
}
