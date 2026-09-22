import { StyleSheet, Text, View } from 'react-native';

import type { Severity } from '@/domain/types';
import { colors, radius, severityPalette, spacing, touchTarget, type } from '@/theme';

import { Button } from './Button';
import { Icon, type IconName } from './Icon';

export const MEDICAL_DISCLAIMER =
  'Kết quả chỉ mang tính tham khảo, hỗ trợ theo dõi sức khỏe tại nhà; không thay thế chẩn đoán hay điều trị của nhân viên y tế.';

export function Disclaimer({ text = MEDICAL_DISCLAIMER }: { text?: string }) {
  return (
    <View style={styles.disclaimer} accessibilityRole="text">
      <Icon name="shield-check-outline" size={18} color={colors.textMuted} />
      <Text style={[type.caption, styles.flex]}>{text}</Text>
    </View>
  );
}

export function InfoBanner({
  severity = 'info',
  title,
  message,
  action,
}: {
  severity?: Severity;
  title?: string;
  message: string;
  action?: { label: string; onPress: () => void };
}) {
  const p = severityPalette[severity];
  return (
    <View
      style={[styles.banner, { backgroundColor: p.bg, borderColor: p.fill }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite">
      <Icon name={p.icon as IconName} size={22} color={p.fg} />
      <View style={styles.flex}>
        {title ? <Text style={[type.bodyStrong, { color: p.fg }]}>{title}</Text> : null}
        <Text style={[type.body, { color: colors.text }]}>{message}</Text>
        {action ? <Button title={action.label} onPress={action.onPress} variant="ghost" style={styles.bannerAction} /> : null}
      </View>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: IconName;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void; icon?: IconName };
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={36} color={colors.primary} />
      </View>
      <Text style={[type.title, styles.center]}>{title}</Text>
      {message ? <Text style={[type.body, styles.center, { color: colors.textSecondary }]}>{message}</Text> : null}
      {action ? <Button title={action.label} icon={action.icon} onPress={action.onPress} style={styles.emptyAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  center: { textAlign: 'center' },
  disclaimer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  banner: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  bannerAction: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, marginLeft: -spacing.sm, minHeight: touchTarget },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyAction: { alignSelf: 'stretch' },
});
