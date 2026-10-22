import { Ionicons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export const GENDERS = ['Female', 'Male'];

/** `value` is what gets saved in the profile (and sent to the AI); `ar` is only for display. */
export const GOAL_OPTIONS: { value: string; ar: string; icon: IconName }[] = [
  { value: 'Lose weight', ar: 'إنقاص الوزن', icon: 'trending-down' },
  { value: 'Maintain weight', ar: 'ثبات الوزن', icon: 'swap-horizontal' },
  { value: 'Gain weight', ar: 'زيادة الوزن', icon: 'trending-up' },
  { value: 'Eat healthier', ar: 'أكل صحي أكتر', icon: 'leaf-outline' },
];

export const GOALS = GOAL_OPTIONS.map((g) => g.value);
