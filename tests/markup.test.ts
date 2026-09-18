import { describe, expect, it } from 'vitest';
import { MarkupError } from '../src/domain/errors.js';
import { isValidMarkup, parseMarkup, plainText } from '../src/domain/markup.js';

describe("grammaire d'emphase inline", () => {
  it('rend un texte sans emphase en un seul fragment', () => {
    expect(parseMarkup('Une phrase simple.')).toEqual([
      { text: 'Une phrase simple.', style: 'plain' },
    ]);
  });

  it('découpe le gras et le code en fragments typés', () => {
    expect(parseMarkup('Passé en `async/await` avec un **acteur**.')).toEqual([
      { text: 'Passé en ', style: 'plain' },
      { text: 'async/await', style: 'code' },
      { text: ' avec un ', style: 'plain' },
      { text: 'acteur', style: 'strong' },
      { text: '.', style: 'plain' },
    ]);
  });

  it('gère une emphase en tête et en fin de phrase', () => {
    expect(parseMarkup('**Livrée.**')).toEqual([{ text: 'Livrée.', style: 'strong' }]);
  });

  it('refuse un délimiteur jamais fermé', () => {
    expect(() => parseMarkup('Un **gras oublié')).toThrow(MarkupError);
  });

  it('refuse une emphase vide', () => {
    expect(() => parseMarkup('Rien ici : ****')).toThrow(MarkupError);
  });

  it('refuse les emphases imbriquées', () => {
    expect(() => parseMarkup('**un `code` dedans**')).toThrow(MarkupError);
  });

  it('nomme la raison dans le message, pour situer la faute dans le fichier', () => {
    expect(() => parseMarkup('Un `code oublié')).toThrow(/never closed/);
  });

  it('expose la validité sans lever, pour le schéma', () => {
    expect(isValidMarkup('**ok**')).toBe(true);
    expect(isValidMarkup('**pas ok')).toBe(false);
  });

  it('reconstitue le texte nu', () => {
    expect(plainText(parseMarkup('Un **fait** vérifiable.'))).toBe('Un fait vérifiable.');
  });
});
