# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for the tides of French harbors:
a Node.js service (Node 22+, ESM, no build step) that runs in its own
sandboxed Docker container and talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. It downloads, once a day per harbor, the tide
predictions of the SHOM (the public services behind maree.shom.fr: harbor
list, high and low tides, water heights every 5 minutes, coefficients) and
computes everything else locally on a one-minute timer. The service
addresses come from the Home Assistant integration KipK/marees_france (MIT,
see NOTICE). Transport: cloud only.

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/tides.test.js            # one file
DEBUG=gladys-integration-sdk npm test     # with the SDK debug logs
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store . --skip-image-check   # store checks
node scripts/update-ports.mjs             # harbor list: src/ports.json + the `port` select
scripts/build-cover.sh                    # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh              # docs/assets/widgets.<lang>.png
node .github/scripts/release.mjs next     # the version the next release would get
```

## Architecture

```
index.js                SDK wiring only (new GladysIntegration + createApp)
src/app.js              every handler, the minute timer, the daily download
src/shom-api.js         SHOM client: URLs (parameter order matters), headers, error kinds
src/ports.js            harbor list (WFS), display names, search and resolution
src/ports.json          built-in snapshot of the harbor list (scripts/update-ports.mjs)
src/tides.js            pure tide computations: parse, interpolate, next tide, local days
src/time.js             timezone helpers (Intl), the TZ given by the supervisor
src/store.js            JSON files under /data (tides, harbor list, fired events)
src/device.js           one device per harbor, its features and states
src/events.js           scene trigger events and scene action outputs
src/widgets.js          tide of the day, next tides, coefficients
src/config.js           configuration (harbor select, other harbors, language)
src/i18n.js             runtime texts, en / fr / de / es
gladys-assistant-integration.json   manifest (the `port` options are generated)
docs/{en,fr,de,es}.md   user documentation, re-hosted by the store
docs/illustrations/     generated widget images (render.sh, gen.mjs, render.js)
test/fixtures/          real SHOM answers (Brest, Fort-de-France) and the baseline
.github/scripts/release.mjs         version, changelog, bump (tested in test/)
```

## Rules

- **External ids are forever**, and so is every key users store: the device
  external id is the SHOM harbor code (`BREST`), never a name; feature keys,
  `category` / `type` / `unit` / `min` / `max` / `step`; the keys of
  `config_schema`, the option values of the `port` select (harbor codes),
  `actions`, the widgets and their settings, scene triggers (fields, option
  values, variables) and scene actions (fields, outputs).
  `test/structure.test.js` compares them to
  `test/fixtures/discovery.baseline.json`: never update the baseline to make a
  test pass without a documented migration.
- **Be gentle with the SHOM.** Its web application firewall refuses some query
  strings (HTML "Security Error" page in 403, e.g. a query ending with
  `&correlation=1&duration=1`) and then the address for a while: keep the
  parameter order of shom-api.js, the `Referer` and browser User-Agent, one
  download a day per harbor, 2 s between requests, and stop for 3 hours after
  a `blocked` error. Never add a request per widget or per minute.
- **Times**: always ask `utc=0` and convert with the timezone of Gladys (`TZ`
  set by the supervisor, time.js). `utc=standard` is the legal time of
  mainland France for every harbor, overseas ones included: never use it.
- **Category / type pairs** come from the SDK constants and have an icon in
  the Gladys front (`test/devices.test.js` lists them). `should_poll` stays
  false: the integration's own minute timer publishes the states (the water
  height on 5-minute steps, as the SHOM computes it).
- **Scene events**: one event per tide and per offset (and per coefficient
  threshold for spring tides), since trigger filters compare by equality; the
  `minutes_before` and `min_coefficient` filters stay required. An event is
  fired once (kept in `/data/fired.json`), and dropped when missed by more
  than 10 minutes. Never fire one as a consequence of a scene action.
- **The container rootfs is read-only.** Write only under `/data`.
- **Four languages.** Every user-facing text (manifest, runtime messages in
  `src/i18n.js`, `docs/*.md`, README) exists in English, French, German and
  Spanish, except the harbor names of the `port` select (proper nouns, `en`
  label only, to keep the manifest small). `test/i18n.test.js` checks it.
- **Widget images.** After any change to the content of a widget, run
  `docs/illustrations/render.sh` again and look at the four PNG files.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, the lockfile or the manifest, nor the `docker_image` tag.
  The version stays below 1.0.0 until the maintainer runs the Release workflow
  with `release-as: 1.0.0`.
- **Changelog.** Never edit CHANGELOG.md by hand, it is generated at the
  release. Write the PR title as the line the user will read.
- **Commits and PR titles** follow Conventional Commits, in English: `feat` ->
  minor, `fix` / `perf` -> patch, `!` or `BREAKING CHANGE:` -> major (minor
  below 1.0.0); `docs`, `chore`, `ci`, `test`, `style`, `refactor`, `build`
  release nothing.
- **Manifest.** Texts are objects `{ "en", "fr", "de", "es" }`; the catalog
  `description` holds 10 to 100 characters per language; the file stays under
  90 KB (the store refuses 100 KB: the harbor options weigh about 30 KB). A
  field older cores do not know needs a higher `gladys_version` minimum (see
  `src/constants.js` of the integration-store): a widget button with a form or
  a `houses` source would need 5.2.0. Transport: `["cloud"]`.
- **Forum drafts** (`.github/forum-*.md`) are never committed.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network.
