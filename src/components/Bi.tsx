import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { Colors } from '@/constants/nutri';
import { useStyles } from '@/context/ThemeContext';

/**
 * Bilingual text block: English on top (left), Arabic below (right).
 * Same look as the rows in form.tsx. If `ar` is empty (e.g. an old cached
 * plan) only the English line is shown.
 */
type Props = {
  en: string;
  ar?: string;
  center?: boolean;
  style?: StyleProp<ViewStyle>;
  enStyle?: StyleProp<TextStyle>;
  arStyle?: StyleProp<TextStyle>;
};

export default function Bi({ en, ar, center, style, enStyle, arStyle }: Props) {
  const styles = useStyles(makeStyles);
  const align = center ? ({ textAlign: 'center' } as const) : null;
  return (
    <View style={style}>
      <Text style={[styles.en, align, enStyle]}>{en}</Text>
      {!!ar && <Text style={[styles.ar, align, arStyle]}>{ar}</Text>}
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    en: { fontSize: 15, fontWeight: '600', color: colors.text },
    ar: { fontSize: 14, color: colors.muted, marginTop: 2 },
  });
