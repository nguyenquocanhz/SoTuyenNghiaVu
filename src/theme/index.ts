import { Platform, type TextStyle } from 'react-native';

import type { Severity } from '@/domain/types';

/**
 * Light theme in military green for the commune screening team.
 * Semantic colours follow the alarm-priority convention of IEC 60601-1-8
 * (red = high priority, yellow = medium, cyan/blue = low / informational) and
 * every status is always paired with a text label + icon so colour is never
 * the only carrier of meaning (WCAG 1.4.1).
 */
export const colors = {
  primary: '#2D5F3A',
  primaryPressed: '#1F4629',
  primarySoft: '#E6EFE7',
  accent: '#8A6A12',
  accentSoft: '#F6EFD9',

  background: '#F3F5F2',
  surface: '#FFFFFF',
  surfaceAlt: '#F7F9F6',
  border: '#D3DBD2',
  divider: '#E5EBE4',

  text: '#15211A',
  textSecondary: '#46554B',
  textMuted: '#687669',
  onPrimary: '#FFFFFF',

  normal: '#1B7A3A',
  normalSoft: '#E5F3E9',
  info: '#0A6AA8',
  infoSoft: '#E2F0FA',
  caution: '#8A5A00',
  cautionSoft: '#FFF3D1',
  cautionFill: '#E3A300',
  warning: '#B04309',
  warningSoft: '#FDE9DA',
  warningFill: '#E8680F',
  danger: '#B3261E',
  dangerSoft: '#FCE5E3',
  critical: '#7A0F12',
  criticalSoft: '#F6D3D3',
} as const;

export interface SeverityPalette {
  fg: string;
  bg: string;
  fill: string;
  icon: string;
  label: string;
}

export const severityPalette: Record<Severity, SeverityPalette> = {
  normal: { fg: colors.normal, bg: colors.normalSoft, fill: '#2E9E55', icon: 'check-circle', label: 'Bình thường' },
  info: { fg: colors.info, bg: colors.infoSoft, fill: '#2A8FD0', icon: 'information', label: 'Lưu ý' },
  caution: { fg: colors.caution, bg: colors.cautionSoft, fill: colors.cautionFill, icon: 'alert-circle-outline', label: 'Cần theo dõi' },
  warning: { fg: colors.warning, bg: colors.warningSoft, fill: colors.warningFill, icon: 'alert', label: 'Cảnh báo' },
  danger: { fg: colors.danger, bg: colors.dangerSoft, fill: '#D93A2F', icon: 'alert-octagon', label: 'Nguy cơ cao' },
  critical: { fg: colors.critical, bg: colors.criticalSoft, fill: '#9E1A1E', icon: 'alert-octagram', label: 'Khẩn cấp' },
  unknown: { fg: colors.textSecondary, bg: colors.surfaceAlt, fill: '#9AA7B3', icon: 'help-circle-outline', label: 'Chưa đủ dữ liệu' },
};

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 14, pill: 999 } as const;

/** Minimum touch target (Android 48dp / iOS 44pt). */
export const touchTarget = 48;

const tabular: TextStyle = { fontVariant: ['tabular-nums'] };
const monoFamily = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

export const type = {
  display: { fontSize: 56, lineHeight: 62, fontWeight: '700', color: colors.text, ...tabular },
  valueLg: { fontSize: 32, lineHeight: 38, fontWeight: '700', color: colors.text, ...tabular },
  valueMd: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: colors.text, ...tabular },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: colors.text },
  heading: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, lineHeight: 22, color: colors.text },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600', color: colors.text },
  caption: { fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  overline: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textMuted },
  unit: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: colors.textSecondary },
  mono: { fontSize: 12, lineHeight: 16, fontFamily: monoFamily, color: colors.textSecondary },
} satisfies Record<string, TextStyle>;

export const shadow = Platform.select({
  web: { boxShadow: '0 1px 2px rgba(15, 30, 44, 0.08)' },
  default: { elevation: 1, shadowColor: '#0F1E2C', shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
});
