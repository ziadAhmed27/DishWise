import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Profile = {
  name: string;
  age: string;
  gender: string;
  phone: string;
  email: string;
  height: string; // cm
  weight: string; // kg
  goal: string;
};

type ProfileContextValue = {
  profile: Profile | null;
  loaded: boolean;
  saveProfile: (p: Profile) => Promise<void>;
};

const STORAGE_KEY = 'nutri.profile.v1';

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setProfile(JSON.parse(raw));
      } catch {
        // ignore read errors, user will just see the onboarding again
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const saveProfile = useCallback(async (p: Profile) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    setProfile(p);
  }, []);

  const value = useMemo(() => ({ profile, loaded, saveProfile }), [profile, loaded, saveProfile]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside ProfileProvider');
  return ctx;
}
