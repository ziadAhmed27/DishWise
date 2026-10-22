import { Appear, FocusReplay, PressableScale } from '@/components/Anim';
import Screen from '@/components/Screen';
import { analyzeFood, Nutrients, Rating } from '@/constants/gemini';
import { Colors, radius, spacing } from '@/constants/nutri';
import { useStyles, useTheme } from '@/context/ThemeContext';
import { useProfile } from '@/context/ProfileContext';
import { BiText, CONDITIONS, usePlan } from '@/context/PlanContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type MealKey = 'b' | 'l' | 'd' | 's';
type Plan = ReturnType<typeof usePlan>['plan'];

type Entry = {
  id: string;
  meal: MealKey;
  name: string;
  details: string;
  amount: string;
  status: 'loading' | 'done' | 'error';
  n?: Nutrients;
  rating?: Rating;
  reason?: BiText; // only for red
};

const MEALS: { key: MealKey; en: string; ar: string; icon: IconName }[] = [
  { key: 'b', en: 'Breakfast', ar: 'الفطار', icon: 'sunny-outline' },
  { key: 'l', en: 'Lunch', ar: 'الغداء', icon: 'restaurant-outline' },
  { key: 'd', en: 'Dinner', ar: 'العشاء', icon: 'moon-outline' },
  { key: 's', en: 'Snacks', ar: 'سناكس', icon: 'cafe-outline' },
];

const RED = '#D64545';
const GREEN = '#2E9E5B';
const getRatings = (muted: string): Record<Rating, { color: string; bg: string; icon: IconName; en: string; ar: string }> => ({
  green: { color: GREEN, bg: 'rgba(46,158,91,0.15)', icon: 'checkmark-circle', en: 'Best choice', ar: 'اختيار ممتاز' },
  normal: { color: muted, bg: 'rgba(123,140,132,0.18)', icon: 'remove-circle-outline', en: 'Normal', ar: 'عادي' },
  red: { color: RED, bg: 'rgba(214,69,69,0.15)', icon: 'warning', en: 'Avoid', ar: 'تجنّبه' },
});

function RatingBadge({ rating }: { rating: Rating }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const r = getRatings(colors.muted)[rating];
  return (
    <View style={[styles.badge, { backgroundColor: r.bg }]}>
      <Ionicons name={r.icon} size={13} color={r.color} />
      <Text style={[styles.badgeText, { color: r.color }]}>
        {r.en} · {r.ar}
      </Text>
    </View>
  );
}
const MACRO_COLORS = { p: '#4C8BF5', c: '#F5A524', f: '#E5617A' };

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const WEEKDAY_HEADS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const pad = (n: number) => String(n).padStart(2, '0');

// Same key format as before, so existing saved logs keep working.
const keyOf = (d: Date) => `nutri_log_${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

const parseEntries = (raw: string | null): Entry[] => {
  if (!raw) return [];
  try {
    const saved: Entry[] = JSON.parse(raw);
    // anything that was still loading when the app closed becomes retry-able
    return saved.map((e) => (e.status === 'loading' ? { ...e, status: 'error' } : e));
  } catch {
    return [];
  }
};

const sumEntries = (entries: Entry[]) => {
  const t = { kcal: 0, p: 0, c: 0, f: 0, fiber: 0, sugar: 0 };
  for (const e of entries) {
    if (e.n) {
      t.kcal += e.n.kcal;
      t.p += e.n.p;
      t.c += e.n.c;
      t.f += e.n.f;
      t.fiber += e.n.fiber;
      t.sugar += e.n.sugar;
    }
  }
  return t;
};

/* --------------------------------- Hooks ---------------------------------- */

/** Ticks every second; only re-renders the component that uses it. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setNow(new Date());
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, []);
  return now;
}

/** Returns today's storage key and only changes (re-rendering) when the date changes — i.e. at midnight. */
function useDayKey() {
  const [key, setKey] = useState(() => keyOf(new Date()));
  useEffect(() => {
    const check = () => setKey(keyOf(new Date())); // same string → React bails out, no re-render
    const id = setInterval(check, 1000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, []);
  return key;
}

/* ------------------------------ Progress bar ------------------------------ */
function Bar({ pct, over, color }: { pct: number; over?: boolean; color?: string }) {
  const styles = useStyles(makeStyles);
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(Math.min(pct, 100), { duration: 600 });
  }, [pct]); // eslint-disable-line react-hooks/exhaustive-deps
  const anim = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return (
    <View style={styles.track}>
      <Animated.View
        style={[styles.fill, color && { backgroundColor: color }, over && styles.fillOver, anim]}
      />
    </View>
  );
}

/* ------------------------------- Clock card ------------------------------- */
function ClockCard({ onOpenHistory }: { onOpenHistory: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const now = useNow();
  const h = now.getHours();
  const h12 = h % 12 || 12;
  const ampm = h < 12 ? 'AM · ص' : 'PM · م';

  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  const left = Math.max(0, nextMidnight - now.getTime());
  const lh = Math.floor(left / 3600000);
  const lm = Math.floor((left % 3600000) / 60000);

  return (
    <View style={styles.clockCard}>
      <View style={{ flex: 1 }}>
        <View style={styles.clockRow}>
          <Text style={styles.clockTime}>
            {pad(h12)}:{pad(now.getMinutes())}
          </Text>
          <Text style={styles.clockSeconds}>:{pad(now.getSeconds())}</Text>
          <Text style={styles.clockAmPm}>{ampm}</Text>
        </View>
        <Text style={styles.clockDate}>
          {DAYS_EN[now.getDay()]}, {now.getDate()} {MONTHS_EN[now.getMonth()]} {now.getFullYear()}
        </Text>
        <Text style={styles.clockDateAr}>
          {DAYS_AR[now.getDay()]} {now.getDate()} {MONTHS_AR[now.getMonth()]}
        </Text>
        <View style={styles.resetPill}>
          <Ionicons name="refresh-outline" size={12} color="#fff" />
          <Text style={styles.resetText}>
            New day in {lh}h {lm}m · يوم جديد بعد
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.historyBtn} onPress={onOpenHistory} activeOpacity={0.8}>
        <Ionicons name="calendar-outline" size={22} color={colors.primary} />
        <Text style={styles.historyBtnText}>History</Text>
        <Text style={styles.historyBtnTextAr}>السجل</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ----------------------------- History calendar ---------------------------- */
function HistoryModal({
  visible,
  onClose,
  plan,
  todayKey,
  todayEntries,
}: {
  visible: boolean;
  onClose: () => void;
  plan: Plan;
  todayKey: string;
  todayEntries: Entry[];
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const ratings = getRatings(colors.muted);
  const [view, setView] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [sel, setSel] = useState(() => new Date());
  const [data, setData] = useState<Record<string, Entry[]>>({});

  // Each time it opens, jump back to the current month with today selected.
  useEffect(() => {
    if (visible) {
      const d = new Date();
      setView({ y: d.getFullYear(), m: d.getMonth() });
      setSel(d);
    }
  }, [visible]);

  // Load every day of the visible month in one go.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const count = new Date(view.y, view.m + 1, 0).getDate();
    const keys = Array.from({ length: count }, (_, i) => keyOf(new Date(view.y, view.m, i + 1)));
    AsyncStorage.multiGet(keys)
      .then((rows) => {
        if (cancelled) return;
        const out: Record<string, Entry[]> = {};
        rows.forEach(([k, v]) => {
          out[k] = parseEntries(v);
        });
        setData(out);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible, view.y, view.m]);

  const entriesFor = (k: string) => (k === todayKey ? todayEntries : data[k] ?? []);

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const isCurrentMonth = view.y === today.getFullYear() && view.m === today.getMonth();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const blanks = new Date(view.y, view.m, 1).getDay();

  const goMonth = (delta: number) => {
    const d = new Date(view.y, view.m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  const selKey = keyOf(sel);
  const selEntries = entriesFor(selKey);
  const selTotals = sumEntries(selEntries);
  const selOver = !!plan && selTotals.kcal > plan.kcal;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={styles.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetTitle}>Diet history</Text>
            <Text style={styles.sheetTitleAr}>سجل الأكل</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.lg }}>
          {/* Month switcher */}
          <View style={styles.monthRow}>
            <TouchableOpacity onPress={() => goMonth(-1)} hitSlop={10} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.monthText}>
                {MONTHS_EN[view.m]} {view.y}
              </Text>
              <Text style={styles.monthTextAr}>{MONTHS_AR[view.m]}</Text>
            </View>
            <TouchableOpacity
              onPress={() => goMonth(1)}
              disabled={isCurrentMonth}
              hitSlop={10}
              style={[styles.navBtn, isCurrentMonth && { opacity: 0.3 }]}
            >
              <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Weekday heads */}
          <View style={styles.weekRow}>
            {WEEKDAY_HEADS.map((d, i) => (
              <Text key={i} style={styles.weekHead}>
                {d}
              </Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={styles.grid}>
            {Array.from({ length: blanks }, (_, i) => (
              <View key={`b${i}`} style={styles.cell} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const date = new Date(view.y, view.m, i + 1);
              const k = keyOf(date);
              const list = entriesFor(k);
              const kcal = list.reduce((s, e) => s + (e.n?.kcal ?? 0), 0);
              const future = date > startOfToday;
              const isToday = k === todayKey;
              const isSel = k === selKey;
              const hasData = list.length > 0;
              const dotOver = !!plan && kcal > plan.kcal;

              return (
                <TouchableOpacity
                  key={k}
                  style={styles.cell}
                  disabled={future}
                  onPress={() => setSel(date)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      isToday && styles.dayToday,
                      isSel && styles.daySelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        future && { color: colors.border },
                        isSel && { color: '#fff', fontWeight: '700' },
                      ]}
                    >
                      {i + 1}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.dot,
                      hasData && { backgroundColor: isSel ? '#fff' : dotOver ? RED : colors.primary },
                    ]}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Selected day details */}
          <View style={styles.detail}>
            <Text style={styles.detailTitle}>
              {DAYS_EN[sel.getDay()]}, {sel.getDate()} {MONTHS_EN[sel.getMonth()]}
            </Text>
            <Text style={styles.detailTitleAr}>
              {DAYS_AR[sel.getDay()]} {sel.getDate()} {MONTHS_AR[sel.getMonth()]}
            </Text>

            {selEntries.length === 0 ? (
              <View style={styles.emptyDay}>
                <Ionicons name="leaf-outline" size={26} color={colors.muted} />
                <Text style={styles.emptyDayText}>Nothing logged this day · مفيش أكل متسجل</Text>
              </View>
            ) : (
              <>
                <View style={styles.detailSummary}>
                  <Text style={[styles.detailKcal, selOver && { color: RED }]}>
                    {Math.round(selTotals.kcal)}
                    {plan ? <Text style={styles.detailKcalGoal}> / {plan.kcal}</Text> : null} kcal
                  </Text>
                  {plan && <Bar pct={(selTotals.kcal / plan.kcal) * 100} over={selOver} />}
                  <View style={styles.chipRow}>
                    <Text style={[styles.chip, { color: MACRO_COLORS.p }]}>P {Math.round(selTotals.p)} g</Text>
                    <Text style={[styles.chip, { color: MACRO_COLORS.c }]}>C {Math.round(selTotals.c)} g</Text>
                    <Text style={[styles.chip, { color: MACRO_COLORS.f }]}>F {Math.round(selTotals.f)} g</Text>
                  </View>
                </View>

                {MEALS.map((m) => {
                  const list = selEntries.filter((e) => e.meal === m.key);
                  if (!list.length) return null;
                  return (
                    <View key={m.key} style={styles.histMeal}>
                      <View style={styles.histMealHead}>
                        <Ionicons name={m.icon} size={16} color={colors.primary} />
                        <Text style={styles.histMealTitle}>
                          {m.en} · {m.ar}
                        </Text>
                      </View>
                      {list.map((e) => (
                        <View key={e.id} style={styles.histEntry}>
                          <View style={{ flex: 1 }}>
                            <View style={styles.histNameRow}>
                              {!!e.rating && <View style={[styles.ratingDot, { backgroundColor: ratings[e.rating].color }]} />}
                              <Text style={styles.histEntryName}>{e.name}</Text>
                            </View>
                            {e.rating === 'red' && !!e.reason?.en && <Text style={styles.histReason}>{e.reason.en}</Text>}
                            {!!(e.amount || e.details) && (
                              <Text style={styles.entryMeta}>
                                {[e.amount, e.details].filter(Boolean).join(' · ')}
                              </Text>
                            )}
                          </View>
                          <Text style={styles.histEntryKcal}>{e.n ? `${e.n.kcal} kcal` : '—'}</Text>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

/* --------------------------------- Screen --------------------------------- */
function TrackerContent() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const { plan, health } = usePlan();
  const { profile } = useProfile();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [openMeal, setOpenMeal] = useState<MealKey | null>(null);
  const [name, setName] = useState('');
  const [details, setDetails] = useState('');
  const [amount, setAmount] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);

  const dayKey = useDayKey(); // changes at midnight
  const loaded = useRef(false);
  const activeKey = useRef(dayKey);
  const entriesRef = useRef<Entry[]>(entries);
  entriesRef.current = entries;

  // Load the current day's log. When the date rolls over (midnight, or the app
  // returns from background on a new day) yesterday is saved and the screen restarts empty.
  useEffect(() => {
    const prev = activeKey.current;
    if (prev !== dayKey && loaded.current) {
      AsyncStorage.setItem(prev, JSON.stringify(entriesRef.current)).catch(() => {});
    }
    activeKey.current = dayKey;
    loaded.current = false;

    // fresh start
    setEntries([]);
    setOpenMeal(null);
    setName('');
    setDetails('');
    setAmount('');

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(dayKey);
        if (activeKey.current !== dayKey) return;
        const saved = parseEntries(raw);
        if (saved.length) setEntries(saved);
      } finally {
        if (activeKey.current === dayKey) loaded.current = true;
      }
    })();
  }, [dayKey]);

  useEffect(() => {
    if (loaded.current) AsyncStorage.setItem(activeKey.current, JSON.stringify(entries)).catch(() => {});
  }, [entries]);

  const patch = useCallback((id: string, p: Partial<Entry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...p } : e)));
  }, []);

const analyze = useCallback(
  async (e: Entry) => {
    patch(e.id, { status: 'loading' });
    try {
      const ctx = {
        profile: profile
          ? { age: profile.age, gender: profile.gender, weight: profile.weight, height: profile.height, goal: profile.goal }
          : undefined,
        conditions: (health?.conditions ?? []).map((id) => ({
          id,
          en: CONDITIONS.find((x) => x.id === id)?.en ?? id,
        })),
        other: health?.otherDiseases ?? '',
        lists: plan ? { eat: plan.eat.map((t) => t.en), avoid: plan.avoid.map((t) => t.en) } : undefined,
      };
      const { n, rating, reason } = await analyzeFood(e.name, e.details, e.amount, ctx);
      patch(e.id, { status: 'done', n, rating, reason: rating === 'red' ? reason : undefined });
    } catch {
      patch(e.id, { status: 'error' });
    }
  },
  [patch, plan, health, profile]
);

  const addEntry = () => {
    if (!openMeal || !name.trim()) return;
    const e: Entry = {
      id: String(Date.now()),
      meal: openMeal,
      name: name.trim(),
      details: details.trim(),
      amount: amount.trim(),
      status: 'loading',
    };
    setEntries((prev) => [...prev, e]);
    setName('');
    setDetails('');
    setAmount('');
    setOpenMeal(null);
    analyze(e); // request to Gemini right after the entry is added
  };

  const remove = (id: string) => setEntries((prev) => prev.filter((e) => e.id !== id));

  /* ------------------------------- Totals ------------------------------- */
  const totals = useMemo(() => sumEntries(entries), [entries]);

  const TITLE = 'Daily tracker · متابعة اليوم';
  const SUBTITLE = 'Log what you ate · سجّل اللي أكلته';

  const historyModal = (
    <HistoryModal
      visible={historyOpen}
      onClose={() => setHistoryOpen(false)}
      plan={plan}
      todayKey={dayKey}
      todayEntries={entries}
    />
  );

  /* No plan yet → targets are missing */
  if (!plan) {
    return (
      <Screen title={TITLE} subtitle={SUBTITLE}>
        <Appear index={0} style={styles.clockWrap}>
          <ClockCard onOpenHistory={() => setHistoryOpen(true)} />
        </Appear>
        <Appear index={1} style={styles.center}>
          <Ionicons name="nutrition-outline" size={40} color={colors.muted} />
          <Text style={styles.centerText}>Generate your diet plan first to get daily targets.</Text>
          <Text style={styles.centerTextAr}>اعمل خطتك الغذائية الأول علشان نعرف أهدافك اليومية.</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.navigate('/diet')}>
            <Text style={styles.buttonText}>Go to diet plan · روح للخطة</Text>
          </TouchableOpacity>
        </Appear>
        {historyModal}
      </Screen>
    );
  }

  const remaining = plan.kcal - totals.kcal;
  const over = remaining < 0;
  const macros = [
    { en: 'Protein', ar: 'بروتين', got: totals.p, goal: plan.p, color: MACRO_COLORS.p },
    { en: 'Carbs', ar: 'كربوهيدرات', got: totals.c, goal: plan.c, color: MACRO_COLORS.c },
    { en: 'Fat', ar: 'دهون', got: totals.f, goal: plan.f, color: MACRO_COLORS.f },
  ];

  return (
    <Screen title={TITLE} subtitle={SUBTITLE}>
      {/* ------------------------------- Clock ------------------------------- */}
      <Appear index={0} style={styles.clockWrap}>
        <ClockCard onOpenHistory={() => setHistoryOpen(true)} />
      </Appear>

      {/* ------------------------------ Summary ------------------------------ */}
      <Appear index={1} style={styles.summary}>
        <Text style={styles.summaryLabel}>
          {over ? 'Over your goal by · زيادة عن هدفك' : 'Calories remaining · السعرات المتبقية'}
        </Text>
        <Text style={[styles.summaryValue, over && { color: RED }]}>
          {Math.abs(Math.round(remaining))} <Text style={styles.summaryUnit}>kcal</Text>
        </Text>
        <Bar pct={(totals.kcal / plan.kcal) * 100} over={over} />
        <Text style={styles.summarySub}>
          {Math.round(totals.kcal)} / {plan.kcal} kcal
        </Text>

        <View style={styles.macroGrid}>
          {macros.map((m) => {
            const pct = m.goal ? (m.got / m.goal) * 100 : 0;
            return (
              <View key={m.en} style={styles.macroCard}>
                <Text style={styles.macroName}>{m.en}</Text>
                <Text style={styles.macroNameAr}>{m.ar}</Text>
                <Text style={styles.macroValue}>
                  {Math.round(m.got)}
                  <Text style={styles.macroGoal}> / {m.goal} g</Text>
                </Text>
                <Bar pct={pct} over={pct > 100} color={m.color} />
                <Text style={styles.macroLeft}>
                  {pct > 100
                    ? `+${Math.round(m.got - m.goal)} g over · زيادة`
                    : `${Math.max(0, Math.round(m.goal - m.got))} g left · متبقي`}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.extraRow}>
          <Text style={styles.extraText}>Fiber · ألياف: {Math.round(totals.fiber)} g</Text>
          <Text style={styles.extraText}>Sugar · سكر: {Math.round(totals.sugar)} g</Text>
        </View>
      </Appear>

      {/* ------------------------------ Sections ----------------------------- */}
      {MEALS.map((m, mi) => {
        const list = entries.filter((e) => e.meal === m.key);
        const mealKcal = list.reduce((s, e) => s + (e.n?.kcal ?? 0), 0);
        const isOpen = openMeal === m.key;

        return (
          <Appear key={m.key} index={2 + mi} style={styles.card}>
            <View style={styles.mealHeader}>
              <View style={styles.mealIcon}>
                <Ionicons name={m.icon} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{m.en}</Text>
                <Text style={styles.cardTitleAr}>{m.ar}</Text>
              </View>
              <View style={styles.kcalPill}>
                <Text style={styles.mealKcal}>{Math.round(mealKcal)} kcal</Text>
              </View>
            </View>

            {list.map((e) => (
              <Animated.View
                key={e.id}
                entering={FadeInDown.duration(220)}
                exiting={FadeOut.duration(150)}
                style={styles.entry}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryName}>{e.name}</Text>
                  {!!(e.amount || e.details) && (
                    <Text style={styles.entryMeta}>{[e.amount, e.details].filter(Boolean).join(' · ')}</Text>
                  )}
                  {e.status === 'done' && e.n && (
                    <Text style={styles.entryNutri}>
                      {e.n.kcal} kcal
                      <Text style={{ color: MACRO_COLORS.p }}>  P {e.n.p}</Text>
                      <Text style={{ color: MACRO_COLORS.c }}>  C {e.n.c}</Text>
                      <Text style={{ color: MACRO_COLORS.f }}>  F {e.n.f}</Text>
                    </Text>
                  )}
                  {e.status === 'done' && e.rating && <RatingBadge rating={e.rating} />}
                  {e.status === 'done' && e.rating === 'red' && !!e.reason && (
                       <View style={styles.reasonBox}>
                       <Text style={styles.reasonEn}>{e.reason.en}</Text>
                      {!!e.reason.ar && <Text style={styles.reasonAr}>{e.reason.ar}</Text>}
                     </View>
                  )}
                  {e.status === 'loading' && (
                    <View style={styles.inline}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.entryMeta}> Calculating… · بنحسب…</Text>
                    </View>
                  )}
                  {e.status === 'error' && (
                    <TouchableOpacity onPress={() => analyze(e)} style={styles.inline}>
                      <Ionicons name="refresh-outline" size={16} color={RED} />
                      <Text style={styles.errorText}> Failed — tap to retry · حاول تاني</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity onPress={() => remove(e.id)} hitSlop={10}>
                  <Ionicons name="trash-outline" size={18} color={colors.muted} />
                </TouchableOpacity>
              </Animated.View>
            ))}

            {isOpen ? (
              <Animated.View entering={FadeInDown.duration(200)} style={styles.form}>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="What did you eat? · أكلت إيه؟"
                  placeholderTextColor={colors.muted}
                  autoFocus
                />
                <TextInput
                  style={styles.input}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="Amount (e.g. 2 slices, 150 g) · الكمية"
                  placeholderTextColor={colors.muted}
                />
                <TextInput
                  style={styles.input}
                  value={details}
                  onChangeText={setDetails}
                  placeholder="Details (optional) · تفاصيل"
                  placeholderTextColor={colors.muted}
                />
                <View style={styles.formButtons}>
                  <TouchableOpacity onPress={() => setOpenMeal(null)} style={styles.cancel}>
                    <Text style={styles.cancelText}>Cancel · إلغاء</Text>
                  </TouchableOpacity>
                  <PressableScale
                    onPress={addEntry}
                    disabled={!name.trim()}
                    style={[styles.addBtn, !name.trim() && { opacity: 0.4 }]}
                  >
                    <Text style={styles.buttonText}>Add · إضافة</Text>
                  </PressableScale>
                </View>
              </Animated.View>
            ) : (
              <TouchableOpacity style={styles.addRow} onPress={() => setOpenMeal(m.key)}>
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.addRowText}>Add food · أضف أكلة</Text>
              </TouchableOpacity>
            )}
          </Appear>
        );
      })}

      <Text style={styles.disclaimer}>
        Values are AI estimates · القيم تقديرية من الذكاء الاصطناعي
      </Text>

      {historyModal}
    </Screen>
  );
}

export default function TrackerScreen() {
  return (
    <FocusReplay>
      <TrackerContent />
    </FocusReplay>
  );
}

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.07,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
} as const;

const makeStyles = (colors: Colors) => StyleSheet.create({
  center: { alignItems: 'center', paddingVertical: spacing.lg * 2, gap: spacing.md },
  centerText: { fontSize: 15, color: colors.muted, textAlign: 'center' },
  centerTextAr: { fontSize: 14, color: colors.muted, textAlign: 'center' },
  button: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: 28 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  

  /* food rating */
badge: {
  flexDirection: 'row',
  alignItems: 'center',
  alignSelf: 'flex-start',
  gap: 4,
  marginTop: 6,
  paddingVertical: 3,
  paddingHorizontal: 8,
  borderRadius: radius.pill,
},
badgeText: { fontSize: 12, fontWeight: '700' },
reasonBox: {
  marginTop: 6,
  padding: spacing.sm,
  borderRadius: radius.sm,
  backgroundColor: 'rgba(214,69,69,0.12)',
  borderLeftWidth: 3,
  borderLeftColor: RED,
},
reasonEn: { fontSize: 13, color: colors.text, lineHeight: 18 },
reasonAr: { fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 17 },
histNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
ratingDot: { width: 8, height: 8, borderRadius: 4 },
histReason: { fontSize: 12, color: RED, marginTop: 1 },

  /* clock */
  clockWrap: { marginBottom: spacing.md },
  clockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow,
  },
  clockRow: { flexDirection: 'row', alignItems: 'flex-end' },
  clockTime: { fontSize: 44, fontWeight: '800', color: '#fff', letterSpacing: 1, fontVariant: ['tabular-nums'] },
  clockSeconds: { fontSize: 20, fontWeight: '600', color: 'rgba(255,255,255,0.75)', marginBottom: 8, fontVariant: ['tabular-nums'] },
  clockAmPm: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.85)', marginBottom: 10, marginLeft: 6 },
  clockDate: { fontSize: 14, fontWeight: '600', color: '#fff', marginTop: 2 },
  clockDateAr: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  resetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: spacing.sm,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  resetText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  historyBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 1,
  },
  historyBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary, marginTop: 3 },
  historyBtnTextAr: { fontSize: 11, color: colors.muted },

  /* summary */
  summary: { backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  summaryLabel: { fontSize: 14, color: colors.muted },
  summaryValue: { fontSize: 36, fontWeight: '800', color: colors.primary, marginVertical: 4 },
  summaryUnit: { fontSize: 16, fontWeight: '600' },
  summarySub: { fontSize: 12, color: colors.muted, marginTop: 4 },
  track: { height: 10, borderRadius: radius.pill, backgroundColor: colors.border, overflow: 'hidden', marginTop: 4 },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
  fillOver: { backgroundColor: RED },

  macroGrid: { marginTop: spacing.md, flexDirection: 'row', gap: spacing.sm },
  macroCard: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.sm + 2, ...shadow },
  macroName: { fontSize: 13, fontWeight: '700', color: colors.text },
  macroNameAr: { fontSize: 12, color: colors.muted },
  macroValue: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 4 },
  macroGoal: { fontSize: 11, fontWeight: '400', color: colors.muted },
  macroLeft: { fontSize: 11, color: colors.muted, marginTop: 4 },
  extraRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  extraText: { fontSize: 12, color: colors.muted },

  /* meal cards */
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm + 2,
    ...shadow,
  },
  mealHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  mealIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardTitleAr: { fontSize: 13, color: colors.muted },
  kcalPill: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 12 },
  mealKcal: { fontSize: 13, fontWeight: '700', color: colors.primary },

  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  entryName: { fontSize: 15, fontWeight: '600', color: colors.text },
  entryMeta: { fontSize: 12, color: colors.muted, marginTop: 1 },
  entryNutri: { fontSize: 13, color: colors.primary, marginTop: 3, fontWeight: '600' },
  inline: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  errorText: { fontSize: 12, color: RED },

  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: spacing.sm },
  addRowText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  form: { gap: spacing.sm, marginTop: spacing.sm },
  input: {
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  formButtons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: spacing.md },
  cancel: { paddingVertical: 10, paddingHorizontal: 8 },
  cancelText: { fontSize: 14, color: colors.muted, fontWeight: '600' },
  addBtn: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 12, paddingHorizontal: 24 },
  disclaimer: { fontSize: 12, color: colors.muted, textAlign: 'center', marginVertical: spacing.md },

  /* history modal */
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '88%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.sm },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  sheetTitleAr: { fontSize: 13, color: colors.muted },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },

  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: spacing.sm },
  navBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  monthText: { fontSize: 17, fontWeight: '700', color: colors.text },
  monthTextAr: { fontSize: 12, color: colors.muted },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekHead: { width: '14.2857%', textAlign: 'center', fontSize: 12, fontWeight: '600', color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.2857%', alignItems: 'center', paddingVertical: 3 },
  dayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayToday: { borderWidth: 1.5, borderColor: colors.primary },
  daySelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayText: { fontSize: 14, color: colors.text },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 2, backgroundColor: 'transparent' },

  detail: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.border },
  detailTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  detailTitleAr: { fontSize: 13, color: colors.muted, marginBottom: spacing.sm },
  emptyDay: { alignItems: 'center', gap: 8, paddingVertical: spacing.md },
  emptyDayText: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  detailSummary: { backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  detailKcal: { fontSize: 24, fontWeight: '800', color: colors.primary, marginBottom: 4 },
  detailKcalGoal: { fontSize: 14, fontWeight: '500', color: colors.muted },
  chipRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  chip: { fontSize: 13, fontWeight: '700' },
  histMeal: { marginTop: spacing.sm },
  histMealHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  histMealTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  histEntry: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  histEntryName: { fontSize: 14, fontWeight: '600', color: colors.text },
  histEntryKcal: { fontSize: 13, fontWeight: '700', color: colors.primary },
});
