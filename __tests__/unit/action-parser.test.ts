import { describe, it, expect } from 'vitest';
import { parseActions } from '@/lib/ed/actions';

describe('parseActions', () => {
  it('parses a single action block', () => {
    const text = 'Sure, I\'ll create that job. [MC_ACTION:create_job]{"title":"Test","engine":"shell"}[/MC_ACTION] Done!';
    const { cleanText, actions } = parseActions(text);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('create_job');
    expect(actions[0].params).toEqual({ title: 'Test', engine: 'shell' });
    // Action block is replaced leaving a space — expected behavior
    expect(cleanText).toContain("Sure, I'll create that job.");
    expect(cleanText).toContain('Done!');
    expect(cleanText).not.toContain('MC_ACTION');
  });

  it('parses multiple action blocks', () => {
    const text = [
      'I\'ll set that up.',
      '[MC_ACTION:create_research]{"url":"https://example.com","title":"Test Article"}[/MC_ACTION]',
      'And queue a scout.',
      '[MC_ACTION:queue_scout]{"url":"https://example.com","title":"Test Article"}[/MC_ACTION]',
      'All done!',
    ].join('\n');

    const { cleanText, actions } = parseActions(text);
    expect(actions).toHaveLength(2);
    expect(actions[0].type).toBe('create_research');
    expect(actions[1].type).toBe('queue_scout');
    expect(cleanText).not.toContain('MC_ACTION');
  });

  it('returns empty actions for text with no action blocks', () => {
    const text = 'Just a normal message with no actions.';
    const { cleanText, actions } = parseActions(text);
    expect(actions).toHaveLength(0);
    expect(cleanText).toBe(text);
  });

  it('skips action blocks with invalid JSON', () => {
    const text = 'Before [MC_ACTION:create_job]{bad json here}[/MC_ACTION] After';
    const { cleanText, actions } = parseActions(text);
    expect(actions).toHaveLength(0);
    // The block is still removed from cleanText
    expect(cleanText).toBe('Before  After');
  });

  it('handles create_task action', () => {
    const text = '[MC_ACTION:create_task]{"title":"Fix login bug","description":"Users can\'t log in","priority":2}[/MC_ACTION]';
    const { actions } = parseActions(text);
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('create_task');
    expect(actions[0].params).toEqual({
      title: 'Fix login bug',
      description: "Users can't log in",
      priority: 2,
    });
  });

  it('handles spawn_job action', () => {
    const text = '[MC_ACTION:spawn_job]{"title":"Research AI","prompt_text":"Research latest AI","engine":"claude","agent_name":"Scout"}[/MC_ACTION]';
    const { actions } = parseActions(text);
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('spawn_job');
    expect(actions[0].params).toHaveProperty('agent_name', 'Scout');
  });

  it('handles code_change action', () => {
    const text = '[MC_ACTION:code_change]{"description":"Fix the navbar","files":"components/Navbar.tsx","reason":"Layout broken on mobile"}[/MC_ACTION]';
    const { actions } = parseActions(text);
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('code_change');
  });

  it('cleans up excess newlines after removing actions', () => {
    const text = 'Hello.\n\n\n[MC_ACTION:check_status]{}[/MC_ACTION]\n\n\nGoodbye.';
    const { cleanText } = parseActions(text);
    // Should collapse triple+ newlines to double
    expect(cleanText).not.toMatch(/\n{3,}/);
    expect(cleanText).toContain('Hello.');
    expect(cleanText).toContain('Goodbye.');
  });

  it('handles empty params object', () => {
    const text = '[MC_ACTION:check_status]{}[/MC_ACTION]';
    const { actions } = parseActions(text);
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('check_status');
    expect(actions[0].params).toEqual({});
  });

  it('handles action blocks with nested JSON', () => {
    const text = '[MC_ACTION:plan_project]{"project_name":"MyApp","tasks":[{"title":"Task 1"},{"title":"Task 2"}]}[/MC_ACTION]';
    const { actions } = parseActions(text);
    expect(actions).toHaveLength(1);
    expect(actions[0].params).toHaveProperty('tasks');
    expect((actions[0].params as Record<string, unknown>).tasks).toHaveLength(2);
  });
});
