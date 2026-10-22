import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import Screen from '@/components/Screen';
import Bi from '@/components/Bi';
import { Appear, CountUp, FocusReplay } from '@/components/Anim';
import { Colors, radius, spacing } from '@/constants/nutri';
import { useStyles, useTheme } from '@/context/ThemeContext';
import { useProfile } from '@/context/ProfileContext';
import { BiText, CONDITIONS, usePlan } from '@/context/PlanContext';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TITLE = 'Diet plan · الخطة الغذائية';
const SUBTITLE = 'Your personalized plan · خطتك الخاصة';

const MEALS: { key: 'b' | 'l' | 'd' | 's'; en: string; ar: string; icon: IconName }[] = [
  { key: 'b', en: 'Breakfast', ar: 'الفطار', icon: 'sunny-outline' },
  { key: 'l', en: 'Lunch', ar: 'الغداء', icon: 'restaurant-outline' },
  { key: 'd', en: 'Dinner', ar: 'العشاء', icon: 'moon-outline' },
  { key: 's', en: 'Snacks', ar: 'سناكس', icon: 'cafe-outline' },
];

function Bullets({ items, color }: { items: BiText[]; color?: string }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const tint = color ?? colors.text;
  return (
    <>
      {items.map((t, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={[styles.bullet, { color: tint }]}>•</Text>
          <Bi en={t.en} ar={t.ar} style={styles.flex} enStyle={styles.bulletEn} arStyle={styles.bulletAr} />
        </View>
      ))}
    </>
  );
}

function CardTitle({ en, ar }: { en: string; ar: string }) {
  const styles = useStyles(makeStyles);
  return <Bi en={en} ar={ar} style={styles.cardTitleWrap} enStyle={styles.cardTitle} arStyle={styles.cardTitleAr} />;
}

function Message({
  icon,
  en,
  ar,
  button,
}: {
  icon?: IconName;
  en: string;
  ar: string;
  button?: { en: string; ar: string; onPress: () => void };
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Appear style={styles.center}>
      {icon && <Ionicons name={icon} size={40} color={colors.muted} />}
      <Bi en={en} ar={ar} center enStyle={styles.centerText} arStyle={styles.centerTextAr} />
      {button && (
        <TouchableOpacity style={styles.button} onPress={button.onPress}>
          <Text style={styles.buttonText}>
            {button.en} · {button.ar}
          </Text>
        </TouchableOpacity>
      )}
    </Appear>
  );
}

function DietContent() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const { profile } = useProfile();
  const { health, plan, status, error, generatePlan } = usePlan();

  /* ---------- No health data saved yet ---------- */
  if (!health) {
    return (
      <Screen title={TITLE} subtitle={SUBTITLE}>
        <Message
          icon="clipboard-outline"
          en="Fill in your health status first to get your plan."
          ar="املا حالتك الصحية الأول علشان تاخد خطتك."
          button={{ en: 'Go to health status', ar: 'روح للحالة الصحية', onPress: () => router.navigate('/form') }}
        />
      </Screen>
    );
  }

  /* ---------- Loading ---------- */
  if (status === 'loading') {
    return (
      <Screen title={TITLE} subtitle={SUBTITLE}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Bi en="Creating your plan…" ar="بنجهز خطتك…" center enStyle={styles.centerText} arStyle={styles.centerTextAr} />
        </View>
      </Screen>
    );
  }

  /* ---------- Error ---------- */
  if (status === 'error') {
    return (
      <Screen title={TITLE} subtitle={SUBTITLE}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.muted} />
          <Bi
            en={error || 'Could not create your plan.'}
            ar={error ? '' : 'مقدرناش نعمل خطتك.'}
            center
            enStyle={styles.centerText}
            arStyle={styles.centerTextAr}
          />
          {profile && (
            <TouchableOpacity style={styles.button} onPress={() => generatePlan(profile)}>
              <Text style={styles.buttonText}>Try again · حاول تاني</Text>
            </TouchableOpacity>
          )}
        </View>
      </Screen>
    );
  }

  /* ---------- Saved health but no plan generated yet ---------- */
  if (!plan) {
    return (
      <Screen title={TITLE} subtitle={SUBTITLE}>
        <Message
          en="Your plan has not been generated yet."
          ar="لسه ماعملناش خطتك."
          button={
            profile
              ? { en: 'Generate my plan', ar: 'أنشئ خطتي', onPress: () => generatePlan(profile) }
              : undefined
          }
        />
      </Screen>
    );
  }

  /* ---------- Plan ---------- */
  const chips: { key: string; en: string; ar?: string }[] = health.isHealthy
    ? [{ key: 'healthy', en: 'Healthy', ar: 'سليم' }]
    : [
        ...health.conditions.map((id) => {
          const c = CONDITIONS.find((x) => x.id === id);
          return { key: id, en: c?.en ?? id, ar: c?.ar };
        }),
        ...(health.otherDiseases ? [{ key: 'other', en: health.otherDiseases }] : []),
      ];

  const macros = [
    { en: 'Protein', ar: 'بروتين', value: `${plan.p} g` },
    { en: 'Carbs', ar: 'كربوهيدرات', value: `${plan.c} g` },
    { en: 'Fat', ar: 'دهون', value: `${plan.f} g` },
  ];

  return (
    <Screen title={TITLE} subtitle={SUBTITLE}>
      {/* Conditions */}
      <Appear index={0} style={styles.chips}>
        {chips.map((c) => (
          <View key={c.key} style={styles.chip}>
            <Text style={styles.chipText}>{c.en}</Text>
            {!!c.ar && <Text style={styles.chipTextAr}>{c.ar}</Text>}
          </View>
        ))}
      </Appear>

      {/* Nutrition requirements */}
      <Appear index={1} style={styles.summary}>
        <Text style={styles.summaryLabel}>Daily calories · السعرات اليومية</Text>
        <CountUp to={plan.kcal} suffix=" kcal" style={styles.summaryValue} />
        <View style={styles.macroRow}>
          {macros.map((m) => (
            <View key={m.en} style={styles.macro}>
              <Text style={styles.macroValue}>{m.value}</Text>
              <Text style={styles.macroLabel}>{m.en}</Text>
              <Text style={styles.macroLabel}>{m.ar}</Text>
            </View>
          ))}
        </View>
      </Appear>

      {/* General instructions */}
      <Appear index={2} style={styles.card}>
        <CardTitle en="General instructions" ar="تعليمات عامة" />
        <Bullets items={plan.tips} color={colors.primary} />
      </Appear>

      {/* Eat / avoid */}
      <Appear index={3} style={styles.card}>
        <CardTitle en="Best choices — what to eat" ar="أفضل الاختيارات — كُل إيه" />
        <Bullets items={plan.eat} color="#2E9E5B" />
      </Appear>
      <Appear index={4} style={styles.card}>
        <CardTitle en="What to avoid" ar="تجنّب إيه" />
        <Bullets items={plan.avoid} color="#D64545" />
      </Appear>

      {/* Meals */}
      {MEALS.map((m, mi) => (
        <Appear key={m.key} index={5 + mi} style={styles.card}>
          <View style={styles.mealHeader}>
            <View style={styles.mealIcon}>
              <Ionicons name={m.icon} size={20} color={colors.primary} />
            </View>
            <CardTitle en={m.en} ar={m.ar} />
          </View>
          <Bullets items={plan.meals[m.key] ?? []} color={colors.primary} />
        </Appear>
      ))}

      {/* Safety note */}
      <Appear index={8}>
        <Bi en={plan.note.en} ar={plan.note.ar} center style={styles.note} enStyle={styles.noteText} arStyle={styles.noteText} />
      </Appear>

      {profile && (
        <TouchableOpacity style={styles.regen} onPress={() => generatePlan(profile)}>
          <Ionicons name="refresh-outline" size={18} color={colors.primary} />
          <Text style={styles.regenText}>Regenerate plan · أعد إنشاء الخطة</Text>
        </TouchableOpacity>
      )}
    </Screen>
  );
}

export default function DietScreen() {
  return (
    <FocusReplay>
      <DietContent />
    </FocusReplay>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', paddingVertical: spacing.lg * 2, gap: spacing.md },
  centerText: { fontSize: 15, fontWeight: '400', color: colors.muted },
  centerTextAr: { fontSize: 14, color: colors.muted },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  chipTextAr: { fontSize: 12, color: colors.muted, marginTop: 1 },

  summary: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  summaryLabel: { fontSize: 14, color: colors.muted },
  summaryValue: { fontSize: 30, fontWeight: '700', color: colors.primary, marginTop: 2 },
  macroRow: { flexDirection: 'row', marginTop: spacing.md, gap: spacing.sm },
  macro: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  macroValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  macroLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  cardTitleWrap: { marginBottom: 6 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardTitleAr: { fontSize: 14, fontWeight: '600', color: colors.muted },
  bulletRow: { flexDirection: 'row', marginTop: 6 },
  bullet: { fontSize: 16, width: 16, lineHeight: 20 },
  bulletEn: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  bulletAr: { fontSize: 13, lineHeight: 19 },

  mealHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  mealIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },

  note: { marginVertical: spacing.md },
  noteText: { fontSize: 12, fontWeight: '400', color: colors.muted },
  regen: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm },
  regenText: { fontSize: 14, fontWeight: '600', color: colors.primary },
});
