'use client';

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

export function SignModal({ callbackUrl = '/' }: { callbackUrl?: string }) {
  const t = useTranslations('common.sign');
  const { isShowSignModal, setIsShowSignModal } = useAppContext();

  return (
    <Dialog open={isShowSignModal} onOpenChange={setIsShowSignModal}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('sign_in_title')}</DialogTitle>
          <DialogDescription>{t('sign_in_description')}</DialogDescription>
        </DialogHeader>
        <SignInForm callbackUrl={callbackUrl} />
      </DialogContent>
    </Dialog>
  );
}
