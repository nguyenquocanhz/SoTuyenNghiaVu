import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { bleScaleSource, simulatedScaleSource, type DataSource, type SourceStatus } from '@/ble/sources';
import type { KnownDevice, ScaleReading } from '@/ble/types';
import type { SessionHint, WeightSessionResult, WeightSessionSnapshot } from '@/ble/weightSession';
import { Button, Card, Divider, EmptyState, Icon, InfoBanner, Screen, StatusBadge, type IconName } from '@/components';
import { CountdownRing } from '@/components/charts/CountdownRing';
import { formatNumber, roundTo } from '@/domain/format';
import { recordMeasurement } from '@/domain/physique';
import type { Severity } from '@/domain/types';
import { useWeightMeasurement } from '@/hooks/useWeightMeasurement';
import { useDraftStore } from '@/store/drafts';
import { useSettingsStore } from '@/store/settings';
import { colors, radius, severityPalette, spacing, touchTarget, type } from '@/theme';

const HINTS: Record<SessionHint, { text: string; severity: Severity; icon: IconName }> = {
  step_on: { text: 'Mời công dân bước lên cân', severity: 'info', icon: 'shoe-print' },
  stand_still: { text: 'Đứng yên giữa cân, thả lỏng hai tay…', severity: 'normal', icon: 'human-handsdown' },
  hold_steady: { text: 'Số đo đang dao động – giữ thăng bằng', severity: 'caution', icon: 'scale-balance' },
  stepped_off: { text: 'Công dân đã bước xuống – quá trình đo được đặt lại', severity: 'warning', icon: 'alert' },
  done: { text: 'Đã đo xong', severity: 'normal', icon: 'check-circle' },
};

function sourceStatusText(status: SourceStatus | null, demo: boolean, advertisement: boolean): string {
  switch (status) {
    case 'connecting':
      return 'Đang kết nối với cân…';
    case 'listening':
      if (demo) return 'Đang nhận dữ liệu từ cân mô phỏng';
      return advertisement ? 'Đang lắng nghe tín hiệu phát từ cân' : 'Đã kết nối – đang nhận dữ liệu từ cân';
    case 'disconnected':
      return 'Mất kết nối với cân';
    default:
      return demo ? 'Đang khởi động cân mô phỏng…' : 'Đang chuẩn bị Bluetooth…';
  }
}

export default function MeasureWeightScreen() {
  const params = useLocalSearchParams<{ requestKey?: string; name?: string }>();
  const demoMode = useSettingsStore((s) => s.demoMode);
  const demoWeightKg = useSettingsStore((s) => s.demoWeightKg);
  const scaleDevice = useSettingsStore((s) => s.scaleDevice);
  const updateSettings = useSettingsStore((s) => s.update);

  const source = useMemo<DataSource<ScaleReading> | null>(() => {
    if (demoMode) return simulatedScaleSource(demoWeightKg);
    if (scaleDevice) return bleScaleSource(scaleDevice);
    return null;
  }, [demoMode, demoWeightKg, scaleDevice]);

  if (!source) {
    return (
      <Screen>
        <EmptyState
          icon="scale-bathroom"
          title="Chưa chọn cân Bluetooth"
          message="Chọn cân điện tử Bluetooth của trạm để nhận số đo tự động, hoặc quay lại nhập cân nặng bằng tay."
          action={{ label: 'Chọn cân Bluetooth', icon: 'bluetooth', onPress: () => router.push({ pathname: '/devices', params: { kind: 'scale' } }) }}
        />
        <Button
          title="Dùng cân mô phỏng (thử nghiệm)"
          icon="test-tube"
          variant="secondary"
          onPress={() => updateSettings({ demoMode: true })}
          style={styles.emptySecondary}
        />
      </Screen>
    );
  }

  const sessionKey = demoMode ? `demo:${demoWeightKg}` : `ble:${scaleDevice?.id}:${scaleDevice?.protocolId}`;
  return (
    <WeightSession
      key={sessionKey}
      source={source}
      demoMode={demoMode}
      demoWeightKg={demoWeightKg}
      device={demoMode ? undefined : scaleDevice}
      requestKey={params.requestKey ?? ''}
      citizenName={params.name}
    />
  );
}

function WeightSession({
  source,
  demoMode,
  demoWeightKg,
  device,
  requestKey,
  citizenName,
}: {
  source: DataSource<ScaleReading>;
  demoMode: boolean;
  demoWeightKg: number;
  device?: KnownDevice;
  requestKey: string;
  citizenName?: string;
}) {
  const measureDurationSec = useSettingsStore((s) => s.measureDurationSec);
  const minWeightKg = useSettingsStore((s) => s.minWeightKg);
  const [result, setResult] = useState<WeightSessionResult | null>(null);

  const { status, snapshot, sourceStatus, error, start, cancel } = useWeightMeasurement({
    source,
    durationSec: measureDurationSec,
    minWeightKg,
    onComplete: setResult,
  });

  const begin = () => {
    setResult(null);
    void start();
  };

  const useResult = () => {
    if (!result) return;
    useDraftStore.getState().setWeight({ requestKey, weightKg: roundTo(result.weightKg, 2), source: demoMode ? 'manual' : 'ble' });
    router.back();
  };

  const completed = status === 'completed' && result !== null;

  let footer = null;
  if (status === 'idle') {
    footer = <Button title="Bắt đầu đo" icon="play-circle-outline" size="lg" onPress={begin} />;
  } else if (status === 'connecting' || status === 'active') {
    footer = <Button title="Huỷ" icon="close" variant="secondary" size="lg" onPress={() => void cancel()} />;
  } else if (status === 'error') {
    footer = <Button title="Thử lại" icon="refresh" size="lg" onPress={begin} />;
  } else if (completed) {
    footer = (
      <View style={styles.footerRow}>
        <Button title="Đo lại" icon="refresh" variant="secondary" onPress={begin} style={styles.flex} />
        <Button title="Dùng số đo này" icon="check" onPress={useResult} style={styles.flex} />
      </View>
    );
  }

  const isAdvertisement = device?.transport === 'advertisement';

  return (
    <Screen footer={footer}>
      {demoMode ? (
        <InfoBanner
          severity="caution"
          title="Chế độ mô phỏng đang bật"
          message={`Số đo do ứng dụng giả lập (khoảng ${formatNumber(demoWeightKg, 1)} kg), không phải cân nặng thật. Tắt trong Cài đặt trước khi sơ tuyển.`}
        />
      ) : null}

      {status === 'idle' ? <IdleView durationSec={measureDurationSec} demoMode={demoMode} device={device} citizenName={citizenName} /> : null}

      {status === 'connecting' || status === 'active' ? (
        <ActiveView
          status={status}
          snapshot={snapshot}
          durationSec={measureDurationSec}
          statusText={sourceStatusText(status === 'connecting' ? 'connecting' : sourceStatus, demoMode, isAdvertisement)}
          nonFatalError={error}
        />
      ) : null}

      {status === 'error' ? (
        <>
          <InfoBanner severity="warning" title="Không đo được cân nặng" message={error ?? 'Đã xảy ra lỗi không xác định.'} />
          <Card title="Cách khắc phục" icon="lightbulb-on-outline">
            <Text style={type.body}>• Bật Bluetooth và cấp quyền “Thiết bị ở gần” cho ứng dụng.</Text>
            <Text style={type.body}>• Bật cân (bước nhẹ lên cân để đánh thức) và để điện thoại gần cân.</Text>
            <Text style={type.body}>• Nếu vẫn lỗi, chọn lại cân hoặc quay lại nhập cân nặng bằng tay.</Text>
            <Button
              title="Chọn cân khác"
              icon="bluetooth-settings"
              variant="secondary"
              onPress={() => router.push({ pathname: '/devices', params: { kind: 'scale' } })}
            />
          </Card>
        </>
      ) : null}

      {completed ? (
        <Card title="Kết quả cân" icon="scale-bathroom" tone={result.quality === 'poor' ? 'warning' : 'normal'}>
          <View style={styles.valueRow}>
            <Text style={type.valueLg}>{formatNumber(result.weightKg, 1)}</Text>
            <Text style={type.unit}>kg</Text>
          </View>
          <Text style={type.body}>
            {'Ghi vào phiếu (quy tròn theo Mục IV.1.a): '}
            <Text style={type.bodyStrong}>{`${formatNumber(recordMeasurement(result.weightKg), 0)} kg`}</Text>
          </Text>
          <StatusBadge
            severity={result.quality === 'good' ? 'normal' : result.quality === 'fair' ? 'caution' : 'warning'}
            label={result.quality === 'good' ? 'Số đo ổn định' : result.quality === 'fair' ? 'Dao động ít' : 'Dao động nhiều – nên đo lại'}
          />
          <Text style={type.caption}>
            {`${result.samples} mẫu · dao động ${formatNumber(result.rangeKg, 2)} kg · ${demoMode ? 'cân mô phỏng' : (device?.name ?? 'cân Bluetooth')}`}
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
}

function IdleView({ durationSec, demoMode, device, citizenName }: { durationSec: number; demoMode: boolean; device?: KnownDevice; citizenName?: string }) {
  const steps = [
    'Đặt cân trên nền cứng, bằng phẳng.',
    'Công dân bỏ mũ, giày dép; nam mặc 1 quần đùi, nữ mặc quần dài, áo mỏng (Mục IV.1.b Phụ lục I).',
    'Bước lên và đứng yên giữa cân, hai chân đều lực, thả lỏng hai tay.',
    `Thời gian đo ${durationSec} giây, bắt đầu khi cân nhận được cân nặng; bước xuống giữa chừng sẽ phải đo lại.`,
  ];
  return (
    <>
      <Card title="Hướng dẫn cân" icon="clipboard-list-outline">
        {steps.map((s, i) => (
          <View key={s} style={styles.stepRow}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{i + 1}</Text>
            </View>
            <Text style={[type.body, styles.flex]}>{s}</Text>
          </View>
        ))}
      </Card>
      <Card title="Thiết bị" icon={demoMode ? 'test-tube' : 'bluetooth'}>
        <View style={styles.infoRow}>
          <Icon name="scale-bathroom" size={22} color={colors.primary} />
          <View style={styles.flex}>
            <Text style={type.bodyStrong}>{demoMode ? 'Cân mô phỏng' : (device?.name ?? 'Cân Bluetooth')}</Text>
            <Text style={type.caption}>{demoMode ? 'Chế độ mô phỏng' : (device?.protocolName ?? 'Giao thức không xác định')}</Text>
          </View>
          <Button title="Đổi" variant="ghost" onPress={() => router.push({ pathname: '/devices', params: { kind: 'scale' } })} />
        </View>
        {citizenName ? (
          <>
            <Divider />
            <View style={styles.infoRow}>
              <Icon name="account-outline" size={22} color={colors.primary} />
              <View style={styles.flex}>
                <Text style={type.caption}>Công dân</Text>
                <Text style={type.bodyStrong}>{citizenName}</Text>
              </View>
            </View>
          </>
        ) : null}
      </Card>
    </>
  );
}

function ActiveView({
  status,
  snapshot,
  durationSec,
  statusText,
  nonFatalError,
}: {
  status: 'connecting' | 'active';
  snapshot: WeightSessionSnapshot;
  durationSec: number;
  statusText: string;
  nonFatalError: string | null;
}) {
  const measuring = status === 'active' && snapshot.phase === 'measuring';
  const hint = HINTS[snapshot.hint];
  const hintPalette = severityPalette[hint.severity];
  const ringColor = !measuring
    ? colors.border
    : snapshot.hint === 'hold_steady' || snapshot.hint === 'stepped_off'
      ? hintPalette.fill
      : colors.primary;
  const remainingSec = measuring ? snapshot.remainingMs / 1000 : durationSec;

  return (
    <>
      <Card>
        <View style={styles.statusRow} accessibilityLiveRegion="polite">
          <Icon name={status === 'connecting' ? 'bluetooth' : 'bluetooth-connect'} size={20} color={colors.primary} />
          <Text style={[type.caption, styles.flex]}>{statusText}</Text>
        </View>
        <CountdownRing progress={measuring ? snapshot.progress : 0} remainingSec={remainingSec} size={200} color={ringColor}>
          {measuring ? undefined : (
            <View style={styles.ringCentre}>
              {status === 'connecting' ? <ActivityIndicator color={colors.primary} size="large" /> : <Icon name="scale-bathroom" size={44} color={colors.primary} />}
              <Text style={[type.caption, styles.textCentre]}>
                {status === 'connecting' ? 'Đang kết nối…' : `Đếm ngược ${durationSec} giây khi có cân nặng`}
              </Text>
            </View>
          )}
        </CountdownRing>
        <View style={[styles.hintBox, { backgroundColor: hintPalette.bg, borderColor: hintPalette.fill }]} accessibilityLiveRegion="polite">
          <Icon name={hint.icon} size={24} color={hintPalette.fg} />
          <Text style={[type.bodyStrong, styles.flex, { color: hintPalette.fg }]}>{hint.text}</Text>
        </View>
        <View style={styles.liveBlock}>
          <Text style={type.overline}>Cân nặng hiện tại</Text>
          <View style={styles.valueRow}>
            <Text style={[type.display, snapshot.liveKg === undefined && { color: colors.textMuted }]} numberOfLines={1} adjustsFontSizeToFit>
              {formatNumber(snapshot.liveKg, 1)}
            </Text>
            <Text style={[type.unit, styles.bigUnit]}>kg</Text>
          </View>
        </View>
      </Card>
      {nonFatalError ? <InfoBanner severity="caution" title="Cảnh báo từ thiết bị" message={nonFatalError} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  textCentre: { textAlign: 'center' },
  emptySecondary: { marginHorizontal: spacing.lg },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
  stepRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepNumber: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumberText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: touchTarget },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ringCentre: { alignItems: 'center', gap: spacing.sm, maxWidth: 150 },
  hintBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, minHeight: touchTarget },
  liveBlock: { alignItems: 'center', gap: spacing.xs },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  bigUnit: { fontSize: 22, lineHeight: 28 },
});
