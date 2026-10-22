export const colors = {
  primary: '#2E9E6B',
  primarySoft: '#E4F5EC',
  background: '#F7FAF8',
  card: '#FFFFFF',
  text: '#1B2B24',
  muted: '#7B8C84',
  border: '#E3EBE6',
  accent: '#F4A340',
  accentSoft: '#FDF1E0',
};

export type Colors = typeof colors;

/** Night mode palette (same keys as `colors`). */
export const darkColors: Colors = {
  primary: '#38B07A',
  primarySoft: '#1B3328',
  background: '#0F1512',
  card: '#18211C',
  text: '#E8F1EC',
  muted: '#8FA39A',
  border: '#2A3731',
  accent: '#F4A340',
  accentSoft: '#3A2C17',
};

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };
export const spacing = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 };
