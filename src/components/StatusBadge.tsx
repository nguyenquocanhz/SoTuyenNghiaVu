import { StyleSheet, Text, View } from 'react-native';

import type { Severity } from '@/domain/types';
import { radius, severityPalette, spacing } from '@/theme';

import { Icon, type IconName } from './Icon';

/** Colour + icon + text: status is never conveyed by colour alone. */
export function StatusBadge({ severity, label, size = 'md' }: { severity: Severity; label?: string; size?: 'sm' | 'md' }) {
  const p = severityPalette[severity];
  const text = label ?? p.label;
  return (
    <View
      style={[styles.badge, size === 'sm' && styles.small, { backgroundColor: p.bg, borderColor: p.fill }]}
      accessibilityRole="text"
      accessibilityLabel={`Mức độ: ${text}`}>
      <Icon name={p.icon as IconName} size={size === 'sm' ? 14 : 16} color={p.fg} />
      <Text style={[styles.label, size === 'sm' && styles.labelSmall, { color: p.fg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  small: { paddingHorizontal: 6, paddingVertical: 2 },
  label: { fontSize: 14, fontWeight: '700' },
  labelSmall: { fontSize: 12 },
});
