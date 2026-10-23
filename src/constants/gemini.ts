// Gemini helper: estimate nutrition for ONE food entry AND rate it against the user's diet plan.
// All requests go through the Cloudflare Worker (see constants/api.ts). The API key and the
// model name live in the Worker, so nothing secret is stored in the app.

import { GEMINI_PROXY_URL } from '@/constants/api';

export type Nutrients = {
  kcal: number;
  p: number; // protein g
  c: number; // carbs g
  f: number; // fat g
  fiber: number; // g
  sugar: number; // g
};

export type Rating = 'green' | 'normal' | 'red';
export type BiText = { en: string; ar: string };

/** The diet plan's lists (English only, to save tokens). */
export type PlanLists = { eat: string[]; avoid: string[] };

/** Who is eating: profile (goal, body) + health form + plan lists. */
export type FoodContext = {
  profile?: { age?: string | number; gender?: string; weight?: string | number; height?: string | number; goal?: string };
  conditions: { id: string; en: string }[]; // from the health form
  other?: string; // free-text "other diseases"
  lists?: PlanLists;
};

// What is genuinely risky for each condition (used so the model judges by the person's disease, not loosely).
const CONDITION_RISKS: Record<string, string> = {
  diabetes_gdm: 'sugary foods/drinks, sweets, juices, large refined-carb portions (white bread/rice/pasta/pastries)',
  diabetes_t2: 'sugary foods/drinks, sweets, juices, large refined-carb portions',
  diabetes_t1: 'very large or sugary carb loads that spike blood sugar, sweet drinks, juices',
  hypertension: 'very salty food (pickles, cured/processed meat, instant noodles, salted snacks), heavy fast food, energy drinks',
  chf: 'very salty food (pickles, canned soups, cured meat, salted snacks, soy sauce), large fluid loads',
  cad: 'deep-fried food, trans-fat bakery, fatty red meat, full-fat cream/butter-heavy dishes, high-sodium broths',
  kidney_stones: 'very salty food, large red-meat portions, high-oxalate foods in big amounts (spinach, lots of almonds) only for oxalate stones',
  anemia: 'tea/coffee taken with an iron-rich meal, very low-nutrient processed food replacing meals',
  obesity: 'sweet drinks, juices, sweets, deep-fried/fast food, very high-calorie portions',
  osteoporosis: 'cola/soda, very salty food, large caffeine amounts, alcohol',
  pcos: 'sugary drinks/sweets, refined bread, pastries, cakes, French fries, deep-fried chicken, sausages/hot dogs, packaged chips',
  diabetic_nephropathy: 'very salty/canned/processed food, excess protein (especially red meat), sugary foods, unmonitored high-potassium or high-phosphorus foods',
  fatty_liver: 'sugary drinks, sweets, fried food, saturated fats, processed snacks, alcohol',
  gout: 'organ meats (liver, kidney), red meat, sardines/anchovies/mackerel, shellfish, alcohol, sugary and high-fructose drinks',
  thyroid_disorders: 'kelp/iodine supplements, energy drinks and heavy caffeine, taking calcium/iron supplements together with thyroid medication',
};

export type FoodAnalysis = { n: Nutrients; rating: Rating; reason: BiText };

export async function analyzeFood(
  name: string,
  details: string,
  amount: string,
  ctx?: FoodContext
): Promise<FoodAnalysis> {
  const hasConditions = !!ctx && (ctx.conditions.length > 0 || !!ctx.other?.trim());
  const person = ctx
    ? `\nPERSON: ${JSON.stringify({
        age: ctx.profile?.age,
        gender: ctx.profile?.gender,
        kg: ctx.profile?.weight,
        cm: ctx.profile?.height,
        goal: ctx.profile?.goal || 'not set',
        diseases: hasConditions ? ctx.conditions.map((c) => c.en) : 'none (healthy)',
        other_diseases: ctx.other?.trim() || 'none',
      })}\n` +
      (ctx.conditions.length
        ? `Known risks per disease: ${JSON.stringify(
            Object.fromEntries(ctx.conditions.map((c) => [c.en, CONDITION_RISKS[c.id] ?? 'use general medical knowledge']))
          )}\n`
        : '') +
      (ctx.lists
        ? `Plan EAT list (for "green"): ${JSON.stringify(ctx.lists.eat)}\n` +
          `Plan AVOID list (reference only, a loose or partial match is NOT enough for red): ${JSON.stringify(ctx.lists.avoid)}\n`
        : '')
    : '\n';

  const classify =
    `${person}Rate this food for THIS person. Be lenient: most everyday food is "normal".\n` +
    `rating = "red" ONLY in one of these cases:\n` +
    `1) The person has a disease (or other_diseases entry) and this food, in this amount, clearly conflicts with it ` +
    `(e.g. sugary food for a diabetic, very salty food for hypertension/heart failure).\n` +
    `2) The food is widely recognized as unhealthy in general (e.g. energy drinks, deep-fried fast-food combos, processed/cured meats as the main item, alcohol).\n` +
    `3) The amount contains HUGE sugar or fat: about 40g+ sugar, or 45g+ fat, or 25g+ saturated-fat-type heavy load in this one entry.\n` +
    `Do NOT use red for: moderately high calories, moderate sugar/fat/salt, a single mild item, or a vague/partial match to the AVOID list. ` +
    `The person's goal alone (e.g. losing weight) makes food red only if it is a clearly high-calorie/sugary/fried item, not for ordinary food.\n` +
    `"green" if the food clearly matches the EAT list or is clearly very good for the person's diseases/goal; otherwise "normal". ` +
    `If it qualifies for red, choose red.\n` +
    `reason_en / reason_ar: ONLY when rating is "red". 1-2 short sentences that state the specific danger for THIS person: ` +
    `name the disease and/or the goal and say what the food does (e.g. "Raises blood sugar fast, risky for your type 2 diabetes"; ` +
    `"Very high in salt, bad for your high blood pressure"; "About 60g sugar, works against your weight-loss goal"). ` +
    `If it is red for a general reason, say so and still connect it to the person's disease/goal when relevant. ` +
    `Never write a generic reason. reason_ar: simple Egyptian-friendly Arabic. Otherwise empty strings.`;

  const prompt =
    `Estimate the total nutrition for this food eaten once.\n` +
    `Food: ${name}\nDetails: ${details || 'none'}\nAmount: ${amount || '1 serving'}\n` +
    `Numbers are totals for the whole amount (kcal; grams for the rest).` +
    classify +
    `\nReply with JSON only.`;

  const res = await fetch(GEMINI_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            kcal: { type: 'NUMBER' },
            p: { type: 'NUMBER' },
            c: { type: 'NUMBER' },
            f: { type: 'NUMBER' },
            fiber: { type: 'NUMBER' },
            sugar: { type: 'NUMBER' },
            rating: { type: 'STRING', enum: ['green', 'normal', 'red'] },
            reason_en: { type: 'STRING' },
            reason_ar: { type: 'STRING' },
          },
          required: ['kcal', 'p', 'c', 'f', 'fiber', 'sugar', 'rating', 'reason_en', 'reason_ar'],
        },
      },
    }),
  });

  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const data = await res.json();
  const text: string = (data?.candidates?.[0]?.content?.parts ?? [])
    .filter((p: any) => typeof p.text === 'string' && !p.thought)
    .map((p: any) => p.text)
    .join('');
  if (!text) throw new Error('Empty Gemini reply');

  const j = JSON.parse(text);
  const n = (v: unknown) => Math.max(0, Math.round(Number(v) * 10) / 10 || 0);
  const rating: Rating = j.rating === 'green' || j.rating === 'red' ? j.rating : 'normal';

  // Red must always come with a reason, even if the model left it empty.
  const reason: BiText =
    rating === 'red'
      ? {
          en: String(j.reason_en || '').trim() || 'This food is risky for your health condition or goal.',
          ar: String(j.reason_ar || '').trim() || 'الأكل ده خطر على حالتك الصحية أو هدفك.',
        }
      : { en: '', ar: '' };

  return {
    n: { kcal: Math.round(n(j.kcal)), p: n(j.p), c: n(j.c), f: n(j.f), fiber: n(j.fiber), sugar: n(j.sugar) },
    rating,
    reason,
  };
}

/* -------------------------------------------------------------------------- */
/*  Chat assistant (answers using the user's profile + medical history)       */
/* -------------------------------------------------------------------------- */

export type ChatTurn = { role: 'user' | 'ai'; text: string };
export type ChatContext = FoodContext & { plan?: { kcal: number; p: number; c: number; f: number } | null };

function buildChatSystemPrompt(ctx: ChatContext): string {
  const pr = ctx.profile;
  const hasConditions = ctx.conditions.length > 0 || !!ctx.other?.trim();
  const user = {
    age: pr?.age,
    gender: pr?.gender,
    kg: pr?.weight,
    cm: pr?.height,
    goal: pr?.goal || 'not set',
    diseases: hasConditions ? ctx.conditions.map((c) => c.en) : 'none reported (healthy) or not filled in yet',
    other_diseases: ctx.other?.trim() || 'none',
  };
  const risks = ctx.conditions.length
    ? `Key food concerns per disease: ${JSON.stringify(
        Object.fromEntries(ctx.conditions.map((c) => [c.en, CONDITION_RISKS[c.id] ?? 'use general medical knowledge']))
      )}\n`
    : '';
  const plan = ctx.plan
    ? `Their daily plan: ${ctx.plan.kcal} kcal, protein ${ctx.plan.p}g, carbs ${ctx.plan.c}g, fat ${ctx.plan.f}g.\n` +
      (ctx.lists
        ? `Plan EAT list: ${JSON.stringify(ctx.lists.eat)}\nPlan AVOID list: ${JSON.stringify(ctx.lists.avoid)}\n`
        : '')
    : 'They have no generated diet plan yet (you may suggest generating one in the Diet tab).\n';

  return (
    `You are a friendly nutrition assistant inside a diet app for Egyptian users.\n` +
    `USER MEDICAL HISTORY AND PROFILE: ${JSON.stringify(user)}\n${risks}${plan}\n` +
    `Rules:\n` +
    `- Personalize every answer to this person's diseases, goal, age and plan. Mention the relevant disease or goal when it matters ` +
    `(e.g. "because of your hypertension..."). If no medical history is saved, give general healthy advice and suggest filling in the Health Status page.\n` +
    `- Topics: food, meals, recipes, portions, calories, hydration, healthy habits, and how conditions relate to diet. ` +
    `For anything unrelated, politely say you can only help with nutrition and health.\n` +
    `- Prefer common, affordable Egyptian foods. Never recommend foods that conflict with their diseases or the AVOID list.\n` +
    `- You are not a doctor: do not diagnose, and do not tell them to start, stop or change medication doses. ` +
    `For symptoms, medication questions or lab results, advise asking their doctor. ` +
    `For emergency signs (chest pain, trouble breathing, fainting, very high or low blood sugar with symptoms, severe symptoms) tell them to get urgent medical care now.\n` +
    `- Keep answers short and practical: at most about 90 words per language, simple wording, short bullet lines allowed (use "• ").\n` +
    `- Understand questions in English or Arabic (Egyptian dialect included).\n` +
    `Reply with JSON only: {"en": answer in English, "ar": same answer in simple Egyptian-friendly Arabic}.`
  );
}

/** Send the conversation so far and get a bilingual reply. */
export async function askAssistant(history: ChatTurn[], ctx: ChatContext): Promise<BiText> {
  // Gemini wants user/model turns starting with a user turn; merge same-role neighbours.
  const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  for (const t of history.slice(-12)) {
    const role = t.role === 'user' ? 'user' : 'model';
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts[0].text += `\n${t.text}`;
    else if (last || role === 'user') contents.push({ role, parts: [{ text: t.text }] });
  }
  if (!contents.length || contents[contents.length - 1].role !== 'user') throw new Error('No user message');

  const res = await fetch(GEMINI_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildChatSystemPrompt(ctx) }] },
      contents,
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: { en: { type: 'STRING' }, ar: { type: 'STRING' } },
          required: ['en', 'ar'],
        },
      },
    }),
  });

  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const data = await res.json();
  const text: string = (data?.candidates?.[0]?.content?.parts ?? [])
    .filter((p: any) => typeof p.text === 'string' && !p.thought)
    .map((p: any) => p.text)
    .join('');
  if (!text) throw new Error('Empty Gemini reply');

  const j = JSON.parse(text);
  const en = String(j.en || '').trim();
  const ar = String(j.ar || '').trim();
  if (!en && !ar) throw new Error('Empty Gemini reply');
  return { en, ar };
}