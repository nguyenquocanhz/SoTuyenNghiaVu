import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Severity } from '@/domain/types';
import { colors, radius, severityPalette, shadow, spacing, type } from '@/theme';

import { Icon, type IconName } from './Icon';

/** Surface container. `tone` adds a left accent bar in the severity colour. */
export function Card({
  title,
  subtitle,
  icon,
  right,
  tone,
  onPress,
  children,
  style,
  accessibilityLabel,
}: {
  title?: string;
  subtitle?: string;
  icon?: IconName;
  right?: ReactNode;
  tone?: Severity;
  onPress?: () => void;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const header =
    title || icon || right ? (
      <View style={styles.header}>
        {icon ? <Icon name={icon} size={20} color={tone ? severityPalette[tone].fg : colors.primary} /> : null}
        <View style={styles.headerText}>
          {title ? <Text style={type.heading}>{title}</Text> : null}
          {subtitle ? <Text style={type.caption}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
    ) : null;

  const inner = (
    <>
      {tone ? <View style={[styles.accent, { backgroundColor: severityPalette[tone].fill }]} /> : null}
      {header}
      {children}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        style={({ pressed }) => [styles.card, shadow, pressed && styles.pressed, style]}>
        {inner}
      </Pressable>
    );
  }
  return <View style={[styles.card, shadow, style]}>{inner}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    overflow: 'hidden',
  },
  pressed: { backgroundColor: colors.surfaceAlt },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerText: { flex: 1, gap: 2 },
});
