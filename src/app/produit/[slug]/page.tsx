import React from 'react';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/settings';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProductClientDetails from './ProductClientDetails';
import imageCreditsRegistry from '@/lib/product-image-credits.json';
import type { Metadata } from 'next';
import {
  PRIVATE_ROBOTS,
  absoluteUrl,
  defaultShareImage,
  getSeoSettings,
  robotsFor,
  sharedOpenGraph,
} from '@/lib/seo';
import { productDescription, productImageUrls, productJsonLd } from '@/lib/product-seo';
import { JsonLd, breadcrumbJsonLd } from '@/lib/structured-data';

export const dynamic = 'force-dynamic';

/**
 * Les photos produits proviennent de Wikimedia Commons sous licence CC0, domaine
 * public ou CC-BY : les licences CC-BY imposent une attribution visible, affichée
 * sous la galerie. Le registre est généré par scripts/fetch-product-images-commons.mjs.
 */
interface ImageCreditRow {
  file: string;
  title: string;
  creator: string;
  creatorUrl: string;
  license: string;
  licenseUrl: string;
}

function getImageCredits(slug: string, images: string[]): ImageCreditRow[] {
  const registry = imageCreditsRegistry as unknown as {
    products?: Array<{ slug: string; images: ImageCreditRow[] }>;
  };
  const entry = registry.products?.find((item) => item.slug === slug);
  if (!entry) return [];
  return images
    .map((file) => entry.images.find((image) => image.file === file))
    .filter((image): image is ImageCreditRow => Boolean(image));
}


export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [product, seo, settings] = await Promise.all([
    prisma.product.findUnique({ where: { slug } }),
    getSeoSettings(),
    getSiteSettings(),
  ]);
  if (!product || !product.isActive) return { title: 'Produit introuvable', robots: PRIVATE_ROBOTS };

  const title = (product.seoTitle || product.name).trim();
  const description = productDescription(product);
  const url = absoluteUrl(`/produit/${product.slug}`);
  const images = productImageUrls(product);
  const shareImages = images.length ? images.slice(0, 4) : [defaultShareImage(seo, settings)];

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      ...sharedOpenGraph(seo, settings),
      url,
      title: `${title} | ${settings.siteName}`,
      description,
      images: shareImages.map((src) => ({ url: src, alt: product.name })),
    },
    twitter: { card: 'summary_large_image', title, description, images: shareImages },
    robots: robotsFor(seo.allowIndexing),
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const settings = await getSiteSettings();
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: true,
      variants: true,
      reviews: { where: { isApproved: true } },
    },
  });

  // Une fiche retirée du catalogue (désactivée) n'est plus consultable, même
  // par son URL directe : les listes publiques filtrent déjà sur `isActive`, un
  // lien partagé ou indexé ne doit donc pas ressusciter un produit retiré. Le
  // tunnel de commande refuse lui aussi ces fiches, l'ensemble reste cohérent.
  if (!product || !product.isActive) {
    notFound();
  }

  let productImages: string[] = [];
  try {
    productImages = JSON.parse(product.images);
  } catch {
    productImages = [];
  }
  const imageCredits = getImageCredits(slug, productImages);

  const seo = await getSeoSettings();
  const structuredData = [
    productJsonLd(product, {
      brand: seo.merchantBrand || settings.companyName || settings.siteName,
      sellerName: settings.companyName || settings.siteName,
      categoryName: product.category?.name,
      reviews: product.reviews,
    }),
    breadcrumbJsonLd([
      { name: 'Accueil', path: '/' },
      { name: 'Boutique', path: '/boutique' },
      { name: product.name, path: `/produit/${product.slug}` },
    ]),
  ];

  return (
    <>
      <JsonLd data={structuredData} />
      <Navbar siteName={settings.siteName} phone={settings.companyPhone} slogan={settings.slogan} />

      {/* `min-w-0` est nécessaire : la colonne flex parente donnerait sinon à ce
          bloc une largeur minimale égale à son contenu (noms de produits longs),
          ce qui provoquait un défilement horizontal sur mobile. */}
      <main className="flex-1 w-full min-w-0 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <ProductClientDetails product={product} siteSettings={settings} imageCredits={imageCredits} />
      </main>

      <Footer settings={settings} />
    </>
  );
}
