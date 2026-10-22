import { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, spacing } from '@/constants/nutri';
import { useStyles } from '@/context/ThemeContext';

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  scroll?: boolean;
};

export default function Screen({ title, subtitle, children, scroll = true }: Props) {
  const styles = useStyles(makeStyles);
  const header = (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={styles.flex}>
          <View style={styles.headerPad}>{header}</View>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    content: { padding: spacing.md, paddingBottom: spacing.xl },
    headerPad: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
    header: { marginBottom: spacing.md },
    title: { fontSize: 28, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: 15, color: colors.muted, marginTop: 4 },
  });
