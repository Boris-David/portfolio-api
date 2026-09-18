import type { Locale } from '../domain/locale.js';

/**
 * Date formatting for the résumé.
 *
 * The content stores `YYYY-MM`; how it is displayed is a matter of language
 * and medium. Formatting it here rather than storing it avoids holding two
 * truths, one of which — "today" — goes stale on its own.
 */

/** The en dash: a date range, not a hyphen. */
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

/** "mai 2023 – aujourd'hui", "janv. 2022 – avr. 2023". */
export function formatPeriod(start: string, end: string | null, locale: Locale): string {
  const from = formatMonth(start, locale);
  const to = end === null ? STILL_THERE[locale] : formatMonth(end, locale);
  return `${from} ${RANGE_SEPARATOR} ${to}`;
}

export function formatYearRange(startYear: number, endYear: number): string {
  return `${String(startYear)} ${RANGE_SEPARATOR} ${String(endYear)}`;
}

/** "novembre 2025" when the month is known, "2025" otherwise. */
export function formatAwardedOn(awardedOn: string, locale: Locale): string {
  if (!awardedOn.includes('-')) return awardedOn;
  return LONG_MONTH_YEAR[locale].format(toDate(awardedOn));
}
