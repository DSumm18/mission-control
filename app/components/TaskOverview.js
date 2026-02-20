import Panel from './Panel'

const priorityColor = {
  high: 'text-red-400',
  medium: 'text-amber-400',
  low: 'text-emerald-400',
}

export default function TaskOverview({ tasks }) {
  const total = tasks.length
  const overdue = tasks.filter((task) => task.status === 'overdue').length
  const progress = tasks.filter((task) => task.status === 'in-progress').length
  const done = tasks.filter((task) => task.status === 'done').length

  return (
    <Panel title="Task Overview" right={<span className="text-xs text-slate-500">{total} total</span>}>
      <div className="mb-2 text-xs text-slate-400">{overdue} overdue · {progress} in progress · {done} done</div>
      <div className="space-y-2">
        {tasks.slice(0, 4).map((task) => (
          <div key={task.id} className="rounded border border-slate-800 bg-slate-950/70 p-2 text-xs">
            <div className={`font-medium uppercase ${priorityColor[task.priority] || priorityColor.low}`}>{task.priority} · {task.title}</div>
            <div className="text-slate-500">{task.assignee} · {task.status}{task.dueDate ? ` · due ${task.dueDate}` : ''}</div>
          </div>
        ))}
      </div>
    </Panel>
  )
}
