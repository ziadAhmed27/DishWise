import { SYSTEM_PROMPT } from '@/constants/prompt';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

/* ------------------------------- Config ---------------------------------- */

// Low-cost Gemini model. Change here if you want another one (e.g. 'gemini-2.5-flash').
const MODEL = 'gemini-3.5-flash-lite';
const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY; // set in .env (see notes)

// How many times to try before showing an error (parse / truncation failures only).
const MAX_ATTEMPTS = 2;

// Appended to your existing SYSTEM_PROMPT so you don't have to edit prompt.ts
// (you can move this text into prompt.ts later and drop the constant).
const BILINGUAL_RULES = `

OUTPUT LANGUAGE (overrides any earlier output-format instruction):
Every text field must be bilingual: an object {"en": "...", "ar": "..."}.
"en" is English, "ar" is the same meaning in simple Egyptian-friendly Arabic. Keep each sentence short.
Return ONLY this JSON, no markdown:
{"kcal":number,"p":number,"c":number,"f":number,
"tips":[{"en":"","ar":""}],
"eat":[{"en":"","ar":""}],
"avoid":[{"en":"","ar":""}],
"meals":{"b":[{"en":"","ar":""}],"l":[{"en":"","ar":""}],"d":[{"en":"","ar":""}],"s":[{"en":"","ar":""}]},
"note":{"en":"","ar":""}}
kcal, p, c, f are plain numbers (grams for p, c, f).`;

// Gemini "structured output" schema: the API itself guarantees valid JSON in this exact shape,
// which prevents stray/missing braces like the one that caused the parse error.
const BI_SCHEMA = {
  type: 'OBJECT',
  properties: { en: { type: 'STRING' }, ar: { type: 'STRING' } },
  required: ['en', 'ar'],
};
const BI_LIST_SCHEMA = { type: 'ARRAY', items: BI_SCHEMA };
const PLAN_SCHEMA = {
  type: 'OBJECT',
  properties: {
    kcal: { type: 'NUMBER' },
    p: { type: 'NUMBER' },
    c: { type: 'NUMBER' },
    f: { type: 'NUMBER' },
    tips: BI_LIST_SCHEMA,
    eat: BI_LIST_SCHEMA,
    avoid: BI_LIST_SCHEMA,
    meals: {
      type: 'OBJECT',
      properties: { b: BI_LIST_SCHEMA, l: BI_LIST_SCHEMA, d: BI_LIST_SCHEMA, s: BI_LIST_SCHEMA },
      required: ['b', 'l', 'd', 's'],
    },
    note: BI_SCHEMA,
  },
  required: ['kcal', 'p', 'c', 'f', 'tips', 'eat', 'avoid', 'meals', 'note'],
};

/* -------------------------------- Types ---------------------------------- */

// `sex` = only shown to that sex in the health form (omit for conditions that apply to everyone).
export type Condition = { id: string; en: string; ar: string; sex?: 'female' | 'male' };

// ids match instructions.md. Diabetes has 3 separate options.
export const CONDITIONS: Condition[] = [
  { id: 'diabetes_t1', en: 'Type 1 Diabetes', ar: 'السكري النوع الأول' },
  { id: 'diabetes_t2', en: 'Type 2 Diabetes', ar: 'السكري النوع الثاني' },
  { id: 'diabetes_gdm', en: 'Gestational Diabetes', ar: 'سكر الحمل', sex: 'female' },
  { id: 'hypertension', en: 'High Blood Pressure (Hypertension)', ar: 'ارتفاع ضغط الدم' },
  { id: 'chf', en: 'Chronic Heart Failure', ar: 'قصور القلب المزمن' },
  { id: 'cad', en: 'Coronary Artery Disease', ar: 'مرض الشريان التاجي' },
  { id: 'kidney_stones', en: 'Kidney Stones', ar: 'حصوات الكلى' },
  { id: 'obesity', en: 'Obesity', ar: 'السمنة' },
  { id: 'anemia', en: 'Anemia', ar: 'الأنيميا' },
  { id: 'osteoporosis', en: 'Osteoporosis', ar: 'هشاشة العظام' },
  { id: 'pcos', en: 'Polycystic Ovary Syndrome (PCOS)', ar: 'تكيس المبايض', sex: 'female' },
  { id: 'diabetic_nephropathy', en: 'Diabetic Nephropathy (Kidney Disease from Diabetes)', ar: 'اعتلال الكلى السكري' },
  { id: 'fatty_liver', en: 'Fatty Liver', ar: 'الكبد الدهني' },
  { id: 'gout', en: 'Gout', ar: 'النقرس' },
  { id: 'thyroid_disorders', en: 'Thyroid Disorders', ar: 'اضطرابات الغدة الدرقية' },
];

/** 'male' | 'female' | undefined, from the profile's free-text gender (English or Arabic). */
export function normalizeSex(gender?: string | null): 'male' | 'female' | undefined {
  const g = (gender ?? '').trim().toLowerCase();
  if (g.startsWith('f') || g.startsWith('أنث') || g.startsWith('انث')) return 'female';
  if (g.startsWith('m') || g.startsWith('ذكر')) return 'male';
  return undefined;
}

/** Can this condition be offered to this gender? Unknown gender => only unrestricted conditions. */
export function isConditionAllowed(c: Condition, gender?: string | null): boolean {
  return !c.sex || c.sex === normalizeSex(gender);
}

export const conditionsForGender = (gender?: string | null): Condition[] =>
  CONDITIONS.filter((c) => isConditionAllowed(c, gender));

export type HealthStatus = { isHealthy: boolean; conditions: string[]; otherDiseases: string };

/** A text in both languages. */
export type BiText = { en: string; ar: string };

export type Plan = {
  kcal: number;
  p: number;
  c: number;
  f: number;
  tips: BiText[];
  eat: BiText[];
  avoid: BiText[];
  meals: { b: BiText[]; l: BiText[]; d: BiText[]; s: BiText[] };
  note: BiText;
};

// Only the profile fields we need (matches useProfile().profile).
export type ProfileInput = {
  age: string | number;
  gender: string;
  weight: string | number;
  height: string | number;
  goal: string;
};

type Status = 'idle' | 'loading' | 'ready' | 'error';

type PlanContextValue = {
  loaded: boolean;
  health: HealthStatus | null;
  plan: Plan | null;
  status: Status;
  error: string;
  saveHealth: (h: HealthStatus) => Promise<void>;
  generatePlan: (profile: ProfileInput) => Promise<void>;
};

const HEALTH_KEY = 'nutri.health';
const PLAN_KEY = 'nutri.plan';

const PlanContext = createContext<PlanContextValue | null>(null);

/* ------------------------------ Normalizer -------------------------------- */

// Accepts {en, ar} or a plain string (old cached plans / model slips).
const toBi = (x: any): BiText =>
  typeof x === 'string' ? { en: x, ar: '' } : { en: String(x?.en ?? ''), ar: String(x?.ar ?? '') };

const toBiList = (x: any): BiText[] => (Array.isArray(x) ? x.map(toBi).filter((t) => t.en || t.ar) : []);

function normalizePlan(raw: any): Plan {
  return {
    kcal: Number(raw?.kcal) || 0,
    p: Number(raw?.p) || 0,
    c: Number(raw?.c) || 0,
    f: Number(raw?.f) || 0,
    tips: toBiList(raw?.tips),
    eat: toBiList(raw?.eat),
    avoid: toBiList(raw?.avoid),
    meals: {
      b: toBiList(raw?.meals?.b),
      l: toBiList(raw?.meals?.l),
      d: toBiList(raw?.meals?.d),
      s: toBiList(raw?.meals?.s),
    },
    note: toBi(raw?.note),
  };
}

/* --------------------------- Robust JSON parsing --------------------------- */

/**
 * Repairs one specific model slip: an extra "}" that closes the root object too early
 * (e.g. `..."meals":{...}},"note":{...}}`). Brace counting is string-aware.
 */
function dropPrematureRootClose(s: string) {
  let out = '';
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      out += ch;
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      out += ch;
      continue;
    }
    if (ch === '{' || ch === '[') depth++;
    if (ch === '}' || ch === ']') {
      if (ch === '}' && depth === 1 && s.slice(i + 1).trimStart().startsWith(',')) continue; // drop it
      depth--;
    }
    out += ch;
  }
  return out;
}

/** Pulls the JSON object out of a model reply, even with fences, extra text or a stray brace. */
function parseModelJson(raw: string) {
  const s = raw.replace(/```json|```/gi, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end <= start) {
    console.warn('Model reply was not JSON:', raw.slice(0, 200));
    throw new RetryableError('The model did not return a valid plan, please try again.');
  }
  const body = s.slice(start, end + 1);
  try {
    return JSON.parse(body);
  } catch {
    try {
      return JSON.parse(dropPrematureRootClose(body)); // second chance: fix the stray brace
    } catch {
      console.warn('JSON parse failed. Raw reply:', raw);
      throw new RetryableError('The plan came back malformed, please try again.');
    }
  }
}

/** Errors worth an automatic second attempt (bad/cut-off output). HTTP/key errors are NOT retried. */
class RetryableError extends Error {}

/* ------------------------------- Provider -------------------------------- */

export function PlanProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  // Restore saved data on app start.
  useEffect(() => {
    (async () => {
      try {
        const [h, p] = await Promise.all([AsyncStorage.getItem(HEALTH_KEY), AsyncStorage.getItem(PLAN_KEY)]);
        if (h) setHealth(JSON.parse(h));
        if (p) {
          setPlan(normalizePlan(JSON.parse(p)));
          setStatus('ready');
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const saveHealth = useCallback(async (h: HealthStatus) => {
    setHealth(h);
    await AsyncStorage.setItem(HEALTH_KEY, JSON.stringify(h));
  }, []);

  const generatePlan = useCallback(
    async (profile: ProfileInput) => {
      if (!health) return;
      if (!API_KEY) {
        setStatus('error');
        setError('Missing API key. Add EXPO_PUBLIC_GEMINI_API_KEY to your .env file.\nمفتاح الـ API ناقص.');
        return;
      }
      setStatus('loading');
      setError('');

      // Minimal input = fewer tokens.
      const input = {
        age: Number(profile.age) || profile.age,
        sex: profile.gender,
        kg: Number(profile.weight) || profile.weight,
        cm: Number(profile.height) || profile.height,
        goal: profile.goal,
        dx: health.isHealthy
          ? []
          : health.conditions.filter((id) => {
              const c = CONDITIONS.find((x) => x.id === id);
              return !c || isConditionAllowed(c, profile.gender);
            }),
        other: health.otherDiseases,
      };

      // One full request: fetch → read all text parts → parse → validate.
      const requestPlan = async (): Promise<Plan> => {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: SYSTEM_PROMPT + BILINGUAL_RULES }] },
              contents: [{ role: 'user', parts: [{ text: JSON.stringify(input) }] }],
              generationConfig: {
                temperature: 0.3,
                // English + Arabic across 4 meals is long, and thinking tokens can share this budget.
                maxOutputTokens: 8192,
                responseMimeType: 'application/json',
                responseSchema: PLAN_SCHEMA,
              },
            }),
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message ?? `Request failed (${res.status})`);

        const cand = data?.candidates?.[0];
        if (!cand) {
          throw new RetryableError(
            data?.promptFeedback?.blockReason ? 'Request was blocked, try again.' : 'Empty response from the model.'
          );
        }

        // Join every text part (skipping "thought" parts) instead of trusting parts[0].
        const text: string = (cand.content?.parts ?? [])
          .filter((p: any) => typeof p.text === 'string' && !p.thought)
          .map((p: any) => p.text)
          .join('');

        if (cand.finishReason && cand.finishReason !== 'STOP') {
          console.warn('Gemini finishReason:', cand.finishReason, 'usage:', data?.usageMetadata);
        }
        if (!text) throw new RetryableError('Empty response from the model.');
        if (cand.finishReason === 'MAX_TOKENS') throw new RetryableError('The plan was cut off, please try again.');

        const parsed = normalizePlan(parseModelJson(text));
        if (!parsed.kcal || !parsed.meals.b.length) {
          throw new RetryableError('Unexpected response from the model.');
        }
        return parsed;
      };

      let lastError: any;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const parsed = await requestPlan();
          setPlan(parsed);
          setStatus('ready');
          await AsyncStorage.setItem(PLAN_KEY, JSON.stringify(parsed));
          return;
        } catch (e: any) {
          lastError = e;
          if (!(e instanceof RetryableError)) break; // network / key / quota errors: don't retry
        }
      }

      setStatus('error');
      setError(lastError?.message ?? 'Something went wrong.');
    },
    [health]
  );

  return (
    <PlanContext.Provider value={{ loaded, health, plan, status, error, saveHealth, generatePlan }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used inside <PlanProvider>');
  return ctx;
}