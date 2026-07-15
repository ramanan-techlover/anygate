// src/core/credentials.ts — single source of truth for resolving a provider's API key.
//
// Previously `resolveLocalProviderApiKey` lived in provider-catalog.ts but was
// inlined/re-imported at 7 sites (cli.ts, codex.ts, codex-app.ts, claude-app.ts,
// gemini.ts, favorites-resolver.ts, antigravity/launch-routes.ts). That drift is
// exactly how the "Kilo Code No credential" bug shipped — codex.ts itself still
// called the old inline copy instead of the shared helper. Centralizing here
// guarantees every launcher uses identical credential resolution.

import { resolveProviderCredential } from './env.js';
import { getTemplateById } from '../providers/provider-templates.js';
import { loadRegistry } from '../registry/io.js';
import { oauthAuthRef } from '../registry/import-build.js';
import type { LocalProvider } from './types.js';

/** Resolve API key when provider.apiKey is empty (registry authRef or global OpenCode key). */
export async function resolveLocalProviderApiKey(provider: LocalProvider): Promise<string | null> {
  const direct = provider.apiKey?.trim();
  if (direct) return direct;

  if (provider.authType === 'none') return 'anonymous';

  const template = getTemplateById(provider.id);
  if (template?.apiKeyOptional || template?.anonymousFreeModels) {
    return 'anonymous';
  }

  const reg = loadRegistry().providers.find(p => p.id === provider.id);
  const authRef = reg?.authRef
    ?? (provider.id === 'zen' || provider.id === 'go' ? 'keyring:global:opencode' : oauthAuthRef(provider.id));
  return resolveProviderCredential(provider.id, authRef);
}
