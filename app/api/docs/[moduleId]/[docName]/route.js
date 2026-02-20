import { NextResponse } from 'next/server'
import { readModuleDoc } from '../../../../lib/data'

export async function GET(_, { params }) {
  const allowed = ['RESEARCH.md', 'SPEC.md', 'TEST-CASES.md', 'QA-REPORT.md']
  if (!allowed.includes(params.docName)) {
    return NextResponse.json({ error: 'Invalid doc name', status: 400 }, { status: 400 })
  }

  const content = await readModuleDoc(params.moduleId, params.docName)
  if (!content) {
    return NextResponse.json({ error: 'Document not found', status: 404 }, { status: 404 })
  }

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  })
}
