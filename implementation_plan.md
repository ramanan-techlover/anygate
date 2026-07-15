# Restructure Plan — anygate codebase (full domain split)

## Goal

The current `src/` is **~56 flat `.ts` files with almost no subfoldering** —
`cli.ts`, `proxy.ts`, `sdk-adapter.ts`, `provider-factory.ts`, `catalog.ts`,
`models.ts`, `favorites*.ts`, `codex*.ts`, `gemini*.ts`, `claude-app.ts`,
`env.ts`, `key-setup.ts`, etc. all live at the root, plus a few subfolders
(`registry/`, `oauth/`, `server/`, `ui/`, `antigravity/`, `codex/`, `gemini/`,
`claude-desktop/`) that overlap the root files. This is hard to navigate and
causes the duplicated credential/error logic.

Reorganize into a **proper, fully-foldered domain layout with clearer file
names**, and fix the two systemic defects:

1. **Error handling is ad-hoc + duplicated.** One custom error class
   (`UpstreamUnreachableError`); per-agent code re-parses failures by
   `string.includes('HTTP 429')` sniffing (`src/codex/upstream-error.ts:56`).
   Upstream failures collapse to opaque `502` in Codex routes while
   `relayAnthropicMessages` already forwards the *real* status.
2. **Credential resolution is not centralized.** `resolveLocalProviderApiKey`
   lives in `provider-catalog.ts`, but the same call is inlined at 7 sites
   (`cli.ts:1292`, `codex.ts:507`, `codex-app.ts:458`, `claude-app.ts:190`,
   `gemini.ts:181/217`, `favorites-resolver.ts:60`, `antigravity/launch-routes.ts:27`)
   — exactly how the "Kilo Code No credential" bug shipped.

> [!NOTE]
> **Build-safe at every step.** Each phase keeps `npm run build` + `npm test` green.
> Done incrementally, one domain at a time, not as one giant diff.
> **No user-facing CLI behavior changes** — only layout, naming, and internal logic.

> [!IMPORTANT]
> **UI-forward:** you plan a major "most advanced" UI overhaul. The restructure must
> make `src/ui/` an **API-first, asset-swappable** layer so the advanced UI drops
> in without touching gateway/agent logic. `ui/api.ts` is a **frozen public contract**;
> backend never imports from `ui/`.

---

## User Review Required

- **Scope = fuller domain split (Option B).** Unlike the earlier surgical plan,
  we now create real subfolders for every domain and rename files to clear,
  intention-revealing names (e.g. `codex.ts` → `agents/codex/cli.ts`,
  `proxy.ts` → `gateway/anthropic-proxy.ts`). Export *symbols* stay identical
  so tests/docs don't break; only *paths* change.
- **Backward-compat for `docs/` + `context/`:** new modules keep the same
  exported names the old functions had (`resolveLocalProviderApiKey`,
  `UpstreamUnreachableError`, etc.).
- **Drop legacy "Relay" identifiers?** `package.json` description + `relayIntro`/
  `RELAY_LAUNCH_FLAGS`. Marked optional cleanup.
- **Advanced-UI stack:** framework (React/Vite/Svelte) or richer vanilla? Decides
  whether `ui/public/` stays plain assets or becomes a bundled SPA mounted on
  the frozen `ui/api.ts`. Plan assumes swappable `public/`.

---

## Open Questions

- **Rename aggressively or conservatively?** Plan renames for clarity
  (`proxy.ts`→`gateway/anthropic-proxy.ts`, `codex-proxy.ts`→`gateway/codex-proxy.ts`)
  but preserves each exported symbol. Confirm you're OK with new filenames.
- **Typed `throw` vs `Result<T>`?** Plan assumes typed `throw` + `sendError`
  helper (less invasive than Result everywhere).
- **UI contract frozen?** Should `ui/api.ts` endpoints be frozen (recommended,
  pure frontend swap) or do you expect new backend endpoints too?

---

## Proposed layout (the target)

```
src/
├── cli.ts                       # UNCHANGED entry/dispatch (kept at root on purpose)
├── core/                       # [NEW] cross-cutting, no domain bias
│   ├── errors.ts                # centralized typed errors + formatUpstreamError/sendError/safeJsonParse
│   ├── credentials.ts          # resolveLocalProviderApiKey + resolveOrCollectApiKey + readFromCredentialStore
│   ├── config.ts               # ~/.anygate/config.json
│   ├── constants.ts            # BACKENDS, MAX_MODEL_CATALOG, CONFLICTING_ENV_VARS, classifyModelFormat
│   ├── types.ts               # shared types
│   ├── env.ts                 # buildChildEnv (child isolation)
│   └── agent-io.ts            # clean NDJSON/JSONL stdout
├── registry/                   # [MOVED + split] provider registry
│   ├── index.ts
│   ├── crud.ts  io.ts  load.ts  migrate.ts  convert.ts  materialize.ts  types.ts  builtins.ts
│   ├── templates.ts            # was provider-templates.ts
│   ├── custom-endpoint.ts      # was custom-endpoint.ts
│   ├── import-opencode.ts  import-build.ts
│   ├── auth.ts                # was provider-auth.ts (native + broker)
│   ├── auth-broker.ts  opencode-auth.ts  refresh-credentials.ts
│   ├── pricing.ts  models.ts  fetch-template-models.ts  model-source.ts  models-dev.ts
│   ├── url-security.ts  validate.ts  validate-import-key.ts  google-model-id.ts
│   └── discovery.ts           # was providers.ts (OpenCode local discovery)
├── oauth/                      # [MOVED] device-code flows (unchanged shape)
│   ├── types.ts  github.ts  openai.ts  xai.ts  antigravity-oauth.ts
│   ├── claude-code.ts  claude-identity.ts  callback-server.ts  pkce.ts
│   └── refresh.ts  refresh-http.ts  responses-websocket.ts
├── gateway/                    # [NEW] unified local API gateway
│   ├── server.ts              # was server/index.ts
│   ├── router.ts             # was server/router.ts
│   ├── models.ts             # was server/models.ts
│   ├── catalog-filter.ts  vendor-mask.ts  auth.ts  prompts.ts  provider-select.ts
│   ├── vertex.ts             # was server/vertex-config.ts
│   ├── anthropic-proxy.ts    # was proxy.ts
│   ├── proxy-shared.ts        # was proxy-shared.ts + proxy-types.ts merged
│   ├── sdk-adapter.ts        # was sdk-adapter.ts
│   ├── provider-factory.ts   # was provider-factory.ts
│   └── antigravity/          # was antigravity/* Cloud Code gateway
│       ├── cloud-code-gateway.ts  cloud-code-proxy.ts  request-adapter.ts
│       ├── response-adapter.ts  anthropic-to-cloudcode.ts  cloudcode-to-anthropic.ts
│       ├── catalog.ts  slot-registry.ts  ide-profile.ts  types.ts
│       └── launch-cli.ts  launch-ide.ts  launch-routes.ts
├── agents/                     # [NEW] all agent launchers, one folder per target
│   ├── claude/
│   │   ├── cli.ts             # was cli.ts claude flow (orchestrated inline; extracted)
│   │   ├── desktop.ts         # was claude-app.ts
│   │   ├── desktop-app.ts     # was claude-desktop/app-*.ts
│   │   ├── launch.ts  launch-target.ts  first-run.ts  prompts.ts
│   │   └── favorites.ts  favorites-picker.ts  favorites-resolver.ts  favorite-provider-display.ts
│   ├── codex/
│   │   ├── cli.ts             # was codex.ts
│   │   ├── app.ts             # was codex-app.ts
│   │   ├── proxy.ts            # was codex-proxy.ts
│   │   ├── responses-adapter.ts# was codex-responses-adapter.ts
│   │   ├── routing.ts  catalog.ts  session.ts  profile.ts  app-config.ts
│   │   ├── app-launch.ts  app-profile.ts  app-provider-routes.ts  app-session.ts
│   │   ├── favorites-catalog.ts  favorites-launch.ts  upstream-error.ts  ui.ts
│   │   └── launch.ts
│   ├── gemini/
│   │   ├── cli.ts             # was gemini.ts
│   │   ├── proxy.ts            # was gemini-proxy.ts
│   │   ├── parts.ts            # was gemini-parts.ts
│   │   ├── launch.ts  backend-routes.ts  prompts.ts
│   │   └── antigravity.ts     # was antigravity.ts (CLI/app/IDE dispatcher)
│   └── shared/               # [NEW] shared launcher helpers
│       ├── launch.ts           # was launch.ts (find + spawn binary)
│       ├── native-launcher.ts  trace-log.ts  update-check.ts  model-search.ts
│       ├── model-compatibility.ts  tool-search.ts  free-models.ts
│       ├── reasoning-capabilities.ts  context-window.ts  context-model-id.ts
│       └── key-setup.ts       # API-key collection + keychain (feeds core/credentials.ts)
├── ui/                        # [API-first, swappable assets]
│   ├── server.ts             # was ui.ts (HTTP server, UNCHANGED by UI overhaul)
│   ├── command.ts            # was ui-command.ts
│   ├── api.ts                # JSON API — FROZEN contract for advanced UI
│   ├── api-types.ts          # [NEW] typed API schema (shared old + new UI)
│   ├── server-control.ts      # in-process gateway lifecycle (UNCHANGED)
│   └── public/              # index.html / app.js / style.css — ONLY UI-coupled assets
└── providers/                 # [NEW] provider CLI + catalog
    ├── command.ts            # was providers-command.ts
    ├── catalog.ts            # was provider-catalog.ts (registry-first;
    │                         #   resolveLocalProviderApiKey MOVED to core/credentials.ts)
    ├── templates.ts          # was provider-templates.ts
    └── opencode-serve.ts     # was opencode-serve.ts
```

> [!IMPORTANT]
> Every moved/renamed file keeps its **exported symbol names** identical
> (`resolveLocalProviderApiKey`, `startProxy`, `runServerCommand`, `UpstreamUnreachableError`).
> Only *import paths* of callers change. This is what keeps `npm test` green
> without rewriting every test — and what keeps the **goal intact**.

---

## Execution phases (build-safe, one domain at a time)

### Phase 0 — Foundation: `core/errors.ts` + `core/credentials.ts`
- Create `src/core/errors.ts`: move `UpstreamUnreachableError`
  (`upstream-forward.ts:32`), add typed `AnygateError` base (`httpStatus`,
  `retryable`, `userMessage`), `ProviderAuthError`, `ModelNotFoundError`,
  `InvalidConfigError`, `CredentialUnavailableError` (replaces bare `"No credential"`).
  Move `formatUpstreamError` + `upstreamHttpStatus` + `anthropicErrorType`
  (from `codex/upstream-error.ts` → delete that file). Add `sendError(res,…)`
  + `safeJsonParse(text)` helpers.
- Create `src/core/credentials.ts`: move `resolveLocalProviderApiKey`
  (from `provider-catalog.ts`), `resolveOrCollectApiKey` + `readFromCredentialStore`
  (from `key-setup.ts`/`env.ts:413`). Make the 7 inlined call sites import it.
- **Verify:** `grep -rn "resolveLocalProviderApiKey" src/` shows ONE definition + imports.

### Phase 1 — Extract `core/` shared modules
- Move `config.ts`, `constants.ts`, `types.ts`, `env.ts`, `agent-io.ts` into `src/core/`.
  Update imports. Keep symbol names.

### Phase 2 — Build `gateway/`
- Move `server/*` → `gateway/server.ts` etc.; `proxy.ts` → `gateway/anthropic-proxy.ts`;
  merge `proxy-shared.ts`+`proxy-types.ts` → `gateway/proxy-shared.ts`.
- Move `sdk-adapter.ts`, `provider-factory.ts` → `gateway/`.
- Move `antigravity/*` → `gateway/antigravity/`.

### Phase 3 — Build `agents/` (the biggest churn)
- Per-target folders `claude/`, `codex/`, `gemini/`. Move root `codex.ts`,
  `codex-app.ts`, `codex-proxy.ts`, `codex-responses-adapter.ts`, `gemini.ts`,
  `gemini-proxy.ts`, `gemini-parts.ts`, `claude-app.ts`, `antigravity.ts` +
  their `codex/`, `gemini/`, `claude-desktop/` subfiles into the right homes.
- Move `launch.ts`, `launch-target.ts`, `first-run.ts`, `prompts.ts`, `trace-log.ts`,
  `update-check.ts`, favorites/*, model-* helpers, `tool-search.ts`, `key-setup.ts`
  into `agents/shared/` (or `core/` where pure).
- `cli.ts` stays at root and dispatches into `agents/*`.

### Phase 4 — Build `registry/`, `providers/`, `oauth/`
- Split `provider-templates.ts`→`registry/templates.ts`, `providers.ts`→`registry/discovery.ts`,
  `provider-catalog.ts`→`providers/catalog.ts` (after moving the credential fn out in Phase 0),
  `providers-command.ts`→`providers/command.ts`, `opencode-serve.ts`→`providers/opencode-serve.ts`.
- `oauth/*` already foldered — keep, just re-point imports.

### Phase 5 — Safer coding logic (the "errors handled better" ask)
- Replace `throw new Error('No credential')` → `throw new CredentialUnavailableError(providerId)`.
- Replace `message.includes('HTTP 429')` sniffing (`codex/upstream-error.ts:56`, now
  `gateway/...`) with real `err.httpStatus` reads via `core/errors.ts`.
- Extend `relayAnthropicMessages`' real-status forwarding to Codex/OpenAI routes
  (no more opaque `502`).
- Replace the 4 scattered `JSON.parse`/`try-catch` blocks with `safeJsonParse`.
- Hoist the `--trace` redaction fn into `core/errors.ts`/`trace-log.ts`.

### Phase 6 — UI-forward readiness
- Freeze `ui/api.ts` contract; add `ui/api-types.ts` + `ui/api.test.ts`.
- Keep `ui/public/` the only UI-coupled assets (advanced UI swaps here, mounts on frozen API).
- Enforce **one-way dependency**: backend never imports `ui/`. Add grep-audit step.
- `server-control.ts` stays the single gateway source (Server tab = thin wrapper).

### Phase 7 — Docs + housekeeping
- Update `context/` pack (paths in `02_ARCHITECTURE.md`, `03_COMPONENTS.md`,
  `09_GLOSSARY.md`) + add UI-contract section.
- Optional: normalize legacy "Relay" string in `package.json`.
- Add `core/errors.test.ts`, `core/credentials.test.ts`, `ui/api.test.ts` to lock contracts.

---

## Verification Plan

### Automated Tests
- `npm run typecheck` — green after every phase (strict TS).
- `npm test` — full vitest green; new `errors.test.ts` + `credentials.test.ts`
  assert the 7 call sites resolve identically; `ui/api.test.ts` locks routes.
- `npx vitest run tests/proxy.test.ts tests/codex-proxy.test.ts tests/server-*` —
  gateway routing + error-mapping regression.
- **Import audits (the goal-preservation guards):**
  - `grep -rn "resolveLocalProviderApiKey" src/` → ONE definition + imports, zero inlined copies.
  - `grep -rn "from '.*ui/" src/core src/gateway src/agents src/registry src/providers`
    → EMPTY (backend never imports UI).
  - `grep -rn "includes('HTTP 4" src/` → EMPTY (no status sniffing).

### Manual Verification
- `npm run build && anygate --version` (sanity).
- `anygate claude` + `anygate codex` vs a registry provider and a Zen/Go model:
  wrong key → typed 401, bad model → typed 404, upstream down → typed 502
  with **real** upstream status (not opaque "api_error").
- `anygate server` + `anygate ui` Server tab both start and serve `/models`;
  advanced UI (when built) hits the same `ui/api.ts` contract.
- Deliberately break an upstream → client gets the *real* HTTP status (the win).

---

## Risks / Caveats
- **Import churn:** the `agents/` + `gateway/` moves touch ~80 import lines.
  Mitigated by keeping export names stable and moving one domain per phase.
- **Test drift:** some `tests/` import moved files by path; update those imports
  in the same commit as each move.
- **Behavioral parity:** the refactor must NOT change *what* users see — only
  layout, naming, centralized errors/credentials, and UI-layer separability.
- **UI scope creep:** the advanced-UI build itself is **out of scope** here; this
  plan only ensures the restructure won't block it (frozen API, swappable assets,
  one-way dependency).
- **Goal intact:** every phase ends green; if a phase can't be made green,
  stop and report rather than shipping a broken intermediate.
