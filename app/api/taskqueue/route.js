import fs from 'fs'
import path from 'path'

export async function GET(request) {
  try {
    const taskqueuePath = path.join(
      process.cwd(),
      '..',
      '..',
      'TASKQUEUE.md'
    )

    if (fs.existsSync(taskqueuePath)) {
      const content = fs.readFileSync(taskqueuePath, 'utf-8')
      // Parse basic markdown task list
      const tasks = []
      const lines = content.split('\n')
      
      lines.forEach((line, index) => {
        if (line.match(/^- \[[ x]\]/)) {
          const isCompleted = line.includes('[x]')
          const title = line.replace(/^- \[[^\]]\]\s*/, '')
          tasks.push({
            id: index,
            title: title,
            priority: 'medium',
            status: isCompleted ? 'completed' : 'pending'
          })
        }
      })

      return Response.json({ tasks })
    }
  } catch (error) {
    console.error('Error reading taskqueue:', error)
  }

  // Fallback to sample data
  return Response.json({
    tasks: [
      { id: 1, title: 'Fix ClawPhone auth bug', priority: 'high', status: 'in-progress' },
      { id: 2, title: 'Design MyMeme landing page', priority: 'medium', status: 'pending' },
      { id: 3, title: 'Set up MySongs API', priority: 'high', status: 'pending' },
      { id: 4, title: 'Review DealFind MVP', priority: 'medium', status: 'pending' },
      { id: 5, title: 'Update CricBook database', priority: 'low', status: 'pending' },
    ]
  })
}
