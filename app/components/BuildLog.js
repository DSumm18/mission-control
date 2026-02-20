import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell } from 'recharts'
import { formatTime } from '../lib/utils'
import Panel from './Panel'

const categoryColor = {
  spec: '#fbbf24',
  tool: '#60a5fa',
  resource: '#a78bfa',
  auth: '#f87171',
  test: '#fb7185',
  unknown: '#94a3b8',
}

export default function BuildLog({ rows, stats }) {
  const pieData = Object.entries(stats?.failureBreakdown || {}).map(([name, value]) => ({ name, value }))

  return (
    <Panel title="Build Log" right={<span className="text-xs text-slate-500">Last 20 builds</span>}>
      <div className="mb-3 grid grid-cols-2 gap-2 text-xs lg:grid-cols-4">
        <div className="rounded border border-slate-800 bg-slate-950/70 p-2">Today: <span className="text-slate-200">{stats?.total || 0}</span></div>
        <div className="rounded border border-slate-800 bg-slate-950/70 p-2">Pass: <span className="text-emerald-400">{stats?.pass || 0}</span></div>
        <div className="rounded border border-slate-800 bg-slate-950/70 p-2">Fail: <span className="text-red-400">{stats?.fail || 0}</span></div>
        <div className="rounded border border-slate-800 bg-slate-950/70 p-2">Success: <span className="text-cyan-400">{stats?.passRate || 0}%</span></div>
      </div>
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="uppercase tracking-wider text-slate-500">
              <tr>
                <th className="pb-2 text-left">Time</th>
                <th className="pb-2 text-left">Module</th>
                <th className="pb-2 text-left">Tool</th>
                <th className="pb-2 text-left">Result</th>
                <th className="pb-2 text-left">Category</th>
                <th className="pb-2 text-right">Dur</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-800">
                  <td className="py-2 font-mono text-slate-400">{formatTime(row.timestamp)}</td>
                  <td className="py-2 text-slate-200">{row.module}</td>
                  <td className="py-2 text-slate-400">{row.tool}</td>
                  <td className={`py-2 font-medium ${row.result === 'pass' ? 'text-emerald-400' : 'text-red-400'}`}>{row.result.toUpperCase()}</td>
                  <td className="py-2">
                    {row.failureCategory ? <span className="rounded border border-slate-700 px-1 text-[10px] uppercase text-slate-300">{row.failureCategory}</span> : '—'}
                  </td>
                  <td className="py-2 text-right text-slate-400">{Math.round(row.durationMs / 1000)}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="h-40 rounded border border-slate-800 bg-slate-950/70 p-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={55} innerRadius={25}>
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={categoryColor[entry.name] || '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Panel>
  )
}
