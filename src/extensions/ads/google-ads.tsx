import { ReactNode } from 'react';
import Script from 'next/script';

import { AdsConfigs, AdsProvider } from './index';

/**
 * Google Ads Provider
 * Supports both Google Ads conversion tracking and remarketing
 */
export class GoogleAdsProvider implements AdsProvider {
  readonly name = 'google-ads';
  configs: AdsConfigs;

  constructor(configs: AdsConfigs) {
    this.configs = configs;
  }

  getMetaTags(): ReactNode {
    return null;
  }

  getHeadScripts(): ReactNode {
    const { conversionId, conversionLabel } = this.configs;

    if (!conversionId) {
      return null;
    }

    return (
      <>
        {/* Google Ads Global Site Tag (gtag.js) */}
        <Script
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=${conversionId}`}
        />
        <Script
          id="google-ads-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${conversionId}');
              ${conversionLabel ? `gtag('config', '${conversionLabel}');` : ''}
            `,
          }}
        />
      </>
    );
  }

  getBodyScripts(): ReactNode {
    return null;
  }
}

/**
 * Google Ads Display Component
 * Use this to show ads on your pages
 */
export function GoogleAdsDisplay({
  adSlot,
  adFormat = 'auto',
  fullWidthResponsive = true,
  style,
  className,
}: {
  adSlot: string;
  adFormat?: 'auto' | 'fluid' | 'rectangle' | 'vertical' | 'horizontal';
  fullWidthResponsive?: boolean;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div className={className} style={style}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={process.env.NEXT_PUBLIC_GOOGLE_ADS_CLIENT_ID}
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive={fullWidthResponsive.toString()}
      />
      <Script
        id={`google-ads-${adSlot}`}
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (adsbygoogle = window.adsbygoogle || []).push({});
          `,
        }}
      />
    </div>
  );
}

/**
 * Track Google Ads conversion
 * Call this function when a user completes a desired action
 */
export function trackGoogleAdsConversion(
  conversionId: string,
  conversionLabel: string,
  value?: number,
  currency: string = 'USD'
) {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'conversion', {
      send_to: `${conversionId}/${conversionLabel}`,
      value: value,
      currency: currency,
    });
  }
}
