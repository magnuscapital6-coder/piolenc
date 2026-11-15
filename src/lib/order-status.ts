/** Libellés français des statuts logistiques (une seule liste pour toute l'administration). */
export const FULFILLMENT_LABELS: Record<string, string> = {
  ORDER_CREATED: 'Commande reçue',
  VALIDATED: 'Validée',
  IN_PREPARATION: 'En préparation',
  READY_FOR_SHIPPING: 'Prête à expédier',
  SHIPPED: 'Expédiée',
  IN_TRANSIT: 'En transit',
  OUT_FOR_DELIVERY: 'En cours de livraison',
  DELIVERY_DELAYED: 'Livraison retardée',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
  INCIDENT: 'Incident',
};

export function fulfillmentLabel(status: string | null | undefined): string {
  if (!status) return '—';
  return FULFILLMENT_LABELS[status] || status;
}
