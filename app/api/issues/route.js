import { NextResponse } from 'next/server'
import { readJson } from '../../lib/data'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const severity = searchParams.get('severity')
  const product = searchParams.get('product')

  const data = await readJson('issues', { issues: [] })
  let issues = data.issues || []

  if (status) issues = issues.filter((item) => item.status === status)
  if (severity) issues = issues.filter((item) => item.severity === severity)
  if (product) issues = issues.filter((item) => item.product === product)

  return NextResponse.json({ issues })
}
