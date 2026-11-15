/**
 * Règle unique du stock disponible.
 *
 * - `stock` : quantité encore vendable en entrepôt. Une commande la diminue
 *   immédiatement (une seule fois) ; l'annulation d'une commande la rend.
 * - `reservedStock` : quantité mise de côté À LA MAIN depuis l'administration
 *   (palettes promises par téléphone, lot abîmé…). Elle n'est plus touchée par
 *   les commandes : auparavant chaque vente diminuait `stock` ET augmentait
 *   `reservedStock`, si bien que chaque article vendu était décompté deux fois
 *   et que le compteur ne redescendait jamais.
 *
 * Les pages publiques, le panier et la commande utilisent tous cette fonction :
 * le client voit exactement la quantité que la commande acceptera.
 */
export function availableStock(product: { stock: number; reservedStock?: number | null }): number {
  return Math.max(0, (product.stock || 0) - (product.reservedStock || 0));
}

/** Statut de commande qui rend la marchandise au stock. */
export const STOCK_RELEASING_STATUS = 'CANCELLED';
