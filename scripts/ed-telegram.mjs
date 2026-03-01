#!/usr/bin/env node

/**
 * Ed Telegram Bridge
 *
 * Ed is the orchestrator agent for Mission Control.
 * Polls Telegram directly via getUpdates (long polling), processes messages
 * through Claude CLI as Ed, executes MC actions, responds on Telegram,
 * and stores conversation history in mc_telegram_messages.
 *
 * Managed by launchd: com.missioncontrol.ed-telegram
 *
 * Architecture:
 *   Telegram getUpdates → this script → Claude CLI → actions + response → Telegram
 *   All messages stored in mc_telegram_messages for audit + conversation context
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

// ── Config ──────────────────────────────────────────────────────────────

const ENV_PATH       = resolve(process.cwd(), '.env.local');
const MAX_HISTORY    = 20;             // messages to include in conversation context
const CLAUDE_CLI     = '/opt/homebrew/bin/claude';
const CLAUDE_TIMEOUT = 300_000;        // 300s max per response

// ── Load .env.local ─────────────────────────────────────────────────────

function loadEnv() {
  try {
    const lines = readFileSync(ENV_PATH, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch (err) {
    log(`WARN: could not load ${ENV_PATH}: ${err.message}`);
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOT_TOKEN    = process.env.TELEGRAM_BOT_TOKEN;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('FATAL: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}
if (!BOT_TOKEN) {
  console.error('FATAL: TELEGRAM_BOT_TOKEN must be set');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ── State ───────────────────────────────────────────────────────────────

let running = true;
let processing = false;
let lastUpdateId = 0;  // Telegram update offset for getUpdates

const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ── Helpers ─────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`${new Date().toISOString()} [ed-telegram] ${msg}`);
}

// ── Ed's System Prompt ──────────────────────────────────────────────────

function buildSystemPrompt(contextBlock) {
  return `You are Ed, the orchestrator agent for Mission Control — David Summers' AI operations platform.

## Who You Are
- David's right-hand AI assistant — think Jarvis, but for the whole product portfolio.
- You coordinate a team of specialist agents across ALL products.
- You're direct, proactive, and efficient. No waffle.
- You communicate like a sharp colleague, not a corporate chatbot.
- When David tells you to do something, you DO it by creating jobs — not just discuss it.

## What You Know
- **Product Portfolio** (priority order): MySongs, MyMeme, Schoolgle, DealFind, CricBook, ClawPhone.
- **Revenue target**: £10K/month combined by end March 2026.
- **Schoolgle**: EdTech platform for UK schools. Weekly newsletter "The Schoolgle Signal".
- **MySongs**: AI song generator. Claude + Suno API + Stripe.
- **MyMeme**: AI photo style transformation. Expo/React Native + Runware API. 127K+ photos.
- **DealFind**: Deal discovery engine. Node.js + Crawlee + Supabase.
- **CricBook**: Cricket social network. Next.js + Expo monorepo.
- **ClawPhone**: Voice-first iOS app. Swift native.
- Each project has structured specs with milestones, acceptance criteria, and constraints in its delivery_plan.

## Your Agent Team
- **Scout**: Research — finds, summarises, scores content relevance 1-10
- **Hawk**: Deep analysis — policy context, cross-references, implications
- **Megaphone**: Writer — newsletter sections, social copy
- **Builder**: Tool creator — interactive tools/snippets
- **Inspector**: QA — voice check, accuracy, AI-phrase detection
- **Publisher**: Deployment — releases
- **Pixel**: Design — visual assets, branding
- **Pulse**: Data analyst — insights, trends, projections

## CRITICAL: When to Act vs Talk
- If David asks you to DO something → create jobs/tasks immediately, don't just discuss
- If David asks for a status update → report what you know from MC state
- If David says something "needs doing" or "sort this out" → create the jobs NOW
- Only ask clarification if genuinely ambiguous — otherwise pick the obvious path and go

## How to Respond
- SHORT and punchy. This is Telegram, not an essay. 2-4 sentences for most replies.
- Emojis: use sparingly but effectively (✅ 🔍 📰 🎯 ⚡).
- If David shares a URL → assess what it's useful for, suggest angles.
- If David shares an idea → help develop it AND create the jobs to execute.
- If you need clarification → ask ONE focused question.
- When delegating → explain what + why in one line, and include the action.
- Be proactive — suggest connections and actions David hasn't thought of.

## Actions
When you need to execute something in Mission Control, include action blocks in your response.
Use this EXACT format — each on its own line:

### Create a job for any project (main action — use this for all product work)
[MC_ACTION:create_job]{"title":"...","prompt_text":"...","project_name":"MySongs","engine":"claude","priority":3}[/MC_ACTION]
- project_name: must match exactly — MySongs, MyMeme, Schoolgle, DealFind, CricBook, ClawPhone
- engine: "claude" (default), "gemini", or "shell"
- priority: 1 (highest) to 10 (lowest), default 3
- prompt_text: detailed instructions for the agent — include what to do, acceptance criteria, constraints

### Launch Claude Code in a project repo (for code changes)
[MC_ACTION:launch_claude]{"project_name":"MyMeme","task":"Fix the RUNWARE_API_KEY env var loading in production builds"}[/MC_ACTION]
- Creates a job with full project spec context, runs in the project's repo

### Research actions (for Schoolgle newsletter pipeline)
[MC_ACTION:create_research]{"url":"...","title":"...","content_type":"article","notes":"..."}[/MC_ACTION]
[MC_ACTION:queue_scout]{"research_item_id":"...","title":"...","url":"...","content_type":"article"}[/MC_ACTION]
[MC_ACTION:queue_hawk]{"research_item_id":"...","focus":"..."}[/MC_ACTION]
[MC_ACTION:queue_draft]{"newsletter_id":"..."}[/MC_ACTION]

### Task management
[MC_ACTION:create_task]{"title":"...","description":"...","project_name":"MySongs","priority":3}[/MC_ACTION]

### System health check
[MC_ACTION:health_check]{}[/MC_ACTION]
-> Runs diagnostics across all MC subsystems: Supabase, job queue, stalled jobs, failures, scheduler, Telegram bridge, tunnel, agents, disk, notifications, pause flag. Returns pass/fail for each. Use when David asks "is everything working?" or "health check" or "systems check". Also run this proactively if you suspect something is broken.

Available content_types: article, youtube, govuk, pdf, social, manual

IMPORTANT RULES:
- When David asks for work to be done → ALWAYS include action blocks. Don't just talk about it.
- Use create_job for research, analysis, specs, reviews across ANY product.
- Use launch_claude for actual code changes in a project repo.
- You can include MULTIPLE actions in one response — create several jobs at once if needed.
- When creating research from a shared URL, create_research first, then queue_scout.

${contextBlock}`;
}

// ── MC Context (live state) ─────────────────────────────────────────────

async function buildContextBlock() {
  let ctx = '\n## Current MC State\n';

  try {
    // Products with specs and blockers
    const { data: projects } = await sb
      .from('mc_projects')
      .select('id, name, status, revenue_target_monthly, delivery_plan, description, repo_path')
      .eq('status', 'active')
      .order('revenue_target_monthly', { ascending: false });

    if (projects?.length) {
      const totalTarget = projects.reduce((s, p) => s + (p.revenue_target_monthly || 0), 0);
      ctx += `\nProduct Portfolio (£${totalTarget.toLocaleString()}/mo target):\n`;
      for (const p of projects) {
        const dp = p.delivery_plan || {};
        const milestones = dp.milestones || [];
        const nextMs = milestones.find(m => m.status !== 'done');
        const blockers = dp.key_blockers || [];
        ctx += `- **${p.name}** — £${p.revenue_target_monthly || 0}/mo${p.repo_path ? ` [repo: ${p.repo_path}]` : ' [NO REPO]'}`;
        if (nextMs) ctx += ` → next: ${nextMs.name} [${nextMs.status}]`;
        ctx += ` (id: ${p.id})\n`;
        if (dp.current_status) ctx += `  Status: ${dp.current_status}\n`;
        if (blockers.length > 0) ctx += `  Blockers: ${blockers.join('; ')}\n`;
      }
    }

    // Active jobs
    const { data: jobs } = await sb
      .from('mc_jobs')
      .select('id, title, status, engine, project_id')
      .in('status', ['queued', 'running'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (jobs?.length) {
      ctx += `\nActive Jobs (${jobs.length}):\n`;
      for (const j of jobs) {
        const projName = projects?.find(p => p.id === j.project_id)?.name || '';
        ctx += `- [${j.status}] ${j.title}${projName ? ` (${projName})` : ''}\n`;
      }
    } else {
      ctx += '\nActive Jobs: none — queue is empty, ready for new work\n';
    }

    // Newsletters
    const { data: newsletters } = await sb
      .from('mc_newsletters')
      .select('id, week_no, title, pipeline_status')
      .order('week_no', { ascending: false })
      .limit(3);

    if (newsletters?.length) {
      ctx += '\nNewsletters:\n';
      for (const n of newsletters) {
        ctx += `- Week ${n.week_no}: "${n.title}" [${n.pipeline_status}] (id: ${n.id})\n`;
      }
    }

    // Pending research
    const { data: research } = await sb
      .from('mc_research_items')
      .select('id, title, status, relevance_score, content_type')
      .in('status', ['captured', 'assessing', 'assessed'])
      .order('created_at', { ascending: false })
      .limit(8);

    if (research?.length) {
      ctx += '\nPending Research:\n';
      for (const r of research) {
        ctx += `- [${r.status}] ${r.title || '(untitled)'} (${r.content_type}, score: ${r.relevance_score || '?'}/10, id: ${r.id})\n`;
      }
    }

    // Recent completed jobs for awareness
    const { data: recentDone } = await sb
      .from('mc_jobs')
      .select('title, status, project_id, completed_at')
      .eq('status', 'done')
      .order('completed_at', { ascending: false })
      .limit(5);

    if (recentDone?.length) {
      ctx += '\nRecently Completed:\n';
      for (const j of recentDone) {
        const projName = projects?.find(p => p.id === j.project_id)?.name || '';
        ctx += `- ${j.title}${projName ? ` (${projName})` : ''}\n`;
      }
    }

    ctx += `\nToday: ${new Date().toISOString().split('T')[0]}\n`;
  } catch (err) {
    ctx += `(Error loading state: ${err.message})\n`;
  }

  return ctx;
}

// ── Conversation History ────────────────────────────────────────────────

async function loadHistory(chatId) {
  const { data } = await sb
    .from('mc_telegram_messages')
    .select('role, from_name, content, created_at')
    .eq('chat_id', chatId)
    .in('status', ['replied', 'sent'])
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORY);

  // Reverse to chronological order
  return (data || []).reverse();
}

function formatHistory(history) {
  if (!history.length) return '';
  const lines = history.map(m => {
    const name = m.role === 'user' ? 'David' : 'Ed';
    return `${name}: ${m.content}`;
  });
  return '\n## Recent Conversation\n' + lines.join('\n') + '\n';
}

// ── Claude CLI ──────────────────────────────────────────────────────────

function callClaude(systemPrompt, userMessage) {
  return new Promise((resolve, reject) => {
    const args = ['-p', '--system-prompt', systemPrompt];
    // Unset CLAUDECODE to allow nested CLI calls from launchd
    const env = { ...process.env };
    delete env.CLAUDECODE;
    const proc = spawn(CLAUDE_CLI, args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('Claude CLI timed out after ' + (CLAUDE_TIMEOUT / 1000) + 's'));
    }, CLAUDE_TIMEOUT);

    proc.stdin.write(userMessage);
    proc.stdin.end();

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 || stdout.length > 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`Claude CLI exited ${code}: ${stderr.slice(0, 500)}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// ── Response Parsing ────────────────────────────────────────────────────

function parseResponse(text) {
  const actionRegex = /\[MC_ACTION:(\w+)\](.*?)\[\/MC_ACTION\]/gs;
  const actions = [];
  let match;

  while ((match = actionRegex.exec(text)) !== null) {
    try {
      actions.push({
        type: match[1],
        params: JSON.parse(match[2]),
      });
    } catch {
      log(`WARN: invalid action JSON: ${match[2].slice(0, 100)}`);
    }
  }

  // Remove action markers from text David sees
  const cleanText = text.replace(actionRegex, '').replace(/\n{3,}/g, '\n\n').trim();

  return { text: cleanText, actions };
}

// ── Action Execution ────────────────────────────────────────────────────

async function executeActions(actions, chatId) {
  const results = [];

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'create_research': {
          const p = action.params;
          const { data, error } = await sb
            .from('mc_research_items')
            .upsert({
              source_url: p.url,
              title: p.title || null,
              content_type: p.content_type || 'article',
              shared_by: 'david',
              status: 'captured',
              why_relevant: p.notes || null,
            }, { onConflict: 'source_url' })
            .select('id')
            .single();
          if (error) throw error;
          results.push({ type: 'create_research', id: data.id, ok: true });
          log(`ACTION: created research item ${data.id} for ${p.url}`);
          break;
        }

        case 'queue_scout': {
          const p = action.params;
          // Find Scout agent
          const { data: scout } = await sb
            .from('mc_agents')
            .select('id')
            .eq('name', 'Scout')
            .single();

          // Find or use provided research item
          let researchId = p.research_item_id;
          if (!researchId && p.url) {
            const { data: ri } = await sb
              .from('mc_research_items')
              .select('id')
              .eq('source_url', p.url)
              .single();
            researchId = ri?.id;
          }

          const { data: job, error } = await sb
            .from('mc_jobs')
            .insert({
              title: `Assess: ${p.title || p.url || 'Research item'}`,
              prompt_text: `Assess this content for the Schoolgle Signal newsletter. URL: ${p.url || 'N/A'}. Content type: ${p.content_type || 'article'}. Summarise the key points, score relevance 1-10 for UK school leaders, suggest a newsletter angle, and explain WHY it matters.`,
              repo_path: '/Users/david/.openclaw/workspace/mission-control',
              engine: 'claude',
              status: 'queued',
              priority: 1,
              agent_id: scout?.id || null,
            })
            .select('id')
            .single();
          if (error) throw error;

          // Update research item status
          if (researchId) {
            await sb.from('mc_research_items')
              .update({ assessment_job_id: job.id, status: 'assessing' })
              .eq('id', researchId);
          }

          results.push({ type: 'queue_scout', job_id: job.id, ok: true });
          log(`ACTION: queued Scout job ${job.id}`);
          break;
        }

        case 'queue_hawk': {
          const p = action.params;
          const { data: hawk } = await sb
            .from('mc_agents')
            .select('id')
            .eq('name', 'Hawk')
            .single();

          const { data: job, error } = await sb
            .from('mc_jobs')
            .insert({
              title: `Deep Dive: ${p.focus || 'Analysis'}`,
              prompt_text: `Deep analysis for Schoolgle Signal: ${p.focus || 'General analysis'}. Provide policy context, cross-references with DfE data, implications for UK school leaders, and actionable recommendations.${p.research_item_id ? ` Research item: ${p.research_item_id}` : ''}`,
              repo_path: '/Users/david/.openclaw/workspace/mission-control',
              engine: 'claude',
              status: 'queued',
              priority: 1,
              agent_id: hawk?.id || null,
            })
            .select('id')
            .single();
          if (error) throw error;
          results.push({ type: 'queue_hawk', job_id: job.id, ok: true });
          log(`ACTION: queued Hawk job ${job.id}`);
          break;
        }

        case 'create_job': {
          const p = action.params;
          // Resolve project_name to project_id
          let projectId = null;
          let repoPath = '/Users/david/.openclaw/workspace/mission-control';
          if (p.project_name) {
            const { data: proj } = await sb
              .from('mc_projects')
              .select('id, repo_path')
              .ilike('name', p.project_name)
              .single();
            if (proj) {
              projectId = proj.id;
              if (proj.repo_path) repoPath = proj.repo_path;
            }
          }

          const { data: job, error } = await sb
            .from('mc_jobs')
            .insert({
              title: p.title,
              prompt_text: p.prompt_text || p.title,
              repo_path: repoPath,
              engine: p.engine || 'claude',
              status: 'queued',
              priority: p.priority || 3,
              job_type: p.job_type || 'task',
              source: 'dashboard',
              project_id: projectId,
            })
            .select('id')
            .single();
          if (error) throw error;
          results.push({ type: 'create_job', job_id: job.id, project: p.project_name || 'none', ok: true });
          log(`ACTION: created job ${job.id} for ${p.project_name || 'MC'}: ${p.title}`);
          break;
        }

        case 'launch_claude': {
          const p = action.params;
          // Resolve project
          const { data: proj } = await sb
            .from('mc_projects')
            .select('id, name, repo_path, delivery_plan, description, revenue_target_monthly')
            .ilike('name', p.project_name)
            .single();

          if (!proj) {
            results.push({ type: 'launch_claude', ok: false, error: `Project "${p.project_name}" not found` });
            log(`ACTION ERROR: launch_claude — project "${p.project_name}" not found`);
            break;
          }
          if (!proj.repo_path) {
            results.push({ type: 'launch_claude', ok: false, error: `No repo_path for ${proj.name}` });
            log(`ACTION ERROR: launch_claude — no repo_path for ${proj.name}`);
            break;
          }

          // Build spec-aware prompt (mirrors launch-claude route logic)
          const dp = proj.delivery_plan || {};
          const milestones = dp.milestones || [];
          const activeMilestone = milestones.find(m => m.status !== 'done');
          const specLines = [];
          if (dp.overview) specLines.push(`Overview: ${dp.overview}`);
          if (dp.tech_stack?.length) specLines.push(`Tech Stack: ${dp.tech_stack.join(', ')}`);
          if (dp.current_status) specLines.push(`Current Status: ${dp.current_status}`);
          if (dp.key_blockers?.length) specLines.push(`Blockers: ${dp.key_blockers.join('; ')}`);
          if (activeMilestone) {
            specLines.push(`\nActive Milestone: ${activeMilestone.name} [${activeMilestone.status}]`);
            if (activeMilestone.acceptance_criteria?.length) {
              specLines.push('Acceptance Criteria:');
              for (const ac of activeMilestone.acceptance_criteria) specLines.push(`- [ ] ${ac}`);
            }
          }
          const evalBlock = [];
          if (dp.evaluation?.build_must_pass) evalBlock.push('Build MUST pass before committing.');
          if (dp.evaluation?.test_command) evalBlock.push(`Run tests: ${dp.evaluation.test_command}`);
          if (dp.evaluation?.verify_url) evalBlock.push(`Verify at: ${dp.evaluation.verify_url}`);

          const promptText = [
            `You are working on the project "${proj.name}".`,
            `Repo path: ${proj.repo_path}`,
            proj.description ? `Description: ${proj.description}` : '',
            proj.revenue_target_monthly ? `Revenue target: £${proj.revenue_target_monthly}/month` : '',
            '',
            ...specLines,
            '',
            `## Task`,
            p.task,
            '',
            `## Working Instructions`,
            'Work in the project repo. Make changes, run tests, and commit when done.',
            ...evalBlock,
            'If you encounter issues, document them clearly.',
          ].filter(Boolean).join('\n');

          const { data: job, error } = await sb
            .from('mc_jobs')
            .insert({
              title: `[${proj.name}] ${p.task.slice(0, 100)}`,
              prompt_text: promptText,
              engine: 'claude',
              status: 'queued',
              priority: p.priority || 3,
              job_type: 'task',
              source: 'dashboard',
              project_id: proj.id,
              repo_path: proj.repo_path,
            })
            .select('id')
            .single();
          if (error) throw error;
          results.push({ type: 'launch_claude', job_id: job.id, project: proj.name, ok: true });
          log(`ACTION: launched claude job ${job.id} for ${proj.name}: ${p.task.slice(0, 80)}`);
          break;
        }

        case 'create_task': {
          const p = action.params;
          // Resolve project_name to project_id if provided
          let projectId = null;
          if (p.project_name) {
            const { data: proj } = await sb
              .from('mc_projects')
              .select('id')
              .ilike('name', p.project_name)
              .single();
            if (proj) projectId = proj.id;
          }

          const { data: task, error } = await sb
            .from('mc_tasks')
            .insert({
              title: p.title,
              description: p.description || '',
              status: 'todo',
              priority: p.priority || 5,
              project_id: projectId,
            })
            .select('id')
            .single();
          if (error) throw error;
          results.push({ type: 'create_task', task_id: task.id, ok: true });
          log(`ACTION: created task ${task.id}${p.project_name ? ` for ${p.project_name}` : ''}`);
          break;
        }

        case 'queue_draft': {
          const p = action.params;
          const { data: ed } = await sb
            .from('mc_agents')
            .select('id')
            .eq('name', 'Ed')
            .single();

          const { data: job, error } = await sb
            .from('mc_jobs')
            .insert({
              title: `Generate Draft: Newsletter ${p.newsletter_id}`,
              prompt_text: `Decompose newsletter ${p.newsletter_id} into sections. Review approved research items and generate a draft plan with sections: headline, lead_story, data_snapshot, tool_spotlight, policy_watch, quick_wins, week_ahead.`,
              repo_path: '/Users/david/.openclaw/workspace/mission-control',
              engine: 'claude',
              status: 'queued',
              priority: 1,
              agent_id: ed?.id || null,
            })
            .select('id')
            .single();
          if (error) throw error;
          results.push({ type: 'queue_draft', job_id: job.id, ok: true });
          log(`ACTION: queued draft generation job ${job.id}`);
          break;
        }

        case 'health_check': {
          const baseUrl = process.env.MC_SERVER_URL || 'http://localhost:3000';
          const res = await fetch(`${baseUrl}/api/health`, {
            signal: AbortSignal.timeout(15000),
          });
          const health = await res.json();
          const checks = health.checks || [];
          const summary = checks
            .map(c => `${c.ok ? 'OK' : 'FAIL'} ${c.name}: ${c.detail}`)
            .join('\n');
          results.push({
            type: 'health_check',
            ok: health.ok,
            summary,
            passed: health.passed,
            failed: health.failed,
            total: health.total,
          });
          log(`ACTION: health check — ${health.passed}/${health.total} passed`);
          break;
        }

        default:
          log(`WARN: unknown action type: ${action.type}`);
      }
    } catch (err) {
      log(`ERROR executing action ${action.type}: ${err.message}`);
      results.push({ type: action.type, ok: false, error: err.message });
    }
  }

  return results;
}

// ── Telegram API ────────────────────────────────────────────────────────

async function sendTelegram(chatId, text) {
  if (!BOT_TOKEN || !text) return;

  // Telegram message limit is 4096 chars — split if needed
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= 4096) {
      chunks.push(remaining);
      break;
    }
    // Find a good split point
    let splitAt = remaining.lastIndexOf('\n', 4096);
    if (splitAt < 2000) splitAt = 4096;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }

  for (const chunk of chunks) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        parse_mode: 'Markdown',
      }),
    }).catch(async () => {
      // Fallback: send without Markdown if parsing fails
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: chunk }),
      }).catch(() => {});
    });
  }
}

async function sendChatAction(chatId, action) {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action }),
  }).catch(() => {});
}

// ── Message Processing ──────────────────────────────────────────────────

async function processMessage(msg) {
  const startTime = Date.now();
  log(`processing message from ${msg.from_name}: "${(msg.content || '').slice(0, 80)}..."`);

  // 1. Mark as processing
  await sb.from('mc_telegram_messages')
    .update({ status: 'processing' })
    .eq('id', msg.id);

  // 2. Send typing indicator
  await sendChatAction(msg.chat_id, 'typing');

  try {
    // 3. Load conversation history
    const history = await loadHistory(msg.chat_id);
    const historyText = formatHistory(history);

    // 4. Build live MC context
    const contextBlock = await buildContextBlock();

    // 5. Build system prompt with context
    const systemPrompt = buildSystemPrompt(contextBlock);

    // 6. Build user message with history
    let userMessage = '';
    if (historyText) {
      userMessage += historyText + '\n';
    }
    userMessage += `David: ${msg.content || '(empty message)'}`;

    // Add URL metadata if present
    const urls = msg.metadata?.urls;
    if (urls?.length) {
      userMessage += `\n\n[Shared URLs: ${urls.join(', ')}]`;
    }
    if (msg.photo_file_id) {
      userMessage += '\n\n[David shared a photo]';
    }

    userMessage += '\n\nRespond as Ed:';

    // 7. Refresh typing indicator periodically during Claude call
    const typingInterval = setInterval(() => {
      sendChatAction(msg.chat_id, 'typing');
    }, 4_000);

    // 8. Call Claude CLI
    let rawResponse;
    try {
      rawResponse = await callClaude(systemPrompt, userMessage);
    } finally {
      clearInterval(typingInterval);
    }

    // 9. Parse response and extract actions
    const { text, actions } = parseResponse(rawResponse);

    // 10. Execute MC actions
    let actionResults = [];
    if (actions.length > 0) {
      actionResults = await executeActions(actions, msg.chat_id);
      log(`executed ${actions.length} actions: ${actionResults.map(a => `${a.type}:${a.ok}`).join(', ')}`);
    }

    // 11. Send response to Telegram
    await sendTelegram(msg.chat_id, text);

    // 12. Store Ed's response
    await sb.from('mc_telegram_messages').insert({
      chat_id: msg.chat_id,
      from_name: 'ed',
      role: 'assistant',
      content: text,
      status: 'sent',
      actions_taken: actionResults,
    });

    // 13. Mark original as replied
    await sb.from('mc_telegram_messages')
      .update({ status: 'replied' })
      .eq('id', msg.id);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`replied in ${elapsed}s (${actions.length} actions)`);

  } catch (err) {
    log(`ERROR processing message ${msg.id}: ${err.message}`);

    // Mark as error
    await sb.from('mc_telegram_messages')
      .update({ status: 'error', error_message: err.message })
      .eq('id', msg.id);

    // Send error to David with context-specific message
    const isTimeout = err.message.includes('timed out');
    const errorMsg = isTimeout
      ? `⚡ That one took too long (>3 min). Try breaking it into smaller messages or I'll pick it up on a shorter prompt.`
      : `⚠️ Hit a snag: ${err.message.slice(0, 200)}\n\nI'll keep going on the next message.`;
    await sendTelegram(msg.chat_id, errorMsg);
  }
}

// ── Notification Delivery ────────────────────────────────────────────────

async function deliverNotifications() {
  try {
    // Find pending notifications not yet delivered via Telegram
    const { data: notifications } = await sb
      .from('mc_ed_notifications')
      .select('id, title, body, category, priority, metadata')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(5);

    if (!notifications?.length) return;

    // Find David's chat ID from recent messages
    const { data: recentMsg } = await sb
      .from('mc_telegram_messages')
      .select('chat_id')
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!recentMsg?.chat_id) return;

    for (const notif of notifications) {
      const icon = {
        job_complete: '✅',
        job_failed: '❌',
        decision_needed: '🤔',
        approval_needed: '✋',
        deploy_ready: '🚀',
        alert: '⚠️',
        info: 'ℹ️',
        reminder: '🔔',
      }[notif.category] || '📌';

      let text = `${icon} *${notif.title}*`;
      if (notif.body) text += `\n${notif.body.slice(0, 300)}`;

      // Urgent items get extra emphasis
      if (notif.priority === 'urgent') {
        text = `🔴 URGENT\n${text}`;
      }

      await sendTelegram(recentMsg.chat_id, text);

      // Mark as delivered via telegram
      const delivered_via = ['telegram'];
      await sb
        .from('mc_ed_notifications')
        .update({
          status: 'delivered',
          delivered_via,
          delivered_at: new Date().toISOString(),
        })
        .eq('id', notif.id);

      log(`NOTIFICATION: delivered ${notif.id} via telegram (${notif.category}/${notif.priority})`);
    }
  } catch (err) {
    // Non-critical — don't log spam
  }
}

// ── Telegram Polling ────────────────────────────────────────────────────

async function getUpdates() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35_000);

    const res = await fetch(`${TG_API}/getUpdates?offset=${lastUpdateId + 1}&timeout=30&allowed_updates=["message"]`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      log(`getUpdates HTTP ${res.status}`);
      return [];
    }

    const body = await res.json();
    if (!body.ok) return [];

    return body.result || [];
  } catch (err) {
    if (err.name !== 'AbortError') {
      log(`getUpdates error: ${err.message}`);
    }
    return [];
  }
}

function extractMessage(update) {
  const message = update.message;
  if (!message) return null;

  const text = message.text?.trim() || message.caption?.trim() || '';
  const from = message.from?.first_name || 'david';
  const chatId = message.chat.id;

  // Extract metadata
  const metadata = {};
  const urls = text.match(/https?:\/\/[^\s]+/g);
  if (urls) metadata.urls = urls;
  if (message.photo?.length > 0) {
    metadata.photo = message.photo[message.photo.length - 1];
  }
  if (message.document) metadata.document = message.document;

  return {
    chat_id: chatId,
    message_id: message.message_id,
    from_name: from.toLowerCase(),
    content: text,
    photo_file_id: message.photo?.[message.photo.length - 1]?.file_id || null,
    metadata,
  };
}

// ── Main Loop ───────────────────────────────────────────────────────────

async function loop() {
  log('started — Ed Telegram bridge is live (direct polling)');
  log(`Claude CLI: ${CLAUDE_CLI}`);

  while (running) {
    try {
      // 1. Long-poll Telegram for new messages
      const updates = await getUpdates();

      for (const update of updates) {
        lastUpdateId = update.update_id;

        const msg = extractMessage(update);
        if (!msg || !msg.content) continue;

        // 2. Store incoming message in DB for audit + history
        const { data: stored } = await sb.from('mc_telegram_messages').insert({
          chat_id: msg.chat_id,
          message_id: msg.message_id,
          from_name: msg.from_name,
          role: 'user',
          content: msg.content,
          photo_file_id: msg.photo_file_id,
          status: 'pending',
          metadata: msg.metadata,
        }).select('id, chat_id, content, from_name, photo_file_id, metadata').single();

        if (!stored) continue;

        // 3. Process through Ed
        await processMessage(stored);
      }

      // 4. Deliver pending notifications to David via Telegram
      await deliverNotifications();

    } catch (err) {
      log(`LOOP ERROR: ${err.message}`);
      await new Promise((r) => setTimeout(r, 5000)); // back off on error
    }
  }

  log('stopped');
}

// ── Graceful Shutdown ───────────────────────────────────────────────────

process.on('SIGTERM', () => { log('SIGTERM received'); running = false; });
process.on('SIGINT',  () => { log('SIGINT received');  running = false; });

loop();
