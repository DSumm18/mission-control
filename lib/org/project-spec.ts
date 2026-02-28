/**
 * Structured project specifications — Zod schemas, parsers, and prompt formatters.
 *
 * Uses the existing delivery_plan JSONB column (no migration needed).
 * Backward compatible: old {milestones:[...]} format still works.
 */

import { z } from 'zod';

// ---------- Schemas ----------

export const ConstraintSchema = z.object({
  musts: z.array(z.string()).default([]),
  must_nots: z.array(z.string()).default([]),
  preferences: z.array(z.string()).default([]),
  escalation: z.array(z.string()).default([]),
});

export const MilestoneSchema = z.object({
  name: z.string(),
  target: z.string().optional(),
  status: z.string().default('not_started'),
  acceptance_criteria: z.array(z.string()).default([]),
  features: z.array(z.string()).default([]),
  constraints: ConstraintSchema.optional(),
});

export const EvaluationSchema = z.object({
  build_must_pass: z.boolean().default(true),
  test_command: z.string().optional(),
  verify_url: z.string().optional(),
});

export const ProjectSpecSchema = z.object({
  overview: z.string().optional(),
  target_audience: z.string().optional(),
  tech_stack: z.array(z.string()).default([]),
  revenue_model: z.string().optional(),
  current_status: z.string().optional(),
  key_blockers: z.array(z.string()).default([]),
  milestones: z.array(MilestoneSchema).default([]),
  decomposition_pattern: z.string().optional(),
  evaluation: EvaluationSchema.optional(),
});

export type ProjectSpec = z.infer<typeof ProjectSpecSchema>;
export type Milestone = z.infer<typeof MilestoneSchema>;
export type Constraint = z.infer<typeof ConstraintSchema>;

export const MasterIntentSchema = z.object({
  business_goals: z.array(z.string()).default([]),
  revenue_target: z.string().optional(),
  priority_order: z.array(z.string()).default([]),
  trade_off_hierarchy: z.array(z.string()).default([]),
  decision_boundaries: z.object({
    agent_autonomy: z.array(z.string()).default([]),
    escalate_to_david: z.array(z.string()).default([]),
  }).optional(),
  quality_standards: z.record(z.array(z.string())).optional(),
  escalation_rules: z.array(z.string()).default([]),
});

export type MasterIntent = z.infer<typeof MasterIntentSchema>;

// ---------- Parser ----------

/**
 * Safely parse delivery_plan JSONB into a ProjectSpec.
 * Handles old format ({milestones:[...]}) and new structured format.
 */
export function parseProjectSpec(raw: unknown): ProjectSpec {
  if (!raw || typeof raw !== 'object') {
    return { tech_stack: [], key_blockers: [], milestones: [] };
  }

  // Old format: just { milestones: [...] } with simple milestone objects
  const obj = raw as Record<string, unknown>;
  if (obj.milestones && !obj.overview && !obj.tech_stack) {
    // Legacy — wrap milestones into spec shape
    const milestones = Array.isArray(obj.milestones)
      ? obj.milestones.map((m: Record<string, unknown>) => ({
          name: String(m.name || ''),
          target: m.target ? String(m.target) : undefined,
          status: String(m.status || 'not_started'),
          acceptance_criteria: [],
          features: [],
        }))
      : [];
    return { tech_stack: [], key_blockers: [], milestones };
  }

  // New structured format
  const result = ProjectSpecSchema.safeParse(raw);
  if (result.success) return result.data;

  // Partial parse fallback — extract what we can
  return ProjectSpecSchema.parse({});
}

// ---------- Prompt Formatters ----------

interface FormatSpecOptions {
  includeConstraints?: boolean;
  activeMilestoneOnly?: boolean;
}

/**
 * Render a ProjectSpec as structured text for agent context.
 */
export function formatSpecForPrompt(
  spec: ProjectSpec,
  projectName?: string,
  opts: FormatSpecOptions = {},
): string {
  const lines: string[] = [];

  if (projectName) lines.push(`## Project Specification: ${projectName}`);

  if (spec.overview) {
    lines.push('', `**Overview:** ${spec.overview}`);
  }
  if (spec.target_audience) {
    lines.push(`**Target Audience:** ${spec.target_audience}`);
  }
  if (spec.tech_stack.length > 0) {
    lines.push(`**Tech Stack:** ${spec.tech_stack.join(', ')}`);
  }
  if (spec.revenue_model) {
    lines.push(`**Revenue Model:** ${spec.revenue_model}`);
  }
  if (spec.current_status) {
    lines.push(`**Current Status:** ${spec.current_status}`);
  }
  if (spec.key_blockers.length > 0) {
    lines.push('', '**Key Blockers:**');
    for (const b of spec.key_blockers) lines.push(`- ${b}`);
  }

  // Milestones
  const milestones = opts.activeMilestoneOnly
    ? spec.milestones.filter(m => m.status !== 'done').slice(0, 1)
    : spec.milestones;

  if (milestones.length > 0) {
    lines.push('', '**Milestones:**');
    for (const m of milestones) {
      lines.push(`\n### ${m.name} [${m.status}]${m.target ? ` — target: ${m.target}` : ''}`);

      if (m.acceptance_criteria.length > 0) {
        lines.push('Acceptance Criteria:');
        for (const ac of m.acceptance_criteria) lines.push(`- [ ] ${ac}`);
      }

      if (m.features.length > 0) {
        lines.push('Features:');
        for (const f of m.features) lines.push(`- ${f}`);
      }

      if (opts.includeConstraints !== false && m.constraints) {
        const c = m.constraints;
        if (c.musts.length > 0) {
          lines.push('MUST:');
          for (const r of c.musts) lines.push(`- ${r}`);
        }
        if (c.must_nots.length > 0) {
          lines.push('MUST NOT:');
          for (const r of c.must_nots) lines.push(`- ${r}`);
        }
        if (c.preferences.length > 0) {
          lines.push('Preferences:');
          for (const r of c.preferences) lines.push(`- ${r}`);
        }
        if (c.escalation.length > 0) {
          lines.push('Escalate if:');
          for (const r of c.escalation) lines.push(`- ${r}`);
        }
      }
    }
  }

  // Evaluation
  if (spec.evaluation) {
    lines.push('', '**Verification:**');
    if (spec.evaluation.build_must_pass) lines.push('- Build must pass before committing');
    if (spec.evaluation.test_command) lines.push(`- Run: \`${spec.evaluation.test_command}\``);
    if (spec.evaluation.verify_url) lines.push(`- Verify at: ${spec.evaluation.verify_url}`);
  }

  if (spec.decomposition_pattern) {
    lines.push('', `**Decomposition Pattern:** ${spec.decomposition_pattern}`);
  }

  return lines.join('\n');
}

/**
 * Render master intent as structured text for agent context.
 */
export function formatMasterIntentForPrompt(intent: MasterIntent): string {
  const lines: string[] = ['## Mission Control — Master Intent'];

  if (intent.business_goals.length > 0) {
    lines.push('', '**Business Goals:**');
    for (const g of intent.business_goals) lines.push(`- ${g}`);
  }

  if (intent.revenue_target) {
    lines.push(`\n**Revenue Target:** ${intent.revenue_target}`);
  }

  if (intent.priority_order.length > 0) {
    lines.push(`**Priority Order:** ${intent.priority_order.join(' > ')}`);
  }

  if (intent.trade_off_hierarchy.length > 0) {
    lines.push('', '**Trade-off Hierarchy:**');
    for (const t of intent.trade_off_hierarchy) lines.push(`- ${t}`);
  }

  if (intent.decision_boundaries) {
    const db = intent.decision_boundaries;
    if (db.agent_autonomy.length > 0) {
      lines.push('', '**Agent Can Autonomously:**');
      for (const a of db.agent_autonomy) lines.push(`- ${a}`);
    }
    if (db.escalate_to_david.length > 0) {
      lines.push('', '**Escalate to David:**');
      for (const e of db.escalate_to_david) lines.push(`- ${e}`);
    }
  }

  if (intent.quality_standards) {
    lines.push('', '**Quality Standards:**');
    for (const [area, rules] of Object.entries(intent.quality_standards)) {
      lines.push(`${area}:`);
      for (const r of rules) lines.push(`  - ${r}`);
    }
  }

  if (intent.escalation_rules.length > 0) {
    lines.push('', '**Escalation Rules:**');
    for (const r of intent.escalation_rules) lines.push(`- ${r}`);
  }

  return lines.join('\n');
}
