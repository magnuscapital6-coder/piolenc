import React from 'react';
import type { SeoSettingsData } from '@/lib/seo';
import { CONSENT_STORAGE_KEY } from '@/lib/posthog-replay.mjs';

/**
 * Balises Google rendues côté serveur dans <head> : mode consentement v2,
 * gtag.js (Analytics 4 + Google Ads) et Google Tag Manager.
 *
 * Les identifiants ont été filtrés à l'enregistrement (voir /api/admin/seo :
 * G-…, AW-…, GTM-… uniquement), et sont de toute façon passés par
 * JSON.stringify avant d'entrer dans le script.
 *
 * Consentement : tant que le visiteur n'a pas cliqué sur « Accepter » dans le
 * bandeau cookies, tout est refusé par défaut (exigence CNIL). Le choix déjà
 * enregistré est relu ici pour qu'un visiteur qui a accepté soit mesuré dès le
 * premier affichage ; un changement ultérieur est transmis par ConsentBridge.
 */

export function hasGoogleTags(seo: SeoSettingsData): boolean {
  return Boolean(seo.googleAnalyticsId || seo.googleAdsId || seo.googleTagManagerId);
}

export function GoogleTagsHead({ seo }: { seo: SeoSettingsData }) {
  if (!hasGoogleTags(seo)) return null;

  const gtagIds = [seo.googleAnalyticsId, seo.googleAdsId].filter(Boolean);
  const adsSendTo =
    seo.googleAdsId && seo.googleAdsConversionLabel ? `${seo.googleAdsId}/${seo.googleAdsConversionLabel}` : '';

  const bootstrap = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
(function(){
  var stored = null;
  try { stored = localStorage.getItem(${JSON.stringify(CONSENT_STORAGE_KEY)}); } catch (e) {}
  var granted = ${seo.requireConsent ? "stored === 'accepted_all'" : 'true'};
  var v = granted ? 'granted' : 'denied';
  gtag('consent', 'default', {
    ad_storage: v, ad_user_data: v, ad_personalization: v, analytics_storage: v,
    functionality_storage: 'granted', security_storage: 'granted', wait_for_update: 500
  });
  gtag('set', 'ads_data_redaction', !granted);
  gtag('set', 'url_passthrough', true);
})();
window.__siteTags = ${JSON.stringify({ adsSendTo, ga4: seo.googleAnalyticsId || '' })};
gtag('js', new Date());
${gtagIds.map((id) => `gtag('config', ${JSON.stringify(id)});`).join('\n')}
`;

  const gtm = seo.googleTagManagerId
    ? `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(seo.googleTagManagerId)});`
    : '';

  return (
    <>
      <script id="google-consent-and-tags" dangerouslySetInnerHTML={{ __html: bootstrap }} />
      {gtagIds.length > 0 && (
        <script async src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gtagIds[0])}`} />
      )}
      {gtm && <script id="google-tag-manager" dangerouslySetInnerHTML={{ __html: gtm }} />}
    </>
  );
}

/** Repli Tag Manager pour les navigateurs sans JavaScript (début du <body>). */
export function GoogleTagManagerNoscript({ seo }: { seo: SeoSettingsData }) {
  if (!seo.googleTagManagerId) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(seo.googleTagManagerId)}`}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
      />
    </noscript>
  );
}
