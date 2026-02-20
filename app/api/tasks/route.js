import { NextResponse } from 'next/server'
import { parseTaskQueue, readJson, readText } from '../../lib/data'

export async function GET() {
  const md = await readText('tasksMd', '')
  const tasksFromMd = parseTaskQueue(md)
  const json = await readJson('tasksJson', { tasks: [] })
  const tasks = [...(json.tasks || []), ...tasksFromMd]
  return NextResponse.json({ tasks })
}
