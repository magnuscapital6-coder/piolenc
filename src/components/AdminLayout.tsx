'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingBag,
  CreditCard,
  Package,
  Layers,
  Truck,
  Paintbrush,
  Mail,
  Users,
  ShieldAlert,
  FileText,
  UserCog,
  LogOut,
  ExternalLink,
  Menu,
  X,
  Flame,
  CheckCircle2,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
  userRole?: string;
  userName?: string;
}

// Choix « menu réduit » mémorisé par navigateur, pour qu'il survive au
// changement de page (chaque page admin monte son propre AdminLayout).
const COLLAPSE_STORAGE_KEY = 'admin_sidebar_collapsed';

const navigation = [
  { name: 'Tableau de bord', href: '/admin', icon: LayoutDashboard },
  { name: 'Commandes', href: '/admin/commandes', icon: ShoppingBag },
  { name: 'Virements bancaires', href: '/admin/virements', icon: CreditCard },
  { name: 'Catalogue & Stocks', href: '/admin/produits', icon: Package },
  { name: 'Catégories', href: '/admin/categories', icon: Layers },
  { name: 'Suivi logistique', href: '/admin/livraisons', icon: Truck },
  { name: 'Personnalisation du site', href: '/admin/personnalisation', icon: Paintbrush },
  { name: 'SEO & Google', href: '/admin/seo', icon: Search },
  { name: 'Notifications & Emails', href: '/admin/emails', icon: Mail },
  { name: 'Comptes clients', href: '/admin/clients', icon: Users },
  { name: 'Équipe & Permissions', href: '/admin/utilisateurs', icon: ShieldAlert },
  { name: "Journal d'audit", href: '/admin/audit', icon: FileText },
  { name: 'Mon compte', href: '/admin/mon-compte', icon: UserCog },
];

export default function AdminLayout({
  children,
  userRole = 'SUPER_ADMIN',
  userName = 'Administrateur',
}: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  // Mobile / tablette : menu en tiroir, fermé par défaut.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Grand écran : menu complet ou réduit aux icônes.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1');
    } catch {
      /* stockage indisponible : menu complet */
    }
  }, []);

  // Le tiroir mobile se ferme avec Échap, et on bloque le défilement de la
  // page derrière lui tant qu'il est ouvert.
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarOpen]);

  // Tableaux en cartes sur mobile (voir globals.css) : chaque cellule reçoit le
  // titre de sa colonne dans data-label. Les listes arrivent après le premier
  // affichage (chargement, filtres, pagination) : on observe donc la zone de
  // contenu et on relabellise à chaque changement.
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const label = () => {
      main.querySelectorAll('table').forEach((table) => {
        const headers = Array.from(table.querySelectorAll('thead th')).map((th) =>
          (th.textContent || '').replace(/\s+/g, ' ').trim()
        );
        if (headers.length === 0) return;
        table.querySelectorAll('tbody > tr').forEach((row) => {
          let column = 0;
          Array.from(row.children).forEach((cell) => {
            const span = (cell as HTMLTableCellElement).colSpan || 1;
            const text = span > 1 ? '' : headers[column] || '';
            if (cell.getAttribute('data-label') !== text) cell.setAttribute('data-label', text);
            column += span;
          });
        });
      });
    };
    label();
    let frame = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(label);
    });
    observer.observe(main, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      const next = !value;
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* sans mémorisation */
      }
      return next;
    });
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/connexion');
  };

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);

  const currentPage = navigation.find((item) => isActive(item.href))?.name || 'Tableau de bord';

  // Sur mobile le tiroir affiche toujours les libellés ; la réduction ne
  // s'applique qu'à partir de l'écran large (lg).
  const labelClass = collapsed ? 'lg:hidden' : '';

  return (
    <div className="h-[100dvh] bg-ivory flex font-sans overflow-hidden">
      {/* Voile derrière le tiroir mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-primaryText/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Menu latéral */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-forest-dark text-white flex flex-col border-r border-forest-secondary/30 transition-[transform,width] duration-200 ease-in-out lg:static lg:max-w-none lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'lg:w-16' : 'lg:w-64'}`}
        aria-label="Menu d'administration"
      >
        {/* En-tête du menu */}
        <div
          className={`h-16 shrink-0 flex items-center border-b border-forest-secondary/30 ${
            collapsed ? 'justify-between px-5 lg:justify-center lg:px-0' : 'justify-between px-5'
          }`}
        >
          <Link href="/admin" className="flex items-center space-x-2.5 min-w-0" title="Tableau de bord">
            <Flame className="w-6 h-6 text-beige shrink-0 fill-beige/20" />
            <div className={`min-w-0 ${labelClass}`}>
              <span className="font-poppins font-semibold text-sm text-white block leading-tight truncate">
                Gestion Commerciale
              </span>
              <span className="text-[10px] text-ivory/60 block">Bois &amp; Biomasse</span>
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 text-ivory/70 hover:text-white"
            aria-label="Fermer le menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Liens */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
          {navigation.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                title={collapsed ? item.name : undefined}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 lg:py-2 rounded-md text-xs font-medium transition-colors duration-150 ${
                  collapsed ? 'lg:justify-center lg:px-0' : ''
                } ${active ? 'bg-forest text-white' : 'text-ivory/80 hover:bg-forest/50 hover:text-white'}`}
              >
                <Icon className="w-4 h-4 shrink-0 text-ivory/80" />
                <span className={`truncate ${labelClass}`}>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Pied du menu : boutique, utilisateur, réduction */}
        <div className="p-3 border-t border-forest-secondary/30 space-y-3 shrink-0">
          <Link
            href="/"
            target="_blank"
            title="Boutique publique"
            className={`inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 bg-forest/40 hover:bg-forest text-ivory rounded-md text-xs font-medium transition-colors border border-forest-secondary/40 ${
              collapsed ? 'lg:px-0' : ''
            }`}
          >
            <span className={labelClass}>Boutique publique</span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          </Link>

          <div className={`flex items-center justify-between gap-2 pt-1 ${collapsed ? 'lg:flex-col' : ''}`}>
            <Link
              href="/admin/mon-compte"
              onClick={() => setSidebarOpen(false)}
              className={`text-xs min-w-0 hover:opacity-80 transition-opacity ${labelClass}`}
              title="Modifier mon e-mail et mon mot de passe"
            >
              <p className="font-medium text-white truncate">{userName}</p>
              <p className="text-[10px] text-ivory/60 truncate">{userRole}</p>
            </Link>
            <button
              onClick={handleLogout}
              className="p-1.5 text-ivory/70 hover:text-statusError rounded-md transition-colors shrink-0"
              title="Se déconnecter"
              aria-label="Se déconnecter"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={toggleCollapsed}
            className={`hidden lg:flex items-center gap-2 w-full py-1.5 px-2 rounded-md text-[11px] text-ivory/70 hover:text-white hover:bg-forest/50 transition-colors ${
              collapsed ? 'justify-center px-0' : ''
            }`}
            title={collapsed ? 'Déplier le menu' : 'Réduire le menu'}
            aria-label={collapsed ? 'Déplier le menu' : 'Réduire le menu'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            {!collapsed && <span>Réduire le menu</span>}
          </button>
        </div>
      </aside>

      {/* Zone de contenu */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 sm:h-16 shrink-0 bg-white border-b border-subtleBorder flex items-center justify-between gap-3 px-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-1 text-secondaryText hover:text-primaryText rounded-md"
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              onClick={toggleCollapsed}
              className="hidden lg:inline-flex p-2 -ml-2 text-secondaryText hover:text-primaryText rounded-md"
              title={collapsed ? 'Déplier le menu' : 'Réduire le menu'}
              aria-label={collapsed ? 'Déplier le menu' : 'Réduire le menu'}
            >
              {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2 text-xs text-secondaryText min-w-0">
              <span className="hidden sm:inline">Portail de gestion</span>
              <span className="hidden sm:inline">/</span>
              <span className="text-primaryText font-medium truncate">{currentPage}</span>
            </div>
          </div>

          <span className="badge-success shrink-0 hidden sm:inline-flex">
            <CheckCircle2 className="w-3 h-3" />
            <span>Système connecté</span>
          </span>
        </header>

        {/* Seule cette zone défile : le menu reste en place. `min-w-0` empêche
            un tableau large d'élargir toute la page ; les tableaux défilent
            horizontalement dans leur propre cadre. */}
        <main ref={mainRef} className="admin-main flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-3 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
