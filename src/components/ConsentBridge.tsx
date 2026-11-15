'use client';

import { useEffect } from 'react';
import { CONSENT_CHANGE_EVENT, CONSENT_STORAGE_KEY } from '@/lib/posthog-replay.mjs';

/**
 * Transmet à Google le choix fait dans le bandeau cookies, sans recharger la
 * page : « Accepter » active la mesure (Analytics, Ads), « Refuser » la coupe.
 * Ne fait rien si aucune balise Google n'est configurée (window.gtag absent).
 */
export default function ConsentBridge() {
  useEffect(() => {
    const apply = () => {
      const gtag = (window as any).gtag as ((...args: unknown[]) => void) | undefined;
      if (typeof gtag !== 'function') return;
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(CONSENT_STORAGE_KEY);
      } catch {
        stored = null;
      }
      if (!stored) return;
      const value = stored === 'accepted_all' ? 'granted' : 'denied';
      gtag('consent', 'update', {
        ad_storage: value,
        ad_user_data: value,
        ad_personalization: value,
        analytics_storage: value,
      });
      gtag('set', 'ads_data_redaction', value === 'denied');
    };

    window.addEventListener(CONSENT_CHANGE_EVENT, apply);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, apply);
  }, []);

  return null;
}
