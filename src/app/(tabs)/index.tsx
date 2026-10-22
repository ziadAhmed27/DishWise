import { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Screen from '@/components/Screen';
import Bi from '@/components/Bi';
import Animated, { FadeInDown, FadeOut, ZoomIn } from 'react-native-reanimated';
import { Appear, FocusReplay } from '@/components/Anim';
import EditProfileModal from '@/components/EditProfileModal';
import GoalModal from '@/components/GoalModal';
import { Profile, useProfile } from '@/context/ProfileContext';
import { usePlan } from '@/context/PlanContext';
import { useStyles, useTheme } from '@/context/ThemeContext';
import { Colors, radius, spacing } from '@/constants/nutri';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const menu: { key: string; en: string; ar: string; icon: IconName }[] = [
  { key: 'goals', en: 'Goals', ar: 'الأهداف', icon: 'flag-outline' },
  { key: 'notifications', en: 'Notifications', ar: 'الإشعارات', icon: 'notifications-outline' },
  { key: 'settings', en: 'Settings', ar: 'الإعدادات', icon: 'settings-outline' },
];

function ProfileContent() {
  const { profile } = useProfile();
  const { colors, isDark, setDark } = useTheme();
  const styles = useStyles(makeStyles);
  const { plan, generatePlan } = usePlan();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // After the profile changes, offer to rebuild the diet plan (only if one exists).
  const offerPlanUpdate = (updated: Profile) => {
    if (!plan) return;
    setTimeout(() => {
      Alert.alert(
        'Update your diet plan?',
        'Your details changed. Regenerate your plan to match them.\nغيّرت بياناتك. تحب نحدّث الخطة؟',
        [
          { text: 'Later · بعدين', style: 'cancel' },
          {
            text: 'Update · تحديث',
            onPress: () => {
              generatePlan(updated);
              router.navigate('/diet');
            },
          },
        ]
      );
    }, 350); // let the sheet finish closing first (iOS drops alerts shown mid-dismiss)
  };

  if (!profile) return null;

  const stats = [
    { en: 'Weight', ar: 'الوزن', value: `${profile.weight} kg` },
    { en: 'Height', ar: 'الطول', value: `${profile.height} cm` },
    { en: 'Age', ar: 'السن', value: profile.age },
  ];

  const details: { en: string; ar: string; value: string; icon: IconName }[] = [
    { en: 'Goal', ar: 'الهدف', value: profile.goal, icon: 'flag-outline' },
    { en: 'Gender', ar: 'النوع', value: profile.gender, icon: 'person-outline' },
    { en: 'Phone', ar: 'رقم الموبايل', value: profile.phone, icon: 'call-outline' },
    { en: 'Email', ar: 'البريد الإلكتروني', value: profile.email, icon: 'mail-outline' },
  ];

  return (
    <Screen title="Profile · الملف الشخصي">
      <Appear index={0} style={styles.userCard}>
        <Animated.View entering={ZoomIn.delay(250).springify().damping(12)} style={styles.avatar}>
          <Text style={styles.initial}>{profile.name.trim().charAt(0).toUpperCase()}</Text>
        </Animated.View>
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.email}>{profile.email}</Text>
      </Appear>

      <Appear index={1} style={styles.statsRow}>
        {stats.map((s) => (
          <View key={s.en} style={styles.stat}>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.en}</Text>
            <Text style={styles.statLabel}>{s.ar}</Text>
          </View>
        ))}
      </Appear>

      <Appear index={2} style={styles.menu}>
        {details.map((d, i) => (
          <View key={d.en} style={[styles.row, i < details.length - 1 && styles.rowDivider]}>
            <View style={styles.rowIcon}>
              <Ionicons name={d.icon} size={20} color={colors.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.detailLabel}>
                {d.en} · {d.ar}
              </Text>
              <Text style={styles.detailValue}>{d.value}</Text>
            </View>
          </View>
        ))}
      </Appear>

      <Appear index={3} style={[styles.menu, { marginTop: spacing.md }]}>
        {menu.map((item, i) => {
          const isSettings = item.key === 'settings';
          const open = isSettings && settingsOpen;
          return (
            <View key={item.key}>
              <TouchableOpacity
                style={[styles.row, (i < menu.length - 1 || open) && styles.rowDivider]}
                activeOpacity={0.6}
                onPress={
                  isSettings
                    ? () => setSettingsOpen((o) => !o)
                    : item.key === 'goals'
                      ? () => setGoalOpen(true)
                      : undefined
                }
              >
                <View style={styles.rowIcon}>
                  <Ionicons name={item.icon} size={20} color={colors.primary} />
                </View>
                <Bi en={item.en} ar={item.ar} style={styles.rowText} enStyle={styles.rowLabel} arStyle={styles.rowLabelAr} />
                <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={18} color={colors.muted} />
              </TouchableOpacity>

              {open && (
                <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOut.duration(120)}>
                  <TouchableOpacity
                    style={[styles.row, styles.rowDivider]}
                    activeOpacity={0.6}
                    onPress={() => setEditOpen(true)}
                  >
                    <View style={styles.rowIcon}>
                      <Ionicons name="create-outline" size={20} color={colors.primary} />
                    </View>
                    <Bi
                      en="Edit profile"
                      ar="تعديل الملف الشخصي"
                      style={styles.rowText}
                      enStyle={styles.rowLabel}
                      arStyle={styles.rowLabelAr}
                    />
                    <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                  </TouchableOpacity>
                  <View style={styles.row}>
                  <View style={styles.rowIcon}>
                    <Ionicons name={isDark ? 'moon' : 'moon-outline'} size={20} color={colors.primary} />
                  </View>
                  <Bi
                    en="Night mode"
                    ar="الوضع الليلي"
                    style={styles.rowText}
                    enStyle={styles.rowLabel}
                    arStyle={styles.rowLabelAr}
                  />
                  <Switch
                    value={isDark}
                    onValueChange={setDark}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#fff"
                    accessibilityLabel="Night mode"
                  />
                  </View>
                </Animated.View>
              )}
            </View>
          );
        })}
      </Appear>

      <GoalModal visible={goalOpen} onClose={() => setGoalOpen(false)} onSaved={offerPlanUpdate} />
      <EditProfileModal
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(updated, planOutdated) => planOutdated && offerPlanUpdate(updated)}
      />
    </Screen>
  );
}

export default function ProfileScreen() {
  return (
    <FocusReplay>
      <ProfileContent />
    </FocusReplay>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    userCard: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatar: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    initial: { fontSize: 34, fontWeight: '700', color: colors.primary },
    name: { fontSize: 20, fontWeight: '700', color: colors.text },
    email: { fontSize: 14, color: colors.muted, marginTop: 2 },
    statsRow: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md },
    stat: {
      flex: 1,
      backgroundColor: colors.primarySoft,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    statValue: { fontSize: 18, fontWeight: '700', color: colors.primary },
    statLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
    menu: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    row: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
    rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: radius.sm,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    rowText: { flex: 1 },
    detailLabel: { fontSize: 12, color: colors.muted },
    detailValue: { fontSize: 16, color: colors.text, marginTop: 1 },
    rowLabel: { fontSize: 16, fontWeight: '400', color: colors.text },
    rowLabelAr: { fontSize: 13, color: colors.muted },
  });
