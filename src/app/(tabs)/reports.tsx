import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button, Card, EmptyState, InfoBanner, Screen, TextField } from '@/components';
import { fold } from '@/domain/search';
import type { Screening } from '@/domain/types';
import { book2kCsv, book2kHtml, campaignStats, exemptListHtml, report2aHtml, screeningFormsHtml, type BookRow } from '@/reports/forms';
import { printHtml, safeFileName, sharePdf, shareText } from '@/reports/output';
import { useDataStore } from '@/store/data';
import { useActiveCampaign, useCampaignScreenings } from '@/store/selectors';
import { useSettingsStore } from '@/store/settings';
import { spacing, type } from '@/theme';

type Job = '2a' | '2k' | 'csv' | 'exempt' | 'forms' | 'print';

export default function ReportsScreen() {
  const campaign = useActiveCampaign();
  const screenings = useCampaignScreenings(campaign?.id);
  const citizens = useDataStore((s) => s.citizens);
  const [busy, setBusy] = useState<Job | null>(null);
  const [recipients, setRecipients] = useState('Ban chỉ huy quân sự cấp xã\nHội đồng nghĩa vụ quân sự cấp xã');
  const [council, setCouncil] = useState('Hội đồng nghĩa vụ quân sự xã');

  const rows = useMemo<BookRow[]>(() => {
    const byId = new Map(citizens.map((c) => [c.id, c]));
    return screenings
      .map((s) => ({ citizen: byId.get(s.citizenId), screening: s }))
      .filter((r): r is { citizen: NonNullable<typeof r.citizen>; screening: Screening } => r.citizen !== undefined)
      .sort((a, b) => a.screening.screenedOn.localeCompare(b.screening.screenedOn) || fold(a.citizen.fullName).localeCompare(fold(b.citizen.fullName)));
  }, [citizens, screenings]);

  if (!campaign) {
    return (
      <Screen>
        <EmptyState icon="file-document-outline" title="Chưa có đợt sơ tuyển" action={{ label: 'Tạo đợt sơ tuyển', icon: 'plus', onPress: () => router.push('/campaign-form') }} />
      </Screen>
    );
  }

  const stats = campaignStats(campaign, screenings);
  const concluded = rows.filter((r) => r.screening.outcome !== 'pending');
  const exemptRows = rows.filter((r) => r.screening.outcome === 'exempt' || r.screening.exemptionIds.length > 0);

  const run = async (job: Job, task: () => Promise<void>) => {
    setBusy(job);
    try {
      await task();
    } catch (e) {
      Alert.alert('Không xuất được báo cáo', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const unit = () => useSettingsStore.getState();
  const year = campaign.year;

  return (
    <Screen>
      <Card title={campaign.name} icon="chart-box-outline">
        <View style={styles.statRow}>
          <Stat label="Theo kế hoạch" value={stats.planned ?? '—'} />
          <Stat label="Đã sơ tuyển" value={stats.screened} />
          <Stat label="Đủ điều kiện" value={stats.eligible} />
        </View>
        <View style={styles.statRow}>
          <Stat label="Miễn NVQS" value={stats.exempt} />
          <Stat label="Lý do khác" value={stats.other} />
          <Stat label="Chưa kết luận" value={stats.pending} />
        </View>
        {stats.pending ? <InfoBanner severity="caution" message={`Còn ${stats.pending} phiếu chưa kết luận – không được tính vào số đã sơ tuyển.`} /> : null}
      </Card>

      <Card title="Mẫu 2a – Báo cáo kết quả sơ tuyển" subtitle="Phụ lục II Thông tư 106/2025/TT-BQP · Trạm y tế cấp xã" icon="file-chart-outline">
        <TextField label="Nơi nhận (mỗi dòng một nơi)" value={recipients} onChangeText={setRecipients} multiline maxLength={300} />
        <View style={styles.buttons}>
          <Button
            title="In / Lưu PDF"
            icon="printer-outline"
            variant="secondary"
            disabled={busy !== null}
            onPress={() => void run('print', () => printHtml(report2aHtml(unit(), campaign, stats, new Date(), recipients.trim())))}
            style={styles.flex}
          />
          <Button
            title="Chia sẻ PDF"
            icon="share-variant-outline"
            loading={busy === '2a'}
            disabled={busy !== null}
            onPress={() => void run('2a', () => sharePdf(report2aHtml(unit(), campaign, stats, new Date(), recipients.trim()), `Bao cao ket qua so tuyen NVQS ${year}`))}
            style={styles.flex}
          />
        </View>
      </Card>

      <Card title="Mẫu 2k – Sổ thống kê sơ tuyển" subtitle={`${concluded.length} dòng đã kết luận · khổ A4 ngang`} icon="book-open-outline">
        <View style={styles.buttons}>
          <Button
            title="In"
            icon="printer-outline"
            variant="secondary"
            disabled={busy !== null || rows.length === 0}
            onPress={() => void run('print', () => printHtml(book2kHtml(unit(), campaign, concluded), 'landscape'))}
            style={styles.flex}
          />
          <Button
            title="PDF"
            icon="file-pdf-box"
            loading={busy === '2k'}
            disabled={busy !== null || rows.length === 0}
            onPress={() => void run('2k', () => sharePdf(book2kHtml(unit(), campaign, concluded), `So thong ke so tuyen NVQS ${year}`, 'landscape'))}
            style={styles.flex}
          />
          <Button
            title="Excel (CSV)"
            icon="microsoft-excel"
            variant="secondary"
            loading={busy === 'csv'}
            disabled={busy !== null || rows.length === 0}
            onPress={() =>
              void run('csv', () => shareText(book2kCsv(rows), `${safeFileName(`So thong ke so tuyen NVQS ${year}`)}.csv`, 'text/csv', `Sổ thống kê sơ tuyển ${year}`))
            }
            style={styles.flex}
          />
        </View>
        <Text style={type.caption}>Tệp CSV gồm cả phiếu chưa kết luận, mở được bằng Excel/Google Sheets.</Text>
      </Card>

      <Card title="Danh sách bệnh miễn đăng ký NVQS" subtitle={`Điểm d khoản 3 Điều 7 · ${exemptRows.length} công dân`} icon="shield-account-outline">
        <TextField label="Kính gửi" value={council} onChangeText={setCouncil} maxLength={120} />
        <View style={styles.buttons}>
          <Button
            title="In / Lưu PDF"
            icon="printer-outline"
            variant="secondary"
            disabled={busy !== null}
            onPress={() => void run('print', () => printHtml(exemptListHtml(unit(), campaign, exemptRows, new Date(), council.trim())))}
            style={styles.flex}
          />
          <Button
            title="Chia sẻ PDF"
            icon="share-variant-outline"
            loading={busy === 'exempt'}
            disabled={busy !== null}
            onPress={() => void run('exempt', () => sharePdf(exemptListHtml(unit(), campaign, exemptRows, new Date(), council.trim()), `Danh sach benh mien dang ky NVQS ${year}`))}
            style={styles.flex}
          />
        </View>
      </Card>

      <Card title="Mẫu 2 – In hàng loạt phiếu sơ tuyển" subtitle={`${rows.length} phiếu trong đợt`} icon="printer-outline">
        <View style={styles.buttons}>
          <Button
            title="In tất cả"
            icon="printer-outline"
            variant="secondary"
            disabled={busy !== null || rows.length === 0}
            onPress={() => void run('print', () => printHtml(screeningFormsHtml(unit(), rows)))}
            style={styles.flex}
          />
          <Button
            title="Chia sẻ PDF"
            icon="file-multiple-outline"
            variant="secondary"
            loading={busy === 'forms'}
            disabled={busy !== null || rows.length === 0}
            onPress={() => void run('forms', () => sharePdf(screeningFormsHtml(unit(), rows), `Phieu so tuyen NVQS ${year}`))}
            style={styles.flex}
          />
        </View>
      </Card>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={type.valueMd}>{value}</Text>
      <Text style={type.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  buttons: { flexDirection: 'row', gap: spacing.sm },
});
