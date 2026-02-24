import { useTranslations } from 'next-intl';

import { Link } from '@/core/i18n/navigation';
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
      <Link href="/">
        {t('built_with')}
      </Link>
    </Button>
  );
}
