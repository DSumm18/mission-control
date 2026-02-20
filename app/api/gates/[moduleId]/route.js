import { NextResponse } from 'next/server'
import { readJson, readModuleDoc } from '../../../lib/data'

const DOCS = ['RESEARCH.md', 'SPEC.md', 'TEST-CASES.md', 'QA-REPORT.md']

export async function GET(_, { params }) {
  const data = await readJson('gates', { modules: [] })
  const module = data.modules.find((item) => item.id === params.moduleId)

  if (!module) {
    return NextResponse.json({ error: 'Module not found', status: 404 }, { status: 404 })
  }

  const docs = {}
  for (const doc of DOCS) {
    const content = await readModuleDoc(params.moduleId, doc)
    docs[doc] = content
  }

  return NextResponse.json({ module, docs })
}
