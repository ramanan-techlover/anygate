import { describe, it, expect } from 'vitest';
import { filterServerModelsByFavorites } from '../src/gateway/catalog-filter.js';
import { MAX_MODEL_CATALOG } from './../src/core/constants.js';
import { getServerFavoritesOnly, setServerFavoritesOnly } from './../src/core/config.js';
import type { ServerModelInfo } from '../src/gateway/models.js';
import type { FavoriteModel } from './../src/core/types.js';

describe('server favoritesOnly preference', () => {
  it('round-trips through setServerFavoritesOnly / getServerFavoritesOnly', () => {
    setServerFavoritesOnly(true);
    expect(getServerFavoritesOnly()).toBe(true);
    setServerFavoritesOnly(false);
    expect(getServerFavoritesOnly()).toBe(false);
  });
});

describe('server favorites-only catalog', () => {
  it('caps at MAX_MODEL_CATALOG', () => {
    const models: ServerModelInfo[] = Array.from({ length: 25 }, (_, i) => ({
      providerId: `p${i}`,
      id: `m${i}`,
      displayName: `Model ${i}`,
      contextWindow: 100000,
    }));
    const favorites: FavoriteModel[] = models.map(m => ({
      providerId: m.providerId!,
      modelId: m.id,
    }));

    const filtered = filterServerModelsByFavorites(models, favorites).slice(0, MAX_MODEL_CATALOG);

    expect(filtered).toHaveLength(MAX_MODEL_CATALOG);
  });
});
