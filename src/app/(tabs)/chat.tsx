import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Screen from '@/components/Screen';
import { Colors, radius, spacing } from '@/constants/nutri';
import { useStyles, useTheme } from '@/context/ThemeContext';
import { askAssistant, ChatContext } from '@/constants/gemini';
import { useProfile } from '@/context/ProfileContext';
import { CONDITIONS, usePlan } from '@/context/PlanContext';
import Animated, { FadeInLeft, FadeInRight } from 'react-native-reanimated';
import { PressableScale } from '@/components/Anim';

// AI messages carry both languages. User messages are shown as typed (`ar` unused).
type Message = { id: string; role: 'user' | 'ai'; text: string; ar?: string; error?: boolean };

const initial: Message[] = [
  {
    id: 'welcome',
    role: 'ai',
    text: 'Hi! I can help with meals, nutrition and your goals, based on your health profile. What would you like to know?',
    ar: 'أهلاً! أقدر أساعدك في الوجبات والتغذية وأهدافك حسب حالتك الصحية. تحب تسأل عن إيه؟',
  },
];

const SUGGESTIONS = [
  'What can I eat for dinner tonight?',
  'Is fruit OK for me?',
  'Give me a healthy snack idea',
  'ايه أحسن فطار ليا؟',
];

export default function ChatScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const { profile } = useProfile();
  const { health, plan } = usePlan();

  const [messages, setMessages] = useState<Message[]>(initial);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  const counter = useRef(0);
  const nextId = () => `${Date.now()}-${counter.current++}`;

  // Everything the assistant should know about the person.
  const ctx: ChatContext = useMemo(
    () => ({
      profile: profile
        ? { age: profile.age, gender: profile.gender, weight: profile.weight, height: profile.height, goal: profile.goal }
        : undefined,
      conditions: (health?.conditions ?? []).map((id) => ({
        id,
        en: CONDITIONS.find((x) => x.id === id)?.en ?? id,
      })),
      other: health?.otherDiseases ?? '',
      lists: plan ? { eat: plan.eat.map((t) => t.en), avoid: plan.avoid.map((t) => t.en) } : undefined,
      plan: plan ? { kcal: plan.kcal, p: plan.p, c: plan.c, f: plan.f } : null,
    }),
    [profile, health, plan]
  );

  const scrollDown = () => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);

  const send = useCallback(
    async (raw?: string) => {
      const text = (raw ?? input).trim();
      if (!text || loading) return;

      const userMsg: Message = { id: nextId(), role: 'user', text };
      const next = [...messages, userMsg];
      setMessages(next);
      setInput('');
      setLoading(true);
      scrollDown();

      try {
        // Send only real conversation turns (no welcome text, no error bubbles). Replies are sent in English.
        const history = next
          .filter((m) => m.id !== 'welcome' && !m.error)
          .map((m) => ({ role: m.role, text: m.text }));
        const reply = await askAssistant(history, ctx);
        setMessages((prev) => [...prev, { id: nextId(), role: 'ai', text: reply.en, ar: reply.ar }]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'ai',
            error: true,
            text: 'Sorry, I could not answer right now. Please try again.',
            ar: 'آسفين، مقدرناش نرد دلوقتي. حاول تاني.',
          },
        ]);
      } finally {
        setLoading(false);
        scrollDown();
      }
    },
    [input, loading, messages, ctx]
  );

  const hasHealth = !!health;
  const showSuggestions = messages.length === 1 && !loading;

  return (
    <Screen
      title="Assistant · المساعد"
      subtitle="Ask anything about your nutrition · اسأل عن أي حاجة في تغذيتك"
      scroll={false}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {!hasHealth && (
          <TouchableOpacity style={styles.banner} onPress={() => router.navigate('/form')} activeOpacity={0.8}>
            <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
            <View style={styles.flex}>
              <Text style={styles.bannerText}>Add your health status for personalized answers</Text>
              <Text style={styles.bannerTextAr}>أضف حالتك الصحية علشان الإجابات تبقى مخصصة ليك</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </TouchableOpacity>
        )}

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Animated.View
              entering={(item.role === 'user' ? FadeInRight : FadeInLeft).duration(280)}
              style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}
            >
              <Text style={[styles.bubbleText, item.role === 'user' && styles.userText]}>{item.text}</Text>
              {!!item.ar && <Text style={styles.bubbleTextAr}>{item.ar}</Text>}
            </Animated.View>
          )}
          ListFooterComponent={
            loading ? (
              <View style={[styles.bubble, styles.aiBubble, styles.typing]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.typingText}>Thinking… · بنفكر…</Text>
              </View>
            ) : null
          }
        />

        {showSuggestions && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.chips}
            style={styles.chipsWrap}
          >
            {SUGGESTIONS.map((s) => (
              <TouchableOpacity key={s} style={styles.chip} onPress={() => send(s)} activeOpacity={0.7}>
                <Text style={styles.chipText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Type a message · اكتب رسالة"
            placeholderTextColor={colors.muted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send()}
            returnKeyType="send"
            editable={!loading}
          />
          <PressableScale
            style={[styles.sendBtn, (loading || !input.trim()) && styles.sendDisabled]}
            onPress={() => send()}
            disabled={loading || !input.trim()}
            scaleTo={0.88}
          >
            <Ionicons name="arrow-up" size={20} color="#fff" />
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: spacing.md, gap: spacing.sm },
  bubble: { maxWidth: '82%', padding: spacing.md, borderRadius: radius.lg },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 6,
  },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  bubbleText: { fontSize: 15, lineHeight: 21, color: colors.text },
  bubbleTextAr: { fontSize: 14, lineHeight: 21, color: colors.muted, marginTop: 6 },
  userText: { color: '#fff' },

  typing: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  typingText: { fontSize: 14, color: colors.muted },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    marginHorizontal: spacing.md,
    padding: spacing.sm,
  },
  bannerText: { fontSize: 13, fontWeight: '600', color: colors.text },
  bannerTextAr: { fontSize: 12, color: colors.muted, marginTop: 1 },

  chipsWrap: { flexGrow: 0 },
  chips: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm },
  chip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: { fontSize: 13, color: colors.primary, fontWeight: '600' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
});
