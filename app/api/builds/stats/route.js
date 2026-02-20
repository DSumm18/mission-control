import { NextResponse } from 'next/server'
import { readJson } from '../../../lib/data'

export async function GET() {
  const data = await readJson('builds', { builds: [] })
  const builds = data.builds || []
  const pass = builds.filter((item) => item.result === 'pass').length
  const fail = builds.filter((item) => item.result === 'fail').length
  const failureBreakdown = builds.reduce((acc, item) => {
    if (item.result === 'fail') {
      const key = item.failureCategory || 'unknown'
      acc[key] = (acc[key] || 0) + 1
    }
    return acc
  }, {})

  return NextResponse.json({
    total: builds.length,
    pass,
    fail,
    passRate: builds.length ? Math.round((pass / builds.length) * 100) : 0,
    failureBreakdown,
  })
}
