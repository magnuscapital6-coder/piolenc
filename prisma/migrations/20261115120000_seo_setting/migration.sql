-- Référencement et outils Google pilotés depuis l'administration (/admin/seo).
-- Table distincte de SiteSetting : l'enregistrement de la personnalisation
-- réécrit toute sa ligne et ne doit pas pouvoir effacer ces réglages.
-- Toutes les colonnes ont une valeur par défaut neutre : appliquer la migration
-- ne change rien au site tant que rien n'est saisi dans l'administration.
CREATE TABLE IF NOT EXISTS "SeoSetting" (
    "id" TEXT NOT NULL DEFAULT 'default-seo',
    "allowIndexing" BOOLEAN NOT NULL DEFAULT true,
    "defaultOgImageUrl" TEXT NOT NULL DEFAULT '',
    "organizationType" TEXT NOT NULL DEFAULT 'Store',
    "googleSiteVerification" TEXT NOT NULL DEFAULT '',
    "bingSiteVerification" TEXT NOT NULL DEFAULT '',
    "facebookDomainVerification" TEXT NOT NULL DEFAULT '',
    "googleTagManagerId" TEXT NOT NULL DEFAULT '',
    "googleAnalyticsId" TEXT NOT NULL DEFAULT '',
    "googleAdsId" TEXT NOT NULL DEFAULT '',
    "googleAdsConversionLabel" TEXT NOT NULL DEFAULT '',
    "requireConsent" BOOLEAN NOT NULL DEFAULT true,
    "merchantCenterId" TEXT NOT NULL DEFAULT '',
    "merchantFeedEnabled" BOOLEAN NOT NULL DEFAULT true,
    "merchantBrand" TEXT NOT NULL DEFAULT '',
    "merchantGoogleCategory" TEXT NOT NULL DEFAULT '',
    "customHeadCode" TEXT NOT NULL DEFAULT '',
    "customBodyStartCode" TEXT NOT NULL DEFAULT '',
    "customBodyEndCode" TEXT NOT NULL DEFAULT '',
    "pageMeta" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoSetting_pkey" PRIMARY KEY ("id")
);
