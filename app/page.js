'use client'

import useSWR from 'swr'
import { useMemo, useState } from 'react'
import HeaderBar from './components/HeaderBar'
import GateTracker from './components/GateTracker'
import RevenuePanel from './components/RevenuePanel'
import ProductStatusCards from './components/ProductStatusCards'
import BuildLog from './components/BuildLog'
import TeamActivity from './components/TeamActivity'
import TaskOverview from './components/TaskOverview'
import IssueTracker from './components/IssueTracker'
import AuditTrail from './components/AuditTrail'
import EdChat from './components/EdChat'

export default function Home() {
  const [lastSync, setLastSync] = useState(new Date())

  const gates = useSWR('/api/gates', { refreshInterval: 10000, onSuccess: () => setLastSync(new Date()) })
  const builds = useSWR('/api/builds?limit=20', { refreshInterval: 30000, onSuccess: () => setLastSync(new Date()) })
  const buildStats = useSWR('/api/builds/stats', { refreshInterval: 30000, onSuccess: () => setLastSync(new Date()) })
  const team = useSWR('/api/team', { refreshInterval: 10000, onSuccess: () => setLastSync(new Date()) })
  const revenue = useSWR('/api/revenue', { refreshInterval: 60000, onSuccess: () => setLastSync(new Date()) })
  const products = useSWR('/api/products', { refreshInterval: 30000, onSuccess: () => setLastSync(new Date()) })
  const tasks = useSWR('/api/tasks', { refreshInterval: 30000, onSuccess: () => setLastSync(new Date()) })
  const issues = useSWR('/api/issues', { refreshInterval: 30000, onSuccess: () => setLastSync(new Date()) })

  const overallHealth = useMemo(() => {
    const health = (products.data?.products || []).map((item) => item.health)
    if (health.includes('red')) return 'red'
    if (health.includes('yellow')) return 'yellow'
    return 'green'
  }, [products.data])

  const refreshAll = async () => {
    await Promise.all([
      gates.mutate(),
      builds.mutate(),
      buildStats.mutate(),
      team.mutate(),
      revenue.mutate(),
      products.mutate(),
      tasks.mutate(),
      issues.mutate(),
    ])
    setLastSync(new Date())
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <HeaderBar health={overallHealth} lastSync={lastSync} onRefresh={refreshAll} />
      <div className="mx-auto grid max-w-[1800px] grid-cols-1 gap-4 px-3 pb-6 pt-16 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-4">
          <GateTracker data={gates.data?.modules || []} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <RevenuePanel data={revenue.data} />
            <ProductStatusCards data={products.data?.products || []} />
          </div>
          <BuildLog rows={builds.data?.builds || []} stats={buildStats.data} />
          <AuditTrail />
        </section>
        <aside className="space-y-4">
          <TeamActivity agents={team.data?.agents || []} />
          <TaskOverview tasks={tasks.data?.tasks || []} />
          <IssueTracker issues={issues.data?.issues || []} />
          <EdChat />
        </aside>
      </div>
      <footer className="border-t border-slate-800 px-4 py-3 text-xs text-slate-400">
        Schoolgle Mission Control v2.0 · Last sync: {lastSync.toLocaleTimeString('en-GB')}
      </footer>
    </main>
  )
}
