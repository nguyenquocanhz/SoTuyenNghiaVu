import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Card,
  CheckRow,
  Divider,
  EmptyState,
  Icon,
  InfoBanner,
  ScoreBadge,
  Screen,
  StatusBadge,
  TextField,
} from '@/components';
import { ageInYears, formatNumber, isoToViDate, parseDecimal } from '@/domain/format';
import { formatDateInput, parseViDate } from '@/domain/inputs';
import { assessScreening, opinionFor, OUTCOME_LABELS, OUTCOME_SEVERITY } from '@/domain/screening';
import type { Citizen, Finding, Score, Screening, ScreeningOutcome } from '@/domain/types';
import { screeningFormsHtml } from '@/reports/forms';
import { sharePdf } from '@/reports/output';
import { EXEMPT_DISEASES } from '@/standards/exemptions';
import { useDataStore, type ScreeningInput } from '@/store/data';
import { useDraftStore } from '@/store/drafts';
import { useActiveCampaign, useCitizen } from '@/store/selectors';
import { useSettingsStore } from '@/store/settings';
import { colors, radius, spacing, touchTarget, type } from '@/theme';

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface FormState {
  screenedOn: string;
  examiner: string;
  height: string;
  weight: string;
  weightSource: 'ble' | 'manual';
  chest: string;
  chestIn: string;
  chestOut: string;
  pulse: string;
  systolic: string;
  diastolic: string;
  systolic2: string;
  diastolic2: string;
  rUnc: string;
  lUnc: string;
  rCor: string;
  lCor: string;
  rD: string;
  lD: string;
  familyHistory: string;
  personalHistory: string;
  healthNote: string;
  findings: Finding[];
  exemptionIds: string[];
  outcome: ScreeningOutcome;
  outcomeReason: string;
  teamOpinion: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const todayVi = () => {
  const d = new Date();
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};
const numText = (v?: number, digits = 1) => (v === undefined ? '' : formatNumber(v, Number.isInteger(v) ? 0 : digits));

function toForm(s: Screening | undefined, examiner: string): FormState {
  const v = s?.vision ?? {};
  return {
    screenedOn: s ? isoToViDate(s.screenedOn) : todayVi(),
    examiner: s?.examiner ?? examiner,
    height: numText(s?.heightCm),
    weight: numText(s?.weightKg, 2),
    weightSource: s?.weightSource ?? 'manual',
    chest: numText(s?.chestCm),
    chestIn: '',
    chestOut: '',
    pulse: numText(s?.pulse),
    systolic: numText(s?.systolic),
    diastolic: numText(s?.diastolic),
    systolic2: numText(s?.systolic2),
    diastolic2: numText(s?.diastolic2),
    rUnc: numText(v.rightUncorrected),
    lUnc: numText(v.leftUncorrected),
    rCor: numText(v.rightCorrected),
    lCor: numText(v.leftCorrected),
    rD: numText(v.rightDiopter, 2),
    lD: numText(v.leftDiopter, 2),
    familyHistory: s?.familyHistory ?? '',
    personalHistory: s?.personalHistory ?? '',
    healthNote: s?.healthNote ?? '',
    findings: s?.findings ?? [],
    exemptionIds: s?.exemptionIds ?? [],
    outcome: s?.outcome ?? 'pending',
    outcomeReason: s?.outcomeReason ?? '',
    teamOpinion: s?.teamOpinion ?? '',
  };
}

type Range = [number, number];
const RANGES = {
  height: [100, 220] as Range,
  weight: [25, 200] as Range,
  chest: [50, 150] as Range,
  pulse: [30, 220] as Range,
  systolic: [60, 260] as Range,
  diastolic: [30, 160] as Range,
  acuity: [0, 20] as Range,
  diopter: [-30, 30] as Range,
};

/** "10", "10/10", "8,5" → tenths. */
const parseAcuity = (t: string) => parseDecimal(t.split('/')[0] ?? '');

function num(t: string, [min, max]: Range, parser = parseDecimal): { value?: number; error?: string } {
  if (!t.trim()) return {};
  const n = parser(t);
  if (n === undefined || !Number.isFinite(n)) return { error: 'Không hợp lệ' };
  if (n < min || n > max) return { error: `Trong khoảng ${min}–${max}` };
  return { value: n };
}

function buildInput(f: FormState, campaignId: string, citizenId: string) {
  const fields = {
    height: num(f.height, RANGES.height),
    weight: num(f.weight, RANGES.weight),
    chest: num(f.chest, RANGES.chest),
    pulse: num(f.pulse, RANGES.pulse),
    systolic: num(f.systolic, RANGES.systolic),
    diastolic: num(f.diastolic, RANGES.diastolic),
    systolic2: num(f.systolic2, RANGES.systolic),
    diastolic2: num(f.diastolic2, RANGES.diastolic),
    rUnc: num(f.rUnc, RANGES.acuity, parseAcuity),
    lUnc: num(f.lUnc, RANGES.acuity, parseAcuity),
    rCor: num(f.rCor, RANGES.acuity, parseAcuity),
    lCor: num(f.lCor, RANGES.acuity, parseAcuity),
    rD: num(f.rD, RANGES.diopter),
    lD: num(f.lD, RANGES.diopter),
  };
  const errors: Partial<Record<keyof typeof fields | 'screenedOn', string>> = {};
  for (const [k, v] of Object.entries(fields)) if (v.error) errors[k as keyof typeof fields] = v.error;
  const screenedOn = parseViDate(f.screenedOn);
  if (!screenedOn) errors.screenedOn = 'Ngày không hợp lệ (dd/mm/yyyy)';
  if (fields.systolic.value !== undefined && fields.diastolic.value !== undefined && fields.diastolic.value >= fields.systolic.value) {
    errors.diastolic = 'HA tối thiểu phải nhỏ hơn HA tối đa';
  }
  if (fields.systolic2.value !== undefined && fields.diastolic2.value !== undefined && fields.diastolic2.value >= fields.systolic2.value) {
    errors.diastolic2 = 'HA tối thiểu phải nhỏ hơn HA tối đa';
  }
  if ((fields.systolic.value === undefined) !== (fields.diastolic.value === undefined)) {
    errors[fields.systolic.value === undefined ? 'systolic' : 'diastolic'] = 'Nhập đủ HA tối đa và tối thiểu';
  }
  if ((fields.systolic2.value === undefined) !== (fields.diastolic2.value === undefined)) {
    errors[fields.systolic2.value === undefined ? 'systolic2' : 'diastolic2'] = 'Nhập đủ HA tối đa và tối thiểu';
  }

  const input: ScreeningInput = {
    campaignId,
    citizenId,
    screenedOn: screenedOn ?? new Date().toISOString().slice(0, 10),
    heightCm: fields.height.value,
    weightKg: fields.weight.value,
    weightSource: fields.weight.value !== undefined ? f.weightSource : undefined,
    chestCm: fields.chest.value,
    pulse: fields.pulse.value,
    systolic: fields.systolic.value,
    diastolic: fields.diastolic.value,
    systolic2: fields.systolic2.value,
    diastolic2: fields.diastolic2.value,
    vision: {
      rightUncorrected: fields.rUnc.value,
      leftUncorrected: fields.lUnc.value,
      rightCorrected: fields.rCor.value,
      leftCorrected: fields.lCor.value,
      rightDiopter: fields.rD.value,
      leftDiopter: fields.lD.value,
    },
    findings: f.findings,
    exemptionIds: f.exemptionIds,
    healthNote: f.healthNote.trim() || undefined,
    familyHistory: f.familyHistory.trim() || undefined,
    personalHistory: f.personalHistory.trim() || undefined,
    outcome: f.outcome,
    outcomeReason: f.outcomeReason.trim() || undefined,
    teamOpinion: f.teamOpinion.trim() || undefined,
    examiner: f.examiner.trim() || undefined,
  };
  return { input, errors };
}

const HISTORY_CHIPS = ['Không', 'Hen phế quản', 'Lao', 'Viêm gan B', 'Tăng huyết áp', 'Động kinh', 'Tâm thần', 'Đái tháo đường', 'Chấn thương sọ não', 'Đã phẫu thuật'];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ScreeningScreen() {
  const params = useLocalSearchParams<{ citizenId: string; campaignId?: string }>();
  const citizen = useCitizen(params.citizenId);
  const active = useActiveCampaign();
  const campaign = useDataStore((s) => (params.campaignId ? s.campaigns.find((c) => c.id === params.campaignId) : undefined)) ?? active;

  if (!citizen || !campaign) {
    return (
      <Screen>
        <EmptyState icon="clipboard-alert-outline" title="Không mở được phiếu" message="Không tìm thấy công dân hoặc đợt sơ tuyển." />
      </Screen>
    );
  }
  return <ScreeningForm key={`${campaign.id}:${citizen.id}`} citizen={citizen} campaignId={campaign.id} campaignYear={campaign.year} />;
}

function ScreeningForm({ citizen, campaignId, campaignYear }: { citizen: Citizen; campaignId: string; campaignYear: number }) {
  const existing = useDataStore((s) => s.screenings.find((x) => x.campaignId === campaignId && x.citizenId === citizen.id));
  const saveScreening = useDataStore((s) => s.saveScreening);
  const defaultExaminer = useSettingsStore((s) => s.examiner);
  const requestKey = `${campaignId}:${citizen.id}`;

  const [form, setForm] = useState<FormState>(() => toForm(existing, defaultExaminer));
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [exporting, setExporting] = useState(false);

  const update = useCallback((patch: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
  }, []);
  const field = (key: keyof FormState) => (text: string) => update({ [key]: text } as Partial<FormState>);

  // Results coming back from the Bluetooth scale and the disease picker.
  useFocusEffect(
    useCallback(() => {
      const drafts = useDraftStore.getState();
      const w = drafts.consumeWeight(requestKey);
      if (w) update({ weight: formatNumber(w.weightKg, 2), weightSource: w.source });
      const finding = drafts.consumeFinding(requestKey);
      if (finding) {
        setForm((f) => ({ ...f, findings: [...f.findings.filter((x) => x.itemId !== finding.itemId), finding] }));
        setDirty(true);
      }
    }, [requestKey, update]),
  );

  const { input, errors } = useMemo(() => buildInput(form, campaignId, citizen.id), [form, campaignId, citizen.id]);
  const assessment = useMemo(
    () => assessScreening(citizen, { ...input, id: '', createdAt: '', updatedAt: '' }),
    [citizen, input],
  );
  const hasErrors = Object.keys(errors).length > 0;

  /** Writes the given form state; returns false when a field is invalid. */
  const persist = useCallback(
    (state: FormState) => {
      const built = buildInput(state, campaignId, citizen.id);
      if (Object.keys(built.errors).length) return false;
      saveScreening(built.input);
      setDirty(false);
      setSavedAt(new Date());
      return true;
    },
    [campaignId, citizen.id, saveScreening],
  );

  // Auto-save shortly after the last edit so nothing is lost at a busy screening station.
  useEffect(() => {
    if (!dirty || hasErrors) return;
    const t = setTimeout(() => persist(form), 800);
    return () => clearTimeout(t);
  }, [dirty, hasErrors, form, persist]);

  const withSuggestion = (state: FormState): FormState => {
    const reason = assessment.suggestedReason ?? '';
    return {
      ...state,
      outcome: assessment.suggestedOutcome,
      outcomeReason: assessment.suggestedOutcome === 'eligible' ? '' : reason,
      teamOpinion: opinionFor(assessment.suggestedOutcome, reason),
    };
  };

  const applySuggestion = () => {
    setForm(withSuggestion(form));
    setDirty(true);
  };

  const finish = () => {
    if (hasErrors) {
      Alert.alert('Còn số liệu chưa hợp lệ', 'Kiểm tra các ô được đánh dấu đỏ.');
      return;
    }
    // Opened by mistake: don't create an empty "chưa kết luận" record.
    if (!dirty && !existing) {
      router.back();
      return;
    }
    persist(form);
    if (form.outcome === 'pending') {
      Alert.alert('Chưa kết luận', `Gợi ý: ${OUTCOME_LABELS[assessment.suggestedOutcome]}.`, [
        { text: 'Để sau', style: 'cancel', onPress: () => router.back() },
        {
          text: 'Áp dụng gợi ý',
          onPress: () => {
            persist(withSuggestion(form));
            router.back();
          },
        },
      ]);
      return;
    }
    router.back();
  };

  const exportPdf = async () => {
    if (!persist(form)) {
      Alert.alert('Còn số liệu chưa hợp lệ', 'Kiểm tra các ô được đánh dấu đỏ.');
      return;
    }
    setExporting(true);
    try {
      const unit = useSettingsStore.getState();
      const screening = useDataStore.getState().screenings.find((x) => x.campaignId === campaignId && x.citizenId === citizen.id);
      await sharePdf(screeningFormsHtml(unit, [{ citizen, screening }]), `Phieu so tuyen ${citizen.fullName}`);
    } catch (e) {
      Alert.alert('Không xuất được phiếu', e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  const openScale = () =>
    router.push({ pathname: '/measure-weight', params: { requestKey, name: citizen.fullName } });

  const openPicker = () => router.push({ pathname: '/disease-picker', params: { requestKey, sex: citizen.sex } });

  const age = ageInYears(citizen.birthDate, new Date(campaignYear, 11, 31));
  const { physique, vision, bloodPressure, pulse } = assessment;
  const vitalsScores = [bloodPressure && !bloodPressure.recorded.needsRemeasure ? bloodPressure.score : undefined, pulse?.score].filter(
    (x): x is Score => x !== undefined,
  );
  const vitalsScore = vitalsScores.length ? (Math.max(...vitalsScores) as Score) : undefined;

  const chestAverage = () => {
    const a = parseDecimal(form.chestIn);
    const b = parseDecimal(form.chestOut);
    if (a === undefined || b === undefined) return;
    update({ chest: formatNumber((a + b) / 2, 1) });
  };

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <Button title="Xuất PDF" icon="file-pdf-box" variant="secondary" loading={exporting} onPress={() => void exportPdf()} style={styles.flex} />
          <Button title="Hoàn tất" icon="check" onPress={finish} style={styles.flex} />
        </View>
      }>
      <Stack.Screen options={{ title: citizen.fullName }} />

      <View style={styles.summary}>
        <View style={styles.flex}>
          <Text style={type.bodyStrong}>{`${citizen.sex === 'male' ? 'Nam' : 'Nữ'} · ${isoToViDate(citizen.birthDate)} · ${age} tuổi (năm ${campaignYear})`}</Text>
          <Text style={type.caption}>{`CCCD ${citizen.cccd}`}</Text>
        </View>
        <View style={styles.saveState} accessibilityLiveRegion="polite">
          <Icon name={hasErrors ? 'alert-circle-outline' : dirty ? 'progress-upload' : 'cloud-check-outline'} size={18} color={hasErrors ? colors.danger : colors.textMuted} />
          <Text style={type.caption}>{hasErrors ? 'Chưa lưu' : dirty ? 'Đang lưu…' : savedAt || existing ? 'Đã lưu' : 'Chưa có phiếu'}</Text>
        </View>
      </View>

      <Card title="Thông tin phiếu" icon="calendar-edit">
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="Ngày sơ tuyển" value={form.screenedOn} onChangeText={(t) => update({ screenedOn: formatDateInput(t) })} keyboardType="number-pad" maxLength={10} error={errors.screenedOn} />
          </View>
          <View style={styles.flex}>
            <TextField label="Người khám" value={form.examiner} onChangeText={field('examiner')} autoCapitalize="words" maxLength={60} />
          </View>
        </View>
      </Card>

      {/* ------------------------------ Thể lực ------------------------------ */}
      <Card title="Thể lực" subtitle="Mục I Phụ lục I · số đo quy tròn theo Mục IV.1.a" icon="human-male-height" right={<ScoreBadge score={physique.score} />}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="Cao đứng" unit="cm" value={form.height} onChangeText={field('height')} keyboardType="decimal-pad" maxLength={6} error={errors.height} />
          </View>
          <View style={styles.flex}>
            <TextField
              label="Cân nặng"
              unit="kg"
              value={form.weight}
              onChangeText={(t) => update({ weight: t, weightSource: 'manual' })}
              keyboardType="decimal-pad"
              maxLength={6}
              error={errors.weight}
              hint={form.weightSource === 'ble' && form.weight ? 'Từ cân Bluetooth' : undefined}
            />
          </View>
        </View>
        <Button title="Cân bằng cân Bluetooth" icon="scale-bathroom" variant="secondary" onPress={openScale} />
        {citizen.sex === 'male' ? (
          <>
            <TextField label="Vòng ngực trung bình" unit="cm" value={form.chest} onChangeText={field('chest')} keyboardType="decimal-pad" maxLength={6} error={errors.chest} />
            <View style={styles.row}>
              <View style={styles.flex}>
                <TextField label="Hít vào tối đa" unit="cm" value={form.chestIn} onChangeText={(t) => setForm((f) => ({ ...f, chestIn: t }))} keyboardType="decimal-pad" maxLength={6} />
              </View>
              <View style={styles.flex}>
                <TextField label="Thở ra tối đa" unit="cm" value={form.chestOut} onChangeText={(t) => setForm((f) => ({ ...f, chestOut: t }))} keyboardType="decimal-pad" maxLength={6} />
              </View>
            </View>
            {form.chestIn && form.chestOut ? <Button title="Tính vòng ngực trung bình" icon="calculator-variant-outline" variant="ghost" onPress={chestAverage} /> : null}
          </>
        ) : null}
        <Button title="Cách đo, quy tròn số đo thể lực" icon="book-open-variant" variant="ghost" onPress={() => router.push({ pathname: '/guide', params: { section: 'physique' } })} />
        {physique.components.length ? (
          <View style={styles.scoreTable}>
            {physique.components.map((c) => (
              <View key={c.criterion} style={styles.scoreRow}>
                <Text style={[type.body, styles.flex]}>{c.label}</Text>
                <Text style={[type.bodyStrong, styles.scoreValue]}>{`${formatNumber(c.value, c.criterion === 'bmi' ? 1 : 0)} ${c.unit}`}</Text>
                <ScoreBadge score={c.score} compact />
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      {/* --------------------------- Mạch, huyết áp --------------------------- */}
      <Card
        title="Mạch, huyết áp"
        subtitle="Số 99, 101 Mục II.8 · đo khi nghỉ"
        icon="heart-pulse"
        right={<ScoreBadge score={vitalsScore} />}>
        <TextField label="Mạch khi nghỉ" unit="lần/phút" value={form.pulse} onChangeText={field('pulse')} keyboardType="number-pad" maxLength={3} error={errors.pulse} />
        <Text style={type.overline}>Huyết áp lần 1</Text>
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="HA tối đa" unit="mmHg" value={form.systolic} onChangeText={field('systolic')} keyboardType="number-pad" maxLength={3} error={errors.systolic} />
          </View>
          <View style={styles.flex}>
            <TextField label="HA tối thiểu" unit="mmHg" value={form.diastolic} onChangeText={field('diastolic')} keyboardType="number-pad" maxLength={3} error={errors.diastolic} />
          </View>
        </View>
        <Text style={type.overline}>Huyết áp lần 2 (cách 1–2 phút)</Text>
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="HA tối đa" unit="mmHg" value={form.systolic2} onChangeText={field('systolic2')} keyboardType="number-pad" maxLength={3} error={errors.systolic2} />
          </View>
          <View style={styles.flex}>
            <TextField label="HA tối thiểu" unit="mmHg" value={form.diastolic2} onChangeText={field('diastolic2')} keyboardType="number-pad" maxLength={3} error={errors.diastolic2} />
          </View>
        </View>
        {pulse ? (
          <View style={styles.scoreRow}>
            <Text style={[type.body, styles.flex]}>{`Mạch ${form.pulse} lần/phút`}</Text>
            <ScoreBadge score={pulse.score} compact />
          </View>
        ) : null}
        {bloodPressure ? (
          <View style={styles.scoreRow}>
            <Text style={[type.body, styles.flex]}>
              {`Ghi nhận ${bloodPressure.recorded.systolic}/${bloodPressure.recorded.diastolic} mmHg${bloodPressure.recorded.readings === 2 ? ' (trung bình)' : ''} · ${bloodPressure.grade}`}
            </Text>
            <ScoreBadge score={bloodPressure.recorded.needsRemeasure ? undefined : bloodPressure.score} compact />
          </View>
        ) : null}
        <Button title="Quy trình đo huyết áp, mạch" icon="book-open-variant" variant="ghost" onPress={() => router.push({ pathname: '/guide', params: { section: 'vitals' } })} />
      </Card>

      {/* ------------------------------ Thị lực ------------------------------ */}
      <Card title="Thị lực" subtitle="Số 1–3 Mục II.1 (sửa đổi bởi TT 106/2025)" icon="eye-outline" right={<ScoreBadge score={vision.score} />}>
        <Text style={type.overline}>Không kính (/10)</Text>
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="Mắt phải" value={form.rUnc} onChangeText={field('rUnc')} keyboardType="decimal-pad" maxLength={5} error={errors.rUnc} />
          </View>
          <View style={styles.flex}>
            <TextField label="Mắt trái" value={form.lUnc} onChangeText={field('lUnc')} keyboardType="decimal-pad" maxLength={5} error={errors.lUnc} />
          </View>
        </View>
        <Text style={type.overline}>Có kính (/10) và độ kính (D)</Text>
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="Mắt phải" value={form.rCor} onChangeText={field('rCor')} keyboardType="decimal-pad" maxLength={5} error={errors.rCor} />
          </View>
          <View style={styles.flex}>
            <TextField label="Độ kính MP" unit="D" value={form.rD} onChangeText={field('rD')} keyboardType="numbers-and-punctuation" maxLength={6} error={errors.rD} placeholder="-2,5" />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="Mắt trái" value={form.lCor} onChangeText={field('lCor')} keyboardType="decimal-pad" maxLength={5} error={errors.lCor} />
          </View>
          <View style={styles.flex}>
            <TextField label="Độ kính MT" unit="D" value={form.lD} onChangeText={field('lD')} keyboardType="numbers-and-punctuation" maxLength={6} error={errors.lD} placeholder="-2,5" />
          </View>
        </View>
        {vision.uncorrectedTotal !== undefined || vision.correctedScore !== undefined ? (
          <View style={styles.scoreTable}>
            {vision.uncorrectedScore !== undefined ? (
              <View style={styles.scoreRow}>
                <Text style={[type.body, styles.flex]}>{`Không kính · tổng ${formatNumber(vision.uncorrectedTotal ?? 0, 1)}/10`}</Text>
                <ScoreBadge score={vision.uncorrectedScore} compact />
              </View>
            ) : null}
            {vision.correctedScore !== undefined ? (
              <View style={styles.scoreRow}>
                <Text style={[type.body, styles.flex]}>Sau chỉnh kính (+1 điểm)</Text>
                <ScoreBadge score={vision.correctedScore} compact />
              </View>
            ) : null}
            {vision.refractionScore !== undefined ? (
              <View style={styles.scoreRow}>
                <Text style={[type.body, styles.flex]}>Độ khúc xạ (số 2, 3)</Text>
                <ScoreBadge score={vision.refractionScore} compact />
              </View>
            ) : null}
            <Text style={[type.caption, vision.needsCorrection && !vision.score ? { color: colors.caution } : null]}>{vision.basis}.</Text>
          </View>
        ) : null}
        <Button title="Cách đo thị lực (TT 106/2025)" icon="book-open-variant" variant="ghost" onPress={() => router.push({ pathname: '/guide', params: { section: 'vision' } })} />
      </Card>

      {/* ----------------------------- Tiền sử ------------------------------ */}
      <Card title="Tiền sử bệnh tật" icon="history">
        <TextField label="Gia đình" value={form.familyHistory} onChangeText={field('familyHistory')} multiline maxLength={400} />
        <HistoryChips onPick={(t) => update({ familyHistory: appendItem(form.familyHistory, t) })} />
        <TextField label="Bản thân" value={form.personalHistory} onChangeText={field('personalHistory')} multiline maxLength={400} />
        <HistoryChips onPick={(t) => update({ personalHistory: appendItem(form.personalHistory, t) })} />
      </Card>

      {/* ------------------------ Bệnh, tật phát hiện ------------------------ */}
      <Card title="Tình trạng sức khỏe và bệnh tật" subtitle="Thể lực, dị tật, dị dạng – Mục II Phụ lục I" icon="stethoscope">
        {form.findings.length === 0 ? <Text style={type.body}>Chưa ghi nhận bệnh, tật.</Text> : null}
        {form.findings.map((f, i) => (
          <View key={f.itemId}>
            {i > 0 ? <Divider /> : null}
            <FindingRow
              finding={f}
              onChange={(next) => update({ findings: form.findings.map((x) => (x.itemId === f.itemId ? next : x)) })}
              onRemove={() => update({ findings: form.findings.filter((x) => x.itemId !== f.itemId) })}
            />
          </View>
        ))}
        <Button title="Thêm bệnh, tật theo danh mục" icon="plus" variant="secondary" onPress={openPicker} />
        <TextField label="Ghi chú thêm" value={form.healthNote} onChangeText={field('healthNote')} multiline maxLength={400} />
      </Card>

      <Card title="Bệnh miễn đăng ký NVQS" subtitle="Mục III Phụ lục I – không nhận vào quân thường trực" icon="shield-off-outline">
        {EXEMPT_DISEASES.map((d) => {
          const checked = form.exemptionIds.includes(d.id);
          return (
            <CheckRow
              key={d.id}
              title={`${d.no}. ${d.name}`}
              subtitle={d.icd10 ? `ICD-10: ${d.icd10}` : undefined}
              checked={checked}
              onPress={() => update({ exemptionIds: checked ? form.exemptionIds.filter((x) => x !== d.id) : [...form.exemptionIds, d.id] })}
            />
          );
        })}
      </Card>

      {/* ----------------------------- Kết luận ----------------------------- */}
      <Card title="Gợi ý của ứng dụng" icon="lightbulb-on-outline" tone={OUTCOME_SEVERITY[assessment.suggestedOutcome]}>
        <StatusBadge severity={OUTCOME_SEVERITY[assessment.suggestedOutcome]} label={OUTCOME_LABELS[assessment.suggestedOutcome]} />
        {assessment.failures.length ? (
          <View style={styles.scoreTable}>
            {assessment.failures.map((f) => (
              <View key={f.text} style={styles.failureRow}>
                <Icon name="close-circle-outline" size={18} color={colors.warning} />
                <Text style={[type.body, styles.flex]}>{f.text}</Text>
              </View>
            ))}
          </View>
        ) : assessment.suggestedReason ? (
          <Text style={type.body}>{assessment.suggestedReason}</Text>
        ) : null}
        {assessment.failures.length && assessment.missing.length ? (
          <Text style={type.caption}>{`Còn thiếu: ${assessment.missing.join('; ')}.`}</Text>
        ) : null}
        {assessment.preliminaryScore ? (
          <Text style={type.body}>
            {'Phân loại sơ bộ (tham khảo): '}
            <Text style={type.bodyStrong}>{`loại ${assessment.preliminaryScore}${assessment.preliminaryTemporary ? 'T' : ''}`}</Text>
          </Text>
        ) : null}
        {assessment.warnings.length ? <InfoBanner severity="caution" title="Lưu ý" message={assessment.warnings.map((w) => `• ${w}`).join('\n')} /> : null}
        <Button title="Áp dụng gợi ý vào kết luận" icon="arrow-down-bold-box-outline" variant="secondary" onPress={applySuggestion} />
        <Text style={type.caption}>
          Căn cứ: đạt sức khỏe loại 1, 2, 3 (Điều 4); loại theo chỉ tiêu có điểm cao nhất (Điều 6). Kết luận do Tổ sơ tuyển quyết định; phân loại chính thức do Hội đồng khám sức khỏe khu vực thực hiện.
        </Text>
      </Card>

      <Card title="III. Ý kiến tổ sơ tuyển" icon="account-tie-outline">
        {(['eligible', 'exempt', 'other', 'pending'] as ScreeningOutcome[]).map((o) => (
          <CheckRow key={o} radio title={OUTCOME_LABELS[o]} checked={form.outcome === o} onPress={() => update({ outcome: o })} />
        ))}
        {form.outcome !== 'eligible' ? (
          <TextField label={form.outcome === 'pending' ? 'Còn thiếu' : 'Lý do'} value={form.outcomeReason} onChangeText={field('outcomeReason')} multiline maxLength={300} />
        ) : null}
        <TextField label="Ý kiến tổ sơ tuyển (in trên phiếu)" value={form.teamOpinion} onChangeText={field('teamOpinion')} multiline maxLength={600} />
        {form.outcome !== 'pending' || form.outcomeReason.trim() ? (
          <Button title="Điền ý kiến theo kết luận" icon="text-box-edit-outline" variant="ghost" onPress={() => update({ teamOpinion: opinionFor(form.outcome, form.outcomeReason.trim()) })} />
        ) : null}
      </Card>
    </Screen>
  );
}

function appendItem(text: string, item: string): string {
  const t = text.trim();
  if (item === 'Không') return 'Không';
  if (!t || t === 'Không') return item;
  return t.split(/;\s*/).includes(item) ? t : `${t}; ${item}`;
}

function HistoryChips({ onPick }: { onPick: (text: string) => void }) {
  return (
    <View style={styles.chips}>
      {HISTORY_CHIPS.map((c) => (
        <Pressable key={c} onPress={() => onPick(c)} accessibilityRole="button" accessibilityLabel={`Thêm ${c}`} style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}>
          <Text style={styles.chipText}>{c}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function FindingRow({ finding, onChange, onRemove }: { finding: Finding; onChange: (f: Finding) => void; onRemove: () => void }) {
  const scores: Score[] = [1, 2, 3, 4, 5, 6];
  return (
    <View style={styles.finding}>
      <View style={styles.findingHeader}>
        <Text style={[type.bodyStrong, styles.flex]}>{finding.label}</Text>
        <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Bỏ ${finding.label}`} hitSlop={12} style={styles.iconButton}>
          <Icon name="close" size={22} color={colors.danger} />
        </Pressable>
      </View>
      <View style={styles.scorePicker} accessibilityRole="radiogroup">
        {scores.map((s) => {
          const selected = finding.score === s;
          return (
            <Pressable
              key={s}
              onPress={() => onChange({ ...finding, score: s })}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`Điểm ${s}`}
              style={[styles.scoreOption, selected && styles.scoreOptionSelected]}>
              <Text style={[styles.scoreOptionText, selected && styles.scoreOptionTextSelected]}>{s}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => onChange({ ...finding, temporary: !finding.temporary })}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: finding.temporary }}
          accessibilityLabel="Tạm thời (T)"
          style={[styles.scoreOption, styles.tOption, finding.temporary && styles.scoreOptionSelected]}>
          <Text style={[styles.scoreOptionText, finding.temporary && styles.scoreOptionTextSelected]}>T</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm },
  footer: { flexDirection: 'row', gap: spacing.sm },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  saveState: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  scoreTable: { gap: spacing.xs, paddingTop: spacing.xs },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 32 },
  failureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  scoreValue: { minWidth: 80, textAlign: 'right' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { paddingHorizontal: spacing.md, minHeight: 36, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  chipPressed: { backgroundColor: colors.primarySoft },
  chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  finding: { gap: spacing.sm, paddingVertical: spacing.sm },
  findingHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  iconButton: { minWidth: touchTarget, minHeight: 32, alignItems: 'flex-end' },
  scorePicker: { flexDirection: 'row', gap: spacing.xs },
  scoreOption: { flex: 1, minHeight: 40, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  tOption: { marginLeft: spacing.sm },
  scoreOptionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  scoreOptionText: { fontSize: 16, fontWeight: '700', color: colors.text },
  scoreOptionTextSelected: { color: colors.onPrimary },
});
