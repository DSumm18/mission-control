'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { DollarSign, TrendingDown } from 'lucide-react';
import AnimatedKPI from '@/components/ui/AnimatedKPI';
import { SkeletonKPI, SkeletonCard } from '@/components/ui/Skeleton';
import PageInfo from '@/components/ui/PageInfo';

type CostData = {
  total_cost: number;
  total_runs: number;
  period: string;
  groups: { name: string; runs: number; cost: number; avg_duration_ms: number }[];
  daily: { date: string; cost: number }[];
};

export default function CostsPage() {
  const [data, setData] = useState<CostData | null>(null);
  const [period, setPeriod] = useState('7d');
  const [groupBy, setGroupBy] = useState('engine');

  const fetchData = useCallback(() => {
    fetch(`/api/costs/detailed?period=${period}&group_by=${groupBy}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); })
      .catch(() => {});
  }, [period, groupBy]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const avgCostPerRun = data && data.total_runs > 0 ? data.total_cost / data.total_runs : 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <DollarSign size={24} /> Cost Dashboard
            </h1>
            <PageInfo title="Costs" description="Track AI engine spending across all agents and jobs. Monitor daily cost trends and identify which engines are most cost-effective." features={["KPIs show total spend, daily average, and run count", "Daily cost chart reveals spending patterns", "Breakdown table shows cost per engine", "Adjust time period with the dropdown"]} />
          </div>
          <p className="page-sub" style={{ marginBottom: 0 }}>AI spend tracking across engines, agents, and projects.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={period} onChange={e => setPeriod(e.target.value)} style={{ fontSize: 13, padding: '6px 10px' }}>
            <option value="7d">7 Days</option>
            <option value="30d">30 Days</option>
            <option value="90d">90 Days</option>
          </select>
          <select value={groupBy} onChange={e => setGroupBy(e.target.value)} style={{ fontSize: 13, padding: '6px 10px' }}>
            <option value="engine">By Engine</option>
            <option value="agent">By Agent</option>
            <option value="project">By Project</option>
          </select>
        </div>
      </div>

      {/* KPIs */}
      <section className="grid" style={{ marginBottom: 14 }}>
        <article className="card card-glow-active card-animated" style={{ gridColumn: 'span 4' }}>
          <div className="muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <DollarSign size={14} /> Total Spend
          </div>
          <div className="kpi">
            {data ? <AnimatedKPI value={data.total_cost} prefix="$" decimals={4} /> : <SkeletonKPI />}
          </div>
          <div className="muted">{period} period</div>
        </article>
        <article className="card card-glow-active card-animated" style={{ gridColumn: 'span 4' }}>
          <div className="muted">Total Runs</div>
          <div className="kpi">
            {data ? <AnimatedKPI value={data.total_runs} /> : <SkeletonKPI />}
          </div>
          <div className="muted">API calls</div>
        </article>
        <article className="card card-glow-active card-animated" style={{ gridColumn: 'span 4' }}>
          <div className="muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingDown size={14} /> Avg Cost/Run
          </div>
          <div className="kpi">
            {data ? <AnimatedKPI value={avgCostPerRun} prefix="$" decimals={6} /> : <SkeletonKPI />}
          </div>
          <div className="muted">per execution</div>
        </article>
      </section>

      {/* Chart */}
      <section className="grid" style={{ marginBottom: 14 }}>
        <article className="card card-animated" style={{ gridColumn: 'span 12' }}>
          <h3 style={{ marginTop: 0, fontSize: 15 }}>Daily Spend</h3>
          {data && data.daily.length > 0 ? (
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.daily} barCategoryGap="20%">
                  <XAxis dataKey="date" tick={{ fill: '#9fb0d9', fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fill: '#9fb0d9', fontSize: 11 }} tickFormatter={v => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: '#1a2440', border: '1px solid #2a3559', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [`$${Number(v).toFixed(4)}`, 'Cost']}
                  />
                  <Bar dataKey="cost" fill="#6ea8fe" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <SkeletonCard height={200} />
          )}
        </article>
      </section>

      {/* Breakdown table */}
      <section className="card card-animated">
        <h3 style={{ marginTop: 0, fontSize: 15 }}>
          Breakdown by {groupBy === 'engine' ? 'Engine' : groupBy === 'agent' ? 'Agent' : 'Project'}
        </h3>
        {data && data.groups.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th style={{ textAlign: 'right' }}>Runs</th>
                  <th style={{ textAlign: 'right' }}>Cost</th>
                  <th style={{ textAlign: 'right' }}>Avg Duration</th>
                  <th style={{ textAlign: 'right' }}>% of Total</th>
                </tr>
              </thead>
              <tbody>
                {data.groups.map(g => (
                  <tr key={g.name}>
                    <td style={{ fontWeight: 500 }}>{g.name}</td>
                    <td style={{ textAlign: 'right' }}>{g.runs}</td>
                    <td style={{ textAlign: 'right' }}>${g.cost.toFixed(4)}</td>
                    <td style={{ textAlign: 'right' }}>{(g.avg_duration_ms / 1000).toFixed(1)}s</td>
                    <td style={{ textAlign: 'right' }}>
                      {data.total_cost > 0
                        ? `${((g.cost / data.total_cost) * 100).toFixed(1)}%`
                        : '0%'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="muted" style={{ padding: 20, textAlign: 'center' }}>No cost data for this period</div>
        )}
      </section>
    </div>
  );
}
