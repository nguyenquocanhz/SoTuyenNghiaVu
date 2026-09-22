import { getNfcAvailability } from '@modules/cccd-nfc';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, EmptyState, Icon, ListRow, MetricTile, Screen, SectionHeader, StatusBadge } from '@/components';
import { formatDate, formatNumber, isoToViDate } from '@/domain/format';
import { OUTCOME_SEVERITY, OUTCOME_SHORT } from '@/domain/screening';
import type { ScreeningOutcome } from '@/domain/types';
import { useDataStore } from '@/store/data';
import { useActiveCampaign, useCampaignScreenings } from '@/store/selectors';
import { colors, radius, spacing, type } from '@/theme';

const STEPS = [
  'Ban chỉ huy quân sự cấp xã lập danh sách, tham mưu Chủ tịch UBND cấp xã gọi khám sơ tuyển.',
  'Khai thác tiền sử bệnh tật bản thân và gia đình.',
  'Phát hiện trường hợp không đủ sức khỏe về thể lực, dị tật, dị dạng (Mục I, II Phụ lục I) và bệnh miễn đăng ký NVQS (Mục III).',
  'Hoàn chỉnh Phiếu sơ tuyển sức khỏe NVQS (Mẫu 2).',
  'Lập danh sách công dân mắc bệnh miễn đăng ký NVQS, báo cáo Hội đồng NVQS cấp xã.',
  'Tổng hợp, thống kê, báo cáo theo Mẫu 2a, Mẫu 2k.',
];

export default function DashboardScreen() {
  const campaign = useActiveCampaign();
  const screenings = useCampaignScreenings(campaign?.id);
  const citizens = useDataStore((s) => s.citizens);
  const nfc = getNfcAvailability();

  if (!campaign) {
    return (
      <Screen>
        <EmptyState
          icon="calendar-plus"
          title="Chưa có đợt sơ tuyển"
          message="Tạo đợt sơ tuyển theo kế hoạch tuyển chọn và gọi công dân nhập ngũ của năm."
          action={{ label: 'Tạo đợt sơ tuyển', icon: 'plus', onPress: () => router.push('/campaign-form') }}
        />
      </Screen>
    );
  }

  const count = (o: ScreeningOutcome) => screenings.filter((s) => s.outcome === o).length;
  const concluded = screenings.length - count('pending');
  const planned = campaign.plannedCount;
  const progress = planned ? Math.min(1, concluded / planned) : undefined;
  const recent = [...screenings].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
  const nameOf = (id: string) => citizens.find((c) => c.id === id);

  return (
    <Screen>
      <Card
        title={campaign.name}
        subtitle={`Bắt đầu ${isoToViDate(campaign.startDate)}${campaign.endDate ? ` · kết thúc ${isoToViDate(campaign.endDate)}` : ''}`}
        icon="calendar-check"
        right={<Button title="Đổi" variant="ghost" onPress={() => router.push('/campaigns')} />}>
        <View style={styles.progressHeader}>
          <Text style={type.body}>Đã kết luận</Text>
          <Text style={type.bodyStrong}>{planned ? `${concluded}/${planned} công dân` : `${concluded} công dân`}</Text>
        </View>
        {progress !== undefined ? (
          <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
            <View style={[styles.fill, { width: `${progress * 100}%` }]} />
          </View>
        ) : (
          <Text style={type.caption}>Nhập số lượng theo kế hoạch trong đợt sơ tuyển để theo dõi tiến độ.</Text>
        )}
      </Card>

      <View style={styles.grid}>
        <MetricTile style={styles.tile} label="Đủ điều kiện" value={formatNumber(count('eligible'), 0)} icon="check-decagram-outline" severity="normal" statusLabel="Chuyển khám tuyển" onPress={() => router.push('/citizens')} />
        <MetricTile style={styles.tile} label="Miễn NVQS" value={formatNumber(count('exempt'), 0)} icon="shield-off-outline" severity="danger" statusLabel="Bệnh Mục III" onPress={() => router.push('/citizens')} />
        <MetricTile style={styles.tile} label="Không đủ ĐK" value={formatNumber(count('other'), 0)} icon="close-octagon-outline" severity="warning" statusLabel="Thể lực, bệnh tật" onPress={() => router.push('/citizens')} />
        <MetricTile style={styles.tile} label="Chưa kết luận" value={formatNumber(count('pending'), 0)} icon="progress-clock" severity="unknown" statusLabel="Cần hoàn thiện phiếu" onPress={() => router.push('/citizens')} />
      </View>

      <View style={styles.actions}>
        {nfc.platformSupported && nfc.supported ? (
          <Button title="Quét CCCD – thêm công dân" icon="cellphone-nfc" size="lg" onPress={() => router.push('/scan-cccd')} />
        ) : null}
        <View style={styles.row}>
          <Button title="Nhập tay" icon="account-plus-outline" variant="secondary" onPress={() => router.push('/citizen-form')} style={styles.flex} />
          <Button title="Danh sách" icon="format-list-bulleted" variant="secondary" onPress={() => router.push('/citizens')} style={styles.flex} />
        </View>
      </View>

      {recent.length ? (
        <>
          <SectionHeader title="Phiếu cập nhật gần đây" />
          <Card>
            {recent.map((s) => {
              const c = nameOf(s.citizenId);
              if (!c) return null;
              return (
                <ListRow
                  key={s.id}
                  title={c.fullName}
                  subtitle={`${isoToViDate(c.birthDate)} · sơ tuyển ${formatDate(`${s.screenedOn}T00:00:00`)}`}
                  icon="account-outline"
                  right={<StatusBadge size="sm" severity={OUTCOME_SEVERITY[s.outcome]} label={OUTCOME_SHORT[s.outcome]} />}
                  onPress={() => router.push({ pathname: '/screening/[citizenId]', params: { citizenId: c.id } })}
                />
              );
            })}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Quy trình sơ tuyển (Điều 7)" />
      <Card>
        {STEPS.map((s, i) => (
          <View key={s} style={styles.step}>
            <View style={styles.stepNo}>
              <Text style={styles.stepNoText}>{i + 1}</Text>
            </View>
            <Text style={[type.body, styles.flex]}>{s}</Text>
          </View>
        ))}
        <View style={styles.legal}>
          <Icon name="scale-balance" size={16} color={colors.textMuted} />
          <Text style={[type.caption, styles.flex]}>Thông tư 105/2023/TT-BQP, sửa đổi bởi Thông tư 106/2025/TT-BQP (hiệu lực 30/9/2025).</Text>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm },
  actions: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexBasis: '47%', flexGrow: 1 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  track: { height: 10, borderRadius: radius.pill, backgroundColor: colors.divider, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.pill },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepNo: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNoText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  legal: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
});
