# Project Context — anygate

> Route any model into any coding agent — launch tools, switch providers, and run local API gateways.

This document is the authoritative map of the **anygate** codebase for developers, agents, and contributors. It supersedes the Codex-first framing in `AGENTS.md`/`CLAUDE.md`, which are partly stale (they describe a v0.3.0 Codex-centric build). anygate is now **Claude-Code-first** and at **v0.1.0**.

---

## 1. What anygate is

anygate is a Node.js CLI (and visual launcher UI) that connects AI coding tools to **any** provider behind a single Anthropic-compatible or OpenAI-compatible surface, and runs local API gateways on your machine.

Supported targets:

- **Claude Code** (primary) — `anygate claude`
- **Claude Desktop** (Cowork + Code) — `anygate claude-app`
- **OpenAI Codex CLI** — `anygate codex`
- **ChatGPT desktop app (Codex mode)** — `anygate codex-app` (alias `chatgpt`)
- **Google Gemini CLI** — `anygate gemini`
- **Antigravity CLI / app / IDE** (experimental) — `anygate agy` / `antigravity` / `antigravity-ide`
- **Agent / headless** — `anygate --ai`, boot flags `--provider`/`--model`, clean NDJSON/JSONL

Backends you can wire up:

- **Registry providers** — configured once with `anygate providers` (Groq, Mistral, Together, OpenRouter, 15+ SDK-backed templates, custom OpenAI/Anthropic-compatible endpoints). Stored in `~/.anygate/providers.json`, secrets in the OS keychain.
- **OpenCode Zen / Go** — cloud models via an OpenCode API key (optional).
- **One-time OpenCode import** — `anygate providers import`.
- **Google Vertex AI** — Claude on Vertex via `anygate server --vertex` + gcloud ADC (no OpenCode key).

---

## 2. Status

| Field | Value |
|-------|-------|
| Version | `0.1.0` (see [package.json](file:///e:/anygate/package.json)) |
| Package | **unscoped** `anygate` (npm public, `access: public`) |
| License | MIT |
| Node | `>=18` |
| Module system | ESM (`"type": "module"`) |
| Maintainer | `ramananbuilds` |
| Repo | `https://github.com/ramananbuilds/anygate` |

> [!IMPORTANT]
> This project was forked/renamed from a predecessor product. The current codebase contains **no user-facing references** to the old name/author. Internally, a few legacy code identifiers still carry the old name (e.g. `gatewayIntro`/`gatewayOutro` in [src/ui.ts](file:///e:/anygate/src/ui.ts), `GATEWAY_LAUNCH_FLAGS`/`parseGatewayLaunchFlag` in [src/cli.ts](file:///e:/anygate/src/cli.ts)). These are **internal only** and not surfaced to users. The `package.json` `description` field ("Gateway any model into any coding agent") still contains the old word "Gateway" and should be cleaned as backlog (see §11).

---

## 3. Tech stack

- **Language:** TypeScript (strict), ES2022 target.
- **Runtime:** Node 18+.
- **Bundler:** [tsup](https://tsup.egoist.dev) → single ESM bundle `dist/cli.js` with a `#!/usr/bin/env node` shebang; `target: node18`, sourcemaps on, no minify. Provider SDKs and keyring are marked `external` so they resolve from `node_modules` at runtime (keeps the bundle small).
- **Translation layer:** [Vercel AI SDK](https://sdk.vercel.ai) (`ai` + `@ai-sdk/*`) — the *single* path that converts non-Anthropic providers to the Anthropic wire format Claude Code speaks.
- **CLI prompts:** `@clack/prompts`.
- **TOML parsing:** `smol-toml` (for Codex/Claude Desktop config patches).
- **HTTP/WebSocket:** `open`, `ws`, `ipaddr.js`.
- **Keychain:** `@napi-rs/keyring` (optional dependency, dynamically imported).
- **Validation:** `zod`.
- **Tests:** [vitest](https://vitest.dev) (`vitest run`).
- **UI:** a small Express-free Node HTTP server ([src/ui.ts](file:///e:/anygate/src/ui.ts)) serving static assets in [src/ui/public](file:///e:/anygate/src/ui/public) (`index.html`, `app.js`, `style.css`) + a JSON API in [src/ui/api.ts](file:///e:/anygate/src/ui/api.ts).

---

## 4. Repository layout

```
anygate/
├── src/                  # TypeScript source (entry: cli.ts)
│   ├── cli.ts            # Command parsing + dispatch (root orchestrator)
│   ├── launch.ts         # Locate + spawn target binaries (stdio:inherit)
│   ├── launch-target.ts  # Normalize launch args per agent, plan wizard
│   ├── env.ts            # Environment isolation (17 conflicting vars stripped)
│   ├── key-setup.ts      # API-key collection + secure storage
│   ├── config.ts         # Preferences (~/.anygate/config.json) load/save
│   ├── constants.ts      # BACKENDS, MAX_MODEL_CATALOG=20, stale models, etc.
│   ├── types.ts          # Shared types (ParsedArgs, ModelInfo, ...)
│   ├── proxy.ts          # Local Anthropic-format proxy (single + catalog)
│   ├── sdk-adapter.ts    # Anthropic <-> Vercel AI SDK translation
│   ├── provider-factory.ts # Dynamic import(npm) -> SDK LanguageModel
│   ├── catalog.ts        # Build multi-route catalog for favorites
│   ├── models.ts         # Model listing, caching, format classification
│   ├── providers.ts      # OpenCode local-provider discovery
│   ├── providers-command.ts # `anygate providers` command
│   ├── provider-catalog.ts  # Registry-first catalog resolution
│   ├── provider-templates.ts # Built-in provider templates
│   ├── registry/         # Native provider registry (CRUD, import, auth, refresh)
│   ├── oauth/            # Device-code OAuth (github-copilot, openai, xai, antigravity)
│   ├── server/           # `anygate server` gateway (router, catalog-filter, vertex)
│   ├── ui/               # `anygate ui` visual launcher (api.ts, server-control.ts, public/)
│   ├── antigravity/      # Cloud Code (Gemini-internal) gateway for Antigravity
│   ├── claude-app.ts     # `anygate claude-app` (Claude Desktop)
│   ├── codex.ts / codex-app.ts / codex-proxy.ts / codex-responses-adapter.ts
│   ├── gemini.ts / gemini-proxy.ts / gemini-parts.ts
│   ├── ai-doc.ts         # `anygate --ai` agent reference generator
│   └── ... (favorites, prompts, first-run, trace-log, update-check, ...)
├── tests/                # vitest specs (pure functions + cli help)
├── docs/                 # Guides: PROVIDERS, CODEX, CLAUDE_DESKTOP_SETUP,
│                         #   GEMINI, TROUBLESHOOTING, MODEL-COMPATIBILITY,
│                         #   AI-AGENTS, API_SERVER
├── assets/               # logo.svg, banner.svg (custom SVG branding)
├── scripts/              # copy-ui-assets.mjs, refresh-models-dev-cache.mjs
├── dist/                 # Built bundle (do not hand-edit; rebuild via `npm run build`)
├── .github/workflows/    # publish.yml (npm publish on release)
├── AGENTS.md, CLAUDE.md  # Agent guidance (partly stale — see §intro)
├── README.md             # User-facing docs
└── package.json, tsconfig.json, tsup.config.ts, CHANGELOG.md, LICENSE
```

---

## 5. Architecture

### 5.1 Entry & dispatch
[src/cli.ts](file:///e:/anygate/src/cli.ts) parses `process.argv` and dispatches:

| Subcommand | Handler |
|-----------|---------|
| *(none)* / `--help` | help |
| `--version` | version |
| `claude` | inline wizard + launch (root orchestrator) |
| `server [--vertex]` | [src/server/index.ts](file:///e:/anygate/src/server/index.ts) |
| `models` / `favorites` | [src/favorites.ts](file:///e:/anygate/src/favorites.ts) + [favorites-picker.ts](file:///e:/anygate/src/favorites-picker.ts) |
| `providers` | [src/providers-command.ts](file:///e:/anygate/src/providers-command.ts) |
| `claude-app` | [src/claude-app.ts](file:///e:/anygate/src/claude-app.ts) |
| `codex` | [src/codex.ts](file:///e:/anygate/src/codex.ts) |
| `codex-app` / `chatgpt` | [src/codex-app.ts](file:///e:/anygate/src/codex-app.ts) |
| `gemini` | [src/gemini.ts](file:///e:/anygate/src/gemini.ts) |
| `agy` / `antigravity` / `antigravity-ide` | [src/antigravity.ts](file:///e:/anygate/src/antigravity.ts) |
| `ui` | [src/ui-command.ts](file:///e:/anygate/src/ui-command.ts) |
| `--ai [--install]` | [src/ai-doc.ts](file:///e:/anygate/src/ai-doc.ts) |

Every module is a focused unit with **no side effects at import time**.

### 5.2 Core launch flow (`anygate claude`)
```
cli.ts
  → findClaudeBinary()                 [launch.ts]
  → resolveOrCollectApiKey()           [key-setup.ts — env / keychain / prompt]
  → fetchProviderCatalog()             [provider-catalog.ts — registry-first]
  → runFirstRunWizard() if empty      [first-run.ts]
  → pickModel / favorites catalog      [prompts.ts / catalog.ts]
  → buildChildEnv(baseUrl, ...)        [env.ts — strips 17 vars, sets ANTHROPIC_*, --model]
  → startProxy() / startProxyCatalog() [proxy.ts]
  → launchClaude()                     [launch.ts — spawn, stdio:inherit]
  → proxyHandle.close() on exit
```

### 5.3 The translation layer (the heart of the product)
All **non-Anthropic** providers route through the **Vercel AI SDK** (`ai` + `@ai-sdk/*`, the same packages OpenCode loads). This is the *only* translation path — no hand-rolled per-provider conversion.

- [src/sdk-adapter.ts](file:///e:/anygate/src/sdk-adapter.ts): Anthropic `/v1/messages` ↔ SDK. `translateRequest()` builds SDK call params and folds inline `role:'system'` messages into the system prompt (so skills/system-reminders aren't dropped). `streamAnthropicResponse` maps the SDK `fullStream` → Anthropic SSE. Round-trips `thought_signature` (Gemini) via `tool_use.id` encoding.
- [src/provider-factory.ts](file:///e:/anygate/src/provider-factory.ts): `createLanguageModel({ npm, modelId, apiKey, baseURL })` dynamically `import(npm)` and discovers the `create*` factory. Special branches for OpenAI/xAI **Responses API** selection (`modelPrefersResponsesApi` → `provider.responses(id)`) and openai-compatible/openrouter base URLs. `isSdkMigratedNpm(npm)` is true for any npm except `@ai-sdk/anthropic`.
- **Model format classification** (`modelFormat`): `anthropic` (direct passthrough) vs `openai` (SDK adapter proxy). Driven by `provider.npm` / ID-prefix heuristics.

### 5.4 Local proxy
[src/proxy.ts](file:///e:/anygate/src/proxy.ts): an HTTP server on `127.0.0.1:<random-port>` accepting Anthropic-format `/v1/messages`. Per-route dispatch:
- `modelFormat === 'anthropic'` → direct passthrough to provider's Anthropic endpoint.
- else → `isSdkMigratedNpm(route.npm)` → SDK adapter.

`GET /v1/models` returns a synthetic catalog with per-model `context_window`. `aliasModelId()` rewrites non-`Claude-*` ids so gateway model discovery accepts them. Favorites mode uses `startProxyCatalog()` (multi-route, max 20 = `MAX_MODEL_CATALOG`).

### 5.5 Server mode (`anygate server`)
[src/server/index.ts](file:///e:/anygate/src/server/index.ts) + [router.ts](file:///e:/anygate/src/server/router.ts) run a foreground gateway on fixed port **17645**. `loadServerModels()` converts registry providers to `ServerModelInfo[]`; the router forwards Anthropic-format to `{baseUrl}/v1/messages` and SDK-adapts OpenAI-format. `GET /models` strips `apiKey`. Health: `GET /health`. The **Vertex gateway** (`--vertex`) uses gcloud ADC to serve Claude on Vertex (see [docs/PROVIDERS.md](file:///e:/anygate/docs/PROVIDERS.md)).

### 5.6 Visual launcher (`anygate ui`)
[src/ui.ts](file:///e:/anygate/src/ui.ts) + [src/ui/api.ts](file:///e:/anygate/src/ui/api.ts) serve a browser dashboard from [src/ui/public](file:///e:/anygate/src/ui/public). The **Server tab** runs the *same* gateway as `anygate server` in-process via [src/ui/server-control.ts](file:///e:/anygate/src/ui/server-control.ts) (no child process; stops when the UI exits). Saved settings are shared with the terminal wizard.

### 5.7 Registry & providers
- [src/registry/](file:///e:/anygate/src/registry): native provider registry CRUD, templates ([provider-templates.ts](file:///e:/anygate/src/provider-templates.ts)), one-time OpenCode import, OAuth auth broker, model refresh, pricing.
- `fetchProviderCatalog()` is **registry-first**: OpenCode is no longer the source of truth for providers (unlike older versions).
- [src/oauth/](file:///e:/anygate/src/oauth): device-code flows for `github-copilot`, `openai-oauth`, `xai-oauth`, and `antigravity-oauth`.

### 5.8 Antigravity gateway
[src/antigravity/](file:///e:/anygate/src/antigravity): `startCloudCodeGateway()` fakes Google's internal Cloud Code API so Antigravity routes through anygate. `request-adapter.ts` converts Cloud Code `generateContent` → SDK params; `response-adapter.ts` converts SDK stream → Cloud Code SSE. `normalizeFunctionCallArgs` un-stringifies MCP tool-call args (third-party models stringify them). **Use a throwaway Google account** (see [docs/ANTIGRAVITY.md](file:///e:/anygate/docs/ANTIGRAVITY.md)).

### 5.9 Environment isolation
[src/env.ts](file:///e:/anygate/src/env.ts) `buildChildEnv()`: copies `process.env`, deletes the 17 `CONFLICTING_ENV_VARS` (Vertex AI, Bedrock, AWS, Foundry, stale Anthropic), then sets `ANTHROPIC_BASE_URL` / `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` and passes `--model`. The **parent shell is never mutated.** (Caveat: the target tool may persist the model to its own `settings.json` — outside anygate's control.)

---

## 6. Configuration & data files

| File | Purpose |
|------|---------|
| `~/.anygate/providers.json` | Provider registry (no secrets) |
| `~/.anygate/config.json` | Preferences: `lastProvider`, `lastModel`, `recentModelsByProvider`, `favoriteModels`, server settings, optional server password |
| `~/.anygate/vertex-models.json` | Custom Vertex catalog (copy of `assets/vertex-models.example.json`) |
| OS keychain (`keyring:provider:<id>`, `anygate` service) | Per-provider keys + OpenCode API key |
| `ANYGATE_HOME` env var | Override the `~/.anygate` root |
| `--dry-run` | Ignores all saved state and writes nothing (simulates fresh first-run) |

---

## 7. Commands (quick reference)

Full detail in [README.md](file:///e:/anygate/README.md). Key commands:

```
anygate                      # help
anygate ui                  # visual launcher
anygate claude              # launch Claude Code (primary)
anygate providers           # add/import/list/refresh providers
anygate models              # manage favorite models (mid-session /model)
anygate server [--vertex]   # local API gateway (port 17645)
anygate claude-app          # Claude Desktop (Cowork + Code)
anygate codex               # OpenAI Codex CLI
anygate codex-app|chatgpt   # ChatGPT desktop (Codex mode)
anygate gemini              # Google Gemini CLI
anygate agy|antigravity|antigravity-ide
anygate providers auth <id> # OAuth device-code
anygate --ai                # agent reference (docs/AI-AGENTS.md)
```

Boot flags for non-interactive launch: `--provider`, `--model`, `--` passthrough.

---

## 8. Build, dev & scripts

```bash
npm install            # install deps
npm run build          # tsup -> dist/cli.js + copy UI assets (scripts/copy-ui-assets.mjs)
npm run dev            # tsup --watch
npm run typecheck      # tsc --noEmit
npm test               # vitest run
npx vitest run tests/env.test.ts   # single file
npm run refresh:models-dev         # rebuild dev model cache
```

`prepublishOnly` enforces `package.json`/`package-lock.json` version sync, then builds.

**tsup externals** ([tsup.config.ts](file:///e:/anygate/tsup.config.ts)): `@napi-rs/keyring`, `ws`, all `@ai-sdk/*`, `@openrouter/ai-sdk-provider`, `gitlab-ai-provider`, `venice-ai-sdk-provider`, `open`. These load from `node_modules` at runtime.

---

## 9. Testing

- **vitest** with `@vitest/coverage-v8`.
- Covers pure functions: `env.ts`, `models.ts`, `sdk-adapter.ts`, `provider-factory.ts`, `proxy.ts` (`aliasModelId`), `providers.ts`, `catalog.ts`, `favorites.ts`, `prompts.ts`, `upstream-forward.ts`, `config.ts`, `tool-search.ts`, `cli.ts` (help text), server modules.
- Interactive launch flow + real-provider behavior are verified manually.
- `tests/ai-doc.test.ts` asserts `npm install -g anygate` is documented (keep the README string in sync).

---

## 10. CI / Release

- `.github/workflows/publish.yml` — publishes to npm on release/tag.
- CHANGELOG.md is maintained manually; keep it updated on version bumps.

---

## 11. Known limitations & housekeeping backlog

> [!WARNING]
> **Backlog item — stale "Gateway" string:** `package.json` `description` still reads *"Gateway any model into any coding agent…"*. The user-facing README uses "Route any model". Normalize `package.json` `description` and `keywords` (drop `"gateway"`) for full consistency.

Other known limitations (by design):
- Cost display in Codex is always inaccurate for non-Anthropic models (Codex applies its own pricing table).
- OAuth-authenticated providers (no stored key) are silently skipped by discovery.
- In gateway-discovery (switch-menu) mode, the displayed context window reflects the **launch** model and does not update on live `/model` switch.
- Mistral free tier has tight 429 rate limits during tool-heavy sessions.
- Provider credential resolution is **not fully centralized** — `provider-catalog.ts::resolveLocalProviderApiKey()` is the canonical helper, but `codex.ts`, `codex-app.ts`, `claude-app.ts`, and `favorites-resolver.ts` carry similar-but-divergent copies. Fix credential bugs in all of them (this is how the Kilo Code "No credential" bug shipped).

---

## 12. How to extend

- **Add a provider template:** extend [src/provider-templates.ts](file:///e:/anygate/src/provider-templates.ts) + registry builtins.
- **Add a backend:** update `BACKENDS` in [src/constants.ts](file:///e:/anygate/src/constants.ts), the `BackendConfig` id union in [src/types.ts](file:///e:/anygate/src/types.ts), and the tier logic in `prompts.ts`/`cli.ts`.
- **Add a new SDK provider:** ensure its `@ai-sdk/*` package is a `dependency` + listed external in `tsup.config.ts`; `provider-factory.ts` discovers the factory dynamically.
- **Critical URL constraint:** `BACKENDS.baseUrl` must **NOT** include `/v1` — the Anthropic SDK appends `/v1/messages` automatically.

---

## 13. Disclaimer

anygate has **no affiliation** with OpenCode, Anthropic, Claude, Google, GitHub, OpenAI, xAI, or any integrated vendor. It routes inference through services you configure yourself. Use at your own risk.
