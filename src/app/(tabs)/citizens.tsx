import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, EmptyState, Icon, StatusBadge } from '@/components';
import { ageInYears, isoToViDate } from '@/domain/format';
import { OUTCOME_SEVERITY, OUTCOME_SHORT } from '@/domain/screening';
import { fold, matchesQuery } from '@/domain/search';
import type { Citizen, Screening, ScreeningOutcome } from '@/domain/types';
import { useDataStore } from '@/store/data';
import { useActiveCampaign, useCampaignScreenings } from '@/store/selectors';
import { colors, radius, shadow, spacing, touchTarget, type } from '@/theme';

type Filter = 'all' | 'none' | ScreeningOutcome;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'none', label: 'Chưa sơ tuyển' },
  { value: 'pending', label: 'Chưa kết luận' },
  { value: 'eligible', label: 'Đủ điều kiện' },
  { value: 'exempt', label: 'Miễn NVQS' },
  { value: 'other', label: 'Không đủ ĐK' },
];

export default function CitizensScreen() {
  const citizens = useDataStore((s) => s.citizens);
  const campaign = useActiveCampaign();
  const screenings = useCampaignScreenings(campaign?.id);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const byCitizen = useMemo(() => new Map(screenings.map((s) => [s.citizenId, s])), [screenings]);

  const rows = useMemo(() => {
    const list = citizens.filter((c) => {
      const s = byCitizen.get(c.id);
      if (filter === 'none' && s) return false;
      if (filter !== 'all' && filter !== 'none' && s?.outcome !== filter) return false;
      return matchesQuery(`${c.fullName} ${c.cccd} ${c.currentAddress ?? ''} ${c.permanentAddress ?? ''}`, query);
    });
    // Vietnamese convention: sort by given name (last word), then full name.
    const key = (c: Citizen) => fold(`${c.fullName.split(' ').pop() ?? ''} ${c.fullName}`);
    return list.sort((a, b) => key(a).localeCompare(key(b)));
  }, [citizens, byCitizen, filter, query]);

  const countFor = (f: Filter) =>
    f === 'all' ? citizens.length : f === 'none' ? citizens.filter((c) => !byCitizen.has(c.id)).length : screenings.filter((s) => s.outcome === f).length;

  return (
    <View style={styles.root}>
      <View style={styles.searchBar}>
        <View style={styles.searchBox}>
          <Icon name="magnify" size={22} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Tìm theo tên, số CCCD, địa chỉ"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            autoCorrect={false}
            accessibilityLabel="Tìm công dân"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Xoá tìm kiếm" hitSlop={12}>
              <Icon name="close-circle" size={20} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => {
            const selected = f.value === filter;
            return (
              <Pressable
                key={f.value}
                onPress={() => setFilter(f.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                style={[styles.chip, selected && styles.chipSelected]}>
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{`${f.label} · ${countFor(f.value)}`}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          citizens.length === 0 ? (
            <EmptyState
              icon="account-group-outline"
              title="Chưa có công dân"
              message="Thêm công dân trong danh sách gọi khám sơ tuyển bằng cách quét CCCD gắn chip hoặc nhập tay."
              action={{ label: 'Thêm công dân', icon: 'account-plus', onPress: () => router.push('/citizen-form') }}
            />
          ) : (
            <EmptyState icon="account-search-outline" title="Không tìm thấy" message="Thử từ khoá hoặc bộ lọc khác." />
          )
        }
        renderItem={({ item }) => <CitizenRow citizen={item} screening={byCitizen.get(item.id)} year={campaign?.year} />}
      />

      <View style={styles.footer}>
        <Button title="Quét CCCD" icon="cellphone-nfc" onPress={() => router.push('/scan-cccd')} style={styles.flex} />
        <Button title="Nhập tay" icon="account-plus-outline" variant="secondary" onPress={() => router.push('/citizen-form')} style={styles.flex} />
      </View>
    </View>
  );
}

function CitizenRow({ citizen, screening, year }: { citizen: Citizen; screening?: Screening; year?: number }) {
  const age = year ? ageInYears(citizen.birthDate, new Date(year, 11, 31)) : undefined;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/citizen/[id]', params: { id: citizen.id } })}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, shadow, pressed && { backgroundColor: colors.surfaceAlt }]}>
      <View style={styles.avatar}>
        <Icon name={citizen.sex === 'male' ? 'account' : 'account-outline'} size={24} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <Text style={type.bodyStrong} numberOfLines={1}>
          {citizen.fullName}
        </Text>
        <Text style={type.caption} numberOfLines={1}>
          {`${isoToViDate(citizen.birthDate)}${age !== undefined ? ` (${age} tuổi)` : ''} · CCCD ${citizen.cccd}`}
        </Text>
        {citizen.currentAddress || citizen.permanentAddress ? (
          <Text style={type.caption} numberOfLines={1}>
            {citizen.currentAddress || citizen.permanentAddress}
          </Text>
        ) : null}
      </View>
      {screening ? (
        <StatusBadge size="sm" severity={OUTCOME_SEVERITY[screening.outcome]} label={OUTCOME_SHORT[screening.outcome]} />
      ) : (
        <StatusBadge size="sm" severity="info" label="Chưa sơ tuyển" />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  searchBar: { backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingTop: spacing.sm, gap: spacing.sm },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    minHeight: touchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: spacing.sm },
  chips: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.xs },
  chip: { paddingHorizontal: spacing.md, minHeight: 36, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  chipTextSelected: { color: colors.onPrimary },
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
