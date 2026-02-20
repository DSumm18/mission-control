import { NextResponse } from 'next/server'
import { readJson } from '../../lib/data'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const limit = Number(searchParams.get('limit') || 20)
  const offset = Number(searchParams.get('offset') || 0)
  const module = searchParams.get('module')
  const result = searchParams.get('result')

  const data = await readJson('builds', { builds: [] })
  let builds = data.builds || []

  if (module) builds = builds.filter((item) => item.module === module)
  if (result) builds = builds.filter((item) => item.result === result)

  const total = builds.length
  const page = builds.slice(offset, offset + limit)

  return NextResponse.json({ total, limit, offset, builds: page })
}
