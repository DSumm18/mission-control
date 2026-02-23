# Mission Control — Baseline Check Adoption Plan

## Current state
- `security:baseline-check` script: MISSING
- `mat:gate-check` script: MISSING

## Minimal adoption (recommended now)
Add two npm scripts in Mission Control:
- `security:baseline-check`
- `mat:gate-check`

Implement as lightweight local scripts first (no monorepo dependency coupling), then migrate to shared package once stable.

## Why this path
- Fastest unblock for release hygiene
- Keeps MC independent while auth/key issue is being resolved
- Avoids over-engineering before usage stabilises

## Definition of done
- Scripts exist and run in CI/local
- Baseline check fails on known policy violations
- MAT gate check is enforced pre-release
