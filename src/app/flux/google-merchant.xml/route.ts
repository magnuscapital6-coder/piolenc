import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/settings';
import { absoluteUrl, getSeoSettings } from '@/lib/seo';
import { getSiteUrl } from '@/lib/site-url';
import {
  availability,
  effectivePrice,
  hasPromo,
  plainText,
  productImageUrls,
  type SeoProduct,
} from '@/lib/product-seo';

/**
 * Flux produits Google Merchant Center (RSS 2.0 + espace de noms g:).
 * https://support.google.com/merchants/answer/7052112
 *
 * Lu en direct dans la base : un prix, une promotion ou un stock modifié dans
 * l'administration est repris au prochain passage de Google (planifié chaque
 * jour dans Merchant Center). Seuls les produits actifs et pourvus d'une photo
 * sont publiés : Google refuse les articles sans image.
 */
export const dynamic = 'force-dynamic';

function xml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Caractères de contrôle interdits en XML 1.0.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function tag(name: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  return `      <${name}>${xml(value)}</${name}>\n`;
}

function price(amount: number): string {
  return `${amount.toFixed(2)} EUR`;
}

function isoDate(date: Date | null | undefined): string {
  return date ? date.toISOString().replace(/\.\d{3}Z$/, 'Z') : '';
}

export async function GET() {
  const seo = await getSeoSettings();
  if (!seo.merchantFeedEnabled) {
    return new Response('Flux désactivé dans l’administration (SEO & Google).', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const settings = await getSiteSettings();
  let products;
  try {
    products = await prisma.product.findMany({
      where: { isActive: true },
      include: { category: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  } catch (error: any) {
    // Base momentanément injoignable : un 503 indique à Google de repasser
    // plus tard au lieu de vider le catalogue publié dans Merchant Center.
    console.error('[flux google] lecture du catalogue impossible:', error?.message || error);
    return new Response('Catalogue momentanément indisponible.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '3600' },
    });
  }

  const brand = seo.merchantBrand || settings.companyName || settings.siteName;
  const siteUrl = getSiteUrl();

  const items = products
    .map((product) => {
      const seoProduct = product as unknown as SeoProduct;
      const images = productImageUrls(seoProduct);
      if (images.length === 0) return '';

      const promo = hasPromo(seoProduct);
      const title = plainText(product.seoTitle || product.name, 150);
      const description = plainText(product.description || product.shortDescription || product.name, 5000);
      const productType = [product.category?.name, product.species].filter(Boolean).join(' > ');

      let entry = '    <item>\n';
      entry += tag('g:id', product.reference || product.id);
      entry += tag('g:title', title);
      entry += tag('g:description', description);
      entry += tag('g:link', absoluteUrl(`/produit/${product.slug}`));
      entry += tag('g:image_link', images[0]);
      for (const extra of images.slice(1, 11)) entry += tag('g:additional_image_link', extra);
      entry += tag('g:availability', availability(seoProduct));
      if (availability(seoProduct) === 'preorder') {
        // Date de disponibilité exigée pour une précommande : délai annoncé sur la fiche.
        const lead = Math.max(1, product.leadTimeDays || 7);
        entry += tag('g:availability_date', isoDate(new Date(Date.now() + lead * 86400000)));
      }
      entry += tag('g:price', price(promo ? product.priceTTC : effectivePrice(seoProduct)));
      if (promo) {
        entry += tag('g:sale_price', price(effectivePrice(seoProduct)));
        if (product.promoStartDate && product.promoEndDate && product.promoEndDate > new Date()) {
          entry += tag('g:sale_price_effective_date', `${isoDate(product.promoStartDate)}/${isoDate(product.promoEndDate)}`);
        }
      }
      entry += tag('g:condition', 'new');
      entry += tag('g:brand', brand);
      entry += tag('g:mpn', product.reference);
      // Bois de chauffage sans code-barres GTIN : on le déclare explicitement.
      entry += tag('g:identifier_exists', 'no');
      entry += tag('g:google_product_category', seo.merchantGoogleCategory);
      entry += tag('g:product_type', productType);
      if (product.weightKg) entry += tag('g:shipping_weight', `${product.weightKg} kg`);
      entry += tag('g:custom_label_0', product.woodType);
      entry += tag('g:custom_label_1', product.logLength);
      entry += '    </item>\n';
      return entry;
    })
    .join('');

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n' +
    '  <channel>\n' +
    `    <title>${xml(settings.siteName)}</title>\n` +
    `    <link>${xml(siteUrl)}</link>\n` +
    `    <description>${xml(settings.slogan || settings.siteName)}</description>\n` +
    items +
    '  </channel>\n' +
    '</rss>\n';

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Google relit le flux une fois par jour : une heure de cache côté CDN
      // suffit et évite d'interroger la base à chaque passage de robot.
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=600',
    },
  });
}
