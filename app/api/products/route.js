import { NextResponse } from 'next/server'
import { readJson } from '../../lib/data'

export async function GET() {
  const data = await readJson('products', { products: [] })
  return NextResponse.json(data)
}
