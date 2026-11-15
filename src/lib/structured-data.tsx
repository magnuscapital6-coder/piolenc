import React from 'react';
import type { SiteSettingsData } from './settings';
import type { SeoSettingsData } from './seo';
import { absoluteUrl } from './seo';
import { getSiteUrl } from './site-url';

/**
 * Données structurées schema.org (JSON-LD) : elles permettent à Google
 * d'afficher le prix, la disponibilité, les étoiles et le fil d'Ariane
 * directement dans les résultats de recherche.
 */

/** `<` est échappé : un nom de produit ne peut pas refermer la balise script. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

function parseAddress(address: string) {
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  const postal = address.match(/\b(\d{5})\s+([^,]+)/);
  return {
    '@type': 'PostalAddress',
    ...(parts[0] ? { streetAddress: parts[0] } : {}),
    ...(postal ? { postalCode: postal[1], addressLocality: postal[2].trim() } : {}),
    addressCountry: /belgique/i.test(address) ? 'BE' : /suisse/i.test(address) ? 'CH' : 'FR',
  };
}

export function organizationJsonLd(settings: SiteSettingsData, seo: SeoSettingsData) {
  const siteUrl = getSiteUrl();
  const sameAs = Object.values(settings.socialLinks || {}).filter(
    (link): link is string => typeof link === 'string' && /^https?:\/\//.test(link)
  );
  return {
    '@context': 'https://schema.org',
    '@type': seo.organizationType || 'Store',
    '@id': `${siteUrl}/#organization`,
    name: settings.companyName || settings.siteName,
    alternateName: settings.siteName,
    url: siteUrl,
    logo: absoluteUrl(settings.logoUrl || '/logo.svg'),
    image: absoluteUrl(seo.defaultOgImageUrl || settings.heroImageUrl || settings.logoUrl),
    description: settings.slogan,
    ...(settings.companyPhone ? { telephone: settings.companyPhone } : {}),
    ...(settings.companyEmail ? { email: settings.companyEmail } : {}),
    ...(settings.companyAddress ? { address: parseAddress(settings.companyAddress) } : {}),
    ...(settings.companyVatNumber ? { vatID: settings.companyVatNumber.replace(/\s/g, '') } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    areaServed: settings.deliveryZonesText,
    priceRange: '€€',
  };
}

export function websiteJsonLd(settings: SiteSettingsData) {
  const siteUrl = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteUrl}/#website`,
    name: settings.siteName,
    url: siteUrl,
    inLanguage: 'fr-FR',
    publisher: { '@id': `${siteUrl}/#organization` },
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
