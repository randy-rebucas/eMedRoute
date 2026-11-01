/**
 * Every string catalog, one per area. A key is `<area>.<key>`, e.g. `t('auth.login.title')`.
 * Add strings to the area that owns the screen; reuse `common.*` for shared words (Cancel, Try
 * again, …). If you need a new area, add it here.
 *
 *   common        components/ui, ErrorState, AppHeader, OfflineBanner, LanguagePicker, forms;
 *                 lib/api, useApiData, usePaginatedList
 *   auth          app/(auth)/*, components/auth.tsx, lib/auth.tsx
 *   nav           app/(app)/(tabs)/_layout.tsx (tab names)
 *   home          app/(app)/(tabs)/home.tsx, NextVisitCard
 *   visits        (tabs)/visits.tsx, visits/*, VisitRow, StatusPill, VisitLogForm, ProductPicker, lib/visits
 *   products      (tabs)/products.tsx, products/*, ProductCards, ProductForm, lib/products
 *   more          app/(app)/(tabs)/more.tsx, stack titles in app/(app)/_layout.tsx
 *   profile       app/(app)/profile/*
 *   settings      app/(app)/settings.tsx
 *   password      app/(app)/change-password.tsx
 *   support       app/(app)/support/*
 *   notifications lib/push
 */
import auth from './strings/auth';
import common from './strings/common';
import home from './strings/home';
import more from './strings/more';
import nav from './strings/nav';
import notifications from './strings/notifications';
import password from './strings/password';
import products from './strings/products';
import profile from './strings/profile';
import settings from './strings/settings';
import support from './strings/support';
import visits from './strings/visits';
import type { Message, ParamsArg } from './types';

export const catalogs = {
  auth,
  common,
  home,
  more,
  nav,
  notifications,
  password,
  products,
  profile,
  settings,
  support,
  visits,
};

type Catalogs = typeof catalogs;
type Area = keyof Catalogs;

/** Every valid key, e.g. 'common.tryAgain' | 'auth.login.title' | … */
export type MessageKey = { [A in Area]: `${A}.${keyof Catalogs[A]['en'] & string}` }[Area];

/** The English message behind a key (its literal type carries the placeholders). */
export type MessageOf<K extends MessageKey> = K extends `${infer A}.${infer Rest}`
  ? A extends Area
    ? Rest extends keyof Catalogs[A]['en']
      ? Catalogs[A]['en'][Rest]
      : never
    : never
  : never;

export type TParams<K extends MessageKey> = ParamsArg<MessageOf<K>>;

/** Keys that take no params: use this to type tables of labels, e.g. `Record<Status, PlainKey>`. */
export type PlainKey = { [K in MessageKey]: [] extends TParams<K> ? K : never }[MessageKey];

export function lookup(language: 'en' | 'fil', key: string): Message | undefined {
  const dot = key.indexOf('.');
  const area = catalogs[key.slice(0, dot) as Area] as { en: Record<string, Message>; fil: Record<string, Message> } | undefined;
  if (!area) return undefined;
  const name = key.slice(dot + 1);
  return area[language][name] ?? area.en[name];
}

/** Dev-only: warn when a Filipino string drops or renames a `{placeholder}` from the English one. */
export function checkCatalogs(): void {
  const names = (m: Message) =>
    [...new Set((typeof m === 'string' ? m : `${m.one} ${m.other}`).match(/\{\w+\}/g) ?? [])]
      .filter((p) => p !== '{count}')
      .sort()
      .join(',');
  for (const [area, cat] of Object.entries(catalogs) as [string, { en: Record<string, Message>; fil: Record<string, Message> }][]) {
    for (const key of Object.keys(cat.en)) {
      const fil = cat.fil[key];
      if (fil !== undefined && names(cat.en[key]) !== names(fil)) {
        console.warn(`[i18n] ${area}.${key}: Filipino placeholders ${names(fil)} differ from English ${names(cat.en[key])}`);
      }
    }
  }
}
