import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  clearSavedServerPassword,
  getAppPathOverride,
  getSavedServerPassword,
  getServerFreeModelsOnly,
  getServerListenMode,
  loadPreferences,
  recordLaunchFolder,
  savePreferences,
  setAppPathOverride,
  setSavedServerPassword,
  setServerFreeModelsOnly,
  setServerListenMode,
} from './../src/core/config.js';
import { getAppHome, getConfigPath } from '../src/core/paths.js';

let tempHome: string;
let previousHome: string | undefined;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'anygate-test-'));
  previousHome = process.env['HOME'];
  process.env['HOME'] = tempHome;
  process.env['ANYGATE_HOME'] = join(tempHome, 'app-home');
});

afterEach(() => {
  rmSync(tempHome, { recursive: true, force: true });
  if (previousHome === undefined) delete process.env['HOME'];
  else process.env['HOME'] = previousHome;
  delete process.env['ANYGATE_HOME'];
});

describe('app paths', () => {
  it('uses ANYGATE_HOME when set', () => {
    process.env['ANYGATE_HOME'] = join(tempHome, 'custom-home');

    expect(getAppHome()).toBe(join(tempHome, 'custom-home'));
  });

  it('defaults to a .anygate folder under the user home', () => {
    expect(getAppHome({ HOME: tempHome })).toBe(join(tempHome, '.anygate'));
  });

  it('stores config.json inside the app home', () => {
    process.env['ANYGATE_HOME'] = join(tempHome, 'app');

    expect(getConfigPath()).toBe(join(tempHome, 'app', 'config.json'));
  });
});

describe('dotfolder config', () => {
  it('writes preferences to config.json in the app home', () => {
    savePreferences({ lastBackend: 'zen', lastModel: 'claude-sonnet-4-6' });

    expect(loadPreferences()).toMatchObject({
      lastBackend: 'zen',
      lastModel: 'claude-sonnet-4-6',
    });
    expect(JSON.parse(readFileSync(getConfigPath(), 'utf8'))).toMatchObject({
      lastBackend: 'zen',
      lastModel: 'claude-sonnet-4-6',
    });
  });

  it('saves Antigravity CLI favorites separately from global favorites', () => {
    savePreferences({
      favoriteModels: [{ providerId: 'global', modelId: 'claude' }],
      antigravityCliFavoriteModels: [{ providerId: 'xai-oauth', modelId: 'grok-4.3' }],
      antigravityCliFavoritesHintShown: true,
    });

    expect(loadPreferences()).toMatchObject({
      favoriteModels: [{ providerId: 'global', modelId: 'claude' }],
      antigravityCliFavoriteModels: [{ providerId: 'xai-oauth', modelId: 'grok-4.3' }],
      antigravityCliFavoritesHintShown: true,
    });
    expect(JSON.parse(readFileSync(getConfigPath(), 'utf8'))).toMatchObject({
      favoriteModels: [{ providerId: 'global', modelId: 'claude' }],
      antigravityCliFavoriteModels: [{ providerId: 'xai-oauth', modelId: 'grok-4.3' }],
      antigravityCliFavoritesHintShown: true,
    });
  });

  it('saves and clears app path overrides', () => {
    setAppPathOverride('codex', '/tmp/custom-codex');

    expect(getAppPathOverride('codex')).toBe('/tmp/custom-codex');
    expect(loadPreferences().appPathOverrides).toEqual({ codex: '/tmp/custom-codex' });

    setAppPathOverride('codex', null);

    expect(getAppPathOverride('codex')).toBeUndefined();
    expect(loadPreferences().appPathOverrides).toBeUndefined();
  });

  it('records recent launch folders with most recent first', () => {
    recordLaunchFolder('/Users/jbendavi/project-a');
    recordLaunchFolder('/Users/jbendavi/project-b');
    recordLaunchFolder('/Users/jbendavi/project-a');

    expect(loadPreferences().recentLaunchFolders).toEqual([
      '/Users/jbendavi/project-a',
      '/Users/jbendavi/project-b',
    ]);
  });

  it('migrates legacy lastProvider opencode to zen on read', () => {
    const configPath = getConfigPath();
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, JSON.stringify({ lastProvider: 'opencode' }), 'utf8');

    expect(loadPreferences().lastProvider).toBe('zen');
  });

  it('returns null when no server password is saved', async () => {
    expect(await getSavedServerPassword()).toBeNull();
  });

  it('saves and clears a server password', async () => {
    await setSavedServerPassword('my-lan-password');
    expect(await getSavedServerPassword()).toBe('my-lan-password');

    await clearSavedServerPassword();
    expect(await getSavedServerPassword()).toBeNull();
  });

  it('saves server free-models-only preference', () => {
    expect(getServerFreeModelsOnly()).toBe(false);

    setServerFreeModelsOnly(true);
    expect(getServerFreeModelsOnly()).toBe(true);

    setServerFreeModelsOnly(false);
    expect(getServerFreeModelsOnly()).toBe(false);
  });

  it('saves server listen-mode preference', () => {
    expect(getServerListenMode()).toBe('local');

    setServerListenMode('network');
    expect(getServerListenMode()).toBe('network');

    setServerListenMode('local');
    expect(getServerListenMode()).toBe('local');
  });

  it('creates the app home lazily', () => {
    expect(existsSync(process.env['ANYGATE_HOME']!)).toBe(false);

    savePreferences({ lastProvider: 'zen' });

    expect(existsSync(process.env['ANYGATE_HOME']!)).toBe(true);
  });
});
