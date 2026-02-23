'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { useAppContext } from '@/shared/contexts/app';

import { SignInForm } from './sign-in-form';
import { SignUpForm } from './sign-up-form';

export function SignModal({ callbackUrl = '/' }: { callbackUrl?: string }) {
  const t = useTranslations('common.sign');
  const { isShowSignModal, setIsShowSignModal } = useAppContext();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');

  useEffect(() => {
    if (isShowSignModal) {
      setMode('sign-in');
    }
  }, [isShowSignModal]);

  return (
    <Dialog open={isShowSignModal} onOpenChange={setIsShowSignModal}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'sign-in' ? t('sign_in_title') : t('sign_up_title')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'sign-in'
              ? t('sign_in_description')
              : t('sign_up_description')}
          </DialogDescription>
        </DialogHeader>
        {mode === 'sign-in' ? (
          <SignInForm
            callbackUrl={callbackUrl}
            onSwitchToSignUp={() => setMode('sign-up')}
          />
        ) : (
          <SignUpForm
            callbackUrl={callbackUrl}
            onSwitchToSignIn={() => setMode('sign-in')}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
