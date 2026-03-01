import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Mirror the CreateBody schema from app/api/jobs/route.ts
const CreateBody = z.object({
  title: z.string().min(1),
  engine: z.enum(['claude', 'gemini', 'openai', 'shell']),
  repo_path: z.string().min(1),
  prompt_text: z.string().min(1),
  output_dir: z.string().min(1),
  agent_id: z.string().uuid().nullable().optional(),
  parent_job_id: z.string().uuid().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  priority: z.number().int().min(1).max(10).optional(),
  job_type: z.enum(['task', 'decomposition', 'review', 'integration', 'pm']).optional(),
  source: z.enum(['dashboard', 'telegram', 'cron', 'orchestrator', 'api']).optional(),
});

const VALID_JOB = {
  title: 'Test job',
  engine: 'shell' as const,
  repo_path: '/tmp/test',
  prompt_text: 'echo hello',
  output_dir: '/tmp/out',
};

describe('Job creation schema', () => {
  it('accepts a minimal valid job', () => {
    const result = CreateBody.safeParse(VALID_JOB);
    expect(result.success).toBe(true);
  });

  it('accepts all optional fields', () => {
    const result = CreateBody.safeParse({
      ...VALID_JOB,
      agent_id: '550e8400-e29b-41d4-a716-446655440000',
      parent_job_id: '550e8400-e29b-41d4-a716-446655440001',
      project_id: '550e8400-e29b-41d4-a716-446655440002',
      priority: 3,
      job_type: 'task',
      source: 'telegram',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty title', () => {
    const result = CreateBody.safeParse({ ...VALID_JOB, title: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing title', () => {
    const { title, ...noTitle } = VALID_JOB;
    const result = CreateBody.safeParse(noTitle);
    expect(result.success).toBe(false);
  });

  it('rejects invalid engine', () => {
    const result = CreateBody.safeParse({ ...VALID_JOB, engine: 'gpt4' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid engines', () => {
    for (const engine of ['claude', 'gemini', 'openai', 'shell']) {
      const result = CreateBody.safeParse({ ...VALID_JOB, engine });
      expect(result.success).toBe(true);
    }
  });

  it('rejects empty repo_path', () => {
    const result = CreateBody.safeParse({ ...VALID_JOB, repo_path: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty prompt_text', () => {
    const result = CreateBody.safeParse({ ...VALID_JOB, prompt_text: '' });
    expect(result.success).toBe(false);
  });

  it('rejects priority below 1', () => {
    const result = CreateBody.safeParse({ ...VALID_JOB, priority: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects priority above 10', () => {
    const result = CreateBody.safeParse({ ...VALID_JOB, priority: 11 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer priority', () => {
    const result = CreateBody.safeParse({ ...VALID_JOB, priority: 3.5 });
    expect(result.success).toBe(false);
  });

  it('rejects invalid agent_id (not UUID)', () => {
    const result = CreateBody.safeParse({ ...VALID_JOB, agent_id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('accepts null agent_id', () => {
    const result = CreateBody.safeParse({ ...VALID_JOB, agent_id: null });
    expect(result.success).toBe(true);
  });

  it('rejects invalid job_type', () => {
    const result = CreateBody.safeParse({ ...VALID_JOB, job_type: 'research' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid source', () => {
    const result = CreateBody.safeParse({ ...VALID_JOB, source: 'manual' });
    expect(result.success).toBe(false);
  });
});
