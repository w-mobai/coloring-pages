import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { Button } from '@/shared/components/ui/button';

export function BuiltWith() {
  const t = useTranslations('common');
  
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="text-foreground hover:bg-muted hover:text-foreground"
    >
      <Link href="https://whatgenerationami.online" target="_blank">
        {t('built_with')}
      </Link>
    </Button>
  );
}
