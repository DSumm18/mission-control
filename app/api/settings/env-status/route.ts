import { NextResponse } from 'next/server';

const ENV_KEYS = [
  'MC_RUNNER_TOKEN',
  'OPENAI_API_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
] as const;

export async function GET() {
  const keys = ENV_KEYS.map((name) => ({
    name,
    set: !!process.env[name],
  }));

  return NextResponse.json({ keys });
}
