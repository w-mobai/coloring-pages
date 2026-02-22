import { respData, respErr } from '@/shared/lib/resp';
import {
  DEFAULT_GALLERY_LIMIT,
  getPublicColoringGalleryItems,
} from '@/shared/lib/public-coloring-gallery';

const MAX_LIMIT = 120;
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limitParam = Number(url.searchParams.get('limit') || DEFAULT_GALLERY_LIMIT);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(Math.floor(limitParam), 1), MAX_LIMIT)
      : DEFAULT_GALLERY_LIMIT;
    const list = await getPublicColoringGalleryItems({ limit });

    return respData({
      list,
      total: list.length,
      limit,
    });
  } catch (error: any) {
    console.error('get ai gallery failed:', error);
    return respErr(error?.message || 'get ai gallery failed');
  }
}
