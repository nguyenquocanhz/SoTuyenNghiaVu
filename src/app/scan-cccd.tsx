import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, AppState, Easing, Keyboard, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Card,
  Disclaimer,
  Divider,
  EmptyState,
  Icon,
  InfoBanner,
  Screen,
  StatusBadge,
  TextField,
  ToggleRow,
  type IconName,
} from '@/components';
import { formatNumber, isoToViDate, isValidIsoDate } from '@/domain/format';
import type { Severity } from '@/domain/types';
import { useDataStore } from '@/store/data';
import { useDraftStore } from '@/store/drafts';
import { colors, radius, spacing, type } from '@/theme';
import {
  addProgressListener,
  cancelCccdRead,
  CccdError,
  getNfcAvailability,
  mrzDocumentNumber,
  openNfcSettings,
  readCccd,
  viDateToMrz,
  type CccdErrorCode,
  type CccdIdentity,
  type CccdReadProgress,
  type CccdReadStep,
  type NfcAvailability,
} from '@modules/cccd-nfc';

const CITIZEN_FORM_HREF = '/citizen-form' as Href;

const ID_LENGTH = 12;

const EXPIRY_HINT =
  'Ghi ở mặt trước (Có giá trị đến) hoặc 6 số ngay sau ký tự giới tính (M/F) ở dòng MRZ thứ 2 mặt sau (YYMMDD), ví dụ 360115 là 15/01/2036.';

type Phase = 'form' | 'scanning' | 'result';

interface ScanFailure {
  code: CccdErrorCode;
  message: string;
}

interface FieldCheck {
  valid: boolean;
  error: string | null;
  hint?: string;
}

// ---------------------------------------------------------------------------
// Input helpers
// ---------------------------------------------------------------------------

/** Keeps only digits and inserts the slashes of dd/mm/yyyy while typing on a number pad. */
function formatDateInput(text: string): string {
  const full = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(text);
  if (full) return `${full[1].padStart(2, '0')}/${full[2].padStart(2, '0')}/${full[3]}`;
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Validates "dd/mm/yyyy" with the module helper and returns the local date + MRZ form. */
function parseViDate(value: string): { date: Date; year: number; mrz: string } | null {
  const mrz = viDateToMrz(value);
  if (!mrz) return null;
  const [d, m, y] = value.trim().split('/').map(Number);
  return { date: new Date(y, m - 1, d), year: y, mrz };
}

/**
 * CCCD numbering (Thông tư 59/2021/TT-BCA): digit 4 encodes sex + century
 * (0/1 → 19xx, 2/3 → 20xx, …) and digits 5–6 the last two digits of the birth year.
 */
function birthYearFromId(id: string): number | null {
  if (!/^\d{12}$/.test(id)) return null;
  const centuryDigit = Number(id[3]);
  return 1900 + Math.floor(centuryDigit / 2) * 100 + Number(id.slice(4, 6));
}

function checkIdNumber(value: string, birthYear: number | undefined): FieldCheck {
  if (value.length === 0) return { valid: false, error: null, hint: 'Gồm 12 chữ số in ở mặt trước thẻ.' };
  if (value.length < ID_LENGTH) return { valid: false, error: null, hint: `Đã nhập ${value.length}/${ID_LENGTH} chữ số.` };
  if (!/^\d{12}$/.test(value) || !mrzDocumentNumber(value)) {
    return { valid: false, error: 'Số CCCD phải gồm đúng 12 chữ số.' };
  }
  const idYear = birthYearFromId(value);
  if (birthYear !== undefined && idYear !== null && idYear !== birthYear) {
    return {
      valid: true,
      error: null,
      hint: `Lưu ý: chữ số thứ 4–6 của số CCCD thường ứng với năm sinh (số đã nhập ứng với năm ${idYear}, ngày sinh là năm ${birthYear}). Hãy kiểm tra lại nếu nhập nhầm.`,
    };
  }
  return { valid: true, error: null, hint: 'Dùng để mở khoá chip và ghi vào phiếu sơ tuyển.' };
}

function checkBirthDate(value: string, today: Date): FieldCheck & { parsed?: NonNullable<ReturnType<typeof parseViDate>> } {
  if (value.length === 0) return { valid: false, error: null, hint: 'Ví dụ: 01/05/1990.' };
  if (value.length < 10) return { valid: false, error: null, hint: 'Nhập đủ ngày/tháng/năm, ví dụ 01/05/1990.' };
  const parsed = parseViDate(value);
  if (!parsed) return { valid: false, error: 'Ngày sinh không hợp lệ. Hãy nhập theo dạng dd/mm/yyyy.' };
  if (parsed.year < 1900) return { valid: false, error: 'Năm sinh không hợp lệ.' };
  if (parsed.date.getTime() > today.getTime()) return { valid: false, error: 'Ngày sinh không được sau ngày hôm nay.' };
  return { valid: true, error: null, parsed };
}

function checkExpiry(value: string, birth: Date | undefined, today: Date): FieldCheck {
  if (value.length < 10) return { valid: false, error: null, hint: EXPIRY_HINT };
  const parsed = parseViDate(value);
  if (!parsed) return { valid: false, error: 'Ngày hết hạn không hợp lệ. Hãy nhập theo dạng dd/mm/yyyy.' };
  if (parsed.year < 2021 || parsed.year > 2099) {
    return { valid: false, error: 'Năm hết hạn của thẻ CCCD gắn chip phải trong khoảng 2021–2099.' };
  }
  if (birth && parsed.date.getTime() <= birth.getTime()) return { valid: false, error: 'Ngày hết hạn phải sau ngày sinh.' };
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (parsed.date.getTime() < startOfToday.getTime()) {
    return {
      valid: true,
      error: null,
      hint: `Theo ngày bạn nhập, thẻ đã hết hạn – vẫn có thể thử đọc chip. ${EXPIRY_HINT}`,
    };
  }
  return { valid: true, error: null, hint: EXPIRY_HINT };
}

// ---------------------------------------------------------------------------
// Error guidance
// ---------------------------------------------------------------------------

interface Guidance {
  severity: Severity;
  title: string;
  message: string;
  openSettings?: boolean;
}

function errorGuidance(failure: ScanFailure): Guidance | null {
  switch (failure.code) {
    case 'CANCELLED':
      return null;
    case 'AUTH_FAILED':
      return {
        severity: 'warning',
        title: 'Không mở khoá được chip',
        message:
          'Số CCCD, ngày sinh hoặc ngày hết hạn chưa khớp với thông tin trên chip. Hãy kiểm tra lại cả 3 thông tin (ngày hết hạn có thể xem ở dòng MRZ thứ 2 mặt sau thẻ) rồi thử lại.',
      };
    case 'TAG_LOST':
      return {
        severity: 'caution',
        title: 'Mất kết nối với thẻ',
        message:
          'Thẻ bị dịch chuyển hoặc ở quá xa ăng-ten NFC. Hãy tháo ốp lưng dày, đặt thẻ ở giữa mặt lưng gần cụm camera và giữ yên 5–10 giây, không nhấc thẻ cho đến khi đọc xong.',
      };
    case 'NFC_DISABLED':
      return {
        severity: 'caution',
        title: 'NFC đang tắt',
        message: 'Hãy bật NFC trong Cài đặt của điện thoại rồi quay lại ứng dụng để quét.',
        openSettings: true,
      };
    case 'NFC_UNSUPPORTED':
      return {
        severity: 'warning',
        title: 'Không dùng được NFC',
        message: failure.message || 'Thiết bị này không hỗ trợ đọc chip qua NFC. Hãy nhập sơ yếu lý lịch bằng tay.',
      };
    case 'NOT_ISO_DEP':
      return {
        severity: 'caution',
        title: 'Không phải thẻ CCCD gắn chip',
        message:
          'Thẻ vừa chạm vào máy không phải thẻ Căn cước công dân gắn chip (có thể là thẻ ngân hàng, thẻ từ…). Hãy dùng đúng thẻ CCCD gắn chip và để các thẻ khác ra xa điện thoại.',
      };
    case 'BUSY':
      return {
        severity: 'info',
        title: 'Đang có phiên đọc khác',
        message: 'Ứng dụng đang bận đọc thẻ trong một phiên khác. Hãy đợi vài giây rồi thử lại.',
      };
    case 'INVALID_INPUT':
      return {
        severity: 'caution',
        title: 'Thông tin chưa hợp lệ',
        message: 'Số CCCD, ngày sinh hoặc ngày hết hạn chưa đúng định dạng. Hãy kiểm tra lại rồi thử lại.',
      };
    case 'NO_ACTIVITY':
      return {
        severity: 'caution',
        title: 'Chưa sẵn sàng đọc thẻ',
        message: 'Ứng dụng chưa bật được chế độ đọc NFC. Hãy đóng rồi mở lại màn hình này và thử lại.',
      };
    case 'READ_FAILED':
    default:
      return {
        severity: 'warning',
        title: 'Đọc chip thất bại',
        message: `Không đọc được dữ liệu từ chip${failure.message ? ` (${failure.message})` : ''}. Hãy giữ yên thẻ ở giữa mặt lưng điện thoại và thử lại.`,
      };
  }
}

// ---------------------------------------------------------------------------
// Result helpers
// ---------------------------------------------------------------------------

function sexLabel(sex: CccdIdentity['sex']): string {
  if (sex === 'male') return 'Nam';
  if (sex === 'female') return 'Nữ';
  return 'Không xác định';
}

function nationalityLabel(value: string | null): string {
  if (!value) return '—';
  const v = value.trim();
  if (v.toUpperCase() === 'VNM') return 'Việt Nam';
  return v;
}

function goToManualForm() {
  router.replace(CITIZEN_FORM_HREF);
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ScanCccdScreen() {
  const [nfc, setNfc] = useState<NfcAvailability>(() => getNfcAvailability());
  const [settingsOpenFailed, setSettingsOpenFailed] = useState(false);

  const [consent, setConsent] = useState(false);
  const [idNumber, setIdNumber] = useState('');
  const [birthText, setBirthText] = useState('');
  const [expiryText, setExpiryText] = useState('');

  const [phase, setPhase] = useState<Phase>('form');
  const [progress, setProgress] = useState<CccdReadProgress | null>(null);
  const [failure, setFailure] = useState<ScanFailure | null>(null);
  const [identity, setIdentity] = useState<CccdIdentity | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const mountedRef = useRef(true);
  const scanningRef = useRef(false);
  const listenerRef = useRef<{ remove(): void } | null>(null);

  // Re-check NFC whenever the user comes back (e.g. from the NFC settings page).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setNfc(getNfcAvailability());
        setSettingsOpenFailed(false);
      }
    });
    return () => sub.remove();
  }, []);

  // Release the native listener and stop reader mode when leaving the screen mid-scan.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      listenerRef.current?.remove();
      listenerRef.current = null;
      if (scanningRef.current) {
        scanningRef.current = false;
        cancelCccdRead();
      }
    };
  }, []);

  const today = new Date();
  const birthCheck = checkBirthDate(birthText, today);
  const birth = birthCheck.valid && birthCheck.parsed ? birthCheck.parsed : null;
  const idCheck = checkIdNumber(idNumber, birth?.year);
  const expiryCheck = checkExpiry(expiryText, birth?.date, today);
  const expiryMrz = expiryCheck.valid ? viDateToMrz(expiryText) : null;

  const nfcReady = nfc.platformSupported && nfc.supported && nfc.enabled;
  const inputsValid = idCheck.valid && birth !== null && expiryMrz !== null;
  const canScan = nfcReady && consent && inputsValid && phase === 'form';

  const missing: string[] = [];
  if (!nfcReady) missing.push('bật NFC');
  if (!consent) missing.push('bật công tắc đồng ý');
  if (!idCheck.valid) missing.push('nhập đủ số CCCD');
  if (!birthCheck.valid) missing.push('nhập ngày sinh hợp lệ');
  if (!expiryCheck.valid) missing.push('nhập ngày hết hạn hợp lệ');

  const openSettings = () => {
    const opened = openNfcSettings();
    setSettingsOpenFailed(!opened);
  };

  const startScan = async () => {
    if (!canScan || !birth || !expiryMrz || scanningRef.current) return;
    Keyboard.dismiss();
    scanningRef.current = true;
    setFailure(null);
    setProgress(null);
    setCancelling(false);
    setPhase('scanning');

    const subscription = addProgressListener((p) => {
      if (mountedRef.current) setProgress(p);
    });
    listenerRef.current = subscription;

    try {
      const result = await readCccd({ idNumber, dateOfBirth: birth.mrz, dateOfExpiry: expiryMrz });
      if (!mountedRef.current) return;
      setIdentity(result);
      setPhase('result');
    } catch (e) {
      if (!mountedRef.current) return;
      const error = e instanceof CccdError ? e : new CccdError('READ_FAILED', e instanceof Error ? e.message : String(e));
      setPhase('form');
      setFailure(error.code === 'CANCELLED' ? null : { code: error.code, message: error.message });
      if (error.code === 'NFC_DISABLED' || error.code === 'NFC_UNSUPPORTED') setNfc(getNfcAvailability());
    } finally {
      subscription.remove();
      if (listenerRef.current === subscription) listenerRef.current = null;
      scanningRef.current = false;
      if (mountedRef.current) setCancelling(false);
    }
  };

  const cancelScan = () => {
    setCancelling(true);
    cancelCccdRead();
  };

  const rescan = () => {
    setIdentity(null);
    setIdNumber('');
    setProgress(null);
    setFailure(null);
    setPhase('form');
  };

  const cccd = identity?.idNumber ?? idNumber;
  const existing = useDataStore((s) => (identity ? s.citizens.find((c) => c.cccd === cccd) : undefined));

  const applyToCitizen = () => {
    if (!identity) return;
    useDraftStore.getState().setIdentity({ ...identity, cccd });
    if (existing) router.replace({ pathname: '/citizen-form', params: { id: existing.id } });
    else router.replace(CITIZEN_FORM_HREF);
  };

  // ---- Result ----
  if (phase === 'result' && identity) {
    return (
      <Screen
        footer={
          <View style={styles.footerColumn}>
            <Button
              title={existing ? 'Cập nhật hồ sơ đã có' : 'Tạo hồ sơ công dân'}
              icon="account-arrow-right"
              size="lg"
              onPress={applyToCitizen}
              accessibilityHint="Điền sơ yếu lý lịch vào biểu mẫu để kiểm tra trước khi lưu"
            />
            <Button title="Quét lại" icon="refresh" variant="secondary" onPress={rescan} />
          </View>
        }>
        <InfoBanner severity="normal" title="Đọc chip thành công" message="Đối chiếu với công dân và kiểm tra lại thông tin trước khi lưu." />
        {existing ? (
          <InfoBanner
            severity="info"
            title="Công dân đã có trong danh sách"
            message={`${existing.fullName} đã có hồ sơ với số CCCD này. Thông tin từ chip sẽ được điền vào hồ sơ đó để kiểm tra.`}
          />
        ) : null}
        <IdentityResult identity={identity} cccd={cccd} />
        {!identity.dg13Parsed ? (
          <InfoBanner
            severity="caution"
            title="Tên chưa có dấu"
            message="Không đọc được thông tin công dân (DG13) – đang dùng tên không dấu từ MRZ; hãy sửa họ tên và nhập bổ sung dân tộc, địa chỉ, họ tên bố mẹ."
          />
        ) : null}
        {identity.sex === null ? (
          <InfoBanner severity="info" message="Không xác định được giới tính từ chip – hãy chọn giới tính trong hồ sơ." />
        ) : null}
        {!isValidIsoDate(identity.dateOfBirth) ? (
          <InfoBanner severity="info" message="Không đọc được ngày sinh từ chip – hãy nhập ngày sinh trong hồ sơ." />
        ) : null}
        <Disclaimer text="Chỉ các trường của Phiếu sơ tuyển sức khỏe NVQS (Mẫu 2) được dùng. Ứng dụng không đọc ảnh chân dung, vân tay; dữ liệu chỉ lưu trên máy này." />
      </Screen>
    );
  }

  // ---- Device capability gates ----
  if (!nfc.platformSupported) {
    return (
      <Screen>
        <EmptyState
          icon="cellphone-nfc-off"
          title="Quét CCCD cần ứng dụng Android"
          message="Tính năng đọc chip Căn cước công dân qua NFC hiện chỉ có trên ứng dụng Android. Hãy nhập sơ yếu lý lịch bằng tay."
          action={{ label: 'Nhập bằng tay', icon: 'pencil-outline', onPress: goToManualForm }}
        />
      </Screen>
    );
  }

  if (!nfc.supported) {
    return (
      <Screen>
        <EmptyState
          icon="nfc-variant-off"
          title="Máy không có NFC"
          message="Điện thoại này không có NFC nên không thể đọc chip trên thẻ CCCD. Hãy nhập sơ yếu lý lịch bằng tay."
          action={{ label: 'Nhập bằng tay', icon: 'pencil-outline', onPress: goToManualForm }}
        />
      </Screen>
    );
  }

  // ---- Scanning ----
  if (phase === 'scanning') {
    return (
      <Screen
        footer={
          <Button
            title="Huỷ"
            icon="close"
            variant="danger"
            size="lg"
            loading={cancelling}
            onPress={cancelScan}
            accessibilityHint="Dừng đọc chip CCCD"
          />
        }>
        <ScanProgressCard progress={progress} />
        <ScanTips />
      </Screen>
    );
  }

  // ---- Form ----
  // NFC_DISABLED is already explained by the "NFC đang tắt" banner while NFC is still off.
  const guidance = failure && !(failure.code === 'NFC_DISABLED' && !nfc.enabled) ? errorGuidance(failure) : null;

  const footer: ReactNode = (
    <View style={styles.footerColumn}>
      <Button
        title="Bắt đầu quét chip"
        icon="nfc"
        size="lg"
        disabled={!canScan}
        onPress={() => void startScan()}
        accessibilityHint={canScan ? 'Đặt thẻ CCCD vào mặt lưng điện thoại sau khi bấm' : `Để bắt đầu quét, hãy ${missing.join(', ')}`}
      />
      {!canScan && missing.length > 0 ? (
        <Text style={[type.caption, styles.centerText]}>Để bắt đầu quét, hãy: {missing.join(' · ')}.</Text>
      ) : null}
    </View>
  );

  return (
    <Screen footer={footer}>
      <Text style={type.body}>
        Đọc chip trên thẻ Căn cước công dân để điền nhanh sơ yếu lý lịch của Phiếu sơ tuyển (họ tên, ngày sinh, giới tính, số CCCD, dân tộc, nơi thường trú, họ tên bố mẹ). Có thể sửa lại trước khi lưu.
      </Text>

      {nfc.enabled ? (
        <View style={styles.statusRow} accessible accessibilityLabel="NFC: có, đang bật. Sẵn sàng quét.">
          <Icon name="nfc" size={24} color={colors.primary} />
          <Text style={[type.bodyStrong, styles.flex]}>NFC: Có · Đang bật</Text>
          <StatusBadge severity="normal" label="Sẵn sàng" size="sm" />
        </View>
      ) : (
        <View style={styles.block}>
          <InfoBanner
            severity="caution"
            title="NFC đang tắt"
            message="Hãy bật NFC để đọc chip trên thẻ CCCD. Sau khi bật, quay lại ứng dụng – trạng thái sẽ tự cập nhật."
          />
          <Button title="Bật NFC trong Cài đặt" icon="cog-outline" onPress={openSettings} />
          {settingsOpenFailed ? (
            <Text style={type.caption}>Không mở được Cài đặt. Hãy vào Cài đặt › Kết nối › NFC để bật thủ công.</Text>
          ) : null}
        </View>
      )}

      {guidance ? (
        <View style={styles.block}>
          <InfoBanner severity={guidance.severity} title={guidance.title} message={guidance.message} />
          {guidance.openSettings ? (
            <Button title="Bật NFC trong Cài đặt" icon="cog-outline" variant="secondary" onPress={openSettings} />
          ) : canScan ? (
            <Button title="Thử lại" icon="refresh" variant="secondary" onPress={() => void startScan()} />
          ) : null}
        </View>
      ) : null}

      <Card title="Mục đích và sự đồng ý" subtitle="Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân" icon="shield-account-outline">
        <PrivacyPoint
          icon="clipboard-account-outline"
          text="Chỉ dùng để lập Phiếu sơ tuyển sức khỏe NVQS (Mẫu 2, Thông tư 106/2025/TT-BQP); các trường không đánh dấu (*) được khai thác từ dữ liệu dân cư."
        />
        <PrivacyPoint icon="cellphone-lock" text="Dữ liệu chip được đọc và lưu ngay trên điện thoại của trạm, không gửi lên máy chủ." />
        <PrivacyPoint icon="eye-off-outline" text="Không đọc ảnh chân dung và dữ liệu sinh trắc học (vân tay, khuôn mặt)." />
        <Divider />
        <ToggleRow
          title="Công dân đồng ý cho đọc chip CCCD"
          subtitle="Bắt buộc để bắt đầu quét"
          value={consent}
          onValueChange={setConsent}
        />
      </Card>

      <Card title="Thông tin mở khoá chip" subtitle="Chip chỉ cho đọc khi 3 thông tin này khớp với thẻ." icon="card-account-details-outline">
        <TextField
          label="Số CCCD"
          value={idNumber}
          onChangeText={(text) => setIdNumber(text.replace(/\D/g, '').slice(0, ID_LENGTH))}
          placeholder="12 chữ số"
          keyboardType="number-pad"
          autoCapitalize="none"
          maxLength={ID_LENGTH}
          error={idCheck.error}
          hint={idCheck.hint}
        />
        <TextField
          label="Ngày sinh"
          value={birthText}
          onChangeText={(text) => setBirthText(formatDateInput(text))}
          placeholder="dd/mm/yyyy"
          keyboardType="number-pad"
          autoCapitalize="none"
          maxLength={10}
          error={birthCheck.error}
          hint={birthCheck.hint}
        />
        <TextField
          label="Ngày hết hạn"
          value={expiryText}
          onChangeText={(text) => setExpiryText(formatDateInput(text))}
          placeholder="dd/mm/yyyy"
          keyboardType="number-pad"
          autoCapitalize="none"
          maxLength={10}
          error={expiryCheck.error}
          hint={expiryCheck.hint}
        />
      </Card>

      <ScanTips />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PrivacyPoint({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.pointRow}>
      <Icon name={icon} size={20} color={colors.accent} />
      <Text style={[type.body, styles.flex]}>{text}</Text>
    </View>
  );
}

function ScanTips() {
  return (
    <Card title="Mẹo đọc chip nhanh" icon="lightbulb-on-outline">
      <PrivacyPoint icon="cellphone-cog" text="Tháo ốp lưng dày (đặc biệt ốp có kim loại hoặc nam châm) trước khi quét." />
      <PrivacyPoint
        icon="card-account-details-outline"
        text="Đặt thẻ nằm phẳng ở giữa mặt lưng điện thoại, gần cụm camera (ví dụ với Samsung Galaxy Note 10)."
      />
      <PrivacyPoint icon="hand-back-right-outline" text="Giữ yên thẻ 5–10 giây, không nhấc thẻ khi đang đọc cho đến khi báo hoàn tất." />
    </Card>
  );
}

const STEPS: { step: CccdReadStep; label: string }[] = [
  { step: 'waiting_card', label: 'Chờ áp thẻ vào điện thoại' },
  { step: 'connecting', label: 'Kết nối với chip' },
  { step: 'authenticating', label: 'Xác thực chip (PACE/BAC)' },
  { step: 'reading_dg1', label: 'Đọc vùng MRZ (DG1)' },
  { step: 'reading_dg13', label: 'Đọc thông tin công dân (DG13)' },
];
const STEP_ORDER: CccdReadStep[] = [...STEPS.map((s) => s.step), 'done'];

function ScanProgressCard({ progress }: { progress: CccdReadProgress | null }) {
  const percent = Math.round(Math.min(100, Math.max(0, progress?.percent ?? 0)));
  const currentIndex = Math.max(0, STEP_ORDER.indexOf(progress?.step ?? 'waiting_card'));
  const message = progress?.message || 'Đặt thẻ CCCD vào giữa mặt lưng điện thoại và giữ yên.';

  return (
    <Card>
      <View style={styles.illustration}>
        <NfcPulse />
      </View>
      <Text style={[type.title, styles.centerText]} accessibilityRole="header">
        Áp thẻ CCCD vào mặt lưng điện thoại
      </Text>
      <Text style={[type.body, styles.centerText, { color: colors.textSecondary }]} accessibilityLiveRegion="polite">
        {message}
      </Text>

      <View style={styles.progressHeader}>
        <Text style={type.caption}>Tiến độ đọc chip</Text>
        <Text style={type.bodyStrong}>{formatNumber(percent, 0)}%</Text>
      </View>
      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityLabel="Tiến độ đọc chip"
        accessibilityValue={{ min: 0, max: 100, now: percent, text: `${formatNumber(percent, 0)}%` }}>
        <View style={[styles.fill, { width: `${percent}%` as const }]} />
      </View>

      <View style={styles.steps}>
        {STEPS.map((s, i) => {
          const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'pending';
          return (
            <View
              key={s.step}
              style={styles.stepRow}
              accessible
              accessibilityLabel={`${s.label}: ${state === 'done' ? 'đã xong' : state === 'current' ? 'đang thực hiện' : 'chưa thực hiện'}`}>
              {state === 'done' ? (
                <Icon name="check-circle" size={20} color={colors.normal} />
              ) : state === 'current' ? (
                <ActivityIndicator size="small" color={colors.primary} style={styles.stepIndicator} />
              ) : (
                <Icon name="circle-outline" size={20} color={colors.textMuted} />
              )}
              <Text
                style={[
                  type.body,
                  styles.flex,
                  state === 'pending' && { color: colors.textMuted },
                  state === 'current' && styles.stepCurrent,
                ]}>
                {s.label}
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const PULSE_SIZE = 168;
const PULSE_CORE = 88;

function ringStyle(value: Animated.Value | Animated.AnimatedInterpolation<number>) {
  return {
    opacity: value.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.6, 0] }),
    transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [1, PULSE_SIZE / PULSE_CORE] }) }],
  };
}

/** Pulsing "waiting for card" illustration; the loop stops when the component unmounts. */
function NfcPulse() {
  const [anim] = useState(() => {
    const value = new Animated.Value(0);
    const shifted = value.interpolate({ inputRange: [0, 0.5, 0.5001, 1], outputRange: [0.5, 1, 0, 0.5] });
    return { value, rings: [ringStyle(value), ringStyle(shifted)] };
  });

  useEffect(() => {
    let active = true;
    let loop: Animated.CompositeAnimation | null = null;
    const start = () => {
      if (!active) return;
      loop = Animated.loop(
        Animated.timing(anim.value, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true }),
      );
      loop.start();
    };
    AccessibilityInfo.isReduceMotionEnabled().then(
      (reduce) => {
        if (!reduce) start();
      },
      start,
    );
    return () => {
      active = false;
      loop?.stop();
      anim.value.stopAnimation();
    };
  }, [anim]);

  return (
    <View style={styles.pulse} accessible accessibilityRole="image" accessibilityLabel="Đang chờ thẻ CCCD áp vào mặt lưng điện thoại">
      {anim.rings.map((ring, i) => (
        <Animated.View key={i} style={[styles.ring, ring]} />
      ))}
      <View style={styles.core}>
        <Icon name="cellphone-nfc" size={44} color={colors.primary} />
      </View>
    </View>
  );
}

function IdentityResult({ identity, cccd }: { identity: CccdIdentity; cccd: string }) {
  const birth = isValidIsoDate(identity.dateOfBirth) ? isoToViDate(identity.dateOfBirth) : '—';
  const rows: [string, string][] = [
    ['Họ và tên', identity.fullName || '—'],
    ['Ngày sinh', birth],
    ['Giới tính', sexLabel(identity.sex)],
    ['Số CCCD', cccd || '—'],
    ['Dân tộc', identity.ethnicity ?? '—'],
    ['Tôn giáo', identity.religion ?? '—'],
    ['Quốc tịch', nationalityLabel(identity.nationality)],
    ['Quê quán', identity.placeOfOrigin ?? '—'],
    ['Nơi thường trú', identity.residence ?? '—'],
    ['Họ tên bố', identity.fatherName ?? '—'],
    ['Họ tên mẹ', identity.motherName ?? '—'],
  ];
  return (
    <Card title="Thông tin đọc từ chip" icon="card-account-details-outline">
      <StatusBadge severity="normal" label={`Xác thực chip: ${identity.authMethod}`} />
      {rows.map(([label, value], i) => (
        <View key={label}>
          {i > 0 ? <Divider /> : null}
          <InfoRow label={label} value={value} mono={label === 'Số CCCD'} />
        </View>
      ))}
    </Card>
  );
}

function InfoRow({
  label,
  value,
  mono,
  accessibilityValue,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accessibilityValue?: string;
}) {
  return (
    <View style={styles.infoRow} accessible accessibilityLabel={`${label}: ${accessibilityValue ?? value}`}>
      <Text style={[type.caption, styles.infoLabel]}>{label}</Text>
      <Text style={[type.bodyStrong, styles.infoValue, mono && styles.monoValue]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { gap: spacing.sm },
  centerText: { textAlign: 'center' },
  footerColumn: { gap: spacing.sm },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  illustration: { alignItems: 'center', paddingVertical: spacing.sm },
  pulse: { width: PULSE_SIZE, height: PULSE_SIZE, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: PULSE_CORE,
    height: PULSE_CORE,
    borderRadius: PULSE_CORE / 2,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  core: {
    width: PULSE_CORE,
    height: PULSE_CORE,
    borderRadius: PULSE_CORE / 2,
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  track: { height: 10, borderRadius: radius.pill, backgroundColor: colors.divider, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
  steps: { gap: spacing.sm, marginTop: spacing.xs },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 28 },
  stepIndicator: { width: 20, height: 20 },
  stepCurrent: { fontWeight: '700', color: colors.primary },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 40, paddingVertical: spacing.xs },
  infoLabel: { width: 104 },
  infoValue: { flex: 1, textAlign: 'right' },
  monoValue: { fontFamily: type.mono.fontFamily, letterSpacing: 1 },
});
