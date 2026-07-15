// src/model-compatibility.ts — curated blacklist + models.dev capability filtering

import blacklistData from '../../data/model-incompatible.json' with { type: 'json' };
import type { BackendConfig, ModelInfo } from '../../core/types.js';
import { classifyModelFormat } from '../../core/constants.js';
import { loadOpencodeCache, resolveContextWindow } from './context-window.js';
import {
  findModelsDevModel,
  loadModelsDevCache,
  shouldHideByModelsDevCapabilities,
} from '../../registry/models-dev.js';

const BRAND_MAP: Array<[string, string]> = [
  ['claude', 'Claude'],
  ['gpt', 'GPT'],
  ['gemini', 'Gemini'],
  ['deepseek', 'DeepSeek'],
  ['qwen', 'Qwen'],
  ['minimax', 'MiniMax'],
  ['kimi', 'Kimi'],
  ['glm', 'GLM'],
  ['mimo', 'MiMo'],
  ['grok', 'Grok'],
  ['nemotron', 'Nemotron'],
];

export function deriveBrand(family: string): string {
  const lower = family.toLowerCase();
  for (const [prefix, brand] of BRAND_MAP) {
    if (lower.startsWith(prefix)) return brand;
  }
  return 'Other';
}

export type CompatibilityAgent = 'claude' | 'codex' | 'codex-app' | 'server' | 'gemini' | 'antigravity';

export interface CompatibilityContext {
  providerId: string;
  modelId: string;
  agent: CompatibilityAgent;
}

export interface IncompatibleModelEntry {
  provider: string;
  modelId: string;
  category: string;
  reason: string;
  agents?: CompatibilityAgent[];
  sources?: string[];
  verifiedAt?: string;
}

interface IncompatibleModelFile {
  schema_version?: string;
  entries?: IncompatibleModelEntry[];
}

const BLACKLIST_ENTRIES = (blacklistData as IncompatibleModelFile).entries ?? [];

// Antigravity OAuth's Cloud Code catalog includes helper, internal, and
// candidate slots. Expose only slots we have validated as user-selectable agent
// models; keep normal Google API models governed by the generic rules below.
// Intentionally local allow-list, not model-incompatible.json:
// model-incompatible.json is deny-only and has no allow/deny polarity.
// Moving this would require a data schema migration. See
// docs/superpowers/specs/2026-07-08-agent-launch-consolidation-design.md#111--antigravitys-model-allow-list-vs-the-shared-blacklist-file-deferred
const ANTIGRAVITY_VALIDATED_AGENT_MODELS = new Set([
  'gemini-3.5-flash-low',
  'gemini-3.5-flash-extra-low',
  'gemini-3.1-pro-low',
  'gemini-pro-agent',
  'claude-sonnet-4-6',
  'claude-opus-4-6-thinking',
  'gpt-oss-120b-medium',
]);

function matchesAgent(entryAgents: CompatibilityAgent[] | undefined, agent: CompatibilityAgent): boolean {
  if (!entryAgents || entryAgents.length === 0) return true;
  return entryAgents.includes(agent);
}

function matchesProvider(entryProvider: string, providerId: string): boolean {
  return entryProvider === providerId || entryProvider === '*';
}

export function findBlacklistEntry(ctx: CompatibilityContext): IncompatibleModelEntry | null {
  for (const entry of BLACKLIST_ENTRIES) {
    if (entry.modelId !== ctx.modelId) continue;
    if (!matchesProvider(entry.provider, ctx.providerId)) continue;
    if (!matchesAgent(entry.agents, ctx.agent)) continue;
    return entry;
  }
  return null;
}

export function hideReason(ctx: CompatibilityContext): string | null {
  if (ctx.providerId === 'antigravity' && !ANTIGRAVITY_VALIDATED_AGENT_MODELS.has(ctx.modelId)) {
    return '[antigravity-oauth] not a validated user-selectable Cloud Code agent model';
  }

  const blacklist = findBlacklistEntry(ctx);
  if (blacklist) return `[blacklist:${blacklist.category}] ${blacklist.reason}`;

  const modelsDev = findModelsDevModel(ctx.providerId, ctx.modelId, loadModelsDevCache());
  if (modelsDev && shouldHideByModelsDevCapabilities(modelsDev)) {
    return '[models.dev] incompatible capabilities for coding agents';
  }

  return null;
}

export function shouldHideModel(ctx: CompatibilityContext): boolean {
  return hideReason(ctx) !== null;
}

// ── Zen/Go model discovery (migrated from deleted src/models.ts) ─────────────

export function readModelsFromCache(
  backendId: 'zen' | 'go',
): Map<string, ModelInfo> | null {
  const cache = loadOpencodeCache();
  if (!cache) return null;

  const providerKey = backendId === 'zen' ? 'opencode' : 'opencode-go'; // OpenCode cache file keys
  const providerData = cache[providerKey];
  if (!providerData?.models) return null;

  const result = new Map<string, ModelInfo>();
  for (const entry of Object.values(providerData.models)) {
    if (!entry.id || entry.status === 'deprecated') continue;
    const isFree =
      entry.cost !== undefined &&
      entry.cost.input === 0 &&
      entry.cost.output === 0;
    const rawFormat = classifyModelFormat(entry.id, entry.provider?.npm);
    // Go is an OpenAI-compatible gateway; @ai-sdk/anthropic in the cache is a metadata error.
    const modelFormat = backendId === 'go' && rawFormat === 'anthropic' ? 'openai' : rawFormat;
    result.set(entry.id, {
      id: entry.id,
      name: entry.name ?? entry.id,
      isFree,
      brand: deriveBrand(entry.family ?? ''),
      sourceBackend: backendId,
      modelFormat,
      cost: entry.cost,
      contextWindow: resolveContextWindow(entry.id, entry.limit?.context),
      reasoning: entry.reasoning,
      interleavedReasoningField: entry.interleaved?.field,
    });
  }
  return result;
}

interface ApiModelsResponse {
  data: Array<{ id: string }>;
}

export async function fetchModelsFromApi(backend: BackendConfig): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${backend.baseUrl}/v1/models`, {
      signal: controller.signal,
      headers: { Authorization: 'Bearer test' },
    });
    if (!res.ok) throw new Error(`API returned HTTP ${res.status}`);
    const body = (await res.json()) as ApiModelsResponse;
    return body.data.map(m => m.id);
  } finally {
    clearTimeout(timer);
  }
}

export function mergeModels(
  apiIds: string[],
  cache: Map<string, ModelInfo> | null,
  backendId: 'zen' | 'go',
): ModelInfo[] {
  const uniqueIds = Array.from(new Set(apiIds));
  return uniqueIds
    .filter(id => !shouldHideModel({ providerId: backendId, modelId: id, agent: 'claude' }))
    .map(id => {
      const cached = cache?.get(id);
      if (cached) {
        const modelFormat = backendId === 'go' && cached.modelFormat === 'anthropic' ? 'openai' : cached.modelFormat;
        return { ...cached, sourceBackend: backendId, modelFormat };
      }
      const modelFormat = classifyModelFormat(id, undefined);
      return {
        id,
        name: id,
        isFree: false,
        brand: 'Other',
        sourceBackend: backendId,
        modelFormat,
        contextWindow: resolveContextWindow(id),
      };
    });
}

export async function getModels(
  backend: BackendConfig,
  fallbackModels?: ModelInfo[],
): Promise<{ models: ModelInfo[]; fromCache: boolean }> {
  const cache = readModelsFromCache(backend.id);

  try {
    const apiIds = await fetchModelsFromApi(backend);
    return { models: mergeModels(apiIds, cache, backend.id), fromCache: false };
  } catch {
    if (cache && cache.size > 0) {
      return { models: [...cache.values()], fromCache: true };
    }
    if (fallbackModels && fallbackModels.length > 0) {
      return { models: fallbackModels, fromCache: true };
    }
    throw new Error(
      'Cannot fetch models. Check your network and https://opencode.ai status.',
    );
  }
}

export function groupModels(models: ModelInfo[]): {
  free: ModelInfo[];
  byBrand: Map<string, ModelInfo[]>;
} {
  const free = models
    .filter(m => m.isFree)
    .sort((a, b) => a.id.localeCompare(b.id));

  const byBrand = new Map<string, ModelInfo[]>();
  for (const m of models.filter(m => !m.isFree)) {
    const list = byBrand.get(m.brand) ?? [];
    list.push(m);
    byBrand.set(m.brand, list);
  }
  for (const [brand, list] of byBrand) {
    byBrand.set(brand, list.sort((a, b) => a.id.localeCompare(b.id)));
  }
  return { free, byBrand };
}
