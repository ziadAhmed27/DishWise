import { PressableScale } from '@/components/Anim';
import Chips from '@/components/Chips';
import Field from '@/components/Field';
import { Colors, radius, spacing } from '@/constants/nutri';
import { GENDERS, GOALS } from '@/constants/profileOptions';
import { Profile, useProfile } from '@/context/ProfileContext';
import { useStyles, useTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Errors = Partial<Record<keyof Profile, string>>;

function inRange(value: string, min: number, max: number) {
  const n = Number(value);
  return value.trim() !== '' && !Number.isNaN(n) && n >= min && n <= max;
}

function validate(p: Profile): Errors {
  const e: Errors = {};
  if (!p.name.trim()) e.name = 'Enter your name';
  if (!inRange(p.age, 5, 120)) e.age = 'Enter a valid age';
  if (!p.gender) e.gender = 'Choose one';
  if (p.phone.replace(/\D/g, '').length < 7) e.phone = 'Enter a valid phone number';
  if (!/^\S+@\S+\.\S+$/.test(p.email.trim())) e.email = 'Enter a valid email';
  if (!inRange(p.height, 50, 250)) e.height = 'Enter your height in cm';
  if (!inRange(p.weight, 20, 300)) e.weight = 'Enter your weight in kg';
  if (!p.goal) e.goal = 'Choose a goal';
  return e;
}

// Changes that should make the diet plan out of date.
const PLAN_FIELDS: (keyof Profile)[] = ['age', 'gender', 'height', 'weight', 'goal'];

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Called after saving. `planOutdated` is true when age/gender/height/weight/goal changed. */
  onSaved: (updated: Profile, planOutdated: boolean) => void;
};

export default function EditProfileModal({ visible, onClose, onSaved }: Props) {
  const { profile, saveProfile } = useProfile();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<Profile | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  // Start from the saved profile every time the sheet opens.
  useEffect(() => {
    if (visible && profile) {
      setForm({ ...profile });
      setErrors({});
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!form || !profile) return null;

  const set = (key: keyof Profile) => (value: string) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const save = async () => {
    if (saving) return;
    const e = validate(form);
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    try {
      const updated: Profile = {
        ...form,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      };
      const planOutdated = PLAN_FIELDS.some((k) => updated[k] !== profile[k]);
      await saveProfile(updated);
      onClose();
      onSaved(updated, planOutdated);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <View style={styles.flex}>
              <Text style={styles.title}>Edit profile</Text>
              <Text style={styles.titleAr}>تعديل الملف الشخصي</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: spacing.sm }}
          >
            <Field label="Name · الاسم" placeholder="Your full name" value={form.name} onChangeText={set('name')} error={errors.name} autoCapitalize="words" />
            <Field label="Age · السن" placeholder="e.g. 28" value={form.age} onChangeText={set('age')} error={errors.age} keyboardType="number-pad" maxLength={3} />
            <Chips label="Gender · النوع" options={GENDERS} value={form.gender} onChange={set('gender')} error={errors.gender} />
            <Field label="Phone number · رقم الموبايل" placeholder="Your phone number" value={form.phone} onChangeText={set('phone')} error={errors.phone} keyboardType="phone-pad" />
            <Field label="Email · البريد الإلكتروني" placeholder="you@email.com" value={form.email} onChangeText={set('email')} error={errors.email} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            <Field label="Height (cm) · الطول" placeholder="e.g. 170" value={form.height} onChangeText={set('height')} error={errors.height} keyboardType="number-pad" maxLength={3} />
            <Field label="Weight (kg) · الوزن" placeholder="e.g. 70" value={form.weight} onChangeText={set('weight')} error={errors.weight} keyboardType="decimal-pad" maxLength={5} />
            <Chips label="Your goal · هدفك" options={GOALS} value={form.goal} onChange={set('goal')} error={errors.goal} />
          </ScrollView>

          <PressableScale onPress={save} disabled={saving} style={[styles.button, saving && { opacity: 0.6 }]}>
            <Text style={styles.buttonText}>Save changes · حفظ التعديلات</Text>
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
    sheet: {
      maxHeight: '90%',
      backgroundColor: colors.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.sm },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    title: { fontSize: 20, fontWeight: '800', color: colors.text },
    titleAr: { fontSize: 13, color: colors.muted },
    closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
    scroll: { flexShrink: 1 },
    button: {
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });
