import { Colors, colors as lightColors, darkColors } from '@/constants/nutri';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const KEY = 'nutri_theme';

type ThemeValue = {
  colors: Colors;
  isDark: boolean;
  /** false until the saved choice has been read from storage */
  loaded: boolean;
  setDark: (value: boolean) => void;
  toggleDark: () => void;
};

const ThemeContext = createContext<ThemeValue>({
  colors: lightColors,
  isDark: false,
  loaded: true,
  setDark: () => {},
  toggleDark: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => setIsDark(v === 'dark'))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const setDark = useCallback((value: boolean) => {
    setIsDark(value);
    AsyncStorage.setItem(KEY, value ? 'dark' : 'light').catch(() => {});
  }, []);

  const toggleDark = useCallback(() => setDark(!isDark), [isDark, setDark]);

  const value = useMemo<ThemeValue>(
    () => ({ colors: isDark ? darkColors : lightColors, isDark, loaded, setDark, toggleDark }),
    [isDark, loaded, setDark, toggleDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

/**
 * Builds a StyleSheet from the current theme colors.
 * `factory` must be a module-level function: `const makeStyles = (colors: Colors) => StyleSheet.create({...})`
 */
export function useStyles<T>(factory: (c: Colors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}
