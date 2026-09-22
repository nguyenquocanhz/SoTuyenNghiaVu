import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Button, Card, Screen, TextField } from '@/components';
import { isoToViDate } from '@/domain/format';
import { collapseSpaces, formatDateInput, parseViDate } from '@/domain/inputs';
import { useDataStore } from '@/store/data';
import { useSettingsStore } from '@/store/settings';

const pad = (n: number) => String(n).padStart(2, '0');
const todayVi = () => {
  const d = new Date();
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

export default function CampaignFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useDataStore((s) => (id ? s.campaigns.find((c) => c.id === id) : undefined));
  const screeningCount = useDataStore((s) => (id ? s.screenings.filter((x) => x.campaignId === id).length : 0));
  const saveCampaign = useDataStore((s) => s.saveCampaign);
  const deleteCampaign = useDataStore((s) => s.deleteCampaign);

  const defaultYear = new Date().getMonth() >= 6 ? new Date().getFullYear() + 1 : new Date().getFullYear();
  const [year, setYear] = useState(String(existing?.year ?? defaultYear));
  const [name, setName] = useState(existing?.name ?? '');
  const [planned, setPlanned] = useState(existing?.plannedCount ? String(existing.plannedCount) : '');
  const [start, setStart] = useState(existing ? isoToViDate(existing.startDate) : todayVi());
  const [end, setEnd] = useState(existing?.endDate ? isoToViDate(existing.endDate) : '');
  const [bookNumber, setBookNumber] = useState(existing?.bookNumber ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [touched, setTouched] = useState(false);

  const yearNum = Number(year);
  const startIso = parseViDate(start);
  const endIso = end.trim() ? parseViDate(end) : undefined;
  const errors = {
    year: /^\d{4}$/.test(year) && yearNum >= 2024 && yearNum <= 2100 ? undefined : 'Năm từ 2024 đến 2100.',
    start: startIso ? undefined : 'Ngày bắt đầu không hợp lệ (dd/mm/yyyy).',
    end: end.trim() && (!endIso || (startIso && endIso < startIso)) ? 'Ngày kết thúc không hợp lệ hoặc trước ngày bắt đầu.' : undefined,
    planned: planned && !/^\d{1,5}$/.test(planned) ? 'Nhập số nguyên.' : undefined,
  };
  const shown: Partial<typeof errors> = touched ? errors : {};

  const save = () => {
    setTouched(true);
    if (Object.values(errors).some(Boolean) || !startIso) return;
    const campaign = saveCampaign(
      {
        year: yearNum,
        name: collapseSpaces(name) || `Sơ tuyển sức khỏe NVQS năm ${yearNum}`,
        plannedCount: planned ? Number(planned) : undefined,
        startDate: startIso,
        endDate: endIso,
        bookNumber: collapseSpaces(bookNumber) || undefined,
        note: note.trim() || undefined,
      },
      existing?.id,
    );
    if (!existing) useSettingsStore.getState().update({ activeCampaignId: campaign.id });
    router.back();
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert(
      'Xoá đợt sơ tuyển?',
      screeningCount
        ? `Đợt này có ${screeningCount} phiếu sơ tuyển. Xoá đợt sẽ xoá toàn bộ phiếu (hồ sơ công dân vẫn giữ lại). Không thể hoàn tác.`
        : 'Không thể hoàn tác.',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: () => {
            deleteCampaign(existing.id);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <Screen footer={<Button title="Lưu" icon="content-save-outline" size="lg" onPress={save} />}>
      <Stack.Screen options={{ title: existing ? 'Sửa đợt sơ tuyển' : 'Đợt sơ tuyển mới' }} />
      <Card title="Kế hoạch tuyển chọn" icon="calendar-range">
        <TextField label="Năm gọi nhập ngũ" value={year} onChangeText={(t) => setYear(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" maxLength={4} error={shown.year} />
        <TextField label="Tên đợt" value={name} onChangeText={setName} placeholder={`Sơ tuyển sức khỏe NVQS năm ${year}`} maxLength={100} />
        <TextField
          label="Số lượng sơ tuyển theo kế hoạch"
          value={planned}
          onChangeText={(t) => setPlanned(t.replace(/\D/g, ''))}
          keyboardType="number-pad"
          hint="Theo danh sách Ban chỉ huy quân sự cấp xã gọi khám (Mẫu 2a, mục 1)."
          error={shown.planned}
        />
        <TextField label="Bắt đầu ngày" value={start} onChangeText={(t) => setStart(formatDateInput(t))} keyboardType="number-pad" placeholder="dd/mm/yyyy" maxLength={10} error={shown.start} />
        <TextField label="Kết thúc ngày" value={end} onChangeText={(t) => setEnd(formatDateInput(t))} keyboardType="number-pad" placeholder="dd/mm/yyyy" maxLength={10} error={shown.end} />
        <TextField label="Quyển số (Sổ thống kê Mẫu 2k)" value={bookNumber} onChangeText={setBookNumber} maxLength={20} />
        <TextField label="Ghi chú" value={note} onChangeText={setNote} multiline maxLength={500} />
      </Card>
      {existing ? <Button title="Xoá đợt sơ tuyển" icon="delete-outline" variant="danger" onPress={remove} /> : null}
    </Screen>
  );
}
