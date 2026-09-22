import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors, type } from '@/theme';

/**
 * Circular countdown: a track plus a clockwise progress arc starting at 12 o'clock.
 * The centre shows the remaining whole seconds unless `children` are supplied.
 */
export function CountdownRing({
  progress,
  remainingSec,
  size = 220,
  color = colors.primary,
  children,
}: {
  /** 0 → 1 */
  progress: number;
  remainingSec: number;
  size?: number;
  color?: string;
  children?: ReactNode;
}) {
  const stroke = Math.max(8, Math.round(size * 0.07));
  const r = (size - stroke) / 2;
  const centre = size / 2;
  const circumference = 2 * Math.PI * r;
  const p = Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 1) : 0;
  const seconds = Number.isFinite(remainingSec) ? Math.max(0, Math.ceil(remainingSec)) : 0;
  const digitSize = Math.round(size * 0.26);

  return (
    <View
      style={[styles.root, { width: size, height: size }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Còn ${seconds} giây`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}>
      <Svg width={size} height={size}>
        <Circle cx={centre} cy={centre} r={r} stroke={colors.divider} strokeWidth={stroke} fill="none" />
        {p > 0 ? (
          <Circle
            cx={centre}
            cy={centre}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap={p >= 1 ? 'butt' : 'round'}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - p)}
            transform={`rotate(-90 ${centre} ${centre})`}
          />
        ) : null}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.centre]} pointerEvents="none">
        {children ?? (
          <>
            <Text style={[type.display, { fontSize: digitSize, lineHeight: Math.round(digitSize * 1.12) }]}>{seconds}</Text>
            <Text style={type.unit}>giây</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'center' },
  centre: { alignItems: 'center', justifyContent: 'center', padding: 16 },
});
