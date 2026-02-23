'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getAuthClient } from '@/core/auth/client';
import { envConfigs } from '@/config';
import { User } from '@/shared/models/user';

export interface ContextValue {
  user: User | null;
  setUser: (user: User | null) => void;
  isCheckSign: boolean;
  setIsCheckSign: (isCheckSign: boolean) => void;
  isShowSignModal: boolean;
  setIsShowSignModal: (show: boolean) => void;
  isShowPaymentModal: boolean;
  setIsShowPaymentModal: (show: boolean) => void;
  configs: Record<string, string>;
  fetchConfigs: (force?: boolean) => Promise<void>;
  fetchUserCredits: (force?: boolean) => Promise<void>;
  fetchUserInfo: (force?: boolean) => Promise<void>;
  showOneTap: (configs: Record<string, string>) => Promise<void>;
}

const AppContext = createContext({} as ContextValue);

export const useAppContext = () => useContext(AppContext);

export const AppContextProvider = ({ children }: { children: ReactNode }) => {
  const USER_CREDITS_REFRESH_MIN_INTERVAL_MS = 15_000;
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const configsLoadedRef = useRef(false);
  const fetchConfigsPromiseRef = useRef<Promise<void> | null>(null);
  const fetchUserCreditsPromiseRef = useRef<Promise<void> | null>(null);
  const fetchUserInfoPromiseRef = useRef<Promise<void> | null>(null);
  const lastUserCreditsFetchedAtRef = useRef(0);

  // sign user
  const [user, setUser] = useState<User | null>(null);
  const userRef = useRef<User | null>(null);

  // is check sign (true during SSR and initial render to avoid hydration mismatch when auth is enabled)
  const [isCheckSign, setIsCheckSign] = useState(!!envConfigs.auth_secret);

  // show sign modal
  const [isShowSignModal, setIsShowSignModal] = useState(false);

  // show payment modal
  const [isShowPaymentModal, setIsShowPaymentModal] = useState(false);

  const fetchConfigs = useCallback(async (force = false) => {
    if (!force && configsLoadedRef.current) {
      return;
    }

    if (fetchConfigsPromiseRef.current) {
      return fetchConfigsPromiseRef.current;
    }

    const run = (async () => {
      try {
        const resp = await fetch('/api/config/get-configs', {
          method: 'POST',
        });
        if (!resp.ok) {
          throw new Error(`fetch failed with status: ${resp.status}`);
        }
        const { code, message, data } = await resp.json();
        if (code !== 0) {
          throw new Error(message);
        }

        setConfigs(data);
        configsLoadedRef.current = true;
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('fetch configs failed:', e);
        }
      } finally {
        fetchConfigsPromiseRef.current = null;
      }
    })();

    fetchConfigsPromiseRef.current = run;
    return run;
  }, []);

  const fetchUserCredits = useCallback(async (force = false) => {
    if (!userRef.current) {
      return;
    }

    if (fetchUserCreditsPromiseRef.current) {
      return fetchUserCreditsPromiseRef.current;
    }

    const now = Date.now();
    const elapsed = now - lastUserCreditsFetchedAtRef.current;
    if (!force && elapsed < USER_CREDITS_REFRESH_MIN_INTERVAL_MS) {
      return;
    }

    const run = (async () => {
      try {
        const resp = await fetch('/api/user/get-user-credits', {
          method: 'POST',
        });
        if (!resp.ok) {
          throw new Error(`fetch failed with status: ${resp.status}`);
        }
        const { code, message, data } = await resp.json();
        if (code !== 0) {
          throw new Error(message);
        }

        setUser((prev) => (prev ? { ...prev, credits: data } : prev));
        lastUserCreditsFetchedAtRef.current = Date.now();
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('fetch user credits failed:', e);
        }
      } finally {
        fetchUserCreditsPromiseRef.current = null;
      }
    })();

    fetchUserCreditsPromiseRef.current = run;
    return run;
  }, []);

  const fetchUserInfo = useCallback(async (_force = false) => {
    if (fetchUserInfoPromiseRef.current) {
      return fetchUserInfoPromiseRef.current;
    }

    const run = (async () => {
      try {
        const resp = await fetch('/api/user/get-user-info', {
          method: 'POST',
        });
        if (!resp.ok) {
          throw new Error(`fetch failed with status: ${resp.status}`);
        }
        const { code, message, data } = await resp.json();
        if (code !== 0) {
          throw new Error(message);
        }

        setUser(data);
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('fetch user info failed:', e);
        }
      } finally {
        fetchUserInfoPromiseRef.current = null;
      }
    })();

    fetchUserInfoPromiseRef.current = run;
    return run;
  }, []);

  const showOneTap = useCallback(async (configs: Record<string, string>) => {
    try {
      const authClient = getAuthClient(configs);
      await authClient.oneTap({
        callbackURL: '/',
        onPromptNotification: (notification: any) => {
          // Handle prompt dismissal silently
          // This callback is triggered when the prompt is dismissed or skipped
          if (process.env.NODE_ENV !== 'production') {
            console.log('One Tap prompt notification:', notification);
          }
        },
        // fetchOptions: {
        //   onSuccess: () => {
        //     router.push('/');
        //   },
        // },
      });
    } catch (error) {
      // Silently handle One Tap cancellation errors
      // These errors occur when users close the prompt or decline to sign in
      // Common errors: FedCM NetworkError, AbortError, etc.
    }
  }, []);

  useEffect(() => {
    userRef.current = user;
    if (!user?.id) {
      lastUserCreditsFetchedAtRef.current = 0;
    }
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      setUser,
      isCheckSign,
      setIsCheckSign,
      isShowSignModal,
      setIsShowSignModal,
      isShowPaymentModal,
      setIsShowPaymentModal,
      configs,
      fetchConfigs,
      fetchUserCredits,
      fetchUserInfo,
      showOneTap,
    }),
    [
      user,
      isCheckSign,
      isShowSignModal,
      isShowPaymentModal,
      configs,
      fetchConfigs,
      fetchUserCredits,
      fetchUserInfo,
      showOneTap,
    ]
  );

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const refreshCredits = () => {
      void fetchUserCredits();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshCredits();
      }
    };

    // Initial refresh after user is ready.
    refreshCredits();

    // Refresh when user comes back to the page/app.
    window.addEventListener('focus', refreshCredits);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', refreshCredits);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id, fetchUserCredits]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
