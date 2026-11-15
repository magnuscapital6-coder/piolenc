import React from 'react';

/**
 * Transforme le code collé dans /admin/seo (« Ajoutez ceci dans le <head> »)
 * en éléments React rendus côté serveur.
 *
 * React ne permet pas d'injecter une chaîne HTML brute directement dans
 * <head> : on reconnaît donc les balises qui y ont leur place (meta, link,
 * script, noscript, style, base) et on les reconstruit une par une. Le reste
 * (texte, balises inconnues) est ignoré pour ne pas casser la page.
 *
 * Ce code n'est modifiable que par un super administrateur (voir
 * /api/admin/seo) : il s'exécute sur toutes les pages, comme le ferait un
 * gestionnaire de balises.
 */

const VOID_TAG = /<(meta|link|base)\b([^>]*?)\/?\s*>/iy;
const BLOCK_TAG = /<(script|noscript|style)\b([^>]*)>([\s\S]*?)<\/\1\s*>/iy;
const COMMENT = /<!--[\s\S]*?-->/y;
const ATTRIBUTE = /([^\s=/"'>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

const ATTRIBUTE_TO_PROP: Record<string, string> = {
  class: 'className',
  charset: 'charSet',
  'http-equiv': 'httpEquiv',
  crossorigin: 'crossOrigin',
  referrerpolicy: 'referrerPolicy',
  nomodule: 'noModule',
  fetchpriority: 'fetchPriority',
  hreflang: 'hrefLang',
  itemprop: 'itemProp',
};

const BOOLEAN_ATTRIBUTES = new Set(['async', 'defer', 'nomodule']);

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function parseAttributes(source: string): Record<string, string | boolean> {
  const props: Record<string, string | boolean> = {};
  for (const match of source.matchAll(ATTRIBUTE)) {
    const name = match[1].toLowerCase();
    // Les gestionnaires d'événements inline (onload=…) sont refusés : React les
    // exige sous forme de fonctions et ils n'ont pas leur place dans <head>.
    if (name.startsWith('on')) continue;
    const raw = match[2] ?? match[3] ?? match[4];
    const prop = ATTRIBUTE_TO_PROP[name] || name;
    if (raw === undefined) {
      props[prop] = BOOLEAN_ATTRIBUTES.has(name) ? true : '';
    } else {
      props[prop] = BOOLEAN_ATTRIBUTES.has(name) ? true : decodeEntities(raw);
    }
  }
  return props;
}

export function renderHeadSnippet(html: string, keyPrefix = 'custom-head'): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  if (!html || !html.trim()) return nodes;

  let index = 0;
  let position = 0;
  while (position < html.length) {
    // Blancs et texte libre entre les balises : ignorés.
    const nextTag = html.indexOf('<', position);
    if (nextTag === -1) break;
    position = nextTag;

    COMMENT.lastIndex = position;
    const comment = COMMENT.exec(html);
    if (comment) {
      position = COMMENT.lastIndex;
      continue;
    }

    BLOCK_TAG.lastIndex = position;
    const block = BLOCK_TAG.exec(html);
    if (block) {
      const tag = block[1].toLowerCase();
      const props = parseAttributes(block[2]);
      const content = block[3];
      nodes.push(
        React.createElement(tag, {
          key: `${keyPrefix}-${index++}`,
          ...props,
          ...(content.trim() ? { dangerouslySetInnerHTML: { __html: content } } : {}),
        })
      );
      position = BLOCK_TAG.lastIndex;
      continue;
    }

    VOID_TAG.lastIndex = position;
    const voidTag = VOID_TAG.exec(html);
    if (voidTag) {
      const tag = voidTag[1].toLowerCase();
      nodes.push(React.createElement(tag, { key: `${keyPrefix}-${index++}`, ...parseAttributes(voidTag[2]) }));
      position = VOID_TAG.lastIndex;
      continue;
    }

    // Balise non prise en charge dans <head> : on passe au caractère suivant.
    position += 1;
  }

  return nodes;
}

/** Nombre de balises reconnues : affiché dans l'admin pour rassurer l'exploitant. */
export function countHeadSnippetTags(html: string): number {
  return renderHeadSnippet(html).length;
}
