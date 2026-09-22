import { getNfcAvailability } from '@modules/cccd-nfc';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button, Card, InfoBanner, Screen, SegmentedControl, TextField, ToggleRow, type SegmentOption } from '@/components';
import { DuplicateCccdError } from '@/db';
import { isoToViDate, isValidIsoDate } from '@/domain/format';
import {
  collapseSpaces,
  decodeCccd,
  formatDateInput,
  formatMonthYearInput,
  isValidMonthYear,
  monthYearKey,
  parseViDate,
  serviceAgeNote,
} from '@/domain/inputs';
import type { Citizen, CitizenSource, Sex } from '@/domain/types';
import { useDataStore, type CitizenInput } from '@/store/data';
import { useDraftStore } from '@/store/drafts';
import { useActiveCampaign } from '@/store/selectors';
import { spacing, type } from '@/theme';

const SEX_OPTIONS: SegmentOption<Sex>[] = [
  { value: 'male', label: 'Nam', icon: 'gender-male' },
  { value: 'female', label: 'Nữ', icon: 'gender-female' },
];

interface FormValues {
  fullName: string;
  birth: string;
  sex: Sex;
  cccd: string;
  occupation: string;
  ethnicity: string;
  religion: string;
  served: boolean;
  servedFrom: string;
  servedTo: string;
  fatherName: string;
  fatherBirthYear: string;
  motherName: string;
  motherBirthYear: string;
  permanentAddress: string;
  currentAddress: string;
  phone: string;
}

const EMPTY: FormValues = {
  fullName: '',
  birth: '',
  sex: 'male',
  cccd: '',
  occupation: '',
  ethnicity: '',
  religion: '',
  served: false,
  servedFrom: '',
  servedTo: '',
  fatherName: '',
  fatherBirthYear: '',
  motherName: '',
  motherBirthYear: '',
  permanentAddress: '',
  currentAddress: '',
  phone: '',
};

function fromCitizen(c: Citizen): FormValues {
  return {
    fullName: c.fullName,
    birth: isValidIsoDate(c.birthDate) ? isoToViDate(c.birthDate) : '',
    sex: c.sex,
    cccd: c.cccd,
    occupation: c.occupation ?? '',
    ethnicity: c.ethnicity ?? '',
    religion: c.religion ?? '',
    served: Boolean(c.servedFrom),
    servedFrom: c.servedFrom ?? '',
    servedTo: c.servedTo ?? '',
    fatherName: c.fatherName ?? '',
    fatherBirthYear: c.fatherBirthYear ?? '',
    motherName: c.motherName ?? '',
    motherBirthYear: c.motherBirthYear ?? '',
    permanentAddress: c.permanentAddress ?? '',
    currentAddress: c.currentAddress ?? '',
    phone: c.phone ?? '',
  };
}

type Errors = Partial<Record<keyof FormValues, string>>;

function validate(v: FormValues, year: number): { errors: Errors; birthIso?: string; warnings: string[] } {
  const errors: Errors = {};
  const warnings: string[] = [];
  if (!collapseSpaces(v.fullName)) errors.fullName = 'Nhập họ và tên.';
  const birthIso = parseViDate(v.birth);
  if (!v.birth.trim()) errors.birth = 'Nhập ngày sinh.';
  else if (!birthIso) errors.birth = 'Ngày sinh không hợp lệ (dd/mm/yyyy).';
  if (!/^\d{12}$/.test(v.cccd)) errors.cccd = 'Số CCCD gồm đúng 12 chữ số.';
  const decoded = decodeCccd(v.cccd);
  if (decoded && birthIso && decoded.birthYear !== Number(birthIso.slice(0, 4))) {
    warnings.push(`Chữ số 4–6 của số CCCD ứng với năm sinh ${decoded.birthYear}, khác ngày sinh đã nhập.`);
  }
  if (decoded && decoded.sex !== v.sex) warnings.push(`Chữ số thứ 4 của số CCCD ứng với giới tính ${decoded.sex === 'male' ? 'nam' : 'nữ'}.`);
  if (birthIso) {
    const note = serviceAgeNote(birthIso, year);
    if (note) warnings.push(note);
  }
  if (v.served) {
    if (!isValidMonthYear(v.servedFrom)) errors.servedFrom = 'Nhập tháng/năm (mm/yyyy).';
    if (!isValidMonthYear(v.servedTo)) errors.servedTo = 'Nhập tháng/năm (mm/yyyy).';
    else if (isValidMonthYear(v.servedFrom) && monthYearKey(v.servedTo) < monthYearKey(v.servedFrom)) {
      errors.servedTo = 'Thời điểm kết thúc phải sau thời điểm bắt đầu.';
    }
  }
  for (const key of ['fatherBirthYear', 'motherBirthYear'] as const) {
    if (v[key] && !/^(19|20)\d{2}$/.test(v[key])) errors[key] = 'Năm sinh gồm 4 chữ số.';
  }
  return { errors, birthIso, warnings };
}

const opt = (s: string) => collapseSpaces(s) || undefined;

export default function CitizenFormScreen() {
  const params = useLocalSearchParams<{ id?: string; next?: string }>();
  const existing = useDataStore((s) => (params.id ? s.citizens.find((c) => c.id === params.id) : undefined));
  const saveCitizen = useDataStore((s) => s.saveCitizen);
  const activeCampaign = useActiveCampaign();
  const year = activeCampaign?.year ?? new Date().getFullYear() + 1;

  const [values, setValues] = useState<FormValues>(() => (existing ? fromCitizen(existing) : EMPTY));
  const [source, setSource] = useState<CitizenSource>(existing?.source ?? 'manual');
  const [touched, setTouched] = useState(false);
  const [chipFilled, setChipFilled] = useState(false);

  // Identity read from the chip arrives through the in-memory draft store.
  useFocusEffect(
    useCallback(() => {
      const id = useDraftStore.getState().consumeIdentity();
      if (!id) return;
      setValues((v) => ({
        ...v,
        fullName: id.fullName || v.fullName,
        birth: isValidIsoDate(id.dateOfBirth) ? isoToViDate(id.dateOfBirth) : v.birth,
        sex: id.sex ?? v.sex,
        cccd: id.cccd || v.cccd,
        ethnicity: id.ethnicity ?? v.ethnicity,
        religion: id.religion ?? v.religion,
        permanentAddress: id.residence ?? v.permanentAddress,
        currentAddress: v.currentAddress || id.residence || '',
        fatherName: id.fatherName ?? v.fatherName,
        motherName: id.motherName ?? v.motherName,
      }));
      setSource('nfc');
      setChipFilled(true);
    }, []),
  );

  const set = <K extends keyof FormValues>(key: K) => (value: FormValues[K]) => setValues((v) => ({ ...v, [key]: value }));
  const { errors, birthIso, warnings } = validate(values, year);
  const shown = touched ? errors : {};
  const nfc = getNfcAvailability();

  const save = () => {
    setTouched(true);
    if (Object.keys(errors).length || !birthIso) return;
    const input: CitizenInput = {
      fullName: collapseSpaces(values.fullName),
      birthDate: birthIso,
      sex: values.sex,
      cccd: values.cccd,
      occupation: opt(values.occupation),
      ethnicity: opt(values.ethnicity),
      religion: opt(values.religion),
      servedFrom: values.served ? values.servedFrom : undefined,
      servedTo: values.served ? values.servedTo : undefined,
      fatherName: opt(values.fatherName),
      fatherBirthYear: opt(values.fatherBirthYear),
      motherName: opt(values.motherName),
      motherBirthYear: opt(values.motherBirthYear),
      permanentAddress: opt(values.permanentAddress),
      currentAddress: opt(values.currentAddress),
      phone: opt(values.phone),
      source,
    };
    try {
      const saved = saveCitizen(input, existing?.id);
      if (existing) router.back();
      else router.replace({ pathname: '/citizen/[id]', params: { id: saved.id } });
    } catch (e) {
      if (e instanceof DuplicateCccdError) {
        Alert.alert('Trùng số CCCD', e.message, [
          { text: 'Đóng', style: 'cancel' },
          { text: 'Mở hồ sơ đó', onPress: () => router.replace({ pathname: '/citizen/[id]', params: { id: e.existingId } }) },
        ]);
      } else {
        Alert.alert('Không lưu được', e instanceof Error ? e.message : String(e));
      }
    }
  };

  return (
    <Screen footer={<Button title={existing ? 'Lưu thay đổi' : 'Lưu hồ sơ'} icon="content-save-outline" size="lg" onPress={save} />}>
      <Stack.Screen options={{ title: existing ? 'Sửa sơ yếu lý lịch' : 'Thêm công dân' }} />

      {chipFilled ? (
        <InfoBanner severity="normal" title="Đã điền từ chip CCCD" message="Kiểm tra lại và bổ sung nghề nghiệp, năm sinh bố mẹ, chỗ ở hiện nay." />
      ) : !existing && nfc.platformSupported && nfc.supported ? (
        <Button title="Quét CCCD gắn chip để điền nhanh" icon="cellphone-nfc" variant="secondary" onPress={() => router.push('/scan-cccd')} />
      ) : null}

      {touched && Object.keys(errors).length ? (
        <InfoBanner severity="warning" message="Còn trường chưa hợp lệ – xem các ô được đánh dấu đỏ." />
      ) : null}
      {warnings.length ? <InfoBanner severity="caution" title="Cần kiểm tra" message={warnings.join('\n')} /> : null}

      <Card title="I. Sơ yếu lý lịch" subtitle="Trường có dấu (*) do công dân khai báo" icon="card-account-details-outline">
        <TextField label="Họ và tên (*)" value={values.fullName} onChangeText={set('fullName')} autoCapitalize="words" maxLength={80} error={shown.fullName} />
        <TextField
          label="Ngày, tháng, năm sinh (*)"
          value={values.birth}
          onChangeText={(t) => set('birth')(formatDateInput(t))}
          placeholder="dd/mm/yyyy"
          keyboardType="number-pad"
          maxLength={10}
          error={shown.birth}
        />
        <SegmentedControl label="Giới tính" options={SEX_OPTIONS} value={values.sex} onChange={set('sex')} />
        <TextField
          label="Số CCCD (*)"
          value={values.cccd}
          onChangeText={(t) => set('cccd')(t.replace(/\D/g, '').slice(0, 12))}
          placeholder="12 chữ số"
          keyboardType="number-pad"
          maxLength={12}
          error={shown.cccd}
        />
        <TextField label="Nghề nghiệp" value={values.occupation} onChangeText={set('occupation')} maxLength={80} />
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="Dân tộc" value={values.ethnicity} onChangeText={set('ethnicity')} autoCapitalize="words" maxLength={40} />
          </View>
          <View style={styles.flex}>
            <TextField label="Tôn giáo" value={values.religion} onChangeText={set('religion')} maxLength={40} />
          </View>
        </View>
      </Card>

      <Card title="Đã phục vụ tại ngũ (*)" icon="shield-star-outline">
        <ToggleRow title="Công dân đã từng phục vụ tại ngũ" value={values.served} onValueChange={set('served')} />
        {values.served ? (
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField
                label="Từ (tháng/năm)"
                value={values.servedFrom}
                onChangeText={(t) => set('servedFrom')(formatMonthYearInput(t))}
                placeholder="mm/yyyy"
                keyboardType="number-pad"
                maxLength={7}
                error={shown.servedFrom}
              />
            </View>
            <View style={styles.flex}>
              <TextField
                label="Đến (tháng/năm)"
                value={values.servedTo}
                onChangeText={(t) => set('servedTo')(formatMonthYearInput(t))}
                placeholder="mm/yyyy"
                keyboardType="number-pad"
                maxLength={7}
                error={shown.servedTo}
              />
            </View>
          </View>
        ) : null}
      </Card>

      <Card title="Gia đình" icon="account-group-outline">
        <View style={styles.row}>
          <View style={styles.wide}>
            <TextField label="Họ và tên bố" value={values.fatherName} onChangeText={set('fatherName')} autoCapitalize="words" maxLength={80} />
          </View>
          <View style={styles.narrow}>
            <TextField
              label="Năm sinh"
              value={values.fatherBirthYear}
              onChangeText={(t) => set('fatherBirthYear')(t.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              error={shown.fatherBirthYear}
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.wide}>
            <TextField label="Họ và tên mẹ" value={values.motherName} onChangeText={set('motherName')} autoCapitalize="words" maxLength={80} />
          </View>
          <View style={styles.narrow}>
            <TextField
              label="Năm sinh"
              value={values.motherBirthYear}
              onChangeText={(t) => set('motherBirthYear')(t.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              error={shown.motherBirthYear}
            />
          </View>
        </View>
        <TextField label="Nơi đăng ký thường trú" value={values.permanentAddress} onChangeText={set('permanentAddress')} multiline maxLength={200} />
        <TextField label="Chỗ ở hiện nay của gia đình" value={values.currentAddress} onChangeText={set('currentAddress')} multiline maxLength={200} />
        <TextField label="Số điện thoại liên hệ" value={values.phone} onChangeText={(t) => set('phone')(t.replace(/[^\d+ ]/g, ''))} keyboardType="phone-pad" maxLength={15} />
      </Card>
      <Text style={type.caption}>Dữ liệu chỉ lưu trên điện thoại này; sao lưu định kỳ trong Cài đặt.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  wide: { flex: 3 },
  narrow: { flex: 1.3 },
});
