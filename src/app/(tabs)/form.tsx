import Screen from '@/components/Screen';
import { Colors, radius, spacing } from '@/constants/nutri';
import { useStyles, useTheme } from '@/context/ThemeContext';
import { useProfile } from '@/context/ProfileContext';
import { conditionsForGender, HealthStatus, usePlan } from '@/context/PlanContext';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';
import { Appear, PressableScale } from '@/components/Anim';

/* Progress bar that fills up smoothly */
function ProgressFill({ pct }: { pct: number }) {
  const styles = useStyles(makeStyles);
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(pct, { duration: 700 });
  }, [pct]); // eslint-disable-line react-hooks/exhaustive-deps
  const anim = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return <Animated.View style={[styles.fill, anim]} />;
}

/* -------------------------------------------------------------------------- */
/*  Reusable checkbox row                                                     */
/* -------------------------------------------------------------------------- */

type OptionRowProps = {
  label: string;
  labelAr: string;
  checked: boolean;
  disabled?: boolean;
  onPress: () => void;
};

function OptionRow({ label, labelAr, checked, disabled, onPress }: OptionRowProps) {
  const styles = useStyles(makeStyles);
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.97}
      accessibilityRole="checkbox"
      accessibilityLabel={`${label}. ${labelAr}`}
      accessibilityState={{ checked, disabled: !!disabled }}
      style={[styles.row, checked && styles.rowChecked, disabled && styles.rowDisabled]}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && (
          <Animated.Text entering={ZoomIn.duration(180)} exiting={ZoomOut.duration(120)} style={styles.tick}>
            ✓
          </Animated.Text>
        )}
      </View>
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowTitle}>{label}</Text>
        <Text style={styles.rowSubtitle}>{labelAr}</Text>
      </View>
    </PressableScale>
  );
}

/* -------------------------------------------------------------------------- */
/*  Screen                                                                    */
/* -------------------------------------------------------------------------- */

const TOTAL_STEPS = 5;
const CURRENT_STEP = 2;

export default function FormScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const { profile } = useProfile();
  const { loaded, health, saveHealth, generatePlan } = usePlan();

  const [isHealthy, setIsHealthy] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [other, setOther] = useState('');
  const [saved, setSaved] = useState(false); // true after "Save", reset on any edit

  // Only conditions that make sense for the user's gender (e.g. no PCOS for men).
  const visibleConditions = useMemo(() => conditionsForGender(profile?.gender), [profile?.gender]);
  const allowedIds = useMemo(() => new Set(visibleConditions.map((c) => c.id)), [visibleConditions]);

  // Restore previously saved answers once storage is loaded.
  useEffect(() => {
    if (loaded && health) {
      setIsHealthy(health.isHealthy);
      const kept = health.conditions.filter((id) => allowedIds.has(id));
      setSelected(kept);
      setOther(health.otherDiseases);
      setSaved(kept.length === health.conditions.length); // dropped something => needs re-saving
    }
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // If the gender changes later, drop selections that no longer apply.
  useEffect(() => {
    setSelected((prev) => {
      const kept = prev.filter((id) => allowedIds.has(id));
      if (kept.length !== prev.length) setSaved(false);
      return kept.length !== prev.length ? kept : prev;
    });
  }, [allowedIds]);

  // "Healthy" wins: turning it on wipes everything else.
  const toggleHealthy = () => {
    const next = !isHealthy;
    setIsHealthy(next);
    setSaved(false);
    if (next) {
      setSelected([]);
      setOther('');
    }
  };

  const toggleCondition = (id: string) => {
    if (isHealthy) return;
    setSaved(false);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const canSubmit = useMemo(
    () => isHealthy || selected.length > 0 || other.trim().length > 0,
    [isHealthy, selected, other]
  );

  const handleSave = async () => {
    const payload: HealthStatus = {
      isHealthy,
      conditions: selected,
      otherDiseases: isHealthy ? '' : other.trim(),
    };
    await saveHealth(payload);
    setSaved(true);
  };

  const handleGenerate = () => {
    if (!profile) {
      Alert.alert('Profile missing', 'Please complete your profile first.');
      return;
    }
    generatePlan(profile); // starts the GPT request (state lives in PlanContext)
    router.navigate('/diet'); // diet tab shows loading, then the plan
  };

  return (
    <Screen
      title="Health Status · الحالة الصحية"
      subtitle="Tell us about any conditions so we can personalize your plan."
    >
      {/* Progress */}
      <Appear index={0} style={styles.progressWrap}>
        <Text style={styles.progressText}>
          Step {CURRENT_STEP} of {TOTAL_STEPS}
        </Text>
        <View style={styles.track}>
          <ProgressFill pct={(CURRENT_STEP / TOTAL_STEPS) * 100} />
        </View>
      </Appear>

      {/* Primary option */}
      <Appear index={1}>
        <OptionRow
          label="Healthy / No diseases"
          labelAr="سليم / مفيش أمراض"
          checked={isHealthy}
          onPress={toggleHealthy}
        />
      </Appear>

      {/* Conditions list */}
      <Text style={styles.sectionLabel}>Conditions · الأمراض</Text>
      {visibleConditions.map((c, i) => (
        <Appear key={c.id} index={i + 2}>
          <OptionRow
            label={c.en}
            labelAr={c.ar}
            checked={selected.includes(c.id)}
            disabled={isHealthy}
            onPress={() => toggleCondition(c.id)}
          />
        </Appear>
      ))}

      {/* Free text */}
      <Text style={styles.sectionLabel}>Other diseases · أمراض تانية</Text>
      <TextInput
        value={other}
        onChangeText={(t) => {
          setOther(t);
          setSaved(false);
        }}
        editable={!isHealthy}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        placeholder="Write any other condition here · اكتب أي أمراض تانية"
        placeholderTextColor={colors.muted}
        accessibilityLabel="Other diseases"
        style={[styles.textArea, isHealthy && styles.rowDisabled]}
      />

      {/* Save */}
      <PressableScale
        onPress={handleSave}
        disabled={!canSubmit || saved}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSubmit || saved }}
        style={[styles.button, (!canSubmit || saved) && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>{saved ? 'Saved ✓ · تم الحفظ' : 'Save · حفظ'}</Text>
      </PressableScale>

      {/* Appears only after saving */}
      {saved && (
        <Animated.View
          entering={FadeInDown.springify().damping(16)}
          exiting={FadeOut.duration(150)}
          style={styles.cta}
        >
          <Text style={styles.ctaTitle}>Your health status is saved</Text>
          <Text style={styles.ctaText}>
            Continue to generate your best diet plan based on your profile and health data.
          </Text>
          <Text style={styles.ctaTextAr}>كمّل علشان نعمل لك أفضل خطة غذائية حسب بياناتك.</Text>
          <PressableScale onPress={handleGenerate} accessibilityRole="button" style={styles.ctaButton}>
            <Text style={styles.buttonText}>Generate my plan · أنشئ خطتي</Text>
          </PressableScale>
        </Animated.View>
      )}
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */
/*  Styles                                                                    */
/* -------------------------------------------------------------------------- */

const makeStyles = (colors: Colors) => StyleSheet.create({
  progressWrap: { marginBottom: spacing.md },
  progressText: { fontSize: 13, color: colors.muted, marginBottom: 6 },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },

  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 56,
  },
  rowChecked: { borderColor: colors.primary, borderWidth: 2 },
  rowPressed: { opacity: 0.85 },
  rowDisabled: { opacity: 0.45 },
  rowTextWrap: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowSubtitle: { fontSize: 14, color: colors.muted, marginTop: 2 },

  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    backgroundColor: colors.background,
  },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: '#fff', fontSize: 15, fontWeight: '800', lineHeight: 18 },

  textArea: {
    minHeight: 110,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
  },

  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  cta: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  ctaTitle: { fontSize: 17, fontWeight: '700', color: colors.primary },
  ctaText: { fontSize: 14, color: colors.text, marginTop: 6 },
  ctaTextAr: { fontSize: 14, color: colors.muted, marginTop: 4 },
  ctaButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.md,
  },
});