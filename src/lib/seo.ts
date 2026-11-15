import type { Metadata } from 'next';
import { prisma } from './prisma';
import { getSiteUrl } from './site-url';
import { applySiteSettingsToText, getSiteSettings, type SiteSettingsData } from './settings';

/**
 * Référencement et outils Google, pilotés depuis /admin/seo.
 *
 * Tout est lu à chaque rendu (une seule ligne, recherche par clé primaire) pour
 * qu'un code collé dans l'administration soit en ligne immédiatement, comme le
 * reste du paramétrage du site (voir src/lib/settings.ts).
 */

export interface PageMetaOverride {
  title?: string;
  description?: string;
  noindex?: boolean;
}

export interface SeoSettingsData {
  allowIndexing: boolean;
  defaultOgImageUrl: string;
  organizationType: string;
  googleSiteVerification: string;
  bingSiteVerification: string;
  facebookDomainVerification: string;
  googleTagManagerId: string;
  googleAnalyticsId: string;
  googleAdsId: string;
  googleAdsConversionLabel: string;
  requireConsent: boolean;
  merchantCenterId: string;
  merchantFeedEnabled: boolean;
  merchantBrand: string;
  merchantGoogleCategory: string;
  customHeadCode: string;
  customBodyStartCode: string;
  customBodyEndCode: string;
  pageMeta: Record<string, PageMetaOverride>;
}

export const DEFAULT_SEO_SETTINGS: SeoSettingsData = {
  allowIndexing: true,
  defaultOgImageUrl: '',
  organizationType: 'Store',
  googleSiteVerification: '',
  bingSiteVerification: '',
  facebookDomainVerification: '',
  googleTagManagerId: '',
  googleAnalyticsId: '',
  googleAdsId: '',
  googleAdsConversionLabel: '',
  requireConsent: true,
  merchantCenterId: '',
  merchantFeedEnabled: true,
  merchantBrand: '',
  merchantGoogleCategory: '',
  customHeadCode: '',
  customBodyStartCode: '',
  customBodyEndCode: '',
  pageMeta: {},
};

export const SEO_SETTINGS_ID = 'default-seo';

export const ORGANIZATION_TYPES = ['Store', 'LocalBusiness', 'HomeAndConstructionBusiness', 'Organization'] as const;

function parsePageMeta(raw: unknown): Record<string, PageMetaOverride> {
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Ne lève jamais : si la migration n'est pas encore appliquée (table absente)
 * ou si la base est injoignable, le site tourne avec les valeurs neutres
 * plutôt que de tomber en erreur 500.
 */
export async function getSeoSettings(): Promise<SeoSettingsData> {
  try {
    const row = await prisma.seoSetting.findUnique({ where: { id: SEO_SETTINGS_ID } });
    if (!row) return DEFAULT_SEO_SETTINGS;
    const { id: _id, createdAt: _c, updatedAt: _u, pageMeta, ...rest } = row;
    return { ...DEFAULT_SEO_SETTINGS, ...rest, pageMeta: parsePageMeta(pageMeta) };
  } catch {
    return DEFAULT_SEO_SETTINGS;
  }
}

// ---------------------------------------------------------------------------
// Nettoyage de ce que l'exploitant colle depuis Google
// ---------------------------------------------------------------------------

/**
 * Google donne souvent la balise complète : on accepte indifféremment
 * `<meta name="google-site-verification" content="abc" />` ou `abc`.
 */
export function extractMetaContent(input: unknown): string {
  const value = typeof input === 'string' ? input.trim() : '';
  if (!value) return '';
  const fromTag = value.match(/content\s*=\s*["']([^"']+)["']/i);
  const cleaned = (fromTag ? fromTag[1] : value).trim();
  // Un code de vérification ne contient ni espace ni chevron.
  return /^[A-Za-z0-9_\-.:=+/]{1,200}$/.test(cleaned) ? cleaned : '';
}

/** Retrouve un identifiant (G-…, AW-…, GTM-…) même au milieu d'un extrait de code. */
function extractTagId(input: unknown, pattern: RegExp): string {
  const value = typeof input === 'string' ? input.trim().toUpperCase() : '';
  if (!value) return '';
  const match = value.match(pattern);
  return match ? match[0] : '';
}

export const extractGtmId = (input: unknown) => extractTagId(input, /GTM-[A-Z0-9]{4,12}/);
export const extractGa4Id = (input: unknown) => extractTagId(input, /G-[A-Z0-9]{4,15}/);
export const extractAdsId = (input: unknown) => extractTagId(input, /AW-\d{6,15}/);

/** Libellé de conversion : la partie après « AW-123/ » dans `send_to`. */
export function extractConversionLabel(input: unknown): string {
  const value = typeof input === 'string' ? input.trim() : '';
  if (!value) return '';
  const fromSendTo = value.match(/AW-\d+\/([A-Za-z0-9_-]+)/i);
  const cleaned = fromSendTo ? fromSendTo[1] : value;
  return /^[A-Za-z0-9_-]{1,64}$/.test(cleaned) ? cleaned : '';
}

export function extractDigits(input: unknown, max = 20): string {
  const value = typeof input === 'string' ? input : typeof input === 'number' ? String(input) : '';
  const digits = value.replace(/\D/g, '');
  return digits.slice(0, max);
}

// ---------------------------------------------------------------------------
// Pages publiques et métadonnées
// ---------------------------------------------------------------------------

export interface PublicPageDefinition {
  path: string;
  label: string;
  title: string;
  description: string;
}

/**
 * Titre et description par défaut de chaque page publique. L'exploitant peut
 * les remplacer depuis /admin/seo ; un champ laissé vide reprend ces valeurs.
 * Le titre est complété automatiquement par « | nom du site ».
 */
export const PUBLIC_PAGES: PublicPageDefinition[] = [
  { path: '/', label: 'Accueil', title: '', description: '' },
  {
    path: '/boutique',
    label: 'Boutique',
    title: 'Boutique bois de chauffage : bûches, palettes et granulés',
    description:
      'Achetez votre bois de chauffage sec en ligne : chêne, hêtre, charme en bûches de 25, 33 ou 50 cm. Palettes livrées à domicile avec hayon.',
  },
  {
    path: '/promotions',
    label: 'Promotions',
    title: 'Promotions sur le bois de chauffage',
    description:
      'Les offres du moment sur le bois de chauffage sec et étuvé : palettes à prix réduit, livraison à domicile partout en France.',
  },
  {
    path: '/catalogue',
    label: 'Catalogue',
    title: 'Catalogue complet du bois de chauffage',
    description:
      'Toutes nos références de bois de chauffage : essences, longueurs de bûches, taux d’humidité et conditionnements, avec prix et disponibilité.',
  },
  {
    path: '/categories',
    label: 'Catégories',
    title: 'Catégories de bois de chauffage',
    description:
      'Parcourez le bois de chauffage par catégorie : bûches de bois dur, bois étuvé, bois d’allumage, granulés et briquettes.',
  },
  {
    path: '/calculateurs/quantite',
    label: 'Calculateur de quantité',
    title: 'Calculateur : combien de stères de bois pour l’hiver ?',
    description:
      'Estimez gratuitement la quantité de bois de chauffage nécessaire selon la surface, l’isolation et votre appareil de chauffage.',
  },
  {
    path: '/calculateurs/livraison',
    label: 'Calculateur de livraison',
    title: 'Calculer les frais de livraison du bois de chauffage',
    description:
      'Simulez le coût de livraison de votre palette de bois de chauffage selon votre code postal et la quantité commandée.',
  },
  {
    path: '/guides/essences',
    label: 'Guide des essences',
    title: 'Guide des essences de bois de chauffage : chêne, hêtre, charme',
    description:
      'Quelle essence choisir pour se chauffer ? Pouvoir calorifique, durée de combustion et usages du chêne, du hêtre, du charme et du frêne.',
  },
  {
    path: '/guides/humidite',
    label: 'Guide de l’humidité',
    title: 'Taux d’humidité du bois de chauffage : pourquoi moins de 20 %',
    description:
      'Comprendre le taux d’humidité du bois de chauffage, le mesurer et pourquoi un bois sec à moins de 20 % chauffe mieux et encrasse moins.',
  },
  {
    path: '/guides/stockage',
    label: 'Guide du stockage',
    title: 'Comment bien stocker son bois de chauffage',
    description:
      'Nos conseils pour stocker votre bois de chauffage : abri ventilé, empilage, protection de la pluie et durée de conservation.',
  },
  {
    path: '/faq',
    label: 'FAQ',
    title: 'Questions fréquentes sur le bois de chauffage et la livraison',
    description:
      'Livraison, paiement, humidité du bois, quantités, délais : les réponses aux questions les plus fréquentes de nos clients.',
  },
  {
    path: '/a-propos',
    label: 'À propos',
    title: 'Qui sommes-nous ? Votre fournisseur de bois de chauffage',
    description:
      'Découvrez notre entreprise, notre approvisionnement en bois de chauffage sec et notre engagement qualité, de la forêt à votre abri.',
  },
  {
    path: '/contact',
    label: 'Contact',
    title: 'Contactez-nous',
    description:
      'Une question sur une commande ou une livraison de bois de chauffage ? Contactez notre service client par téléphone ou par e-mail.',
  },
  {
    path: '/livraison-et-retours',
    label: 'Livraison et retours',
    title: 'Livraison et retours',
    description:
      'Modalités de livraison du bois de chauffage sur palette : zones desservies, délais, camion avec hayon et conditions de retour.',
  },
  {
    path: '/virement-bancaire',
    label: 'Paiement par virement',
    title: 'Paiement par virement bancaire',
    description: 'Comment régler votre commande de bois de chauffage par virement bancaire, en toute sécurité.',
  },
  { path: '/cgv', label: 'CGV', title: 'Conditions générales de vente', description: 'Conditions générales de vente du site.' },
  { path: '/mentions-legales', label: 'Mentions légales', title: 'Mentions légales', description: 'Mentions légales du site.' },
  {
    path: '/confidentialite',
    label: 'Confidentialité',
    title: 'Politique de confidentialité',
    description: 'Comment nous protégeons vos données personnelles, conformément au RGPD.',
  },
  { path: '/cookies', label: 'Cookies', title: 'Politique de cookies', description: 'Les cookies utilisés sur le site et comment les gérer.' },
];

/** Pages privées : jamais indexées, quel que soit le réglage. */
export const PRIVATE_ROBOTS: Metadata['robots'] = { index: false, follow: false };

export function absoluteUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return '';
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${getSiteUrl()}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

export function robotsFor(allowIndexing: boolean, noindex?: boolean): Metadata['robots'] {
  if (!allowIndexing || noindex) return { index: false, follow: true };
  return {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
  };
}

/**
 * Métadonnées d'une page publique : valeurs par défaut de PUBLIC_PAGES,
 * remplacées par ce que l'exploitant a saisi dans /admin/seo.
 */
export async function buildPageMetadata(path: string): Promise<Metadata> {
  const [seo, settings] = await Promise.all([getSeoSettings(), getSiteSettings()]);
  const page = PUBLIC_PAGES.find((p) => p.path === path);
  const override = seo.pageMeta[path] || {};
  const title = override.title?.trim() || page?.title || undefined;
  // Sans titre propre (accueil), la page garde le titre et la description SEO
  // de la Personnalisation : on les répète pour le partage sur les réseaux.
  const description =
    override.description?.trim() ||
    page?.description ||
    applySiteSettingsToText(settings.seoDescription, settings).trim() ||
    undefined;
  const url = absoluteUrl(path);
  const shareTitle = title
    ? `${title} | ${settings.siteName}`
    : applySiteSettingsToText(settings.seoTitle, settings).trim() || `${settings.siteName} | ${settings.slogan}`;

  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    alternates: { canonical: url },
    // Next.js remplace l'objet openGraph du parent au lieu de le fusionner :
    // le nom du site, la langue et l'image doivent donc être répétés ici.
    openGraph: {
      ...sharedOpenGraph(seo, settings),
      url,
      ...(shareTitle ? { title: shareTitle } : {}),
      ...(description ? { description } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      ...(shareTitle ? { title: shareTitle } : {}),
      ...(description ? { description } : {}),
      images: [defaultShareImage(seo, settings)],
    },
    robots: robotsFor(seo.allowIndexing, override.noindex),
  };
}

/** Image de partage : celle choisie dans /admin/seo, sinon le visuel d'accueil. */
export function defaultShareImage(seo: SeoSettingsData, settings: SiteSettingsData): string {
  return absoluteUrl(seo.defaultOgImageUrl || settings.heroImageUrl || settings.logoUrl);
}

export function sharedOpenGraph(seo: SeoSettingsData, settings: SiteSettingsData) {
  return {
    type: 'website' as const,
    locale: 'fr_FR',
    siteName: settings.siteName,
    images: [{ url: defaultShareImage(seo, settings), alt: settings.siteName }],
  };
}

/** Pour les pages de compte, panier, commande… : titre propre, jamais indexé. */
export function privatePageMetadata(title: string): Metadata {
  return { title, robots: PRIVATE_ROBOTS };
}
