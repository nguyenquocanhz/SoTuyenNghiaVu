import { StyleSheet, Text, View } from 'react-native';

import type { Score, Severity } from '@/domain/types';
import { radius, severityPalette, spacing } from '@/theme';

export const SCORE_SEVERITY: Record<Score, Severity> = {
  1: 'normal',
  2: 'normal',
  3: 'info',
  4: 'warning',
  5: 'danger',
  6: 'critical',
};

const SCORE_WORD: Record<Score, string> = {
  1: 'rất tốt',
  2: 'tốt',
  3: 'khá',
  4: 'trung bình',
  5: 'kém',
  6: 'rất kém',
};

/** "Điểm" 1–6 (Điều 6 TT 105/2023/TT-BQP) with its meaning; never colour alone. */
export function ScoreBadge({ score, temporary, label, compact }: { score?: Score; temporary?: boolean; label?: string; compact?: boolean }) {
  if (!score) {
    const p = severityPalette.unknown;
    return (
      <View style={[styles.badge, { backgroundColor: p.bg, borderColor: p.fill }]} accessibilityLabel="Chưa đủ số liệu để cho điểm">
        <Text style={[styles.text, { color: p.fg }]}>—</Text>
      </View>
    );
  }
  const p = severityPalette[SCORE_SEVERITY[score]];
  const text = `${label ? `${label} ` : ''}${score}${temporary ? 'T' : ''}${compact ? '' : ` · ${SCORE_WORD[score]}`}`;
  return (
    <View
      style={[styles.badge, { backgroundColor: p.bg, borderColor: p.fill }]}
      accessibilityLabel={`${label ?? 'Điểm'} ${score}${temporary ? ' tạm thời' : ''}, ${SCORE_WORD[score]}`}>
      <Text style={[styles.text, { color: p.fg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2, alignSelf: 'flex-start' },
  text: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
