import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Line } from 'recharts'
import Panel from './Panel'

export default function RevenuePanel({ data }) {
  const rows = data?.current?.daily || []
  const total = data?.current?.total || 0
  const target = data?.target?.amount || 0
  const pct = target ? Math.round((total / target) * 100) : 0

  const chartData = rows.map((item, index) => ({
    ...item,
    targetPace: Math.round((target / 31) * (index + 1)),
  }))

  return (
    <Panel title="Revenue Tracker">
      <div className="mb-3 grid grid-cols-2 gap-2 text-xs xl:grid-cols-4">
        <Stat label="Current" value={`£${total.toLocaleString()}`} />
        <Stat label="Target" value={`£${target.toLocaleString()}`} />
        <Stat label="Daily Needed" value={`£${data?.computed?.dailyNeeded || 0}`} />
        <Stat label="Days Left" value={String(data?.computed?.daysLeft || 0)} />
      </div>
      <div className="mb-3 h-52 rounded border border-slate-800 bg-slate-950/70 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(d) => d.slice(-2)} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="targetPace" stroke="#fbbf24" strokeDasharray="5 5" dot={false} />
            <Area type="monotone" dataKey="amount" stroke="#22d3ee" fill="#155e75" fillOpacity={0.6} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="h-2 rounded bg-slate-800">
        <div className="h-2 rounded bg-gradient-to-r from-cyan-500 to-emerald-500" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="mt-1 text-right font-mono text-xs text-slate-400">{pct}%</div>
    </Panel>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-950/70 p-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-mono text-lg text-slate-100">{value}</div>
    </div>
  )
}
