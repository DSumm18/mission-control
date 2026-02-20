import { NextResponse } from 'next/server'
import { readAuditLines } from '../../lib/data'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const limit = Number(searchParams.get('limit') || 20)
  const offset = Number(searchParams.get('offset') || 0)
  const search = (searchParams.get('search') || '').toLowerCase()
  const type = searchParams.get('type')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let rows = await readAuditLines()
  if (type) rows = rows.filter((item) => item.type === type)
  if (from) rows = rows.filter((item) => new Date(item.ts) >= new Date(from))
  if (to) rows = rows.filter((item) => new Date(item.ts) <= new Date(to))
  if (search) {
    rows = rows.filter((item) => JSON.stringify(item).toLowerCase().includes(search))
  }

  rows = rows.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())

  const total = rows.length
  const entries = rows.slice(offset, offset + limit)

  return NextResponse.json({ total, limit, offset, entries })
}
