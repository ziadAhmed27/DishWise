import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, radius, spacing } from '@/constants/nutri';
import { useStyles } from '@/context/ThemeContext';

type Props = {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  error?: string;
};

export default function Chips({ label, options, value, onChange, error }: Props) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {options.map((o) => {
          const active = o === value;
          return (
            <TouchableOpacity
              key={o}
              onPress={() => onChange(o)}
              activeOpacity={0.8}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{o}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    wrap: { marginBottom: spacing.md },
    label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      paddingHorizontal: 18,
      paddingVertical: 11,
      borderRadius: radius.pill,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 14, fontWeight: '600', color: colors.muted },
    chipTextActive: { color: '#fff' },
    error: { color: '#D9534F', fontSize: 12, marginTop: 4 },
  });
