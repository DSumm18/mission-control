import { NextResponse } from 'next/server'
import { readJson } from '../../lib/data'

export async function GET() {
  const data = await readJson('revenue', { target: { amount: 0 }, current: { total: 0, daily: [] } })
  const now = new Date('2026-02-17T00:00:00Z')
  const deadline = new Date(data.target.deadline)
  const msPerDay = 1000 * 60 * 60 * 24
  const daysLeft = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / msPerDay))
  const remaining = Math.max(0, (data.target.amount || 0) - (data.current.total || 0))
  const dailyNeeded = daysLeft ? Math.ceil(remaining / daysLeft) : remaining

  return NextResponse.json({ ...data, computed: { daysLeft, dailyNeeded } })
}
