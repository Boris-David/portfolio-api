import { chromium, type Browser } from 'playwright';
import { assertCharactersAreCovered } from './fonts.js';

/**
 * Le port de rendu du CV.
 *
 * Le gabarit, le modèle et la commande de build ne connaissent que cette
 * interface : le moteur est un détail remplaçable, et il l'est vraiment — le
 * jour où un autre moteur rend mieux, rien d'autre ne bouge.
 */
export interface CvRenderer {
  render(html: string): Promise<Uint8Array>;
  close(): Promise<void>;
}

const PDF_OPTIONS = {
  printBackground: true,
  /**
   * La taille et les marges viennent de la règle `@page` du gabarit, pas
   * d'options passées ici : la mise en page appartient au gabarit, qui est le
   * seul endroit à lire pour savoir à quoi ressemble le document.
   */
  preferCSSPageSize: true,
} as const;

/**
 * Le rendu par Chromium sans interface.
 *
 * **Pourquoi un navigateur.** Le CV et le site doivent boire aux mêmes tokens
 * (ADR 0004). Un moteur PDF tiers imposerait de réécrire la mise en page dans
 * un autre modèle de boîte : deux moteurs, donc deux rendus qui divergent
 * lentement. Chromium met en page le CV avec **le moteur qui met en page le
 * site** — la forme ne peut pas dériver parce qu'il n'y a qu'un seul calcul.
 *
 * **Le poids et le démarrage à froid.** Ils ne sont pas payés, parce que
 * Chromium n'est jamais là où l'API tourne. Playwright est une dépendance de
 * développement, et le rendu vit dans la CI, qui publie ensuite le Worker et
 * ses assets. Un Worker ne pourrait de toute façon pas lancer un navigateur :
 * la contrainte de l'ADR — « le rendu est déclenché par le changement de
 * contenu, jamais par la requête » — est donc tenue par la plateforme, pas par
 * la discipline. Et un isolat V8 n'a rien à amorcer au réveil.
 */
export async function createChromiumRenderer(): Promise<CvRenderer> {
  const browser: Browser = await chromium.launch();
  return {
    async render(html: string): Promise<Uint8Array> {
      assertCharactersAreCovered(stripTags(html));
      const page = await browser.newPage();
      try {
        // `setContent` plutôt qu'un fichier : le document est autonome —
        // polices comprises — donc il n'a ni base d'URL ni accès disque à
        // résoudre, et le rendu est identique partout.
        await page.setContent(html, { waitUntil: 'load' });
        await page.emulateMedia({ media: 'print' });
        return await page.pdf(PDF_OPTIONS);
      } finally {
        await page.close();
      }
    },
    async close(): Promise<void> {
      await browser.close();
    },
  };
}

/**
 * Le texte que le document affichera, débarrassé du balisage et du CSS.
 *
 * La garde de couverture des polices ne doit voir que ce qui se dessine : une
 * base64 de police ou un sélecteur CSS y ajouterait des caractères qui ne
 * sortent jamais à l'écran.
 */
function stripTags(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ');
}
