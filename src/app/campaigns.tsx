import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, Card, EmptyState, Icon, Screen, StatusBadge } from '@/components';
import { isoToViDate } from '@/domain/format';
import { useDataStore } from '@/store/data';
import { useActiveCampaign } from '@/store/selectors';
import { useSettingsStore } from '@/store/settings';
import { colors, spacing, type } from '@/theme';

export default function CampaignsScreen() {
  const campaigns = useDataStore((s) => s.campaigns);
  const screenings = useDataStore((s) => s.screenings);
  const active = useActiveCampaign();
  const update = useSettingsStore((s) => s.update);

  return (
    <Screen footer={<Button title="Tạo đợt sơ tuyển" icon="plus" size="lg" onPress={() => router.push('/campaign-form')} />}>
      {campaigns.length === 0 ? (
        <EmptyState icon="calendar-blank-outline" title="Chưa có đợt sơ tuyển" message="Tạo đợt sơ tuyển theo kế hoạch tuyển chọn và gọi công dân nhập ngũ." />
      ) : null}
      {campaigns.map((c) => {
        const count = screenings.filter((s) => s.campaignId === c.id).length;
        const isActive = c.id === active?.id;
        return (
          <Card
            key={c.id}
            title={c.name}
            subtitle={`Năm ${c.year} · từ ${isoToViDate(c.startDate)}${c.endDate ? ` đến ${isoToViDate(c.endDate)}` : ''}`}
            icon={isActive ? 'check-circle' : 'calendar-outline'}
            tone={isActive ? 'normal' : undefined}
            onPress={() => {
              update({ activeCampaignId: c.id });
              router.back();
            }}
            accessibilityLabel={`Chọn ${c.name}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Icon name="clipboard-text-outline" size={18} color={colors.textMuted} />
              <Text style={[type.body, { flex: 1 }]}>{`${count} phiếu${c.plannedCount ? ` / kế hoạch ${c.plannedCount}` : ''}`}</Text>
              {isActive ? <StatusBadge severity="normal" label="Đang dùng" size="sm" /> : null}
            </View>
            <Button title="Sửa" icon="pencil-outline" variant="ghost" onPress={() => router.push({ pathname: '/campaign-form', params: { id: c.id } })} />
          </Card>
        );
      })}
    </Screen>
  );
}
