/**
 * Les erreurs du domaine et du chargement de contenu.
 *
 * Elles sont **fatales par nature** : un contenu invalide n'a pas de mode
 * dégradé acceptable — servir un portfolio à moitié faux est pire que ne rien
 * servir. Elles remontent donc au démarrage, jamais au milieu d'une requête.
 */

export class ContentError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** La grammaire d'emphase inline n'est pas respectée dans un texte de contenu. */
export class MarkupError extends ContentError {
  readonly source: string;

  constructor(source: string, reason: string) {
    super(`Balisage invalide (${reason}) dans : ${JSON.stringify(source)}`);
    this.source = source;
  }
}

/** Un fichier de contenu ne satisfait pas le schéma. */
export class ContentValidationError extends ContentError {
  readonly file: string;

  constructor(file: string, issues: string) {
    super(`Contenu invalide — ${file}\n${issues}`);
    this.file = file;
  }
}

/**
 * Le schéma de domaine utilise un noeud Zod que la dérivation ne sait pas
 * traduire. Lever plutôt que laisser passer : un noeud ignoré silencieusement
 * produirait un schéma de fichier trop permissif, donc une validation qui ment.
 */
export class UnsupportedSchemaNodeError extends ContentError {
  constructor(nodeName: string, path: string) {
    super(
      `Noeud Zod non pris en charge par la dérivation du schéma de contenu : ` +
        `${nodeName} (à « ${path} »). Ajouter sa prise en charge dans ` +
        `src/content/derive.ts plutôt que de contourner.`,
    );
  }
}
