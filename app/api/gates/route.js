import { NextResponse } from 'next/server'
import { canRelease, readJson } from '../../lib/data'

export async function GET() {
  const data = await readJson('gates', { modules: [], lastUpdated: null })
  const modules = (data.modules || []).map((module) => {
    const releaseAllowed = canRelease(module)
    return {
      ...module,
      releaseBlocked: module.releaseBlocked || !releaseAllowed,
      blockReason: module.blockReason || (!releaseAllowed ? 'Release gate requires all docs + G1-G4 passed' : null),
    }
  })

  return NextResponse.json({ ...data, modules })
}
