import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Divider, EmptyState, InfoBanner, Screen, StatusBadge } from '@/components';
import { isoToViDate, isValidIsoDate } from '@/domain/format';
import { OUTCOME_LABELS, OUTCOME_SEVERITY } from '@/domain/screening';
import { isBackup, useDataStore, type Backup } from '@/store/data';
import { useSettingsStore } from '@/store/settings';
import { spacing, type } from '@/theme';

/**
 * Nhập dữ liệu qua liên kết `sotuyennghiavu://import?data=<JSON>` (ví dụ mã QR từ máy sơ tuyển khác).
 * Dữ liệu từ liên kết luôn được xem trước và chỉ được gộp khi người dùng xác nhận.
 */
function parse(data: string | undefined): Backup | null {
  if (!data) return null;
  try {
    const value: unknown = JSON.parse(data);
    return isBackup(value) ? value : null;
  } catch {
    return null;
  }
}

const masked = (cccd: string) => (cccd.length > 3 ? `${'•'.repeat(cccd.length - 3)}${cccd.slice(-3)}` : cccd);

export default function ImportScreen() {
  const params = useLocalSearchParams<{ data?: string }>();
  const backup = useMemo(() => parse(params.data), [params.data]);
  const existingCccd = useDataStore((s) => s.citizens.map((c) => c.cccd).join(','));
  const [done, setDone] = useState(false);

  if (!backup) {
    return (
      <Screen>
        <EmptyState icon="file-alert-outline" title="Liên kết không hợp lệ" message="Không đọc được dữ liệu sơ tuyển trong liên kết này." />
      </Screen>
    );
  }

  const merge = () => {
    try {
      const c = useDataStore.getState().merge(backup);
      if (!useSettingsStore.getState().activeCampaignId) {
        useSettingsStore.getState().update({ activeCampaignId: useDataStore.getState().campaigns[0]?.id });
      }
      setDone(true);
      const only = backup.citizens.length === 1 ? useDataStore.getState().citizens.find((x) => x.cccd === backup.citizens[0].cccd) : undefined;
      Alert.alert('Đã gộp dữ liệu', `Công dân: thêm ${c.citizensAdded}, cập nhật ${c.citizensUpdated}. Phiếu: thêm ${c.screeningsAdded}, cập nhật ${c.screeningsUpdated}.`, [
        {
          text: 'OK',
          onPress: () => (only ? router.replace({ pathname: '/citizen/[id]', params: { id: only.id } }) : router.replace('/citizens')),
        },
      ]);
    } catch (e) {
      Alert.alert('Không gộp được', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen footer={<Button title="Gộp vào dữ liệu trên máy" icon="database-plus-outline" size="lg" disabled={done} onPress={merge} />}>
      <InfoBanner
        severity="info"
        title="Kiểm tra trước khi gộp"
        message="Dữ liệu hiện có được giữ nguyên. Công dân trùng số CCCD được bổ sung thông tin; phiếu cùng đợt chỉ thay khi phiếu trong liên kết mới hơn."
      />
      <Card title={`${backup.citizens.length} công dân · ${backup.screenings.length} phiếu`} icon="account-multiple-plus-outline">
        {backup.citizens.map((c, i) => {
          const s = backup.screenings.find((x) => x.citizenId === c.id);
          const campaign = s ? backup.campaigns.find((x) => x.id === s.campaignId) : undefined;
          return (
            <View key={c.id} style={styles.item}>
              {i > 0 ? <Divider /> : null}
              <Text style={type.bodyStrong}>{c.fullName}</Text>
              <Text style={type.caption}>
                {`${isValidIsoDate(c.birthDate) ? isoToViDate(c.birthDate) : '—'} · CCCD ${masked(c.cccd)}${existingCccd.split(',').includes(c.cccd) ? ' · đã có trên máy' : ''}`}
              </Text>
              {s ? (
                <>
                  <Text style={type.caption}>{`${campaign?.name ?? `Năm ${campaign?.year ?? ''}`} · sơ tuyển ${isoToViDate(s.screenedOn)}`}</Text>
                  <StatusBadge size="sm" severity={OUTCOME_SEVERITY[s.outcome]} label={OUTCOME_LABELS[s.outcome]} />
                  {s.outcomeReason ? <Text style={type.body}>{s.outcomeReason}</Text> : null}
                </>
              ) : null}
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { gap: spacing.xs },
});
