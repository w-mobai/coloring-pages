'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { authClient, signIn } from '@/core/auth/client';
import { Link, useRouter } from '@/core/i18n/navigation';
import { defaultLocale } from '@/config/locale';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { PasswordInput } from '@/shared/components/ui/password-input';
import { Label } from '@/shared/components/ui/label';
import { useAppContext } from '@/shared/contexts/app';
import { User as UserType } from '@/shared/models/user';

import { SocialProviders } from './social-providers';

function extractSessionUser(data: any): UserType | null {
  const u = data?.user ?? data?.data?.user ?? null;
  return u && typeof u === 'object' ? (u as UserType) : null;
}

export function SignInForm({
  callbackUrl = '/',
  className,
  onSwitchToSignUp,
  defaultEmail = '',
}: {
  callbackUrl: string;
  className?: string;
  onSwitchToSignUp?: () => void;
  defaultEmail?: string;
}) {
  const t = useTranslations('common.sign');
  const router = useRouter();
  const locale = useLocale();
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const didRequestConfigsRef = useRef(false);

  const {
    configs,
    fetchConfigs,
    setUser,
    fetchUserInfo,
    setIsShowSignModal,
  } = useAppContext();

  const isGoogleAuthEnabled = configs.google_auth_enabled === 'true';
  const isGithubAuthEnabled = configs.github_auth_enabled === 'true';
  const isEmailAuthEnabled =
    configs.email_auth_enabled !== 'false' ||
    (!isGoogleAuthEnabled && !isGithubAuthEnabled); // no social providers enabled, auto enable email auth

  useEffect(() => {
    if (
      !didRequestConfigsRef.current &&
      Object.keys(configs || {}).length === 0
    ) {
      didRequestConfigsRef.current = true;
      void fetchConfigs();
    }
  }, [configs, fetchConfigs]);

  useEffect(() => {
    setEmail(defaultEmail || '');
  }, [defaultEmail]);

  if (callbackUrl) {
    if (
      locale !== defaultLocale &&
      callbackUrl.startsWith('/') &&
      !callbackUrl.startsWith(`/${locale}`)
    ) {
      callbackUrl = `/${locale}${callbackUrl}`;
    }
  }

  const base = locale !== defaultLocale ? `/${locale}` : '';
  const stripLocalePrefix = (path: string) => {
    if (!path?.startsWith('/')) return '/';
    if (locale === defaultLocale) return path;
    if (path === `/${locale}`) return '/';
    if (path.startsWith(`/${locale}/`))
      return path.slice(locale.length + 1) || '/';
    return path;
  };

  const navigateAfterAuthSuccess = (path: string) => {
    const normalizedPath = stripLocalePrefix(path || '/');
    if (typeof window !== 'undefined') {
      const localizedPath =
        locale !== defaultLocale
          ? normalizedPath === '/'
            ? `/${locale}`
            : `/${locale}${normalizedPath}`
          : normalizedPath;
      window.location.assign(localizedPath);
      return;
    }

    router.push(normalizedPath || '/');
  };

  const handleSignIn = async () => {
    if (loading) {
      return;
    }

    if (!email || !password) {
      toast.error('email and password are required');
      return;
    }

    // Set loading immediately to avoid duplicate submits before request hooks fire.
    setLoading(true);

    try {
      await signIn.email(
        {
          email,
          password,
          callbackURL: callbackUrl,
        },
        {
          onRequest: (ctx) => {
            // loading is already set above; keep as no-op for safety
          },
          onResponse: (ctx) => {
            // Do NOT reset loading here; navigation may not have completed yet.
          },
          onSuccess: async () => {
            // For modal sign-in on the same route, sync auth state immediately
            // so users don't need a manual page refresh.
            try {
              const res: any = await authClient.getSession();
              const fresh = extractSessionUser(res?.data ?? res);
              if (fresh?.id) {
                setUser(fresh);
                void fetchUserInfo();
              }
            } catch {
              // ignore and continue; cookie is already set server-side
            }

            setIsShowSignModal(false);
            setLoading(false);

            navigateAfterAuthSuccess(callbackUrl);
          },
          onError: (e: any) => {
            const status = e?.error?.status;
            if (status === 403) {
              const normalizedCallbackUrl = stripLocalePrefix(callbackUrl);
              const verifyPath = `/verify-email?sent=1&email=${encodeURIComponent(
                email
              )}&callbackUrl=${encodeURIComponent(normalizedCallbackUrl)}`;

              // Send verification email with callback to verify page.
              void authClient.sendVerificationEmail({
                email,
                callbackURL: `${base}${verifyPath}`,
              });

              // i18n router will prefix locale automatically; do NOT include locale here.
              router.push(verifyPath);
              return;
            }

            toast.error(e?.error?.message || 'sign in failed');
            setLoading(false);
          },
        }
      );
    } catch (e: any) {
      toast.error(e?.message || 'sign in failed');
      setLoading(false);
    }
  };

  return (
    <div className={`w-full md:max-w-md ${className}`}>
      <div className="grid gap-4">
        {isEmailAuthEnabled && (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSignIn();
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="email">{t('email_title')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('email_placeholder')}
                required
                className="auth-input !bg-transparent dark:!bg-transparent placeholder:text-muted-foreground/70 focus-visible:border-input focus-visible:ring-0"
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
                value={email}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">{t('password_title')}</Label>

              <PasswordInput
                id="password"
                placeholder={t('password_placeholder')}
                autoComplete="password"
                className="auth-input !bg-transparent dark:!bg-transparent placeholder:text-muted-foreground/70 focus-visible:border-input focus-visible:ring-0"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              onClick={() => {
                setRememberMe(!rememberMe);
              }}
            />
            <Label htmlFor="remember">{t("remember_me_title")}</Label>
          </div> */}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <p> {t('sign_in_title')} </p>
              )}
            </Button>
          </form>
        )}

        <SocialProviders
          configs={configs}
          callbackUrl={callbackUrl || '/'}
          loading={loading}
          setLoading={setLoading}
        />
      </div>
      {isEmailAuthEnabled && (
        <div className="flex w-full justify-center pt-4">
          <p className="text-center text-xs text-neutral-500">
            {t('no_account')}
            {onSwitchToSignUp ? (
              <button
                type="button"
                className="cursor-pointer underline dark:text-white/70"
                onClick={onSwitchToSignUp}
              >
                {t('sign_up_title')}
              </button>
            ) : (
              <Link href="/sign-up" className="underline">
                <span className="cursor-pointer dark:text-white/70">
                  {t('sign_up_title')}
                </span>
              </Link>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
