import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, EmptyState, Icon, ScoreBadge } from '@/components';
import type { Score } from '@/domain/types';
import { DISEASE_CATALOG, entryLabel, searchCatalog, type CatalogEntry } from '@/standards/catalog';
import { useDraftStore } from '@/store/drafts';
import { colors, radius, spacing, touchTarget, type } from '@/theme';

const SCORES: Score[] = [1, 2, 3, 4, 5, 6];

export default function DiseasePickerScreen() {
  const params = useLocalSearchParams<{ requestKey?: string; sex?: string }>();
  const [query, setQuery] = useState('');
  const [specialty, setSpecialty] = useState<string | undefined>();
  const [selected, setSelected] = useState<CatalogEntry | null>(null);
  const [score, setScore] = useState<Score>(1);
  const [temporary, setTemporary] = useState(false);

  const specialties = DISEASE_CATALOG.filter((s) => params.sex !== 'male' || s.id !== 'phukhoa');
  const results = useMemo(
    () => searchCatalog(query, specialty).filter((e) => params.sex !== 'male' || e.specialtyId !== 'phukhoa'),
    [query, specialty, params.sex],
  );

  const choose = (e: CatalogEntry) => {
    setSelected(e);
    setScore(e.parsed?.min ?? 1);
    setTemporary(e.parsed?.temporary ?? false);
  };

  const confirm = () => {
    if (!selected || !params.requestKey) return;
    useDraftStore.getState().setFinding({
      requestKey: params.requestKey,
      finding: { itemId: selected.key, label: entryLabel(selected), score, temporary },
    });
    router.back();
  };

  const allowed = (s: Score) => !selected?.parsed || (s >= selected.parsed.min && s <= selected.parsed.max);

  return (
    <SafeAreaView style={styles.root} edges={['bottom', 'left', 'right']}>
      <View style={styles.searchBar}>
        <View style={styles.searchBox}>
          <Icon name="magnify" size={22} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Tìm bệnh, tật (vd: bàn chân bẹt, cận thị, trĩ)"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            autoCorrect={false}
            autoFocus
            accessibilityLabel="Tìm bệnh, tật"
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
          <Chip label="Tất cả" selected={!specialty} onPress={() => setSpecialty(undefined)} />
          {specialties.map((s) => (
            <Chip key={s.id} label={s.name.replace(/^Các bệnh (về )?/, '')} selected={specialty === s.id} onPress={() => setSpecialty(s.id)} />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={results}
        keyExtractor={(e) => e.key}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        initialNumToRender={20}
        ListEmptyComponent={<EmptyState icon="text-search" title="Không tìm thấy" message="Thử từ khoá khác hoặc chọn chuyên khoa." />}
        renderItem={({ item }) => {
          const isSelected = selected?.key === item.key;
          return (
            <Pressable
              onPress={() => choose(item)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={({ pressed }) => [styles.item, isSelected && styles.itemSelected, pressed && { backgroundColor: colors.surfaceAlt }]}>
              <View style={styles.flex}>
                <Text style={type.caption} numberOfLines={1}>{`${item.specialtyName.replace(/^Các bệnh (về )?/, '')} · Số ${item.itemNo} ${item.itemTitle}`}</Text>
                {item.context.length ? <Text style={type.caption}>{item.context.join(' › ')}</Text> : null}
                <Text style={type.body}>{item.text}</Text>
              </View>
              <View style={styles.scoreCell}>
                {item.parsed ? (
                  <Text style={styles.scoreText}>{item.scoreText}</Text>
                ) : (
                  <Text style={[type.caption, styles.ruleText]} numberOfLines={3}>
                    {item.scoreText}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        }}
      />

      {selected ? (
        <View style={styles.sheet}>
          <Text style={type.bodyStrong}>{entryLabel(selected)}</Text>
          <Text style={type.caption}>{selected.parsed ? `Điểm theo bảng: ${selected.scoreText}` : `Cách cho điểm: ${selected.scoreText}`}</Text>
          <View style={styles.scoreRow} accessibilityRole="radiogroup">
            {SCORES.map((s) => (
              <Pressable
                key={s}
                disabled={!allowed(s)}
                onPress={() => setScore(s)}
                accessibilityRole="radio"
                accessibilityState={{ checked: score === s, disabled: !allowed(s) }}
                accessibilityLabel={`Điểm ${s}`}
                style={[styles.scoreOption, score === s && styles.scoreOptionSelected, !allowed(s) && styles.scoreOptionDisabled]}>
                <Text style={[styles.scoreOptionText, score === s && styles.scoreOptionTextSelected]}>{s}</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setTemporary((t) => !t)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: temporary }}
              accessibilityLabel="Tạm thời (T)"
              style={[styles.scoreOption, styles.tOption, temporary && styles.scoreOptionSelected]}>
              <Text style={[styles.scoreOptionText, temporary && styles.scoreOptionTextSelected]}>T</Text>
            </Pressable>
          </View>
          <View style={styles.sheetActions}>
            <ScoreBadge score={score} temporary={temporary} />
            <View style={styles.flex} />
            <Button title="Huỷ" variant="ghost" onPress={() => setSelected(null)} />
            <Button title="Thêm vào phiếu" icon="plus" onPress={confirm} />
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
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
  list: { padding: spacing.md, gap: spacing.xs, paddingBottom: 200 },
  item: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    minHeight: touchTarget,
  },
  itemSelected: { borderColor: colors.primary, borderWidth: 2 },
  scoreCell: { width: 76, alignItems: 'flex-end', justifyContent: 'center' },
  scoreText: { fontSize: 18, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  ruleText: { textAlign: 'right' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    elevation: 8,
  },
  scoreRow: { flexDirection: 'row', gap: spacing.xs },
  scoreOption: { flex: 1, minHeight: 44, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  tOption: { marginLeft: spacing.sm },
  scoreOptionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  scoreOptionDisabled: { opacity: 0.35 },
  scoreOptionText: { fontSize: 16, fontWeight: '700', color: colors.text },
  scoreOptionTextSelected: { color: colors.onPrimary },
  sheetActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
