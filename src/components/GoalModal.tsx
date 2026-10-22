import { PressableScale } from '@/components/Anim';
import Bi from '@/components/Bi';
import { Colors, radius, spacing } from '@/constants/nutri';
import { GOAL_OPTIONS } from '@/constants/profileOptions';
import { Profile, useProfile } from '@/context/ProfileContext';
import { useStyles, useTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Called after the new goal is saved. */
  onSaved: (updated: Profile) => void;
};

export default function GoalModal({ visible, onClose, onSaved }: Props) {
  const { profile, saveProfile } = useProfile();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [sel, setSel] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setSel(profile?.goal ?? '');
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const unchanged = !profile || sel === profile.goal;

  const save = async () => {
    if (!profile || unchanged || saving) return;
    setSaving(true);
    try {
      const updated = { ...profile, goal: sel };
      await saveProfile(updated);
      onClose();
      onSaved(updated);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.title}>Your goal</Text>
            <Text style={styles.titleAr}>هدفك</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {GOAL_OPTIONS.map((g) => {
          const active = g.value === sel;
          return (
            <PressableScale
              key={g.value}
              onPress={() => setSel(g.value)}
              scaleTo={0.97}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={[styles.row, active && styles.rowActive]}
            >
              <View style={styles.rowIcon}>
                <Ionicons name={g.icon} size={20} color={colors.primary} />
              </View>
              <Bi en={g.value} ar={g.ar} style={styles.flex} />
              <View style={[styles.radio, active && styles.radioActive]}>{active && <View style={styles.radioDot} />}</View>
            </PressableScale>
          );
        })}

        <PressableScale
          onPress={save}
          disabled={unchanged || saving}
          style={[styles.button, (unchanged || saving) && { opacity: 0.4 }]}
        >
          <Text style={styles.buttonText}>Save goal · حفظ الهدف</Text>
        </PressableScale>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
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
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    rowActive: { borderColor: colors.primary, borderWidth: 2 },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: radius.sm,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioActive: { borderColor: colors.primary },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
    button: {
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });
