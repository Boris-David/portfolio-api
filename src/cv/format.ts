import type { Locale } from '../domain/locale.js';

/**
 * Le formatage des dates du CV.
 *
 * Le contenu stocke `AAAA-MM` ; l'affichage est une affaire de langue et de
 * support. Le formater ici plutôt que de le stocker évite d'avoir deux vérités
 * dont l'une — « aujourd'hui » — se périme toute seule.
 */

/** Le tiret demi-cadratin : une plage de dates, pas un trait d'union. */
const RANGE_SEPARATOR = '–';

const STILL_THERE: Readonly<Record<Locale, string>> = {
  fr: "aujourd'hui",
  en: 'today',
};

const MONTH_YEAR: Readonly<Record<Locale, Intl.DateTimeFormat>> = {
  fr: new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
  en: new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
};

const LONG_MONTH_YEAR: Readonly<Record<Locale, Intl.DateTimeFormat>> = {
  fr: new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
  en: new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
};

function toDate(yearMonth: string): Date {
  const [year, month] = yearMonth.split('-');
  return new Date(Date.UTC(Number(year), Number(month) - 1, 1));
}

export function formatMonth(yearMonth: string, locale: Locale): string {
  return MONTH_YEAR[locale].format(toDate(yearMonth));
}

/** « mai 2023 – aujourd'hui », « janv. 2022 – avr. 2023 ». */
export function formatPeriod(start: string, end: string | null, locale: Locale): string {
  const from = formatMonth(start, locale);
  const to = end === null ? STILL_THERE[locale] : formatMonth(end, locale);
  return `${from} ${RANGE_SEPARATOR} ${to}`;
}

export function formatYearRange(startYear: number, endYear: number): string {
  return `${String(startYear)} ${RANGE_SEPARATOR} ${String(endYear)}`;
}

/** « novembre 2025 » quand le mois est connu, « 2025 » sinon. */
export function formatAwardedOn(awardedOn: string, locale: Locale): string {
  if (!awardedOn.includes('-')) return awardedOn;
  return LONG_MONTH_YEAR[locale].format(toDate(awardedOn));
}
