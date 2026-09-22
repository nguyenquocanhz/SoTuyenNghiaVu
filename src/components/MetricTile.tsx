import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Severity } from '@/domain/types';
import { colors, radius, severityPalette, spacing, type } from '@/theme';

import { Icon, type IconName } from './Icon';

/** Clinical value display: label, big tabular value + unit, optional caption and status line. */
export function MetricTile({
  label,
  value,
  unit,
  caption,
  severity,
  statusLabel,
  icon,
  onPress,
  size = 'md',
  style,
}: {
  label: string;
  value: string;
  unit?: string;
  caption?: string;
  severity?: Severity;
  statusLabel?: string;
  icon?: IconName;
  onPress?: () => void;
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
}) {
  const p = severity ? severityPalette[severity] : undefined;
  const content = (
    <>
      <View style={styles.labelRow}>
        {icon ? <Icon name={icon} size={16} color={colors.textMuted} /> : null}
        <Text style={type.overline} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={styles.valueRow}>
        <Text style={size === 'lg' ? type.valueLg : type.valueMd} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {unit ? <Text style={type.unit}>{unit}</Text> : null}
      </View>
      {p ? (
        <View style={styles.statusRow}>
          <Icon name={p.icon as IconName} size={14} color={p.fg} />
          <Text style={[styles.status, { color: p.fg }]} numberOfLines={2}>
            {statusLabel ?? p.label}
          </Text>
        </View>
      ) : null}
      {caption ? (
        <Text style={type.caption} numberOfLines={2}>
          {caption}
        </Text>
      ) : null}
    </>
  );
  const tileStyle = [styles.tile, p && { borderTopColor: p.fill }, style];
  const a11yLabel = [`${label}: ${value}${unit ? ` ${unit}` : ''}`, p ? (statusLabel ?? p.label) : statusLabel, caption]
    .filter(Boolean)
    .join('. ');
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        style={({ pressed }) => [tileStyle, pressed && { backgroundColor: colors.surfaceAlt }]}>
        {content}
      </Pressable>
    );
  }
  return (
    <View style={tileStyle} accessible accessibilityLabel={a11yLabel}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderTopWidth: 3,
    borderTopColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  status: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
});
