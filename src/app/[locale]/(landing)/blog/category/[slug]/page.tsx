import moment from 'moment';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { envConfigs } from '@/config';
import { defaultLocale, locales } from '@/config/locale';
import {
  PostType as DBPostType,
  getPosts,
  PostStatus,
} from '@/shared/models/post';
import {
  findTaxonomy,
  getTaxonomies,
  TaxonomyStatus,
  TaxonomyType,
} from '@/shared/models/taxonomy';
import {
  Category as CategoryType,
  Post as PostType,
} from '@/shared/types/blocks/blog';
import { DynamicPage } from '@/shared/types/blocks/landing';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const t = await getTranslations('pages.blog.metadata');
  const category = await findTaxonomy({
    slug,
    status: TaxonomyStatus.PUBLISHED,
  });
  if (!category) {
    notFound();
  }

  const categoryTitle = category?.title || slug;
  const categoryDescription =
    locale === 'zh'
      ? `${t('description')} 分类：${categoryTitle}。`
      : `${t('description')} Category: ${categoryTitle}.`;
  const appUrl = envConfigs.app_url.replace(/\/+$/, '');
  const canonical =
    locale !== defaultLocale
      ? `${appUrl}/${locale}/blog/category/${slug}`
      : `${appUrl}/blog/category/${slug}`;
  const languages = Object.fromEntries(
    locales.map((loc) => [
      loc,
      loc !== defaultLocale
        ? `${appUrl}/${loc}/blog/category/${slug}`
        : `${appUrl}/blog/category/${slug}`,
    ])
  );

  return {
    title: `${categoryTitle} | ${t('title')}`,
    description: categoryDescription,
    alternates: {
      canonical,
      languages: {
        ...languages,
        'x-default': `${appUrl}/blog/category/${slug}`,
      },
    },
  };
}

export default async function CategoryBlogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ page?: number; pageSize?: number }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  // load blog data
  const t = await getTranslations('pages.blog');

  const { page: pageNum, pageSize } = await searchParams;
  const page = pageNum || 1;
  const limit = pageSize || 30;

  // get current category
  const categoryData = await findTaxonomy({
    slug,
    status: TaxonomyStatus.PUBLISHED,
  });
  if (!categoryData) {
    notFound();
  }

  // get posts data
  const postsData = await getPosts({
    category: categoryData.id,
    type: DBPostType.ARTICLE,
    status: PostStatus.PUBLISHED,
    page,
    limit,
  });

  // get categories data
  const categoriesData = await getTaxonomies({
    type: TaxonomyType.CATEGORY,
    status: TaxonomyStatus.PUBLISHED,
  });

  // current category data
  const currentCategory: CategoryType = {
    id: categoryData.id,
    slug: categoryData.slug,
    title: categoryData.title,
    url: `/blog/category/${categoryData.slug}`,
  };

  // build category
  const categories: CategoryType[] = categoriesData.map((category) => ({
    id: category.id,
    slug: category.slug,
    title: category.title,
    url: `/blog/category/${category.slug}`,
  }));
  categories.unshift({
    id: 'all',
    slug: 'all',
    title: t('messages.all'),
    url: `/blog`,
  });

  // build posts
  const posts: PostType[] = postsData.map((post) => ({
    id: post.id,
    title: post.title || '',
    description: post.description || '',
    author_name: post.authorName || '',
    author_image: post.authorImage || '',
    created_at: moment(post.createdAt).format('MMM D, YYYY') || '',
    image: post.image || '',
    url: `/blog/${post.slug}`,
  }));

  // build page sections
  const _page: DynamicPage = {
    title: t('page.title'),
    sections: {
      blog: {
        ...t.raw('page.sections.blog'),
        data: {
          categories,
          currentCategory,
          posts,
        },
      },
    },
  };

  // load page component
  const Page = await getThemePage('dynamic-page');

  return <Page locale={locale} page={_page} />;
}
