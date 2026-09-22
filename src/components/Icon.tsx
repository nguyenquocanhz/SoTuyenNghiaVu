import { MaterialDesignIcons, type MaterialDesignIconsIconName } from '@react-native-vector-icons/material-design-icons';
import type { ColorValue, StyleProp, TextStyle } from 'react-native';

import { colors } from '@/theme';

export type IconName = MaterialDesignIconsIconName;

export function Icon({
  name,
  size = 22,
  color = colors.text,
  style,
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<TextStyle>;
}) {
  return <MaterialDesignIcons name={name} size={size} color={color} style={style} accessibilityElementsHidden importantForAccessibility="no" />;
}
