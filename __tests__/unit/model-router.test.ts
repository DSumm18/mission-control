import { describe, it, expect } from 'vitest';
import { routeMessage, getModelId, getModelDisplayName, type ModelTier } from '@/lib/ed/model-router';

describe('routeMessage', () => {
  // Quick-path: short status queries
  it('routes "any jobs running?" to quick-path', () => {
    expect(routeMessage('any jobs running?', false)).toBe('quick-path');
  });

  it('routes "what jobs are queued" to quick-path', () => {
    expect(routeMessage('what jobs are queued', false)).toBe('quick-path');
  });

  it('routes "newsletter status" to quick-path', () => {
    expect(routeMessage('newsletter status', false)).toBe('quick-path');
  });

  it('routes "what tasks are pending" to quick-path', () => {
    expect(routeMessage('what tasks are pending', false)).toBe('quick-path');
  });

  it('routes "sitrep" to quick-path', () => {
    expect(routeMessage('sitrep', false)).toBe('quick-path');
  });

  it('routes "project status" to quick-path', () => {
    expect(routeMessage('project status', false)).toBe('quick-path');
  });

  it('routes "agent status" to quick-path', () => {
    expect(routeMessage('agent status', false)).toBe('quick-path');
  });

  // Quick-path only for short messages (<=80 chars)
  it('does NOT route long status query to quick-path', () => {
    const longMsg = 'what is the current status of all the jobs and everything that is happening right now please';
    expect(routeMessage(longMsg, false)).not.toBe('quick-path');
  });

  // Haiku: confirmations
  it('routes "yes" to haiku', () => {
    expect(routeMessage('yes', false)).toBe('haiku');
  });

  it('routes "go ahead" to haiku', () => {
    expect(routeMessage('go ahead', false)).toBe('haiku');
  });

  it('routes "approved" to haiku', () => {
    expect(routeMessage('approved', false)).toBe('haiku');
  });

  it('routes "option A" to haiku', () => {
    expect(routeMessage('option A', false)).toBe('haiku');
  });

  // Opus: strategic decisions
  it('routes "challenge board" to opus', () => {
    expect(routeMessage('Set up a challenge board for the new product', false)).toBe('opus');
  });

  it('routes "architecture" to opus', () => {
    expect(routeMessage('Review the architecture of mission control', false)).toBe('opus');
  });

  it('routes "business case" to opus', () => {
    expect(routeMessage('Build the business case for MyMeme', false)).toBe('opus');
  });

  it('routes "deep analysis" to opus', () => {
    expect(routeMessage('I need a deep analysis of our revenue strategy', false)).toBe('opus');
  });

  it('routes "comprehensive roadmap" to opus', () => {
    expect(routeMessage('Create a comprehensive roadmap for Q3', false)).toBe('opus');
  });

  // Sonnet: actions
  it('routes "create a new project" to sonnet', () => {
    expect(routeMessage('create a new project called TestApp', false)).toBe('sonnet');
  });

  it('routes "deploy to vercel" to sonnet', () => {
    expect(routeMessage('deploy to vercel now', false)).toBe('sonnet');
  });

  it('routes URL to sonnet', () => {
    expect(routeMessage('Check this out https://example.com/article', false)).toBe('sonnet');
  });

  it('routes "analyse the competition" to sonnet', () => {
    expect(routeMessage('analyse the competition', false)).toBe('sonnet');
  });

  // Images always go to sonnet
  it('routes image messages to sonnet', () => {
    expect(routeMessage('what is this?', true)).toBe('sonnet');
  });

  it('routes even short image messages to sonnet', () => {
    expect(routeMessage('yes', true)).toBe('sonnet');
  });

  // Default: haiku
  it('routes generic short message to haiku', () => {
    expect(routeMessage('hello Ed', false)).toBe('haiku');
  });

  // Long messages: sonnet
  it('routes long messages (>300 chars) to sonnet', () => {
    const long = 'a'.repeat(301);
    expect(routeMessage(long, false)).toBe('sonnet');
  });
});

describe('getModelId', () => {
  it('returns haiku for haiku tier', () => {
    expect(getModelId('haiku')).toBe('haiku');
  });

  it('returns sonnet for sonnet tier', () => {
    expect(getModelId('sonnet')).toBe('sonnet');
  });

  it('returns opus for opus tier', () => {
    expect(getModelId('opus')).toBe('opus');
  });

  it('returns sonnet for quick-path (fallback)', () => {
    expect(getModelId('quick-path')).toBe('sonnet');
  });
});

describe('getModelDisplayName', () => {
  it('returns quick-path for quick-path', () => {
    expect(getModelDisplayName('quick-path')).toBe('quick-path');
  });

  it('returns haiku-4.5 for haiku', () => {
    expect(getModelDisplayName('haiku')).toBe('haiku-4.5');
  });

  it('returns sonnet-4.5 for sonnet', () => {
    expect(getModelDisplayName('sonnet')).toBe('sonnet-4.5');
  });

  it('returns opus-4.6 for opus', () => {
    expect(getModelDisplayName('opus')).toBe('opus-4.6');
  });
});
