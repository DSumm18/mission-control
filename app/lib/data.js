import { promises as fs } from 'fs'
import path from 'path'

const ROOT = process.cwd()
const DATA_DIR = path.join(ROOT, 'data')
const EXTERNAL_ROOT = '/Users/david/.openclaw/workspace'

const FILE_MAP = {
  gates: 'GATE-TRACKER.json',
  builds: 'BUILD-LOG.json',
  team: 'TEAM-STATUS.json',
  products: 'PRODUCT-STATUS.json',
  revenue: 'REVENUE.json',
  issues: 'ISSUES.json',
  audit: 'AUDIT-LOG.jsonl',
  tasksJson: 'TASKS.json',
  tasksMd: 'TASKQUEUE.md',
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function resolveFile(name) {
  const fileName = FILE_MAP[name]
  const localPath = path.join(DATA_DIR, fileName)
  if (await fileExists(localPath)) return localPath

  const externalPath = path.join(EXTERNAL_ROOT, fileName)
  if (await fileExists(externalPath)) return externalPath

  return localPath
}

export async function readJson(name, fallback = {}) {
  const target = await resolveFile(name)
  try {
    const raw = await fs.readFile(target, 'utf8')
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export async function readText(name, fallback = '') {
  const target = await resolveFile(name)
  try {
    return await fs.readFile(target, 'utf8')
  } catch {
    return fallback
  }
}

export async function readAuditLines() {
  const raw = await readText('audit', '')
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

export async function readModuleDoc(moduleId, docName) {
  const localPath = path.join(DATA_DIR, 'modules', moduleId, docName)
  if (await fileExists(localPath)) {
    return fs.readFile(localPath, 'utf8')
  }

  const externalPath = path.join(EXTERNAL_ROOT, 'schoolgle', 'modules', moduleId, docName)
  if (await fileExists(externalPath)) {
    return fs.readFile(externalPath, 'utf8')
  }

  return null
}

export function parseTaskQueue(markdown) {
  const lines = markdown.split('\n')
  const tasks = []

  lines.forEach((line, index) => {
    const match = line.match(/^- \[( |x)\] \[(HIGH|MED|LOW)\] (.+)$/i)
    if (!match) return

    const done = match[1].toLowerCase() === 'x'
    const priority = match[2].toLowerCase() === 'med' ? 'medium' : match[2].toLowerCase()
    const details = match[3].split('::').map((item) => item.trim())
    const title = details[0]
    const meta = Object.fromEntries(
      details.slice(1).map((token) => {
        const [key, value] = token.split('=')
        return [key, value]
      }),
    )

    tasks.push({
      id: `MD-${index + 1}`,
      title,
      priority,
      status: meta.status || (done ? 'done' : 'todo'),
      assignee: meta.assignee || 'Unassigned',
      dueDate: meta.due || null,
      product: 'schoolgle',
    })
  })

  return tasks
}

export function canRelease(module) {
  const docs = ['RESEARCH.md', 'SPEC.md', 'TEST-CASES.md', 'QA-REPORT.md']
  const docsReady = docs.every((doc) => module.docs?.[doc])
  const gatesReady = ['G1', 'G2', 'G3', 'G4'].every((gate) => module.gates?.[gate]?.status === 'passed')
  return docsReady && gatesReady
}
