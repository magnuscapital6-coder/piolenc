import React from 'react';
import { buildPageMetadata } from '@/lib/seo';

// La page est un composant client : ses métadonnées SEO sont déclarées ici.
export async function generateMetadata() {
  return buildPageMetadata('/contact');
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
