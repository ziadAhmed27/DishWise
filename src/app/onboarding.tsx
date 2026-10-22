import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Field from '@/components/Field';
import Chips from '@/components/Chips';
import { Profile, useProfile } from '@/context/ProfileContext';
import { Colors, radius, spacing } from '@/constants/nutri';
import { useStyles, useTheme } from '@/context/ThemeContext';

const GENDERS = ['Female', 'Male'];
const GOALS = ['Lose weight', 'Maintain weight', 'Gain weight', 'Eat healthier'];

const STEPS = [
  { title: "Let's get to know you", subtitle: 'Tell us the basics.' },
  { title: 'How can we reach you?', subtitle: 'Your contact details.' },
  { title: 'Your body and goal', subtitle: 'This helps us build your plan.' },
];

const emptyProfile: Profile = {
  name: '',
  age: '',
  gender: '',
  phone: '',
  email: '',
  height: '',
  weight: '',
  goal: '',
};

type Errors = Partial<Record<keyof Profile, string>>;

function inRange(value: string, min: number, max: number) {
  const n = Number(value);
  return value.trim() !== '' && !Number.isNaN(n) && n >= min && n <= max;
}

function validate(step: number, p: Profile): Errors {
  const e: Errors = {};
  if (step === 0) {
    if (!p.name.trim()) e.name = 'Enter your name';
    if (!inRange(p.age, 5, 120)) e.age = 'Enter a valid age';
    if (!p.gender) e.gender = 'Choose one';
  }
  if (step === 1) {
    if (p.phone.replace(/\D/g, '').length < 7) e.phone = 'Enter a valid phone number';
    if (!/^\S+@\S+\.\S+$/.test(p.email.trim())) e.email = 'Enter a valid email';
  }
  if (step === 2) {
    if (!inRange(p.height, 50, 250)) e.height = 'Enter your height in cm';
    if (!inRange(p.weight, 20, 300)) e.weight = 'Enter your weight in kg';
    if (!p.goal) e.goal = 'Choose a goal';
  }
  return e;
}

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { saveProfile } = useProfile();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Profile>(emptyProfile);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const set = (key: keyof Profile) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const isLast = step === STEPS.length - 1;

  const next = async () => {
    const e = validate(step, form);
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    if (!isLast) {
      setStep(step + 1);
      return;
    }

    setSaving(true);
    try {
      await saveProfile({
        ...form,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      });
      // The root layout moves the user to the app once the profile is saved
    } finally {
      setSaving(false);
    }
  };

  const back = () => {
    setErrors({});
    setStep(Math.max(0, step - 1));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topRow}>
            {step > 0 ? (
              <TouchableOpacity onPress={back} style={styles.backBtn} hitSlop={10}>
                <Ionicons name="chevron-back" size={22} color={colors.text} />
              </TouchableOpacity>
            ) : (
              <View style={styles.backBtn} />
            )}
            <Text style={styles.stepText}>
              Step {step + 1} of {STEPS.length}
            </Text>
            <View style={styles.backBtn} />
          </View>

          <View style={styles.track}>
            <View style={[styles.fill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
          </View>

          {step === 0 && <Text style={styles.kicker}>Create a profile</Text>}
          <Text style={styles.title}>{STEPS[step].title}</Text>
          <Text style={styles.subtitle}>{STEPS[step].subtitle}</Text>

          {step === 0 && (
            <View style={styles.form}>
              <Field label="Name" placeholder="Your full name" value={form.name} onChangeText={set('name')} error={errors.name} autoCapitalize="words" />
              <Field label="Age" placeholder="e.g. 28" value={form.age} onChangeText={set('age')} error={errors.age} keyboardType="number-pad" maxLength={3} />
              <Chips label="Gender" options={GENDERS} value={form.gender} onChange={set('gender')} error={errors.gender} />
            </View>
          )}

          {step === 1 && (
            <View style={styles.form}>
              <Field label="Phone number" placeholder="Your phone number" value={form.phone} onChangeText={set('phone')} error={errors.phone} keyboardType="phone-pad" />
              <Field label="Email" placeholder="you@email.com" value={form.email} onChangeText={set('email')} error={errors.email} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            </View>
          )}

          {step === 2 && (
            <View style={styles.form}>
              <Field label="Height (cm)" placeholder="e.g. 170" value={form.height} onChangeText={set('height')} error={errors.height} keyboardType="number-pad" maxLength={3} />
              <Field label="Weight (kg)" placeholder="e.g. 70" value={form.weight} onChangeText={set('weight')} error={errors.weight} keyboardType="decimal-pad" maxLength={5} />
              <Chips label="Your goal" options={GOALS} value={form.goal} onChange={set('goal')} error={errors.goal} />
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={[styles.button, saving && { opacity: 0.6 }]} onPress={next} disabled={saving} activeOpacity={0.85}>
            <Text style={styles.buttonText}>{isLast ? 'Finish' : 'Continue'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  track: { height: 6, borderRadius: radius.pill, backgroundColor: colors.border, overflow: 'hidden', marginBottom: spacing.lg },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
  kicker: { fontSize: 14, fontWeight: '700', color: colors.primary, marginBottom: 6 },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 15, color: colors.muted, marginTop: 4, marginBottom: spacing.lg },
  form: { marginTop: spacing.xs },
  footer: { padding: spacing.lg, paddingTop: spacing.sm },
  button: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});