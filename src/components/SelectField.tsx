import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fold } from '@/domain/search';
import { colors, radius, spacing, touchTarget, type } from '@/theme';

import { Icon } from './Icon';

export interface SelectOption {
  value: string;
  label: string;
  subtitle?: string;
}

/**
 * Dropdown field: shows the selected label and opens a full-screen searchable list
 * (diacritic-insensitive), suitable for long official lists such as 3,321 communes.
 */
export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = 'Chọn…',
  title,
  searchPlaceholder = 'Tìm (gõ có hoặc không dấu)',
  disabled,
  hint,
  error,
}: {
  label: string;
  value: string | undefined;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  title?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  hint?: string;
  error?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.value === value);

  const indexed = useMemo(() => options.map((o) => ({ option: o, haystack: fold(`${o.label} ${o.subtitle ?? ''}`) })), [options]);
  const results = useMemo(() => {
    const tokens = fold(query).split(/\s+/).filter(Boolean);
    return tokens.length ? indexed.filter((x) => tokens.every((t) => x.haystack.includes(t))).map((x) => x.option) : options;
  }, [indexed, options, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? 'chưa chọn'}`}
        accessibilityHint="Mở danh sách để chọn"
        accessibilityState={{ disabled }}
        style={({ pressed }) => [styles.input, error ? styles.inputError : null, disabled && styles.inputDisabled, pressed && { backgroundColor: colors.surfaceAlt }]}>
        <Text style={[styles.value, !selected && { color: colors.textMuted }]} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <Icon name="chevron-down" size={24} color={disabled ? colors.textMuted : colors.primary} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={type.caption}>{hint}</Text> : null}

      <Modal visible={open} animationType="slide" onRequestClose={close}>
        <SafeAreaView style={styles.modal} edges={['top', 'bottom', 'left', 'right']}>
          <View style={styles.header}>
            <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Đóng" hitSlop={12} style={styles.close}>
              <Icon name="close" size={26} color={colors.onPrimary} />
            </Pressable>
            <Text style={styles.title} numberOfLines={1}>
              {title ?? label}
            </Text>
          </View>
          <View style={styles.searchBox}>
            <Icon name="magnify" size={22} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              autoCorrect={false}
              autoFocus
              accessibilityLabel={`Tìm ${label}`}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Xoá tìm kiếm" hitSlop={12}>
                <Icon name="close-circle" size={20} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
          <Text style={[type.caption, styles.count]}>{`${results.length} mục`}</Text>
          <FlatList
            data={results}
            keyExtractor={(o) => o.value}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            windowSize={11}
            renderItem={({ item }) => {
              const isSelected = item.value === value;
              return (
                <Pressable
                  onPress={() => {
                    onChange(item.value);
                    close();
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.primarySoft }]}>
                  <View style={styles.flex}>
                    <Text style={[type.body, isSelected && styles.selectedText]}>{item.label}</Text>
                    {item.subtitle ? <Text style={type.caption}>{item.subtitle}</Text> : null}
                  </View>
                  {isSelected ? <Icon name="check" size={22} color={colors.primary} /> : null}
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={<Text style={[type.body, styles.empty]}>Không tìm thấy.</Text>}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  field: { gap: spacing.xs },
  label: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTarget,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  inputError: { borderColor: colors.danger, borderWidth: 1.5 },
  inputDisabled: { backgroundColor: colors.surfaceAlt },
  value: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: spacing.sm },
  error: { fontSize: 13, color: colors.danger, fontWeight: '600' },
  modal: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.primary, paddingHorizontal: spacing.lg, minHeight: 56 },
  close: { minWidth: touchTarget - 8, minHeight: touchTarget - 8, justifyContent: 'center' },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.onPrimary },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: touchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: spacing.sm },
  count: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: touchTarget + 8, backgroundColor: colors.surface },
  selectedText: { fontWeight: '700', color: colors.primary },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider },
  empty: { textAlign: 'center', padding: spacing.xl, color: colors.textSecondary },
});
