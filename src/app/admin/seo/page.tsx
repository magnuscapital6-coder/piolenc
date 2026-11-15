'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import {
  Search,
  RefreshCw,
  Save,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  BarChart3,
  ShoppingCart,
  Code2,
  FileText,
  Globe,
  Copy,
  ExternalLink,
  Lock,
} from 'lucide-react';

type PageMeta = { title?: string; description?: string; noindex?: boolean };

type SeoSettings = {
  allowIndexing: boolean;
  defaultOgImageUrl: string;
  organizationType: string;
  googleSiteVerification: string;
  bingSiteVerification: string;
  facebookDomainVerification: string;
  googleTagManagerId: string;
  googleAnalyticsId: string;
  googleAdsId: string;
  googleAdsConversionLabel: string;
  requireConsent: boolean;
  merchantCenterId: string;
  merchantFeedEnabled: boolean;
  merchantBrand: string;
  merchantGoogleCategory: string;
  customHeadCode: string;
  customBodyStartCode: string;
  customBodyEndCode: string;
  pageMeta: Record<string, PageMeta>;
};

type PublicPage = { path: string; label: string; title: string; description: string };

const ORGANIZATION_LABELS: Record<string, string> = {
  Store: 'Magasin / boutique en ligne (conseillé)',
  LocalBusiness: 'Commerce local',
  HomeAndConstructionBusiness: 'Entreprise habitat & construction',
  Organization: 'Organisation (générique)',
};

function Section({
  icon: Icon,
  title,
  intro,
  children,
}: {
  icon: React.ElementType;
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-xl border border-subtleBorder shadow-subtle">
      <div className="p-5 border-b border-subtleBorder">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-forest" />
          <h2 className="font-semibold text-primaryText text-sm">{title}</h2>
        </div>
        {intro && <div className="text-[11px] text-secondaryText mt-1 leading-relaxed">{intro}</div>}
      </div>
      <div className="p-5 space-y-4 text-xs">{children}</div>
    </section>
  );
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block font-semibold text-primaryText mb-1">{label}</label>
      {children}
      {help && <p className="text-[11px] text-secondaryText mt-1 leading-relaxed">{help}</p>}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  help,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  help?: React.ReactNode;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 accent-forest"
      />
      <span>
        <span className="font-semibold text-primaryText block">{label}</span>
        {help && <span className="text-[11px] text-secondaryText leading-relaxed block mt-0.5">{help}</span>}
      </span>
    </label>
  );
}

function CopyLine({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 min-w-0 truncate bg-ivory border border-subtleBorder rounded-md px-2 py-1.5 font-mono text-[11px]">
        {value}
      </code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* presse-papiers indisponible : l'adresse reste sélectionnable */
          }
        }}
        className="p-1.5 border border-subtleBorder rounded-md hover:bg-beige-50"
        title="Copier"
        aria-label="Copier"
      >
        {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="p-1.5 border border-subtleBorder rounded-md hover:bg-beige-50"
        title="Ouvrir"
        aria-label="Ouvrir"
      >
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}

function Counter({ value, ideal }: { value: string; ideal: number }) {
  const length = value.length;
  const tone = length === 0 ? 'text-secondaryText' : length <= ideal ? 'text-emerald-700' : 'text-amber-700';
  return (
    <span className={`text-[10px] ${tone}`}>
      {length}/{ideal}
    </span>
  );
}

export default function AdminSeoPage() {
  const [settings, setSettings] = useState<SeoSettings | null>(null);
  const [pages, setPages] = useState<PublicPage[]>([]);
  const [canEditCode, setCanEditCode] = useState(false);
  const [tableReady, setTableReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; message: string; warnings?: string[] } | null>(null);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/seo', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chargement impossible');
      setSettings(data.settings);
      setPages(data.pages);
      setCanEditCode(Boolean(data.canEditCode));
      setTableReady(data.tableReady !== false);
    } catch (error: any) {
      setStatus({ kind: 'error', message: error?.message || 'Chargement impossible' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = <K extends keyof SeoSettings>(key: K, value: SeoSettings[K]) =>
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));

  const updatePage = (path: string, patch: PageMeta) =>
    setSettings((prev) =>
      prev ? { ...prev, pageMeta: { ...prev.pageMeta, [path]: { ...prev.pageMeta[path], ...patch } } } : prev
    );

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/admin/seo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Enregistrement impossible');
      setSettings(data.settings);
      setTableReady(true);
      setStatus({
        kind: 'ok',
        message: 'Réglages enregistrés : ils sont en ligne sur le site dès maintenant.',
        warnings: data.warnings,
      });
    } catch (error: any) {
      setStatus({ kind: 'error', message: error?.message || 'Enregistrement impossible' });
    } finally {
      setSaving(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const activeTools = useMemo(() => {
    if (!settings) return [];
    return [
      ['Search Console', settings.googleSiteVerification],
      ['Tag Manager', settings.googleTagManagerId],
      ['Analytics', settings.googleAnalyticsId],
      ['Google Ads', settings.googleAdsId],
      ['Merchant Center', settings.merchantCenterId],
    ].filter(([, value]) => Boolean(value)).map(([name]) => name);
  }, [settings]);

  const input = 'input-field text-xs w-full';
  const mono = 'input-field text-xs w-full font-mono';

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-forest-100 text-forest-800 rounded-lg">
                <Search className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold font-heading text-primaryText tracking-tight">
                SEO &amp; Google
              </h1>
            </div>
            <p className="text-xs text-secondaryText mt-1">
              Référencement, Search Console, Google Ads, Analytics, Merchant Center et code à ajouter au site, sans toucher au code.
            </p>
          </div>
          <button
            onClick={load}
            className="flex items-center space-x-1.5 px-3 py-2 bg-white border border-subtleBorder rounded-lg text-xs font-semibold text-primaryText hover:bg-beige-50 transition shadow-subtle"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Actualiser</span>
          </button>
        </div>

        {!tableReady && (
          <div className="flex items-start gap-2 p-3 rounded-lg border text-xs bg-amber-50 border-amber-200 text-amber-900">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              La base de données n’a pas encore la table de ces réglages. Appliquez la mise à jour de la base
              (<code>npx prisma migrate deploy</code>) avant d’enregistrer ; en attendant, le site fonctionne normalement.
            </span>
          </div>
        )}

        {status && (
          <div
            className={`p-3 rounded-lg border text-xs ${
              status.kind === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-statusError'
            }`}
            role="status"
          >
            <div className="flex items-start gap-2">
              {status.kind === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{status.message}</span>
            </div>
            {status.warnings && status.warnings.length > 0 && (
              <ul className="mt-2 ml-6 list-disc text-amber-900 space-y-0.5">
                {status.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {loading && !settings ? (
          <p className="text-xs text-secondaryText">Chargement…</p>
        ) : settings ? (
          <>
            <div className="bg-white rounded-xl border border-subtleBorder shadow-subtle p-4 text-xs flex flex-wrap items-center gap-2">
              <span className="font-semibold text-primaryText">Outils actifs :</span>
              {activeTools.length === 0 ? (
                <span className="text-secondaryText">aucun pour l’instant</span>
              ) : (
                activeTools.map((name) => (
                  <span key={name} className="badge-success">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{name}</span>
                  </span>
                ))
              )}
              {!settings.allowIndexing && (
                <span className="ml-auto text-statusError font-semibold">Site masqué aux moteurs de recherche</span>
              )}
            </div>

            {/* Indexation */}
            <Section
              icon={Globe}
              title="Référencement général"
              intro="Ce que Google voit de votre site. Le plan du site et le fichier robots.txt sont générés automatiquement."
            >
              <Toggle
                checked={settings.allowIndexing}
                onChange={(value) => update('allowIndexing', value)}
                label="Autoriser Google et les moteurs de recherche à référencer le site"
                help="Ne décochez que pendant des travaux : décoché, aucune page n’apparaît dans les résultats de recherche."
              />
              <Field label="Plan du site (à déclarer dans Google Search Console)">
                <CopyLine value={`${origin}/sitemap.xml`} />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Type d’entreprise"
                  help="Annoncé à Google dans les données structurées (nom, adresse, téléphone repris de la Personnalisation)."
                >
                  <select
                    className={input}
                    value={settings.organizationType}
                    onChange={(event) => update('organizationType', event.target.value)}
                  >
                    {Object.entries(ORGANIZATION_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Image de partage par défaut"
                  help="Affichée quand un lien du site est partagé (Facebook, WhatsApp…). 1200 × 630 px conseillé. Vide = visuel de l’accueil."
                >
                  <input
                    className={input}
                    value={settings.defaultOgImageUrl}
                    placeholder="https://… ou /images/partage.jpg"
                    onChange={(event) => update('defaultOgImageUrl', event.target.value)}
                  />
                </Field>
              </div>
              <p className="text-[11px] text-secondaryText">
                Le titre et la description de la page d’accueil se règlent dans <strong>Personnalisation du site</strong>{' '}
                (champs SEO) ; ceux des autres pages, plus bas sur cette page. Chaque fiche produit utilise son propre
                titre SEO (ou son nom) et sa description.
              </p>
            </Section>

            {/* Vérifications */}
            <Section
              icon={ShieldCheck}
              title="Vérification de propriété du site"
              intro={
                <>
                  Quand Google vous demande de prouver que le site est à vous, choisissez la méthode{' '}
                  <strong>« Balise HTML »</strong> et collez ici la balise entière ou seulement le code : les deux marchent.
                </>
              }
            >
              <Field
                label="Google Search Console"
                help="search.google.com/search-console → Ajouter une propriété → Préfixe d’URL → Balise HTML."
              >
                <input
                  className={mono}
                  value={settings.googleSiteVerification}
                  placeholder='<meta name="google-site-verification" content="…" />'
                  onChange={(event) => update('googleSiteVerification', event.target.value)}
                />
              </Field>
              <p className="text-[11px] text-secondaryText -mt-2">
                Merchant Center accepte la même vérification : si le site est déjà validé dans Search Console avec le même
                compte Google, il est reconnu automatiquement.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Bing Webmaster Tools (facultatif)" help="Balise msvalidate.01.">
                  <input
                    className={mono}
                    value={settings.bingSiteVerification}
                    onChange={(event) => update('bingSiteVerification', event.target.value)}
                  />
                </Field>
                <Field label="Facebook / Meta (facultatif)" help="Balise facebook-domain-verification.">
                  <input
                    className={mono}
                    value={settings.facebookDomainVerification}
                    onChange={(event) => update('facebookDomainVerification', event.target.value)}
                  />
                </Field>
              </div>
            </Section>

            {/* Google tags */}
            <Section
              icon={BarChart3}
              title="Balises Google (Ads, Analytics, Tag Manager)"
              intro={
                <>
                  Collez l’identifiant, ou directement le bloc de code donné par Google : l’identifiant est retrouvé
                  automatiquement. Utilisez <strong>soit</strong> Tag Manager, <strong>soit</strong> Analytics/Ads ci-dessous,
                  pas la même balise aux deux endroits (sinon les visites et ventes sont comptées deux fois).
                </>
              }
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Google Ads — ID de la balise" help="Google Ads → Outils → Balise Google. Format AW-123456789.">
                  <input
                    className={mono}
                    value={settings.googleAdsId}
                    placeholder="AW-123456789"
                    onChange={(event) => update('googleAdsId', event.target.value)}
                  />
                </Field>
                <Field
                  label="Google Ads — libellé de conversion « Achat »"
                  help="Objectifs → Conversions → votre action Achat → Configuration de la balise : la partie après AW-…/ dans send_to."
                >
                  <input
                    className={mono}
                    value={settings.googleAdsConversionLabel}
                    placeholder="AbC-D_efG-h12_34-567"
                    onChange={(event) => update('googleAdsConversionLabel', event.target.value)}
                  />
                </Field>
                <Field label="Google Analytics 4 — ID de mesure" help="Analytics → Administration → Flux de données. Format G-XXXXXXX.">
                  <input
                    className={mono}
                    value={settings.googleAnalyticsId}
                    placeholder="G-XXXXXXXXXX"
                    onChange={(event) => update('googleAnalyticsId', event.target.value)}
                  />
                </Field>
                <Field label="Google Tag Manager — ID du conteneur" help="Facultatif, pour les utilisateurs avancés. Format GTM-XXXXXXX.">
                  <input
                    className={mono}
                    value={settings.googleTagManagerId}
                    placeholder="GTM-XXXXXXX"
                    onChange={(event) => update('googleTagManagerId', event.target.value)}
                  />
                </Field>
              </div>
              <p className="text-[11px] text-secondaryText">
                Les achats sont envoyés automatiquement à Google Ads et Analytics sur la page de confirmation de commande
                (montant et numéro de commande).
              </p>
              <Toggle
                checked={settings.requireConsent}
                onChange={(value) => update('requireConsent', value)}
                label="Attendre l’accord du visiteur (bandeau cookies) avant de mesurer — mode consentement Google v2"
                help="Obligatoire en France (RGPD / CNIL). Laissez coché : Google reçoit quand même des signaux anonymes et modélise les conversions des visiteurs qui refusent."
              />
            </Section>

            {/* Merchant Center */}
            <Section
              icon={ShoppingCart}
              title="Google Merchant Center (Google Shopping)"
              intro="Le flux produits est généré automatiquement à partir du catalogue (produits actifs, prix TTC, promotions, stock, photos)."
            >
              <Toggle
                checked={settings.merchantFeedEnabled}
                onChange={(value) => update('merchantFeedEnabled', value)}
                label="Publier le flux produits pour Google"
              />
              <Field
                label="Adresse du flux à déclarer dans Merchant Center"
                help="Merchant Center → Produits → Ajouter des produits → Ajouter un fichier de produits → Fichier hébergé sur un site (récupération planifiée, chaque jour)."
              >
                <CopyLine value={`${origin}/flux/google-merchant.xml`} />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="ID Merchant Center" help="Le numéro affiché en haut à droite de Merchant Center.">
                  <input
                    className={mono}
                    value={settings.merchantCenterId}
                    placeholder="123456789"
                    onChange={(event) => update('merchantCenterId', event.target.value)}
                  />
                </Field>
                <Field label="Marque des produits" help="Vide = nom de l’entreprise.">
                  <input
                    className={input}
                    value={settings.merchantBrand}
                    onChange={(event) => update('merchantBrand', event.target.value)}
                  />
                </Field>
                <Field
                  label="Catégorie Google"
                  help="Numéro ou chemin de la taxonomie Google (ex. « Maison et jardin > Accessoires pour cheminée »). Vide = Google la devine."
                >
                  <input
                    className={input}
                    value={settings.merchantGoogleCategory}
                    onChange={(event) => update('merchantGoogleCategory', event.target.value)}
                  />
                </Field>
              </div>
              <p className="text-[11px] text-secondaryText">
                Les frais de livraison et la TVA se configurent dans Merchant Center (Paramètres → Livraison et retours).
              </p>
            </Section>

            {/* Code libre */}
            <Section
              icon={Code2}
              title="Code personnalisé"
              intro={
                <>
                  Pour tout autre outil qui vous demande « d’ajouter ce code dans le &lt;head&gt; » (Pinterest, Meta Pixel,
                  Hotjar, chat en ligne…). Le code est ajouté sur toutes les pages du site.
                </>
              }
            >
              {!canEditCode && (
                <div className="flex items-start gap-2 p-3 rounded-lg border bg-ivory border-subtleBorder text-secondaryText">
                  <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Seul un super administrateur peut modifier ce code (il s’exécute sur tout le site).</span>
                </div>
              )}
              <Field
                label="Dans le <head> (balises meta, link, script, noscript, style)"
                help="Collez le code tel quel. Un code mal copié peut casser l’affichage : en cas de doute, videz ce champ et enregistrez."
              >
                <textarea
                  className={`${mono} h-32`}
                  value={settings.customHeadCode}
                  disabled={!canEditCode}
                  spellCheck={false}
                  placeholder={'<meta name="…" content="…" />\n<script>…</script>'}
                  onChange={(event) => update('customHeadCode', event.target.value)}
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Juste après l’ouverture du <body>">
                  <textarea
                    className={`${mono} h-24`}
                    value={settings.customBodyStartCode}
                    disabled={!canEditCode}
                    spellCheck={false}
                    onChange={(event) => update('customBodyStartCode', event.target.value)}
                  />
                </Field>
                <Field label="Juste avant la fermeture du </body>">
                  <textarea
                    className={`${mono} h-24`}
                    value={settings.customBodyEndCode}
                    disabled={!canEditCode}
                    spellCheck={false}
                    onChange={(event) => update('customBodyEndCode', event.target.value)}
                  />
                </Field>
              </div>
            </Section>

            {/* Pages */}
            <Section
              icon={FileText}
              title="Titres et descriptions des pages"
              intro="Ce qui s’affiche dans les résultats Google. Laissez vide pour garder le texte proposé (en gris). Idéal : titre ≤ 60 caractères, description ≤ 155."
            >
              <div className="space-y-4">
                {pages
                  .filter((page) => page.path !== '/')
                  .map((page) => {
                    const meta = settings.pageMeta[page.path] || {};
                    return (
                      <div key={page.path} className="border border-subtleBorder rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-primaryText">
                            {page.label} <span className="font-mono text-[10px] text-secondaryText">{page.path}</span>
                          </span>
                          <label className="flex items-center gap-1.5 text-[11px] text-secondaryText cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(meta.noindex)}
                              onChange={(event) => updatePage(page.path, { noindex: event.target.checked })}
                              className="accent-forest"
                            />
                            Masquer de Google
                          </label>
                        </div>
                        <div>
                          <div className="flex justify-between">
                            <span className="text-[11px] text-secondaryText">Titre</span>
                            <Counter value={meta.title || ''} ideal={60} />
                          </div>
                          <input
                            className={input}
                            value={meta.title || ''}
                            placeholder={page.title}
                            maxLength={120}
                            onChange={(event) => updatePage(page.path, { title: event.target.value })}
                          />
                        </div>
                        <div>
                          <div className="flex justify-between">
                            <span className="text-[11px] text-secondaryText">Description</span>
                            <Counter value={meta.description || ''} ideal={155} />
                          </div>
                          <textarea
                            className={`${input} h-16`}
                            value={meta.description || ''}
                            placeholder={page.description}
                            maxLength={320}
                            onChange={(event) => updatePage(page.path, { description: event.target.value })}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </Section>

            <div className="sticky bottom-0 -mx-3 sm:mx-0 bg-white/95 backdrop-blur border border-subtleBorder sm:rounded-xl px-4 py-3 flex justify-end z-30 shadow-subtle">
              <button
                onClick={save}
                disabled={saving}
                className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5 disabled:opacity-60"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Enregistrement…' : 'Enregistrer les réglages SEO'}</span>
              </button>
            </div>
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}
