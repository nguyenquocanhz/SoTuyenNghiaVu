import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Text } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { Button, Card, Divider, ListRow, Screen, SectionHeader, TextField, ToggleRow } from '@/components';
import { formatDateTime, formatNumber, parseDecimal } from '@/domain/format';
import { shareText } from '@/reports/output';
import { isBackup, makeBackup, useDataStore } from '@/store/data';
import { useActiveCampaign } from '@/store/selectors';
import { useSettingsStore } from '@/store/settings';
import { type } from '@/theme';

export default function SettingsScreen() {
  const settings = useSettingsStore();
  const campaign = useActiveCampaign();
  const counts = useDataStore(useShallow((s) => ({ citizens: s.citizens.length, screenings: s.screenings.length, campaigns: s.campaigns.length })));
  const [demoWeight, setDemoWeight] = useState(formatNumber(settings.demoWeightKg, 1));
  const [duration, setDuration] = useState(String(settings.measureDurationSec));

  const exportBackup = async () => {
    try {
      const state = useDataStore.getState();
      const stamp = new Date().toISOString().slice(0, 10);
      await shareText(JSON.stringify(makeBackup(state)), `sotuyen-sao-luu-${stamp}.json`, 'application/json', 'Sao lưu dữ liệu sơ tuyển');
    } catch (e) {
      Alert.alert('Không sao lưu được', e instanceof Error ? e.message : String(e));
    }
  };

  const pickBackup = async () => {
    const picked = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets?.[0]) return null;
    const data: unknown = JSON.parse(await new File(picked.assets[0].uri).text());
    if (!isBackup(data)) throw new Error('Tệp không phải dữ liệu của ứng dụng Sơ tuyển NVQS.');
    return data;
  };

  const mergeBackup = async () => {
    try {
      const data = await pickBackup();
      if (!data) return;
      Alert.alert(
        'Gộp dữ liệu từ tệp?',
        `Tệp có ${data.citizens.length} công dân, ${data.screenings.length} phiếu. Dữ liệu hiện có được giữ nguyên: công dân trùng số CCCD được bổ sung thông tin, phiếu cùng đợt chỉ thay khi phiếu trong tệp mới hơn.`,
        [
          { text: 'Huỷ', style: 'cancel' },
          {
            text: 'Gộp',
            onPress: () => {
              try {
                const c = useDataStore.getState().merge(data);
                if (!useSettingsStore.getState().activeCampaignId) {
                  useSettingsStore.getState().update({ activeCampaignId: useDataStore.getState().campaigns[0]?.id });
                }
                Alert.alert(
                  'Đã gộp dữ liệu',
                  [
                    `Công dân: thêm ${c.citizensAdded}, cập nhật ${c.citizensUpdated}${c.citizensInvalid ? `, bỏ qua ${c.citizensInvalid} (thiếu số CCCD/họ tên/ngày sinh)` : ''}.`,
                    `Phiếu: thêm ${c.screeningsAdded}, cập nhật ${c.screeningsUpdated}${c.screeningsSkipped ? `, giữ bản trên máy ${c.screeningsSkipped}` : ''}.`,
                    c.campaignsAdded ? `Đợt sơ tuyển mới: ${c.campaignsAdded}.` : '',
                  ]
                    .filter(Boolean)
                    .join('\n'),
                );
              } catch (e) {
                Alert.alert('Không gộp được', e instanceof Error ? e.message : String(e));
              }
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert('Không đọc được tệp', e instanceof Error ? e.message : String(e));
    }
  };

  const importBackup = async () => {
    try {
      const data = await pickBackup();
      if (!data) return;
      Alert.alert(
        'Khôi phục dữ liệu?',
        `Bản sao lưu lúc ${formatDateTime(data.exportedAt)}: ${data.citizens.length} công dân, ${data.screenings.length} phiếu. Toàn bộ dữ liệu hiện có trên máy sẽ bị thay thế.`,
        [
          { text: 'Huỷ', style: 'cancel' },
          {
            text: 'Khôi phục',
            style: 'destructive',
            onPress: () => {
              try {
                useDataStore.getState().restore(data);
                useSettingsStore.getState().update({ activeCampaignId: data.campaigns[0]?.id });
                Alert.alert('Đã khôi phục', 'Dữ liệu đã được thay thế bằng bản sao lưu.');
              } catch (e) {
                Alert.alert('Không khôi phục được', e instanceof Error ? e.message : String(e));
              }
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert('Không đọc được tệp', e instanceof Error ? e.message : String(e));
    }
  };

  const wipe = () =>
    Alert.alert('Xoá toàn bộ dữ liệu?', 'Xoá mọi đợt sơ tuyển, công dân và phiếu trên máy này. Hãy sao lưu trước. Không thể hoàn tác.', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá tất cả',
        style: 'destructive',
        onPress: () => {
          useDataStore.getState().wipe();
          settings.update({ activeCampaignId: undefined });
        },
      },
    ]);

  return (
    <Screen>
      <SectionHeader title="Đơn vị" />
      <Card>
        <ListRow title={settings.unitName || 'Chưa nhập tên trạm'} subtitle={`Tổ trưởng: ${settings.teamLeader || '—'}`} icon="hospital-building" onPress={() => router.push('/setup')} />
        <Divider />
        <ListRow title="Đợt sơ tuyển" subtitle={campaign?.name ?? 'Chưa có'} icon="calendar-check" onPress={() => router.push('/campaigns')} />
      </Card>

      <SectionHeader title="Cân Bluetooth" />
      <Card>
        <ListRow
          title={settings.scaleDevice?.name ?? 'Chưa chọn cân'}
          subtitle={settings.scaleDevice?.protocolName ?? 'Nhận cân nặng tự động từ cân điện tử'}
          icon="scale-bathroom"
          onPress={() => router.push({ pathname: '/devices', params: { kind: 'scale' } })}
        />
        <TextField
          label="Thời gian đo ổn định"
          unit="giây"
          value={duration}
          keyboardType="number-pad"
          onChangeText={(t) => {
            const v = t.replace(/\D/g, '').slice(0, 2);
            setDuration(v);
            const n = Number(v);
            if (n >= 5 && n <= 60) settings.update({ measureDurationSec: n });
          }}
          hint="5–60 giây"
        />
        <ToggleRow title="Chế độ mô phỏng" subtitle="Cân giả lập để tập huấn – không dùng khi sơ tuyển thật" value={settings.demoMode} onValueChange={(v) => settings.update({ demoMode: v })} />
        {settings.demoMode ? (
          <TextField
            label="Cân nặng mô phỏng"
            unit="kg"
            value={demoWeight}
            keyboardType="decimal-pad"
            onChangeText={(t) => {
              setDemoWeight(t);
              const n = parseDecimal(t);
              if (n !== undefined && n >= 30 && n <= 150) settings.update({ demoWeightKg: n });
            }}
          />
        ) : null}
      </Card>

      <SectionHeader title="Dữ liệu" />
      <Card>
        <Text style={type.body}>{`${counts.campaigns} đợt · ${counts.citizens} công dân · ${counts.screenings} phiếu`}</Text>
        <Text style={type.caption}>Dữ liệu chỉ lưu trong SQLite trên máy này. Sao lưu thường xuyên và bảo quản tệp theo quy định bảo vệ dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP).</Text>
        <Button title="Sao lưu (xuất tệp JSON)" icon="database-export-outline" variant="secondary" onPress={() => void exportBackup()} />
        <Button title="Gộp dữ liệu từ tệp (giữ dữ liệu hiện có)" icon="database-plus-outline" variant="secondary" onPress={() => void mergeBackup()} />
        <Button title="Khôi phục từ tệp sao lưu (thay toàn bộ)" icon="database-import-outline" variant="secondary" onPress={() => void importBackup()} />
        <Button title="Xoá toàn bộ dữ liệu" icon="delete-forever-outline" variant="danger" onPress={wipe} />
      </Card>

      <Text style={type.caption}>
        Sơ tuyển NVQS điện tử 1.0 · Căn cứ Thông tư 105/2023/TT-BQP ngày 06/12/2023 và Thông tư 106/2025/TT-BQP ngày 30/9/2025 của Bộ Quốc phòng.
      </Text>
    </Screen>
  );
}
