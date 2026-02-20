import { relativeTime } from '../lib/utils'
import Panel from './Panel'

const badgeColor = {
  planning: 'bg-slate-700 text-slate-200',
  'in development': 'bg-blue-900 text-blue-300',
  beta: 'bg-amber-900 text-amber-300',
  live: 'bg-emerald-900 text-emerald-300',
  paused: 'bg-red-900 text-red-300',
}

const healthColor = {
  green: 'bg-emerald-400',
  yellow: 'bg-amber-400',
  red: 'bg-red-400',
}

export default function ProductStatusCards({ data }) {
  return (
    <Panel title="Product Status" right={<span className="text-xs text-slate-500">{data.length} products</span>}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {data.map((item) => (
          <article key={item.id} className="rounded border border-slate-800 bg-slate-950/70 p-3 text-xs">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-100">{item.name}</h3>
              <span className={`rounded px-2 py-0.5 uppercase ${badgeColor[item.status] || badgeColor.planning}`}>{item.status}</span>
            </div>
            <div className="space-y-1 text-slate-400">
              <div>Revenue: £{item.revenue} / £{item.revenueTarget}</div>
              <div>Users: {item.users}</div>
              <div className="flex items-center gap-2">Health: <span className={`h-2.5 w-2.5 rounded-full ${healthColor[item.health] || healthColor.yellow}`} /></div>
              <div>Blockers: {item.blockers?.length ? item.blockers.join(', ') : 'None'}</div>
              <div>Last deploy: {relativeTime(item.lastDeploy)}</div>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  )
}
