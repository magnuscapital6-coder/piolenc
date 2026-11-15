/**
 * Envoi de l'achat à Google (Analytics 4, Google Ads, Tag Manager), côté
 * navigateur, sur la page de confirmation de commande.
 *
 * - Une seule fois par commande : un rechargement ou un retour sur la page ne
 *   doit pas compter deux ventes (mémorisé dans localStorage, plus le
 *   `transaction_id` que Google déduplique de son côté).
 * - Ne fait rien si aucune balise Google n'est configurée. Le consentement est
 *   géré par Google lui-même (mode consentement v2, voir GoogleTags.tsx).
 */

interface TrackableOrder {
  orderNumber: string;
  totalAmount: number;
  subtotalHT?: number;
  currency?: string;
  items?: Array<{ productRef?: string; productId?: string; productName?: string; unitPriceTTC?: number; quantity?: number }>;
}

const SENT_KEY = 'site_tracked_orders';

function alreadySent(orderNumber: string): boolean {
  try {
    const list: string[] = JSON.parse(localStorage.getItem(SENT_KEY) || '[]');
    return list.includes(orderNumber);
  } catch {
    return false;
  }
}

function markSent(orderNumber: string) {
  try {
    const list: string[] = JSON.parse(localStorage.getItem(SENT_KEY) || '[]');
    localStorage.setItem(SENT_KEY, JSON.stringify([...list, orderNumber].slice(-20)));
  } catch {
    /* stockage indisponible : la déduplication par transaction_id reste active */
  }
}

export function trackPurchase(order: TrackableOrder) {
  if (typeof window === 'undefined' || !order?.orderNumber) return;
  const w = window as any;
  const gtag = w.gtag as ((...args: unknown[]) => void) | undefined;
  const hasDataLayer = Array.isArray(w.dataLayer);
  if (typeof gtag !== 'function' && !hasDataLayer) return;
  if (alreadySent(order.orderNumber)) return;

  const currency = order.currency || 'EUR';
  const value = Math.round(Number(order.totalAmount || 0) * 100) / 100;
  const items = (order.items || []).map((item) => ({
    item_id: item.productRef || item.productId,
    item_name: item.productName,
    price: item.unitPriceTTC,
    quantity: item.quantity,
  }));

  const tags = w.__siteTags || {};
  if (typeof gtag === 'function') {
    gtag('event', 'purchase', { transaction_id: order.orderNumber, value, currency, items });
    if (tags.adsSendTo) {
      gtag('event', 'conversion', {
        send_to: tags.adsSendTo,
        value,
        currency,
        transaction_id: order.orderNumber,
      });
    }
  }
  // Pour un conteneur Tag Manager : événement e-commerce standard GA4.
  if (hasDataLayer) {
    w.dataLayer.push({ ecommerce: null });
    w.dataLayer.push({
      event: 'purchase',
      ecommerce: { transaction_id: order.orderNumber, value, currency, items },
    });
  }

  markSent(order.orderNumber);
}
