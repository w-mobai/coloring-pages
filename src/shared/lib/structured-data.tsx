/**
 * Generate structured data (JSON-LD) for SEO
 * This helps search engines understand your content better
 */

export interface StructuredDataProps {
  type: 'WebApplication' | 'WebSite' | 'Article' | 'Organization';
  name: string;
  description: string;
  url: string;
  image?: string;
  author?: {
    name: string;
    url?: string;
  };
  datePublished?: string;
  dateModified?: string;
  keywords?: string[];
}

export function generateStructuredData(props: StructuredDataProps) {
  const baseData = {
    '@context': 'https://schema.org',
    '@type': props.type,
    name: props.name,
    description: props.description,
    url: props.url,
  };

  if (props.type === 'WebApplication') {
    return {
      ...baseData,
      applicationCategory: 'Entertainment',
      operatingSystem: 'Any',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.8',
        ratingCount: '1250',
        bestRating: '5',
        worstRating: '1',
      },
      ...(props.image && { image: props.image }),
    };
  }

  if (props.type === 'WebSite') {
    return {
      ...baseData,
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${props.url}/search?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    };
  }

  if (props.type === 'Article') {
    return {
      ...baseData,
      headline: props.name,
      ...(props.image && { image: props.image }),
      ...(props.datePublished && { datePublished: props.datePublished }),
      ...(props.dateModified && { dateModified: props.dateModified }),
      ...(props.author && {
        author: {
          '@type': 'Person',
          name: props.author.name,
          ...(props.author.url && { url: props.author.url }),
        },
      }),
      ...(props.keywords && { keywords: props.keywords.join(', ') }),
    };
  }

  if (props.type === 'Organization') {
    return {
      ...baseData,
      ...(props.image && { logo: props.image }),
    };
  }

  return baseData;
}

export function StructuredData({ data }: { data: any }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
