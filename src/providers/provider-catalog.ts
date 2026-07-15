import type { CompatibilityAgent } from '../agents/shared/model-compatibility.js';
import { deriveBrand } from '../agents/shared/model-compatibility.js';
import { loadRegistry } from '../registry/io.js';
import { loadRegistryProviders } from '../registry/load.js';
import type { LocalProvider, LocalProviderModel, ModelInfo } from '../core/types.js';
import type { ServerModelInfo } from '../gateway/models.js';
import { BACKENDS, MAX_MODEL_CATALOG, classifyModelFormat } from '../core/constants.js';
import { claudeCodeClientModelId } from '../agents/shared/context-model-id.js';
import { resolveContextWindow, loadOpencodeCache } from '../agents/shared/context-window.js';
import { shouldHideModel } from '../agents/shared/model-compatibility.js';
import { ANTIGRAVITY_BASE_URLS } from '../oauth/antigravity-oauth.js';
import { isSdkMigratedNpm } from '../gateway/provider-factory.js';
import { aliasModelId } from '../gateway/anthropic-proxy.js';
import type { ProxyRoute } from '../gateway/anthropic-proxy.js';
import type { FavoriteModel, BackendConfig } from '../core/types.js';


export async function fetchProviderCatalog(
  opts?: { agent?: CompatibilityAgent },
): Promise<LocalProvider[]> {
  return loadRegistryProviders(undefined, opts);
}

export function providersForPicker(providers: LocalProvider[]): LocalProvider[] {
  for (const p of providers) {
    p.models.sort((a, b) => {
      const nameA = a.name || a.id;
      const nameB = b.name || b.id;
      return nameA.localeCompare(nameB, undefined, { sensitivity: 'base', numeric: true });
    });
  }

  return providers.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
}

/** Human-readable auth line for `providers list` and provider detail. */
export function formatRegistryAuthLabel(
  provider: Pick<import('../registry/types.js').RegistryProvider, 'authRef' | 'authType'>,
): string {
  if (provider.authType === 'oauth' || provider.authRef.includes('oauth:provider:')) {
    return 'keychain (OAuth)';
  }
  if (provider.authRef.startsWith('keyring:global:opencode')) {
    return 'keychain (OpenCode API key)';
  }
  if (provider.authType === 'none') {
    return 'gcloud / manual credentials';
  }
  if (provider.authRef.startsWith('keyring:')) {
    return 'keychain (API key)';
  }
  if (provider.authRef.startsWith('env:')) {
    return provider.authRef;
  }
  return provider.authRef;
}

/** Row for providers list / hub. */
export interface ProviderDisplayEntry {
  id: string;
  name: string;
  modelCount: number;
  enabled: boolean;
  authLabel: string;
  inRegistry: boolean;
}

export async function resolveProvidersForDisplay(): Promise<ProviderDisplayEntry[]> {
  const reg = loadRegistry();
  const entries: ProviderDisplayEntry[] = [];

  for (const provider of reg.providers) {
    entries.push({
      id: provider.id,
      name: provider.name,
      modelCount: provider.modelsCache?.models.length ?? 0,
      enabled: provider.enabled,
      authLabel: formatRegistryAuthLabel(provider),
      inRegistry: true,
    });
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

export function localProvidersToServerModels(localProviders: LocalProvider[]): ServerModelInfo[] {
  return localProviders.flatMap(provider =>
    provider.models.map(model => ({
      id: model.id,
      name: model.name,
      isFree: model.isFree ?? false,
      freeStatus: model.freeStatus,
      brand: model.brand,
      providerLabel: provider.name,
      providerId: provider.id,
      sourceBackend: provider.id,
      modelFormat: model.modelFormat,
      upstreamModelId: model.upstreamModelId,
      cost: model.cost,
      baseUrl: model.baseUrl,
      completionsUrl: model.completionsUrl,
      npm: model.modelFormat === 'openai' ? (model.npm || '@ai-sdk/openai-compatible') : model.npm,
      apiBaseUrl: model.apiBaseUrl,
      apiKey: provider.apiKey,
      authType: provider.authType,
      oauthAccountId: provider.oauthAccountId,
      contextWindow: model.contextWindow,
      supportedParameters: model.supportedParameters,
      reasoning: model.reasoning,
      interleavedReasoningField: model.interleavedReasoningField,
      useResponsesLite: model.useResponsesLite,
      preferWebSockets: model.preferWebSockets,
      headers: provider.headers,
      providerData: provider.providerData,
    }))
  );
}

export function localModelToRoute(lp: LocalProvider, model: LocalProviderModel): ProxyRoute | null {
  if (model.modelFormat === 'anthropic' && !model.baseUrl) return null;
  if (model.modelFormat === 'openai' && !isSdkMigratedNpm(model.npm) && !model.completionsUrl) return null;
  const upstreamUrl = model.modelFormat === 'cloud-code'
    ? (model.baseUrl ?? ANTIGRAVITY_BASE_URLS[0])
    : (model.modelFormat === 'anthropic' ? model.baseUrl : model.completionsUrl);
  return {
    aliasId: claudeCodeClientModelId(aliasModelId(model.id, lp.id), model.contextWindow),
    realModelId: model.upstreamModelId,
    displayName: `${model.name || model.id} (${lp.name})`,
    upstreamUrl: upstreamUrl ?? '',
    apiKey: lp.apiKey,
    modelFormat: model.modelFormat,
    contextWindow: model.contextWindow,
    npm: model.npm,
    baseURL: model.apiBaseUrl,
    providerId: lp.id,
    authType: lp.authType,
    oauthAccountId: lp.oauthAccountId,
    providerData: lp.providerData,
    headers: lp.headers,
    supportedParameters: model.supportedParameters,
    reasoning: model.reasoning,
    interleavedReasoningField: model.interleavedReasoningField,
    useResponsesLite: model.useResponsesLite,
    preferWebSockets: model.preferWebSockets,
  };
}

export function makeRouteResolver(
  localProviders: LocalProvider[] | null,
): (providerId: string, modelId: string) => ProxyRoute | undefined {
  return (providerId, modelId) => {
    const provider = localProviders?.find(lp => lp.id === providerId);
    const model = provider?.models.find(m => m.id === modelId);
    return provider && model ? localModelToRoute(provider, model) ?? undefined : undefined;
  };
}

/**
 * Claude-specific catalog builder. Takes a `resolveRoute` function (not a
 * ResolveContext) and returns built ProxyRoute[] — does NOT delegate to
 * `buildFavoritesList` in `./favorites-resolver.ts` because the input/output
 * shapes are different (closure-based lookup vs. ResolveContext, ProxyRoute
 * vs. ResolvedFavorite). The dedup+cap pattern is duplicated here on purpose;
 * cross-surface shared resolution lives in `favorites-resolver.ts` and is
 * intended to be consumed by other call sites (Codex, Server) that need a
 * route-shape-agnostic intermediate result.
 */
export function buildCatalogRoutes(
  startingRoute: ProxyRoute,
  favorites: FavoriteModel[],
  resolveRoute: (providerId: string, modelId: string) => ProxyRoute | undefined,
  max = MAX_MODEL_CATALOG,
): { routes: ProxyRoute[]; droppedFavorites: FavoriteModel[] } {
  const droppedFavorites: FavoriteModel[] = [];
  const tail = favorites
    .map(fav => {
      const route = resolveRoute(fav.providerId, fav.modelId);
      if (!route) droppedFavorites.push(fav);
      return route;
    })
    .filter((route): route is ProxyRoute => route !== undefined);
  const routes = [
    startingRoute,
    ...tail.filter(route => route.aliasId !== startingRoute.aliasId),
  ].slice(0, max);
  return { routes, droppedFavorites };
}

// ── Raw provider / OpenCode serve helpers (migrated from deleted src/providers.ts) ──

interface RawModel {
  id: string;
  name?: string;
  family?: string;
  api?: { id?: string; npm?: string; url?: string };
  cost?: { input: number; output: number };
  limit?: { context?: number; output?: number };
  supported_parameters?: string[];
  supportedParameters?: string[];
  reasoning?: boolean;
  interleaved?: { field?: string };
}

export interface RawProvider {
  id: string;
  name: string;
  key?: string;
  models?: Record<string, RawModel>;
}

export function resolveEndpoint(
  npm: string,
  apiUrl: string,
): { format: 'anthropic' | 'openai'; baseUrl?: string; completionsUrl?: string } | null {
  if (!npm) return null;
  if (npm === '@ai-sdk/anthropic') {
    return {
      format: 'anthropic',
      baseUrl: (apiUrl || 'https://api.anthropic.com').replace(/\/v1\/?$/, ''),
    };
  }
  if (npm === '@ai-sdk/openai-compatible') {
    if (!apiUrl) return null;
    return {
      format: 'openai',
      completionsUrl: apiUrl.replace(/\/$/, '') + '/chat/completions',
    };
  }
  // Any other npm OpenCode assigns — SDK adapter owns endpoints.
  return { format: 'openai' };
}

export function normalizeProviders(
  raw: RawProvider[],
  opts?: { includeOAuthPlaceholders?: boolean; agent?: CompatibilityAgent },
): LocalProvider[] {
  const agent = opts?.agent ?? 'claude';
  const result: LocalProvider[] = [];

  for (const provider of raw) {
    const hasKey = !!provider.key?.trim();
    if (!hasKey && !opts?.includeOAuthPlaceholders) continue;

    const models: LocalProviderModel[] = [];

    for (const model of Object.values(provider.models ?? {})) {
      if (shouldHideModel({ providerId: provider.id, modelId: model.id, agent })) continue;
      const endpoint = resolveEndpoint(model.api?.npm ?? '', model.api?.url ?? '');
      if (endpoint === null) continue;

      models.push({
        id: model.id,
        name: model.name ?? model.id,
        family: model.family ?? '',
        brand: deriveBrand(model.family ?? ''),
        modelFormat: endpoint.format,
        upstreamModelId: model.api?.id ?? model.id,
        baseUrl: endpoint.baseUrl,
        completionsUrl: endpoint.completionsUrl,
        npm: model.api?.npm,
        apiBaseUrl: model.api?.url,
        cost: model.cost,
        contextWindow: resolveContextWindow(model.id, model.limit?.context),
        supportedParameters: model.supportedParameters ?? model.supported_parameters,
        reasoning: model.reasoning,
        interleavedReasoningField: model.interleaved?.field,
      });
    }

    if (models.length === 0) continue;

    result.push({
      id: provider.id,
      name: provider.name,
      apiKey: provider.key?.trim() ?? '',
      models,
    });
  }

  return result;
}
