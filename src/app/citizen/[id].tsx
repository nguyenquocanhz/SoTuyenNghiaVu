import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Divider, EmptyState, ListRow, Screen, SectionHeader, StatusBadge } from '@/components';
import { ageInYears, formatDate, isoToViDate } from '@/domain/format';
import { OUTCOME_LABELS, OUTCOME_SEVERITY, OUTCOME_SHORT } from '@/domain/screening';
import { screeningFormsHtml } from '@/reports/forms';
import { printHtml, sharePdf } from '@/reports/output';
import { useDataStore } from '@/store/data';
import { useActiveCampaign, useCitizen, useScreening } from '@/store/selectors';
import { useSettingsStore } from '@/store/settings';
import { spacing, type } from '@/theme';

export default function CitizenDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const citizen = useCitizen(id);
  const campaign = useActiveCampaign();
  const current = useScreening(campaign?.id, id);
  const campaigns = useDataStore((s) => s.campaigns);
  const history = useDataStore(useShallow((s) => s.screenings.filter((x) => x.citizenId === id && x.campaignId !== campaign?.id)));
  const deleteCitizen = useDataStore((s) => s.deleteCitizen);
  const [busy, setBusy] = useState<'print' | 'share' | null>(null);

  if (!citizen) {
    return (
      <Screen>
        <EmptyState icon="account-question-outline" title="Không tìm thấy công dân" message="Hồ sơ có thể đã bị xoá." />
      </Screen>
    );
  }

  const rows: [string, string | undefined][] = [
    ['Ngày sinh', `${isoToViDate(citizen.birthDate)}${campaign ? ` · ${ageInYears(citizen.birthDate, new Date(campaign.year, 11, 31))} tuổi năm ${campaign.year}` : ''}`],
    ['Giới tính', citizen.sex === 'male' ? 'Nam' : 'Nữ'],
    ['Số CCCD', citizen.cccd],
    ['Nghề nghiệp', citizen.occupation],
    ['Dân tộc', citizen.ethnicity],
    ['Đã phục vụ tại ngũ', citizen.servedFrom ? `${citizen.servedFrom} – ${citizen.servedTo ?? ''}` : 'Chưa'],
    ['Bố', citizen.fatherName ? `${citizen.fatherName}${citizen.fatherBirthYear ? ` (${citizen.fatherBirthYear})` : ''}` : undefined],
    ['Mẹ', citizen.motherName ? `${citizen.motherName}${citizen.motherBirthYear ? ` (${citizen.motherBirthYear})` : ''}` : undefined],
    ['Thường trú', citizen.permanentAddress],
    ['Chỗ ở hiện nay', citizen.currentAddress],
    ['Điện thoại', citizen.phone],
  ];

  const outputForm = async (mode: 'print' | 'share') => {
    setBusy(mode);
    try {
      const html = screeningFormsHtml(useSettingsStore.getState(), [{ citizen, screening: current }]);
      if (mode === 'print') await printHtml(html);
      else await sharePdf(html, `Phieu so tuyen ${citizen.fullName}`);
    } catch (e) {
      Alert.alert('Không xuất được phiếu', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = () =>
    Alert.alert('Xoá công dân?', `Xoá hồ sơ ${citizen.fullName} và mọi phiếu sơ tuyển của công dân này. Không thể hoàn tác.`, [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: () => {
          deleteCitizen(citizen.id);
          router.back();
        },
      },
    ]);

  return (
    <Screen
      footer={
        campaign ? (
          <View style={styles.footer}>
            <Button
              title={current ? 'Mở phiếu sơ tuyển' : 'Lập phiếu sơ tuyển'}
              icon="clipboard-pulse-outline"
              size="lg"
              onPress={() => router.push({ pathname: '/screening/[citizenId]', params: { citizenId: citizen.id } })}
            />
          </View>
        ) : undefined
      }>
      <Stack.Screen options={{ title: citizen.fullName }} />

      {campaign ? (
        <Card title={campaign.name} icon="clipboard-text-outline" tone={current ? OUTCOME_SEVERITY[current.outcome] : 'info'}>
          {current ? (
            <>
              <StatusBadge severity={OUTCOME_SEVERITY[current.outcome]} label={OUTCOME_LABELS[current.outcome]} />
              {current.outcomeReason ? <Text style={type.body}>{current.outcomeReason}</Text> : null}
              <Text style={type.caption}>{`Sơ tuyển ngày ${isoToViDate(current.screenedOn)}${current.examiner ? ` · ${current.examiner}` : ''}`}</Text>
            </>
          ) : (
            <Text style={type.body}>Chưa lập phiếu sơ tuyển trong đợt này.</Text>
          )}
          <Text style={type.overline}>Phiếu sơ tuyển (Mẫu 2)</Text>
          <View style={styles.buttons}>
            <Button
              title="In / Lưu PDF"
              icon="printer-outline"
              variant="secondary"
              loading={busy === 'print'}
              disabled={busy !== null}
              onPress={() => void outputForm('print')}
              accessibilityHint="Mở hộp thoại in: chọn máy in hoặc Lưu dưới dạng PDF"
              style={styles.flex}
            />
            <Button
              title="Chia sẻ PDF"
              icon="share-variant-outline"
              variant="secondary"
              loading={busy === 'share'}
              disabled={busy !== null}
              onPress={() => void outputForm('share')}
              style={styles.flex}
            />
          </View>
        </Card>
      ) : null}

      <Card
        title="Sơ yếu lý lịch"
        icon="card-account-details-outline"
        right={<Button title="Sửa" variant="ghost" onPress={() => router.push({ pathname: '/citizen-form', params: { id: citizen.id } })} />}>
        {rows.map(([label, value], i) => (
          <View key={label}>
            {i > 0 ? <Divider /> : null}
            <View style={styles.infoRow}>
              <Text style={[type.caption, styles.label]}>{label}</Text>
              <Text style={[type.body, styles.value]}>{value || '—'}</Text>
            </View>
          </View>
        ))}
        <Text style={type.caption}>{`Nguồn: ${citizen.source === 'nfc' ? 'đọc chip CCCD' : citizen.source === 'import' ? 'nhập từ tệp' : 'nhập tay'} · cập nhật ${formatDate(citizen.updatedAt)}`}</Text>
      </Card>

      {history.length ? (
        <>
          <SectionHeader title="Các đợt sơ tuyển trước" />
          <Card>
            {history.map((s) => {
              const c = campaigns.find((x) => x.id === s.campaignId);
              return (
                <ListRow
                  key={s.id}
                  title={c?.name ?? 'Đợt đã xoá'}
                  subtitle={`${isoToViDate(s.screenedOn)} · ${OUTCOME_LABELS[s.outcome]}`}
                  icon="history"
                  right={<StatusBadge size="sm" severity={OUTCOME_SEVERITY[s.outcome]} label={OUTCOME_SHORT[s.outcome]} />}
                  onPress={() => router.push({ pathname: '/screening/[citizenId]', params: { citizenId: citizen.id, campaignId: s.campaignId } })}
                />
              );
            })}
          </Card>
        </>
      ) : null}

      <Button title="Xoá công dân" icon="delete-outline" variant="danger" onPress={remove} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: spacing.sm },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  infoRow: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm },
  label: { width: 112 },
  value: { flex: 1, textAlign: 'right' },
});
