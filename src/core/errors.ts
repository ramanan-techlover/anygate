// src/core/errors.ts — centralized, typed error hierarchy + helpers.
//
// This module is the single source of truth for how anygate classifies and
// reports failures (upstream outages, auth failures, missing models, bad
// config). Moving error classification here removes the per-agent string
// sniffing (e.g. `message.includes('HTTP 429')`) that previously collapsed
// real upstream statuses into opaque 502s.

import type { ServerResponse } from 'node:http';
import { sendJson } from './http-utils.js';

/** Base class for every error anygate throws with a known HTTP mapping. */
export class AnygateError extends Error {
  /** HTTP status to surface to the client (e.g. 401, 404, 429, 502). */
  readonly httpStatus: number;
  /** Whether the caller (proxy router, CLI) may safely retry the request. */
  readonly retryable: boolean;
  /** User-facing message safe to show in a TUI / browser (no stack traces). */
  readonly userMessage: string;

  constructor(opts: {
    httpStatus: number;
    retryable?: boolean;
    userMessage: string;
    cause?: unknown;
  }) {
    super(opts.userMessage, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = new.target.name;
    this.httpStatus = opts.httpStatus;
    this.retryable = opts.retryable ?? false;
    this.userMessage = opts.userMessage;
  }
}

/** Provider rejected the credential (or none was available). */
export class ProviderAuthError extends AnygateError {
  constructor(providerId: string, message?: string) {
    super({
      httpStatus: 401,
      retryable: false,
      userMessage: message ?? `Provider "${providerId}" rejected the API key or no credential is configured.`,
    });
  }
}

/** No credential could be resolved for a provider (replaces bare "No credential"). */
export class CredentialUnavailableError extends AnygateError {
  constructor(providerId: string) {
    super({
      httpStatus: 401,
      retryable: false,
      userMessage: `No credential available for provider "${providerId}". Run \`anygate providers auth ${providerId}\` or set the key.`,
    });
  }
}

/** Requested model id was not found in the catalog. */
export class ModelNotFoundError extends AnygateError {
  constructor(modelId: string) {
    super({
      httpStatus: 404,
      retryable: false,
      userMessage: `Model "${modelId}" not found.`,
    });
  }
}

/** Invalid configuration (config file, provider template, launch flags). */
export class InvalidConfigError extends AnygateError {
  constructor(message: string) {
    super({ httpStatus: 400, retryable: false, userMessage: message });
  }
}

/** Upstream provider could not be reached (DNS, TLS, connection reset). */
export class UpstreamUnreachableError extends Error {
  constructor(cause: unknown) {
    super(`Upstream unreachable: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'UpstreamUnreachableError';
  }
}

interface ApiCallLike {
  message?: string;
  statusCode?: number;
  responseBody?: string;
  data?: { error?: { message?: string; type?: string } };
  lastError?: { message?: string; statusCode?: number };
  errors?: Array<{ message?: string; statusCode?: number }>;
}

/**
 * Build a short, user-safe message from an SDK / upstream failure.
 * No stack traces — intended for display inside the Codex / Claude TUI.
 */
export function formatUpstreamError(err: unknown): string {
  if (!err || typeof err !== 'object') return 'Upstream model request failed.';

  const rec = err as ApiCallLike;

  if (rec.data?.error?.message) {
    const short = sanitizeMessage(rec.data.error.message);
    return rec.statusCode ? `${short} (HTTP ${rec.statusCode})` : short;
  }

  if (rec.responseBody) {
    try {
      const parsed = JSON.parse(rec.responseBody) as { error?: { message?: string } };
      if (parsed.error?.message) {
        const short = sanitizeMessage(parsed.error.message);
        return rec.statusCode ? `${short} (HTTP ${rec.statusCode})` : short;
      }
    } catch { /* ignore */ }
  }

  const last = rec.lastError;
  if (last?.message) {
    const code = last.statusCode;
    const short = sanitizeMessage(last.message);
    return code ? `${short} (HTTP ${code})` : short;
  }

  const fromList = rec.errors?.[rec.errors.length - 1];
  if (fromList?.message) {
    const short = sanitizeMessage(fromList.message);
    return fromList.statusCode ? `${short} (HTTP ${fromList.statusCode})` : short;
  }

  if (rec.message) {
    const short = sanitizeMessage(rec.message);
    if (short && !short.includes('file://') && !short.includes('APICallError') && short.length < 240) {
      return rec.statusCode ? `${short} (HTTP ${rec.statusCode})` : short;
    }
  }

  return 'Upstream model request failed.';
}

/**
 * Real upstream HTTP status from an SDK error, falling back to sniffing the
 * formatted message only as a last resort. Prefer reading `err.httpStatus`
 * on anygate-typed errors over this helper.
 */
export function upstreamHttpStatus(err: unknown, message: string): number {
  if (err instanceof AnygateError) return err.httpStatus;
  if (err && typeof err === 'object' && 'statusCode' in err) {
    const code = (err as { statusCode?: number }).statusCode;
    if (code === 400 || code === 401 || code === 403 || code === 404 || code === 429) return code;
  }
  if (message.includes('HTTP 429') || message.includes('429')) return 429;
  if (message.includes('HTTP 400')) return 400;
  return 500;
}

/** Anthropic SSE error `type` for a status code — lets clients tell retryable from terminal failures. */
export function anthropicErrorType(status: number): string {
  switch (status) {
    case 400: return 'invalid_request_error';
    case 401: return 'authentication_error';
    case 403: return 'permission_error';
    case 404: return 'not_found_error';
    case 429: return 'rate_limit_error';
    default: return 'api_error';
  }
}

/** Write a typed AnygateError to an HTTP response as an Anthropic-style error body. */
export function sendError(res: ServerResponse, err: AnygateError): void {
  if (res.headersSent) {
    res.write(`event: error\ndata: ${JSON.stringify({
      type: 'error',
      error: { type: anthropicErrorType(err.httpStatus), message: err.userMessage },
    })}\n\n`);
    res.end();
    return;
  }
  sendJson(res, err.httpStatus, {
    type: 'error',
    error: { type: anthropicErrorType(err.httpStatus), message: err.userMessage },
  });
}

/** Parse JSON without throwing — returns the fallback (default null) on any error. */
export function safeJsonParse<T = unknown>(text: string | null | undefined, fallback: T | null = null): T | null {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

function sanitizeMessage(message: string): string {
  const line = message.split('\n')[0]?.trim() ?? message;
  if (line.startsWith('RetryError') || line.includes('AI_RetryError')) {
    return 'Upstream model request failed after retries.';
  }
  return line;
}
