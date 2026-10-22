import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { Colors, radius, spacing } from '@/constants/nutri';
import { useStyles, useTheme } from '@/context/ThemeContext';

type Props = TextInputProps & { label: string; error?: string };

export default function Field({ label, error, style, ...rest }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        keyboardAppearance={isDark ? 'dark' : 'light'}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    wrap: { marginBottom: spacing.md },
    label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 },
    input: {
      height: 50,
      borderRadius: radius.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      fontSize: 16,
      color: colors.text,
    },
    inputError: { borderColor: '#D9534F' },
    error: { color: '#D9534F', fontSize: 12, marginTop: 4 },
  });
