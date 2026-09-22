import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import { EmptyState, Icon } from '@/components';
import { fold } from '@/domain/search';
import { DISEASE_CATALOG } from '@/standards/catalog';
import type { DiseaseItem } from '@/standards/diseases';
import { colors, radius, spacing, touchTarget, type } from '@/theme';

const INDENT = [0, 12, 28, 44];

export default function SpecialtyScreen() {
  const { specialty } = useLocalSearchParams<{ specialty: string }>();
  const data = DISEASE_CATALOG.find((s) => s.id === specialty);
  const [query, setQuery] = useState('');

  const items = useMemo(() => {
    if (!data) return [];
    const tokens = fold(query).split(/\s+/).filter(Boolean);
    if (!tokens.length) return data.items;
    return data.items.filter((item) => {
      const h = fold(`${item.no} ${item.title} ${item.rows.map((r) => r.text).join(' ')}`);
      return tokens.every((t) => h.includes(t));
    });
  }, [data, query]);

  if (!data) return <EmptyState icon="book-remove-outline" title="Không tìm thấy chuyên khoa" />;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: data.name }} />
      <View style={styles.searchBar}>
        <View style={styles.searchBox}>
          <Icon name="magnify" size={22} color={colors.textMuted} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Tìm trong chuyên khoa" placeholderTextColor={colors.textMuted} style={styles.searchInput} autoCorrect={false} />
        </View>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item, i) => `${item.no}-${i}`}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <ItemCard item={item} />}
        ListEmptyComponent={<EmptyState icon="text-search" title="Không tìm thấy" />}
      />
    </View>
  );
}

function ItemCard({ item }: { item: DiseaseItem }) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={[type.bodyStrong, styles.flex]}>{`${item.no}. ${item.title}`}</Text>
        {item.score ? <Text style={styles.score}>{item.score}</Text> : null}
      </View>
      {item.rows.map((r, i) => (
        <View key={i} style={[styles.row, styles.subRow, { paddingLeft: INDENT[r.level] }]}>
          <Text style={[r.score ? type.body : type.caption, styles.flex]}>{`${r.level === 1 ? '– ' : r.level === 2 ? '+ ' : r.level === 3 ? '• ' : ''}${r.text}`}</Text>
          {r.score ? <Text style={[styles.score, r.score.length > 6 && styles.scoreRule]}>{r.score}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  searchBar: { backgroundColor: colors.surface, padding: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, minHeight: touchTarget, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, fontSize: 16, color: colors.text },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: 2, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  subRow: { paddingVertical: 3, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  score: { minWidth: 36, textAlign: 'right', fontSize: 15, fontWeight: '700', color: colors.primary, fontVariant: ['tabular-nums'] },
  scoreRule: { maxWidth: 130, fontSize: 12, fontWeight: '600' },
});
