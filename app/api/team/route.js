import { NextResponse } from 'next/server'
import { readJson } from '../../lib/data'

export async function GET() {
  const data = await readJson('team', { agents: [] })
  return NextResponse.json(data)
}
