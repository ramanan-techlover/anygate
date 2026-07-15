import { describe, it, expect } from 'vitest';
import {
  generateAiDoc,
  parseSkillVersion,
} from '../src/agents/shared/ai-doc.js';
import { parseArgs } from '../src/cli.js';
import { VERSION } from './../src/core/constants.js';

describe('ai-doc', () => {
  it('includes agent workflow sections', () => {
    const doc = generateAiDoc();
    expect(doc).toContain('anygate-cli');
    expect(doc).toContain('AGENT PLATFORM PATTERNS');
    expect(doc).toContain('ALEF AGENT INTEGRATION');
    expect(doc).toContain('exec --json');
    expect(doc).toContain('danger-full-access');
    expect(doc).toContain('--provider');
    expect(doc).toContain('-p');
    expect(doc).toContain('providers.json');
    expect(doc).toContain('anygate codex');
    expect(doc).toContain('CURRENT LOCAL STATE');
    expect(doc).toContain(`version: "${VERSION}"`);
  });

  it('uses the published npm package name', () => {
    const doc = generateAiDoc();
    expect(doc).toContain('npm install -g anygate');
  });

  it('parseSkillVersion reads YAML frontmatter', () => {
    const doc = generateAiDoc();
    expect(parseSkillVersion(doc)).toBe(VERSION);
  });
});

describe('parseArgs --ai', () => {
  it('parses anygate --ai', () => {
    expect(parseArgs(['--ai'])).toMatchObject({
      command: 'root',
      showAi: true,
      aiInstall: false,
    });
  });

  it('parses anygate --ai --install', () => {
    expect(parseArgs(['--ai', '--install'])).toMatchObject({
      showAi: true,
      aiInstall: true,
    });
  });
});
