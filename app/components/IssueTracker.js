import { relativeTime } from '../lib/utils'
import Panel from './Panel'

const severityColor = {
  critical: 'text-red-400',
  high: 'text-rose-400',
  medium: 'text-amber-400',
  low: 'text-emerald-400',
}

export default function IssueTracker({ issues }) {
  const open = issues.filter((issue) => issue.status === 'open' || issue.status === 'blocked')
  const critical = open.filter((issue) => issue.severity === 'critical').length
  const high = open.filter((issue) => issue.severity === 'high').length
  const medium = open.filter((issue) => issue.severity === 'medium').length

  return (
    <Panel title="Issue Tracker" right={<span className="text-xs text-slate-500">{open.length} open</span>}>
      <div className="mb-2 text-xs text-slate-400">{critical} critical · {high} high · {medium} medium</div>
      <div className="space-y-2">
        {open.slice(0, 4).map((issue) => (
          <div key={issue.id} className="rounded border border-slate-800 bg-slate-950/70 p-2 text-xs">
            <div className={`font-medium ${severityColor[issue.severity] || severityColor.low}`}>{issue.id} {issue.title}</div>
            <div className="text-slate-500">{issue.product} · {issue.assignee} · {relativeTime(issue.createdAt)}</div>
          </div>
        ))}
      </div>
    </Panel>
  )
}
