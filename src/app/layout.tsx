import type { Metadata } from 'next';
import './globals.css';
import { applySiteSettingsToText, getSiteSettings } from '@/lib/settings';
import { generateThemeCss } from '@/lib/colors';
import { CartProvider } from '@/context/CartContext';
import CartDrawer from '@/components/CartDrawer';
import CookieBanner from '@/components/CookieBanner';
import ConsentBridge from '@/components/ConsentBridge';
import { GoogleTagsHead, GoogleTagManagerNoscript } from '@/components/GoogleTags';
import { defaultShareImage, getSeoSettings, robotsFor, sharedOpenGraph } from '@/lib/seo';
import { getSiteUrl } from '@/lib/site-url';
import { renderHeadSnippet } from '@/lib/html-snippet';
import { JsonLd, organizationJsonLd, websiteJsonLd } from '@/lib/structured-data';

export const dynamic = 'force-dynamic';

// Icône livrée avec le site : flamme sur fond vert forêt, carrée, sans texte.
// Le nom est versionné pour que les navigateurs, qui gardent les favicons en
// cache très longtemps (parfois malgré les en-têtes HTTP), voient une URL
// neuve au lieu de resservir l'ancien logo blanc de 64×64.
const DEFAULT_FAVICON = '/favicon-v2.ico';
// Ancienne valeur par défaut restée en base : elle ne doit pas écraser la
// nouvelle icône. Un favicon réellement envoyé depuis l'admin, lui, est gardé.
const LEGACY_FAVICON = '/favicon.ico';

function resolveFavicon(settingsFaviconUrl?: string | null): string {
  if (!settingsFaviconUrl || settingsFaviconUrl === LEGACY_FAVICON) return DEFAULT_FAVICON;
  return settingsFaviconUrl;
}

export async function generateMetadata(): Promise<Metadata> {
  const [settings, seo] = await Promise.all([getSiteSettings(), getSeoSettings()]);
  const description = applySiteSettingsToText(settings.seoDescription, settings);
  const favicon = resolveFavicon(settings.faviconUrl);
  // Le titre SEO saisi dans la Personnalisation était enregistré mais jamais
  // utilisé : c'est lui qui devient le titre de l'accueil dans Google.
  const homeTitle =
    applySiteSettingsToText(settings.seoTitle, settings).trim() || `${settings.siteName} | ${settings.slogan}`;

  const other: Record<string, string> = {};
  if (seo.bingSiteVerification) other['msvalidate.01'] = seo.bingSiteVerification;
  if (seo.facebookDomainVerification) other['facebook-domain-verification'] = seo.facebookDomainVerification;

  return {
    metadataBase: new URL(getSiteUrl()),
    title: {
      default: homeTitle,
      template: `%s | ${settings.siteName}`,
    },
    description,
    applicationName: settings.siteName,
    openGraph: { ...sharedOpenGraph(seo, settings), title: homeTitle, description, url: getSiteUrl() },
    twitter: {
      card: 'summary_large_image',
      title: homeTitle,
      description,
      images: [defaultShareImage(seo, settings)],
    },
    robots: robotsFor(seo.allowIndexing),
    verification: {
      ...(seo.googleSiteVerification ? { google: seo.googleSiteVerification } : {}),
      ...(Object.keys(other).length ? { other } : {}),
    },
    formatDetection: { telephone: false },
    icons: {
      icon: [
        { url: favicon },
        { url: '/favicon-16.png', type: 'image/png', sizes: '16x16' },
        { url: '/favicon-32.png', type: 'image/png', sizes: '32x32' },
        { url: '/favicon-48.png', type: 'image/png', sizes: '48x48' },
      ],
      shortcut: favicon,
      apple: [{ url: '/apple-touch-icon-v2.png', sizes: '180x180' }],
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, seo] = await Promise.all([getSiteSettings(), getSeoSettings()]);
  const dynamicThemeCss = generateThemeCss(
    settings.primaryColor,
    settings.secondaryColor,
    settings.accentColor
  );

  return (
    <html lang="fr" className="scroll-smooth">
      <head>
        {/* Les balises d'icônes sont générées par generateMetadata (icônes
            versionnées + apple-touch-icon), pour éviter les doublons. */}
        <style
          id="dynamic-brand-theme"
          dangerouslySetInnerHTML={{ __html: dynamicThemeCss }}
        />
        {/* Balises Google et code libre saisis dans /admin/seo. */}
        <GoogleTagsHead seo={seo} />
        {renderHeadSnippet(seo.customHeadCode)}
      </head>
      <body className="flex flex-col min-h-screen">
        <GoogleTagManagerNoscript seo={seo} />
        {seo.customBodyStartCode && (
          <div id="custom-body-start" style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: seo.customBodyStartCode }} />
        )}
        <JsonLd data={[organizationJsonLd(settings, seo), websiteJsonLd(settings)]} />
        <CartProvider>
          {children}
          <CartDrawer />
          <CookieBanner />
        </CartProvider>
        <ConsentBridge />
        {seo.customBodyEndCode && (
          <div id="custom-body-end" style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: seo.customBodyEndCode }} />
        )}
      </body>
    </html>
  );
}
