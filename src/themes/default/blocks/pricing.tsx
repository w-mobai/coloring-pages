'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { SmartIcon } from '@/shared/blocks/common';
import { PaymentModal } from '@/shared/blocks/payment/payment-modal';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { useAppContext } from '@/shared/contexts/app';
import { getCookie } from '@/shared/lib/cookie';
import { cn } from '@/shared/lib/utils';
import { Subscription } from '@/shared/models/subscription';
import {
  PricingCurrency,
  PricingItem,
  Pricing as PricingType,
} from '@/shared/types/blocks/pricing';

const FORCED_CURRENCY = 'usd';

// Helper function to get all available currencies from a pricing item
function getCurrenciesFromItem(item: PricingItem | null): PricingCurrency[] {
  if (!item) return [];

  // Always include the default currency first
  const defaultCurrency: PricingCurrency = {
    currency: item.currency,
    amount: item.amount,
    price: item.price || '',
    original_price: item.original_price || '',
  };

  // Add additional currencies if available
  if (item.currencies && item.currencies.length > 0) {
    return [defaultCurrency, ...item.currencies];
  }

  return [defaultCurrency];
}

function buildDisplayedItemByForcedCurrency(item: PricingItem): PricingItem {
  const currencies = getCurrenciesFromItem(item);
  const usdCurrencyData = currencies.find(
    (c) => c.currency.toLowerCase() === FORCED_CURRENCY
  );

  if (!usdCurrencyData) {
    return {
      ...item,
      currency: item.currency || 'USD',
    };
  }

  return {
    ...item,
    currency: usdCurrencyData.currency,
    amount: usdCurrencyData.amount,
    price: usdCurrencyData.price,
    original_price: usdCurrencyData.original_price,
    payment_product_id: usdCurrencyData.payment_product_id || item.payment_product_id,
    payment_providers: usdCurrencyData.payment_providers || item.payment_providers,
  };
}

export function Pricing({
  section,
  className,
  currentSubscription,
}: {
  section: PricingType;
  className?: string;
  currentSubscription?: Subscription;
}) {
  const locale = useLocale();
  const t = useTranslations('pages.pricing.messages');

  const {
    user,
    isShowPaymentModal,
    setIsShowSignModal,
    setIsShowPaymentModal,
    configs,
  } = useAppContext();

  const [group, setGroup] = useState(() => {
    // find current pricing item
    const currentItem = section.items?.find(
      (i) => i.product_id === currentSubscription?.productId
    );

    // First look for a group with is_featured set to true
    const featuredGroup = section.groups?.find((g) => g.is_featured);
    // If no featured group exists, fall back to the first group
    return (
      currentItem?.group || featuredGroup?.name || section.groups?.[0]?.name
    );
  });

  // current pricing item
  const [pricingItem, setPricingItem] = useState<PricingItem | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);

  // Currency state management for each item
  // Store selected currency and displayed item for each product_id
  const [itemCurrencies, setItemCurrencies] = useState<
    Record<string, { displayedItem: PricingItem }>
  >({});

  // Initialize currency states for all items
  useEffect(() => {
    if (section.items && section.items.length > 0) {
      const initialCurrencyStates: Record<
        string,
        { displayedItem: PricingItem }
      > = {};

      section.items.forEach((item) => {
        const displayedItem = buildDisplayedItemByForcedCurrency(item);

        initialCurrencyStates[item.product_id] = {
          displayedItem,
        };
      });

      setItemCurrencies(initialCurrencyStates);
    }
  }, [section.items]);

  const handlePayment = async (item: PricingItem) => {
    if (!user) {
      setIsShowSignModal(true);
      return;
    }

    // Use displayed item with selected currency
    const displayedItem =
      itemCurrencies[item.product_id]?.displayedItem || item;

    if (configs.select_payment_enabled === 'true') {
      setPricingItem(displayedItem);
      setIsShowPaymentModal(true);
    } else {
      handleCheckout(displayedItem, configs.default_payment_provider);
    }
  };

  const getAffiliateMetadata = ({
    paymentProvider,
  }: {
    paymentProvider: string;
  }) => {
    const affiliateMetadata: Record<string, string> = {};

    // get Affonso referral
    if (
      configs.affonso_enabled === 'true' &&
      ['stripe', 'creem'].includes(paymentProvider)
    ) {
      const affonsoReferral = getCookie('affonso_referral') || '';
      affiliateMetadata.affonso_referral = affonsoReferral;
    }

    // get PromoteKit referral
    if (
      configs.promotekit_enabled === 'true' &&
      ['stripe'].includes(paymentProvider)
    ) {
      const promotekitReferral =
        typeof window !== 'undefined' && (window as any).promotekit_referral
          ? (window as any).promotekit_referral
          : getCookie('promotekit_referral') || '';
      affiliateMetadata.promotekit_referral = promotekitReferral;
    }

    return affiliateMetadata;
  };

  const handleCheckout = async (
    item: PricingItem,
    paymentProvider?: string
  ) => {
    try {
      if (!user) {
        setIsShowSignModal(true);
        return;
      }

      const affiliateMetadata = getAffiliateMetadata({
        paymentProvider: paymentProvider || '',
      });

      const params = {
        product_id: item.product_id,
        currency: item.currency,
        locale: locale || 'en',
        payment_provider: paymentProvider || '',
        metadata: affiliateMetadata,
      };

      setIsLoading(true);
      setProductId(item.product_id);

      const response = await fetch('/api/payment/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (response.status === 401) {
        setIsLoading(false);
        setProductId(null);
        setPricingItem(null);
        setIsShowSignModal(true);
        return;
      }

      if (!response.ok) {
        throw new Error(`request failed with status ${response.status}`);
      }

      const { code, message, data } = await response.json();
      if (code !== 0) {
        throw new Error(message);
      }

      const { checkoutUrl } = data;
      if (!checkoutUrl) {
        throw new Error('checkout url not found');
      }

      window.location.href = checkoutUrl;
    } catch (e: any) {
      console.log('checkout failed: ', e);
      toast.error('checkout failed: ' + e.message);

      setIsLoading(false);
      setProductId(null);
    }
  };

  useEffect(() => {
    if (section.items) {
      const featuredItem = section.items.find((i) => i.is_featured);
      setProductId(featuredItem?.product_id || section.items[0]?.product_id);
      setIsLoading(false);
    }
  }, [section.items]);

  const filteredItems =
    section.items?.filter((item) => !item.group || item.group === group) || [];

  return (
    <section
      id={section.id}
      className={cn('py-24 md:py-36', section.className, className)}
    >
      <div className="mx-auto mb-12 px-4 text-center md:px-8">
        {section.sr_only_title && (
          <h1 className="sr-only">{section.sr_only_title}</h1>
        )}
        <h2 className="mb-6 text-3xl font-bold text-pretty lg:text-4xl">
          {section.title}
        </h2>
        <p className="text-muted-foreground mx-auto mb-4 max-w-xl lg:max-w-none lg:text-lg">
          {section.description}
        </p>
      </div>

      <div className="container">
        {section.groups && section.groups.length > 0 && (
          <div className="mx-auto mt-8 mb-16 flex w-full justify-center md:max-w-lg">
            <Tabs value={group} onValueChange={setGroup} className="">
              <TabsList>
                {section.groups.map((item, i) => {
                  return (
                    <TabsTrigger key={i} value={item.name || ''}>
                      {item.title}
                      {item.label && (
                        <Badge className="ml-2">{item.label}</Badge>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </div>
        )}

        <div
          className={cn(
            'mx-auto mt-0 grid w-full gap-6',
            filteredItems.length <= 1 && 'max-w-sm md:grid-cols-1',
            filteredItems.length === 2 && 'max-w-3xl md:grid-cols-2',
            filteredItems.length >= 3 && 'max-w-[1080px] md:grid-cols-3'
          )}
        >
          {filteredItems.map((item: PricingItem, idx) => {
            let isCurrentPlan = false;
            if (
              currentSubscription &&
              currentSubscription.productId === item.product_id
            ) {
              isCurrentPlan = true;
            }

            // Get currency state for this item
            const currencyState = itemCurrencies[item.product_id];
            const displayedItem = currencyState?.displayedItem || item;

            return (
              <Card key={idx} className="relative w-full max-w-[340px] justify-self-center py-4 shadow-none">
                {item.label && (
                  <span className="absolute inset-x-0 -top-3 mx-auto flex h-6 w-fit items-center rounded-full bg-linear-to-br/increasing from-purple-400 to-amber-300 px-3 py-1 text-xs font-medium text-amber-950 ring-1 ring-white/20 ring-offset-1 ring-offset-gray-950/5 ring-inset">
                    {item.label}
                  </span>
                )}

                <CardHeader>
                  <CardTitle className="font-medium">
                    <h3 className="text-sm font-medium">{item.title}</h3>
                  </CardTitle>

                  <div className="my-3 flex items-baseline gap-2">
                    {displayedItem.original_price && (
                      <span className="text-muted-foreground text-sm line-through">
                        {displayedItem.original_price}
                      </span>
                    )}

                    <div className="my-3 block text-2xl font-semibold">
                      <span className="text-primary">
                        {displayedItem.price}
                      </span>{' '}
                      {displayedItem.unit ? (
                        <span className="text-muted-foreground text-sm font-normal">
                          {displayedItem.unit}
                        </span>
                      ) : (
                        ''
                      )}
                    </div>

                  </div>

                  <CardDescription className="text-sm">
                    {item.description}
                  </CardDescription>
                  {item.tip && (
                    <span className="text-muted-foreground text-sm">
                      {item.tip}
                    </span>
                  )}

                  {isCurrentPlan ? (
                    <Button
                      variant="outline"
                      className="mt-4 h-9 w-full px-4 py-2"
                      disabled
                    >
                      <span className="hidden text-sm md:block">
                        {t('current_plan')}
                      </span>
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handlePayment(item)}
                      disabled={isLoading}
                      className={cn(
                        'focus-visible:ring-ring inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
                        'mt-4 h-9 w-full px-4 py-2',
                        'bg-primary text-primary-foreground hover:bg-primary/90 border-0 shadow-none'
                      )}
                    >
                      {isLoading && item.product_id === productId ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          <span className="block">{t('processing')}</span>
                        </>
                      ) : (
                        <>
                          {item.button?.icon && (
                            <SmartIcon
                              name={item.button?.icon as string}
                              className="size-4"
                            />
                          )}
                          <span className="block">{item.button?.title}</span>
                        </>
                      )}
                    </Button>
                  )}
                </CardHeader>

                <CardContent className="space-y-4">
                  <hr className="border-dashed" />

                  {item.features_title && (
                    <p className="text-sm font-medium">{item.features_title}</p>
                  )}
                  <ul className="list-outside space-y-3 text-sm">
                    {item.features?.map((item, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <Check className="size-3" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <PaymentModal
        isLoading={isLoading}
        pricingItem={pricingItem}
        onCheckout={(item, paymentProvider) =>
          handleCheckout(item, paymentProvider)
        }
      />
    </section>
  );
}
