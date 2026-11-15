import React from 'react';
import { privatePageMetadata } from '@/lib/seo';

// Page privée ou transactionnelle : titre propre, jamais indexée par Google.
export const metadata = privatePageMetadata('Créer un compte');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
