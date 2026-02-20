import { relativeTime } from '../lib/utils'
import Panel from './Panel'

const statusDot = {
  running: 'bg-emerald-400 animate-pulse',
  waiting: 'bg-amber-400',
  idle: 'bg-slate-500',
  error: 'bg-red-500',
}

export default function TeamActivity({ agents }) {
  const active = agents.filter((agent) => agent.status === 'running').length
  return (
    <Panel title="Team Activity" right={<span className="text-xs text-slate-500">{active} active</span>}>
      <div className="space-y-3">
        {agents.map((agent) => (
          <div key={agent.id} className="rounded border border-slate-800 bg-slate-950/70 p-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-200">
                <span className={`h-2.5 w-2.5 rounded-full ${statusDot[agent.status] || statusDot.idle}`} />
                {agent.name}
              </div>
              <span className="text-slate-500">{agent.status === 'idle' ? 'idle' : relativeTime(agent.lastSeen)}</span>
            </div>
            <div className="mt-1 text-slate-400">{agent.module || '—'} · {agent.currentTask}</div>
            <div className="text-slate-500">"{agent.lastOutput}"</div>
          </div>
        ))}
      </div>
    </Panel>
  )
}
