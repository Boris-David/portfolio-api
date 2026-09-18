import { describe, expect, it } from 'vitest';
import { matchesETag, strongETag } from '../src/content/digest.js';
import { negotiate, resolveLocale } from '../src/http/locale.js';

describe('négociation de langue', () => {
  it("retient la langue de plus haute qualité parmi celles qu'on sert", () => {
    expect(negotiate('de;q=1.0,en;q=0.8,fr;q=0.2')).toBe('en');
  });

  it('accepte une étiquette régionale comme sa langue', () => {
    expect(negotiate('fr-CA')).toBe('fr');
  });

  it('ignore une langue explicitement refusée', () => {
    expect(negotiate('en;q=0, fr;q=0.5')).toBe('fr');
  });

  it('retombe sur le français quand rien ne correspond', () => {
    expect(negotiate('de,it')).toBe('fr');
    expect(negotiate(undefined)).toBe('fr');
    expect(negotiate('   ')).toBe('fr');
  });

  it("fait primer le paramètre explicite sur l'en-tête", () => {
    expect(resolveLocale('en', 'fr')).toEqual({ ok: true, locale: 'en' });
  });

  it('signale une langue inconnue au lieu de la remplacer', () => {
    expect(resolveLocale('de', 'fr')).toEqual({ ok: false, requested: 'de' });
  });
});

describe("comparaison d'ETag", () => {
  const etag = strongETag('a body');

  it('reconnaît la forme exacte', () => {
    expect(matchesETag(etag, etag)).toBe(true);
  });

  it('reconnaît la forme faible et le joker', () => {
    expect(matchesETag(`W/${etag}`, etag)).toBe(true);
    expect(matchesETag('*', etag)).toBe(true);
  });

  it("reconnaît une valeur au milieu d'une liste", () => {
    expect(matchesETag(`"a", ${etag} , "b"`, etag)).toBe(true);
  });

  it("refuse un ETag qui n'est pas le bon, et l'absence d'en-tête", () => {
    expect(matchesETag('"other"', etag)).toBe(false);
    expect(matchesETag(undefined, etag)).toBe(false);
  });

  it('change dès que le corps change', () => {
    expect(strongETag('a body')).not.toBe(strongETag('another body'));
  });
});
