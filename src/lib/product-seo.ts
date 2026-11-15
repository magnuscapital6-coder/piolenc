import { absoluteUrl } from './seo';
import { availableStock } from './stock';

/**
 * Règles communes à la fiche produit (données structurées) et au flux Google
 * Merchant Center. Google compare les deux avec la page affichée : prix et
 * disponibilité doivent donc suivre exactement les mêmes règles que la fiche
 * (ProductClientDetails) et que le tunnel de commande.
 */

export interface SeoProduct {
  slug: string;
  name: string;
  reference: string;
  shortDescription: string;
  description: string | null;
  images: string;
  priceTTC: number;
  promoPrice: number | null;
  promoEndDate?: Date | null;
  stock: number;
  reservedStock?: number | null;
  isPreorderAllowed: boolean;
  species?: string | null;
  woodType?: string | null;
  logLength?: string | null;
  humidityRate?: string | null;
  weightKg?: number | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  updatedAt?: Date;
}

export type FeedAvailability = 'in_stock' | 'preorder' | 'out_of_stock';

/** Même règle que la fiche et que /api/checkout : un prix promo renseigné s'applique. */
export function effectivePrice(product: Pick<SeoProduct, 'priceTTC' | 'promoPrice'>): number {
  return product.promoPrice && product.promoPrice > 0 ? product.promoPrice : product.priceTTC;
}

export function hasPromo(product: Pick<SeoProduct, 'priceTTC' | 'promoPrice'>): boolean {
  return Boolean(product.promoPrice && product.promoPrice > 0 && product.promoPrice < product.priceTTC);
}

/** Même règle que la fiche et la commande (src/lib/stock.ts), sinon précommande si autorisée. */
export function availability(product: Pick<SeoProduct, 'stock' | 'reservedStock' | 'isPreorderAllowed'>): FeedAvailability {
  if (availableStock(product) > 0) return 'in_stock';
  return product.isPreorderAllowed ? 'preorder' : 'out_of_stock';
}

const SCHEMA_AVAILABILITY: Record<FeedAvailability, string> = {
  in_stock: 'https://schema.org/InStock',
  preorder: 'https://schema.org/PreOrder',
  out_of_stock: 'https://schema.org/OutOfStock',
};

export function productImageUrls(product: Pick<SeoProduct, 'images'>): string[] {
  try {
    const list = JSON.parse(product.images || '[]');
    return Array.isArray(list) ? list.filter((src) => typeof src === 'string' && src).map(absoluteUrl) : [];
  } catch {
    return [];
  }
}

/** Texte brut (sans HTML ni retours multiples), tronqué proprement. */
export function plainText(value: string | null | undefined, max: number): string {
  // Seules de vraies balises HTML sont retirées : « humidité < 20 % > 15 % »
  // doit rester intact (le texte est échappé ensuite à l'affichage).
  const text = (value || '')
    .replace(/<\/?(?:p|br|b|strong|i|em|u|ul|ol|li|span|div|a|h[1-6])\b[^>]*>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20))}…`;
}

export function productDescription(product: SeoProduct, max = 160): string {
  return plainText(product.seoDescription || product.shortDescription || product.description, max);
}

export function productJsonLd(
  product: SeoProduct,
  options: { brand: string; sellerName: string; categoryName?: string; reviews?: Array<{ rating: number; authorName: string; comment: string; createdAt: Date }> }
) {
  const url = absoluteUrl(`/produit/${product.slug}`);
  const price = effectivePrice(product);
  const reviews = options.reviews || [];
  const ratingCount = reviews.length;
  const ratingValue = ratingCount ? reviews.reduce((sum, review) => sum + review.rating, 0) / ratingCount : 0;

  // Fin de validité du prix : fin de la promotion si elle est datée, sinon un
  // an. Google signale un avertissement quand ce champ manque.
  const validUntil = (
    product.promoEndDate && hasPromo(product) && product.promoEndDate > new Date()
      ? product.promoEndDate
      : new Date(Date.now() + 365 * 86400000)
  )
    .toISOString()
    .slice(0, 10);

  const properties = [
    ['Essence', product.species],
    ['Type de bois', product.woodType],
    ['Longueur des bûches', product.logLength],
    ['Taux d’humidité', product.humidityRate],
  ].filter(([, value]) => Boolean(value));

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: product.name,
    description: productDescription(product, 5000),
    sku: product.reference,
    mpn: product.reference,
    url,
    image: productImageUrls(product),
    brand: { '@type': 'Brand', name: options.brand },
    ...(options.categoryName ? { category: options.categoryName } : {}),
    ...(product.weightKg ? { weight: { '@type': 'QuantitativeValue', value: product.weightKg, unitCode: 'KGM' } } : {}),
    ...(properties.length
      ? {
          additionalProperty: properties.map(([name, value]) => ({
            '@type': 'PropertyValue',
            name,
            value,
          })),
        }
      : {}),
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'EUR',
      price: price.toFixed(2),
      priceValidUntil: validUntil,
      availability: SCHEMA_AVAILABILITY[availability(product)],
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: options.sellerName },
    },
    ...(ratingCount
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Math.round(ratingValue * 10) / 10,
            reviewCount: ratingCount,
            bestRating: 5,
            worstRating: 1,
          },
          review: reviews.slice(0, 5).map((review) => ({
            '@type': 'Review',
            reviewRating: { '@type': 'Rating', ratingValue: review.rating, bestRating: 5 },
            author: { '@type': 'Person', name: review.authorName },
            reviewBody: plainText(review.comment, 500),
            datePublished: review.createdAt.toISOString().slice(0, 10),
          })),
        }
      : {}),
  };
}
