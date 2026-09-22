import { Stack, router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { identifyByServices } from '@/ble/protocols';
import { bleTransport } from '@/ble/transport';
import { ADAPTER_STATE_TEXT, BleUnavailableError, type AdapterState } from '@/ble/transportTypes';
import type { DeviceKind, KnownDevice, ProtocolMatch, TransportMode } from '@/ble/types';
import { Button, Card, Divider, Icon, InfoBanner, SectionHeader, ToggleRow, type IconName, Screen } from '@/components';
import { formatNumber } from '@/domain/format';
import { useDeviceScanner, SCAN_DURATION_MS, type ScannedDevice } from '@/hooks/useDeviceScanner';
import { useSettingsStore } from '@/store/settings';
import { colors, radius, spacing, touchTarget, type } from '@/theme';

const KIND_TEXT: Record<DeviceKind, { title: string; noun: string; icon: IconName; services: string }> = {
  scale: {
    title: 'Chọn cân Bluetooth',
    noun: 'cân',
    icon: 'scale-bathroom',
    services: 'Weight Scale / Body Composition',
  },
  thermometer: {
    title: 'Chọn nhiệt kế Bluetooth',
    noun: 'nhiệt kế',
    icon: 'thermometer',
    services: 'Health Thermometer',
  },
};

const TRANSPORT_TEXT: Record<TransportMode, string> = {
  advertisement: 'Nhận số đo qua quảng bá, không cần kết nối',
  gatt: 'Kết nối trực tiếp (GATT)',
};

const UNNAMED = 'Không tên';
const OTHERS_PREVIEW = 8;

function displayName(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed : UNNAMED;
}

function signalInfo(rssi: number | null): { icon: IconName; label: string } {
  if (rssi === null) return { icon: 'signal-cellular-outline', label: 'không rõ' };
  if (rssi >= -60) return { icon: 'signal-cellular-3', label: 'mạnh' };
  if (rssi >= -75) return { icon: 'signal-cellular-2', label: 'khá' };
  if (rssi >= -90) return { icon: 'signal-cellular-1', label: 'yếu' };
  return { icon: 'signal-cellular-outline', label: 'rất yếu' };
}

function adapterSeverity(state: AdapterState) {
  if (state === 'unknown') return 'info' as const;
  if (state === 'unsupported') return 'warning' as const;
  return 'caution' as const;
}

function openBluetoothSettings() {
  if (Platform.OS === 'android') {
    Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS').catch(() => {
      void Linking.openSettings().catch(() => {});
    });
  } else {
    void Linking.openSettings().catch(() => {});
  }
}

export default function DevicesScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind: DeviceKind = params.kind === 'thermometer' ? 'thermometer' : 'scale';
  const text = KIND_TEXT[kind];

  const current = useSettingsStore((s) => (kind === 'scale' ? s.scaleDevice : undefined));
  const demoMode = useSettingsStore((s) => s.demoMode);
  const updateSettings = useSettingsStore((s) => s.update);

  const { scanning, devices, error, start, stop } = useDeviceScanner();
  const [adapterState, setAdapterState] = useState<AdapterState>(bleTransport.isSupported ? 'unknown' : 'unsupported');
  const [probingId, setProbingId] = useState<string | null>(null);
  const [showAllOthers, setShowAllOthers] = useState(false);

  useEffect(() => bleTransport.onStateChange(setAdapterState), []);

  // Start looking right away the first time Bluetooth is ready and nothing is selected yet.
  const autoStartedRef = useRef(false);
  const hasCurrent = Boolean(current);
  useEffect(() => {
    if (autoStartedRef.current || adapterState !== 'powered_on' || hasCurrent) return;
    autoStartedRef.current = true;
    void start();
  }, [adapterState, hasCurrent, start]);

  // The radio went away (turned off, permission revoked): end the scan cleanly.
  useEffect(() => {
    if (scanning && adapterState !== 'powered_on' && adapterState !== 'unknown') void stop();
  }, [adapterState, scanning, stop]);

  const compatible = devices.filter((d) => d.match?.kind === kind);
  const others = devices.filter((d) => !d.match && d.name?.trim());
  const visibleOthers = showAllOthers ? others : others.slice(0, OTHERS_PREVIEW);

  const saveDevice = (device: KnownDevice | undefined) => {
    if (kind === 'scale') updateSettings({ scaleDevice: device });
  };

  const select = async (id: string, name: string | null, match: ProtocolMatch) => {
    await stop();
    saveDevice({
      id,
      name: displayName(name),
      protocolId: match.protocolId,
      protocolName: match.protocolName,
      kind: match.kind,
      transport: match.transport,
    });
    if (router.canGoBack()) router.back();
    else router.replace('/' as Href);
  };

  const probe = async (device: ScannedDevice) => {
    if (probingId) return;
    const name = displayName(device.name);
    setProbingId(device.id);
    try {
      await stop();
      const uuids = await bleTransport.probeServices(device.id);
      const match = identifyByServices(uuids);
      if (match && match.kind === kind) {
        await select(device.id, device.name, match);
        return;
      }
      Alert.alert(
        'Thiết bị không tương thích',
        match
          ? `“${name}” là ${KIND_TEXT[match.kind].noun} (${match.protocolName}), không phải ${text.noun}. Hãy chọn thiết bị khác.`
          : `“${name}” không có dịch vụ ${text.services} theo chuẩn Bluetooth nên ứng dụng không đọc được số đo từ thiết bị này.`,
      );
    } catch (e) {
      Alert.alert(
        'Không kết nối được',
        e instanceof BleUnavailableError
          ? e.message
          : `Không thể kết nối tới “${name}”. Hãy bật thiết bị, để gần điện thoại (dưới 2 m) rồi thử lại.`,
      );
    } finally {
      setProbingId(null);
    }
  };

  const adapterBanner = !bleTransport.isSupported ? (
    <InfoBanner
      severity="info"
      title="Cần ứng dụng Android/iOS"
      message="Trình duyệt web không truy cập được Bluetooth của cân và nhiệt kế. Hãy dùng ứng dụng GetWeightData trên điện thoại Android/iOS, hoặc bật chế độ mô phỏng để dùng thử."
      action={demoMode ? undefined : { label: 'Bật chế độ mô phỏng', onPress: () => updateSettings({ demoMode: true }) }}
    />
  ) : adapterState !== 'powered_on' ? (
    <InfoBanner
      severity={adapterSeverity(adapterState)}
      title={adapterState === 'unknown' ? undefined : 'Bluetooth chưa sẵn sàng'}
      message={ADAPTER_STATE_TEXT[adapterState]}
      action={
        adapterState === 'powered_off'
          ? { label: 'Mở cài đặt Bluetooth', onPress: openBluetoothSettings }
          : adapterState === 'unauthorized'
            ? { label: 'Mở cài đặt ứng dụng', onPress: () => void Linking.openSettings().catch(() => {}) }
            : undefined
      }
    />
  ) : null;

  const footer = bleTransport.isSupported ? (
    scanning ? (
      <Button
        title="Dừng quét"
        icon="stop-circle-outline"
        variant="secondary"
        size="lg"
        onPress={() => void stop()}
        accessibilityHint="Dừng tìm thiết bị Bluetooth"
      />
    ) : (
      <Button
        title={devices.length ? 'Quét lại' : 'Quét thiết bị'}
        icon="radar"
        size="lg"
        disabled={probingId !== null}
        onPress={() => void start()}
        accessibilityHint={`Tìm ${text.noun} Bluetooth ở gần trong ${formatNumber(SCAN_DURATION_MS / 1000, 0)} giây`}
      />
    )
  ) : undefined;

  return (
    <Screen footer={footer}>
      <Stack.Screen options={{ title: text.title }} />

      {adapterBanner}

      {/* Currently selected device */}
      <Card title={kind === 'scale' ? 'Cân đang dùng' : 'Nhiệt kế đang dùng'} icon={text.icon}>
        {current ? (
          <>
            <View style={styles.currentInfo} accessible accessibilityLabel={`Đang dùng ${current.name}, ${current.protocolName}`}>
              <View style={styles.titleRow}>
                <Icon name="check-circle" size={20} color={colors.normal} />
                <Text style={[type.bodyStrong, styles.shrink]}>{current.name}</Text>
              </View>
              <Chip label={current.protocolName} icon="check-decagram" />
              <Text style={type.caption}>{TRANSPORT_TEXT[current.transport]}</Text>
              <Text style={type.mono} selectable>
                {current.id}
              </Text>
            </View>
            <Button
              title="Bỏ chọn"
              icon="link-variant-off"
              variant="danger"
              onPress={() => saveDevice(undefined)}
              accessibilityHint={`Xóa ${current.name} khỏi thiết bị đã chọn`}
            />
          </>
        ) : (
          <Text style={type.body}>
            Chưa chọn {text.noun}. Chọn một thiết bị trong danh sách bên dưới sau khi quét.
          </Text>
        )}
      </Card>

      {/* Demo mode */}
      <Card>
        <ToggleRow
          title="Chế độ mô phỏng (không cần thiết bị)"
          subtitle={
            demoMode
              ? 'Đang bật: phép đo dùng dữ liệu giả lập, không đọc từ thiết bị đã chọn. Tắt để dùng thiết bị thật.'
              : 'Dùng dữ liệu giả lập để dùng thử ứng dụng khi chưa có cân hoặc nhiệt kế Bluetooth.'
          }
          value={demoMode}
          onValueChange={(value) => updateSettings({ demoMode: value })}
        />
      </Card>

      {error ? (
        <InfoBanner
          severity="warning"
          title="Không quét được thiết bị"
          message={error}
          action={scanning ? undefined : { label: 'Thử lại', onPress: () => void start() }}
        />
      ) : null}

      {bleTransport.isSupported ? (
        <>
          <SectionHeader title={`Thiết bị tương thích (${compatible.length})`} />
          <ScanStatus scanning={scanning} adapterReady={adapterState === 'powered_on'} hasScanned={devices.length > 0} />
          <Card>
            {compatible.length ? (
              compatible.map((device, index) => (
                <View key={device.id}>
                  {index > 0 ? <Divider /> : null}
                  <CompatibleRow
                    device={device}
                    kindIcon={text.icon}
                    noun={text.noun}
                    isCurrent={current?.id === device.id}
                    disabled={probingId !== null}
                    onPress={() => {
                      if (device.match) void select(device.id, device.name, device.match);
                    }}
                  />
                </View>
              ))
            ) : (
              <View style={styles.emptyList}>
                <Icon name={scanning ? 'radar' : 'bluetooth-off'} size={28} color={colors.textMuted} />
                <Text style={[type.body, styles.center]}>
                  {scanning ? `Đang tìm ${text.noun} tương thích…` : `Chưa tìm thấy ${text.noun} tương thích.`}
                </Text>
                {!scanning ? (
                  <Text style={[type.caption, styles.center]}>
                    {kind === 'scale'
                      ? 'Bước lên cân để cân bật và phát tín hiệu, rồi nhấn “Quét thiết bị”.'
                      : 'Bật nhiệt kế (hoặc nhấn nút đo) để thiết bị phát tín hiệu, rồi nhấn “Quét thiết bị”.'}
                  </Text>
                ) : null}
              </View>
            )}
          </Card>

          {others.length ? (
            <>
              <SectionHeader title={`Thiết bị khác (${others.length})`} />
              <Text style={type.caption}>
                Không tự nhận diện được. Nếu đây là {text.noun} theo chuẩn Bluetooth {text.services}, nhấn “Thử kết nối” để kiểm tra.
              </Text>
              <Card>
                {visibleOthers.map((device, index) => (
                  <View key={device.id}>
                    {index > 0 ? <Divider /> : null}
                    <OtherRow
                      device={device}
                      probing={probingId === device.id}
                      disabled={probingId !== null && probingId !== device.id}
                      onProbe={() => void probe(device)}
                    />
                  </View>
                ))}
                {others.length > OTHERS_PREVIEW ? (
                  <Button
                    title={showAllOthers ? 'Thu gọn' : `Hiện tất cả (${others.length})`}
                    icon={showAllOthers ? 'chevron-up' : 'chevron-down'}
                    variant="ghost"
                    onPress={() => setShowAllOthers((v) => !v)}
                  />
                ) : null}
              </Card>
            </>
          ) : null}
        </>
      ) : null}

      <HelpCard kind={kind} />
    </Screen>
  );
}

function ScanStatus({ scanning, adapterReady, hasScanned }: { scanning: boolean; adapterReady: boolean; hasScanned: boolean }) {
  const seconds = formatNumber(SCAN_DURATION_MS / 1000, 0);
  return (
    <View style={styles.scanStatus} accessibilityLiveRegion="polite">
      {scanning ? (
        <>
          <ActivityIndicator color={colors.primary} />
          <Text style={[type.caption, styles.shrink]}>Đang quét… tự dừng sau {seconds} giây.</Text>
        </>
      ) : (
        <>
          <Icon name={adapterReady ? 'bluetooth' : 'bluetooth-off'} size={18} color={adapterReady ? colors.primary : colors.textMuted} />
          <Text style={[type.caption, styles.shrink]}>
            {hasScanned ? 'Đã dừng quét. Nhấn “Quét lại” nếu chưa thấy thiết bị.' : `Nhấn “Quét thiết bị” để tìm trong ${seconds} giây.`}
          </Text>
        </>
      )}
    </View>
  );
}

function Chip({ label, icon }: { label: string; icon?: IconName }) {
  return (
    <View style={styles.chip}>
      {icon ? <Icon name={icon} size={14} color={colors.primary} /> : null}
      <Text style={styles.chipText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function Signal({ rssi }: { rssi: number | null }) {
  const s = signalInfo(rssi);
  return (
    <View style={styles.signal} accessible accessibilityLabel={`Tín hiệu ${s.label}, ${formatNumber(rssi, 0)} dBm`}>
      <Icon name={s.icon} size={18} color={colors.textSecondary} />
      <Text style={styles.signalText}>{formatNumber(rssi, 0)} dBm</Text>
    </View>
  );
}

function CompatibleRow({
  device,
  kindIcon,
  noun,
  isCurrent,
  disabled,
  onPress,
}: {
  device: ScannedDevice;
  kindIcon: IconName;
  noun: string;
  isCurrent: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const name = displayName(device.name);
  const signal = signalInfo(device.rssi);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: isCurrent }}
      accessibilityLabel={`${name}, ${device.match?.protocolName ?? ''}, tín hiệu ${signal.label} ${formatNumber(device.rssi, 0)} dBm${
        isCurrent ? ', đang dùng' : ''
      }`}
      accessibilityHint={`Chọn làm ${noun} để đo`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed, disabled && styles.rowDisabled]}>
      <View style={[styles.avatar, isCurrent && styles.avatarCurrent]}>
        <Icon name={isCurrent ? 'check-circle' : kindIcon} size={22} color={isCurrent ? colors.normal : colors.primary} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[type.bodyStrong, !device.name?.trim() && styles.unnamed]} numberOfLines={1}>
          {name}
        </Text>
        {device.match ? <Chip label={device.match.protocolName} icon="check-decagram" /> : null}
        <View style={styles.metaRow}>
          <Signal rssi={device.rssi} />
          <Text style={[type.mono, styles.shrink]} numberOfLines={1}>
            {device.id}
          </Text>
        </View>
        {isCurrent ? <Text style={[type.caption, { color: colors.normal }]}>Đang dùng</Text> : null}
      </View>
      <Icon name="chevron-right" size={22} color={colors.textMuted} />
    </Pressable>
  );
}

function OtherRow({
  device,
  probing,
  disabled,
  onProbe,
}: {
  device: ScannedDevice;
  probing: boolean;
  disabled: boolean;
  onProbe: () => void;
}) {
  const name = displayName(device.name);
  return (
    <View style={styles.row}>
      <View style={[styles.avatar, styles.avatarMuted]}>
        <Icon name="bluetooth" size={22} color={colors.textSecondary} />
      </View>
      <View style={styles.rowBody}>
        <Text style={type.bodyStrong} numberOfLines={1}>
          {name}
        </Text>
        <Signal rssi={device.rssi} />
        <Text style={type.mono} numberOfLines={1}>
          {device.id}
        </Text>
      </View>
      <Button
        title="Thử kết nối"
        variant="secondary"
        loading={probing}
        disabled={disabled}
        onPress={onProbe}
        accessibilityHint={`Kết nối ngắn tới ${name} để kiểm tra có phải thiết bị đo tương thích không`}
        style={styles.probeButton}
      />
    </View>
  );
}

const SCALE_DEVICES: { name: string; note: string; icon: IconName }[] = [
  { name: 'Xiaomi Mi Smart Scale / Mi Body Composition Scale 2', note: 'không cần kết nối', icon: 'broadcast' },
  { name: 'Cân OKOK / Chipsea', note: 'quảng bá', icon: 'broadcast' },
  { name: 'Cân QN / Renpho / FITINDEX', note: 'quảng bá', icon: 'broadcast' },
  {
    name: 'Cân chuẩn Bluetooth SIG Weight Scale & Body Composition (A&D, Omron, Beurer…)',
    note: 'kết nối trực tiếp',
    icon: 'lan-connect',
  },
];

const THERMOMETER_DEVICES: { name: string; note: string; icon: IconName }[] = [
  { name: 'Nhiệt kế chuẩn Bluetooth Health Thermometer', note: 'kết nối trực tiếp', icon: 'lan-connect' },
];

function HelpCard({ kind }: { kind: DeviceKind }) {
  const tips: { icon: IconName; text: string }[] = [
    kind === 'scale'
      ? { icon: 'shoe-print', text: 'Bước lên cân để đánh thức cân quảng bá trước khi quét – cân chỉ phát tín hiệu khi màn hình đang sáng.' }
      : { icon: 'gesture-tap', text: 'Bật nhiệt kế hoặc nhấn nút đo để thiết bị phát tín hiệu trước khi quét.' },
    kind === 'scale'
      ? { icon: 'gesture-tap', text: 'Nhiệt kế Bluetooth: bật nhiệt kế hoặc nhấn nút đo trước khi quét.' }
      : { icon: 'shoe-print', text: 'Cân quảng bá: bước lên cân để đánh thức cân trước khi quét.' },
    { icon: 'bluetooth', text: 'Bật Bluetooth trên điện thoại và để thiết bị ở gần (dưới 2 m).' },
    { icon: 'cellphone-cog', text: 'Cấp quyền “Thiết bị ở gần” (Android 12 trở lên) hoặc quyền Bluetooth cho ứng dụng.' },
  ];

  return (
    <Card title="Thiết bị được hỗ trợ" icon="help-circle-outline">
      <Text style={type.overline}>Cân điện tử</Text>
      {SCALE_DEVICES.map((d) => (
        <HelpItem key={d.name} icon={d.icon} text={d.name} note={d.note} />
      ))}
      <Text style={type.overline}>Nhiệt kế</Text>
      {THERMOMETER_DEVICES.map((d) => (
        <HelpItem key={d.name} icon={d.icon} text={d.name} note={d.note} />
      ))}
      <Divider />
      <Text style={type.overline}>Mẹo khi quét</Text>
      {tips.map((tip) => (
        <HelpItem key={tip.text} icon={tip.icon} text={tip.text} />
      ))}
    </Card>
  );
}

function HelpItem({ icon, text, note }: { icon: IconName; text: string; note?: string }) {
  return (
    <View style={styles.helpItem} accessible accessibilityLabel={note ? `${text}, ${note}` : text}>
      <Icon name={icon} size={18} color={colors.primary} style={styles.helpIcon} />
      <Text style={[type.body, styles.shrink]}>
        {text}
        {note ? <Text style={type.caption}> ({note})</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shrink: { flexShrink: 1 },
  center: { textAlign: 'center' },
  currentInfo: { gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  chipText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.primary, flexShrink: 1 },
  scanStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 24 },
  emptyList: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: touchTarget + 16,
    paddingVertical: spacing.sm,
  },
  rowPressed: { backgroundColor: colors.surfaceAlt },
  rowDisabled: { opacity: 0.5 },
  rowBody: { flex: 1, gap: spacing.xs },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  avatarCurrent: { backgroundColor: colors.normalSoft },
  avatarMuted: { backgroundColor: colors.surfaceAlt },
  unnamed: { color: colors.textSecondary, fontStyle: 'italic' },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.xxs },
  signal: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  signalText: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: colors.textSecondary, fontVariant: ['tabular-nums'] },
  probeButton: { paddingHorizontal: spacing.md },
  helpItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  helpIcon: { marginTop: 2 },
});
