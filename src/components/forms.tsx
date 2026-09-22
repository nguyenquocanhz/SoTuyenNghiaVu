import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { colors, radius, spacing, touchTarget, type } from '@/theme';

import { Icon, type IconName } from './Icon';

export function TextField({
  label,
  value,
  onChangeText,
  unit,
  placeholder,
  keyboardType,
  error,
  hint,
  secureTextEntry,
  multiline,
  autoCapitalize = 'sentences',
  maxLength,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  unit?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  error?: string | null;
  hint?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  maxLength?: number;
  editable?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, error ? styles.inputError : null, !editable && styles.inputDisabled]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          maxLength={maxLength}
          editable={editable}
          accessibilityLabel={label}
          accessibilityHint={hint}
          style={[styles.input, multiline && styles.multiline]}
        />
        {unit ? <Text style={type.unit}>{unit}</Text> : null}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={type.caption}>{hint}</Text>
      ) : null}
    </View>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
}) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.segments} accessibilityRole="radiogroup">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={o.label}
              style={[styles.segment, selected && styles.segmentSelected]}>
              {o.icon ? <Icon name={o.icon} size={18} color={selected ? colors.onPrimary : colors.primary} /> : null}
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]} numberOfLines={1}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ToggleRow({
  title,
  subtitle,
  value,
  onValueChange,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <Pressable
      style={styles.toggleRow}
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      accessibilityState={{ checked: value }}>
      <View style={styles.flex}>
        <Text style={type.bodyStrong}>{title}</Text>
        {subtitle ? <Text style={type.caption}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.surface}
        accessibilityLabel={title}
      />
    </Pressable>
  );
}

export function ListRow({
  title,
  subtitle,
  icon,
  iconColor = colors.primary,
  right,
  onPress,
  chevron = Boolean(onPress),
  destructive,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconColor?: string;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
}) {
  const color = destructive ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.listRow, pressed && onPress ? { backgroundColor: colors.surfaceAlt } : null]}>
      {icon ? <Icon name={icon} size={22} color={destructive ? colors.danger : iconColor} /> : null}
      <View style={styles.flex}>
        <Text style={[type.bodyStrong, { color }]}>{title}</Text>
        {subtitle ? <Text style={type.caption}>{subtitle}</Text> : null}
      </View>
      {right}
      {chevron ? <Icon name="chevron-right" size={22} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={type.overline} accessibilityRole="header">
        {title}
      </Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          hitSlop={{ left: 12, right: 12 }}
          style={styles.sectionActionHit}>
          <Text style={styles.sectionAction}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Checkbox (or radio) row with a 48dp target; state is conveyed by icon + accessibility state. */
export function CheckRow({
  title,
  subtitle,
  checked,
  onPress,
  radio,
  right,
}: {
  title: string;
  subtitle?: string;
  checked: boolean;
  onPress: () => void;
  radio?: boolean;
  right?: ReactNode;
}) {
  const icon: IconName = radio
    ? checked
      ? 'radiobox-marked'
      : 'radiobox-blank'
    : checked
      ? 'checkbox-marked'
      : 'checkbox-blank-outline';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={radio ? 'radio' : 'checkbox'}
      accessibilityState={{ checked }}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      style={({ pressed }) => [styles.checkRow, pressed && { backgroundColor: colors.surfaceAlt }]}>
      <Icon name={icon} size={24} color={checked ? colors.primary : colors.textMuted} />
      <View style={styles.flex}>
        <Text style={type.body}>{title}</Text>
        {subtitle ? <Text style={type.caption}>{subtitle}</Text> : null}
      </View>
      {right}
    </Pressable>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  field: { gap: spacing.xs },
  label: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  inputWrap: {
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
  input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: spacing.sm },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  error: { fontSize: 13, color: colors.danger, fontWeight: '600' },
  segments: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    minHeight: touchTarget,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  segmentSelected: { backgroundColor: colors.primary },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  segmentTextSelected: { color: colors.onPrimary },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: touchTarget },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: touchTarget + 8, paddingVertical: spacing.xs },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  sectionAction: { fontSize: 14, fontWeight: '700', color: colors.primary },
  sectionActionHit: { minHeight: touchTarget, justifyContent: 'center', paddingHorizontal: spacing.xs },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: touchTarget, paddingVertical: spacing.xs, borderRadius: radius.sm },
});
