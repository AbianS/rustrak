# @rustrak/i18n

Translation for every Rustrak surface. No React, no DOM, no Node built-ins in
the runtime: it is built `platform: 'neutral'` so the same package serves the
dashboard, a server process and a future mobile app. Root context: `/CLAUDE.md`.

```bash
pnpm build --filter=@rustrak/i18n        # compile catalogs, then tsdown
pnpm test --filter=@rustrak/i18n
```

## The engine is Lingui, and the parser does not ship

`@lingui/core` formats an **already compiled** message. `scripts/compile-catalogs.mjs`
turns each ICU string into Lingui's array form at build time, so the browser
never carries an ICU parser. Measured, bundled and gzipped:

| | runtime |
|---|---|
| `@lingui/core` | **2.1 kB** |
| `intl-messageformat` (what next-intl and react-intl use) | 9.7 kB |
| `i18next` | 14.1 kB |

Compiled catalogs are about 5% larger than their source, which buys back 7.6 kB
of parser and moves the parse cost to build time.

**Paraglide was the fastest on every published benchmark and was still wrong
here.** Its ICU plugin drops exact plural matches (`=1`) and treats rich tags as
literal text. All 35 plurals in these catalogs use `=1`, and French CLDR `one`
covers 0 as well as 1, so folding them would turn `0 événements` into
`0 événement` in an already translated catalog, silently.
`src/translator.test.ts` pins that case and the Romanian `one/few/other` one.

## Catalogs

`messages/<locale>.json`, nested ICU, one file per language. That is the format
translators see and the only thing to edit; everything under `src/generated/` is
built and gitignored.

The compiler emits **one module per namespace per locale**, which is what makes
a page pay for what it names:

| | gzipped |
|---|---|
| runtime alone | 1.8 kB |
| login page (4 namespaces, `fr`) | 4.1 kB |
| whole dashboard (30 namespaces, `fr`) | 29.2 kB |

`src/size.test.ts` pins those ratios. Nothing else notices when a page starts
loading thirty namespaces instead of four; it just gets slower.

The old setup kept a hand-written list of which namespaces crossed to the
client, with a comment warning that `commands` was easy to miss. Here a
namespace is a chunk, so a caller names what it uses at the call site and the
bundler does the rest.

## Using it

```ts
const t = await createTranslator({
  locale: resolveLocale({ stored: user.language, acceptLanguage: header }),
  namespaces: ['auth', 'common'],
});

t.t('auth.form.title');
t.t('charts.eventCount', { count: 3 });
```

`createTranslator` is async because catalogs are separate chunks, and it is the
only thing that awaits: nothing downstream deals with a half-loaded dictionary.
A missing message returns its own key rather than an empty string, so a screen
says which message is missing.

## Rules

- **`resolveLocale` order is stored, then browser, then English.** The stored
  preference lives on the account, so it follows a reader to any browser they
  sign in from. A cookie cannot do that.
- **Never edit `src/generated/`.** It is rebuilt from `messages/` on every
  build and ignored by git.
- **A new language is a file in `messages/` plus an entry in `LOCALES`.** The
  compiler picks the rest up.
- **Keep messages in ICU.** `=1`, `one/few/other` and rich tags all survive the
  compile, and the tests say so.
- The package holds no React binding on purpose. A consumer that wants hooks
  builds them over `Translator`, which is a plain object.
