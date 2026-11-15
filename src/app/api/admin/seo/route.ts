import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminUser } from '@/lib/auth';
import {
  DEFAULT_SEO_SETTINGS,
  ORGANIZATION_TYPES,
  PUBLIC_PAGES,
  SEO_SETTINGS_ID,
  extractAdsId,
  extractConversionLabel,
  extractDigits,
  extractGa4Id,
  extractGtmId,
  extractMetaContent,
  getSeoSettings,
  type PageMetaOverride,
  type SeoSettingsData,
} from '@/lib/seo';
import { countHeadSnippetTags } from '@/lib/html-snippet';

export const dynamic = 'force-dynamic';

// Le référencement relève du contenu : super administrateur et responsable
// contenu. Le code libre, lui, s'exécute sur toutes les pages du site (comme
// un gestionnaire de balises) : seul un super administrateur peut le modifier.
const SEO_ROLES = ['SUPER_ADMIN', 'CONTENT_MANAGER'];
const CODE_FIELDS = ['customHeadCode', 'customBodyStartCode', 'customBodyEndCode'] as const;
const MAX_CODE_LENGTH = 20_000;

function text(value: unknown, max = 300): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function isSafeImageUrl(value: string): boolean {
  return value === '' || value.startsWith('/') || /^https:\/\//i.test(value);
}

function sanitizePageMeta(input: unknown): Record<string, PageMetaOverride> {
  if (!input || typeof input !== 'object') return {};
  const allowed = new Set(PUBLIC_PAGES.map((p) => p.path));
  const result: Record<string, PageMetaOverride> = {};
  for (const [path, raw] of Object.entries(input as Record<string, any>)) {
    if (!allowed.has(path) || !raw || typeof raw !== 'object') continue;
    const entry: PageMetaOverride = {};
    const title = text(raw.title, 120);
    const description = text(raw.description, 320);
    if (title) entry.title = title;
    if (description) entry.description = description;
    if (raw.noindex === true) entry.noindex = true;
    if (Object.keys(entry).length) result[path] = entry;
  }
  return result;
}

export async function GET() {
  const user = await getAdminUser();
  if (!user || !SEO_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
  }

  let tableReady = true;
  try {
    await prisma.seoSetting.findFirst({ select: { id: true } });
  } catch {
    tableReady = false;
  }

  return NextResponse.json({
    settings: await getSeoSettings(),
    pages: PUBLIC_PAGES,
    canEditCode: user.role === 'SUPER_ADMIN',
    tableReady,
  });
}

export async function PUT(request: Request) {
  const user = await getAdminUser();
  if (!user || !SEO_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const current = await getSeoSettings();
  const warnings: string[] = [];

  // Chaque identifiant est extrait de ce qui a été collé (balise complète,
  // extrait de code ou identifiant seul). Une saisie non reconnue est signalée
  // au lieu d'être enregistrée telle quelle.
  const normalize = (field: keyof SeoSettingsData, raw: unknown, extract: (v: unknown) => string, label: string) => {
    const submitted = text(raw, 2000);
    const value = extract(submitted);
    if (submitted && !value) warnings.push(`${label} : valeur non reconnue, champ laissé vide.`);
    return value;
  };

  const ogImage = text(body.defaultOgImageUrl, 500);
  if (!isSafeImageUrl(ogImage)) warnings.push('Image de partage : utilisez une adresse en https:// ou un chemin commençant par /.');

  const data: Omit<SeoSettingsData, 'pageMeta'> & { pageMeta: string } = {
    allowIndexing: body.allowIndexing !== false,
    defaultOgImageUrl: isSafeImageUrl(ogImage) ? ogImage : '',
    organizationType: (ORGANIZATION_TYPES as readonly string[]).includes(body.organizationType)
      ? body.organizationType
      : DEFAULT_SEO_SETTINGS.organizationType,
    googleSiteVerification: normalize('googleSiteVerification', body.googleSiteVerification, extractMetaContent, 'Google Search Console'),
    bingSiteVerification: normalize('bingSiteVerification', body.bingSiteVerification, extractMetaContent, 'Bing Webmaster Tools'),
    facebookDomainVerification: normalize('facebookDomainVerification', body.facebookDomainVerification, extractMetaContent, 'Vérification Facebook'),
    googleTagManagerId: normalize('googleTagManagerId', body.googleTagManagerId, extractGtmId, 'Google Tag Manager'),
    googleAnalyticsId: normalize('googleAnalyticsId', body.googleAnalyticsId, extractGa4Id, 'Google Analytics 4'),
    googleAdsId: normalize('googleAdsId', body.googleAdsId, extractAdsId, 'Google Ads'),
    googleAdsConversionLabel: normalize('googleAdsConversionLabel', body.googleAdsConversionLabel, extractConversionLabel, 'Libellé de conversion Google Ads'),
    requireConsent: body.requireConsent !== false,
    merchantCenterId: normalize('merchantCenterId', body.merchantCenterId, (v) => extractDigits(v), 'Identifiant Merchant Center'),
    merchantFeedEnabled: body.merchantFeedEnabled !== false,
    merchantBrand: text(body.merchantBrand, 70),
    merchantGoogleCategory: text(body.merchantGoogleCategory, 250),
    customHeadCode: current.customHeadCode,
    customBodyStartCode: current.customBodyStartCode,
    customBodyEndCode: current.customBodyEndCode,
    pageMeta: JSON.stringify(sanitizePageMeta(body.pageMeta)),
  };

  if (user.role === 'SUPER_ADMIN') {
    for (const field of CODE_FIELDS) {
      const value = typeof body[field] === 'string' ? body[field] : '';
      if (value.length > MAX_CODE_LENGTH) {
        return NextResponse.json(
          { error: `Code trop long (${value.length} caractères, ${MAX_CODE_LENGTH} au maximum).` },
          { status: 400 }
        );
      }
      data[field] = value.trim();
    }
    if (data.customHeadCode && countHeadSnippetTags(data.customHeadCode) === 0) {
      warnings.push(
        'Code du <head> : aucune balise reconnue (meta, link, script, noscript, style). Vérifiez le copier-coller.'
      );
    }
  } else if (CODE_FIELDS.some((field) => typeof body[field] === 'string' && body[field].trim() !== current[field])) {
    warnings.push('Le code personnalisé ne peut être modifié que par un super administrateur : il a été conservé.');
  }

  if (data.googleAdsConversionLabel && !data.googleAdsId) {
    warnings.push('Le libellé de conversion ne sert à rien sans l’identifiant Google Ads (AW-…).');
  }

  try {
    await prisma.seoSetting.upsert({
      where: { id: SEO_SETTINGS_ID },
      update: data,
      create: { id: SEO_SETTINGS_ID, ...data },
    });
  } catch (error: any) {
    console.error('[seo] enregistrement impossible:', error?.message || error);
    return NextResponse.json(
      {
        error:
          'Enregistrement impossible. Si c’est la première utilisation, la mise à jour de la base (migration « seo_setting ») n’a sans doute pas encore été appliquée.',
      },
      { status: 500 }
    );
  }

  await prisma.auditLog
    .create({
      data: {
        userId: user.id,
        action: 'SEO_SETTINGS_UPDATED',
        resourceType: 'SeoSetting',
        resourceId: SEO_SETTINGS_ID,
        details: JSON.stringify({
          allowIndexing: data.allowIndexing,
          googleSiteVerification: Boolean(data.googleSiteVerification),
          googleTagManagerId: data.googleTagManagerId || null,
          googleAnalyticsId: data.googleAnalyticsId || null,
          googleAdsId: data.googleAdsId || null,
          merchantCenterId: data.merchantCenterId || null,
          customCodeChanged: CODE_FIELDS.some((field) => data[field] !== current[field]),
        }),
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ success: true, settings: await getSeoSettings(), warnings });
}
