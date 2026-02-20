'use client'

import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cls } from '../lib/utils'

const tabs = ['Overview', 'Gates', 'Builds', 'Issues', 'Audit']

export default function HeaderBar({ health, lastSync, onRefresh }) {
  const [now, setNow] = useState(new Date())
  const [secondsAgo, setSecondsAgo] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - new Date(lastSync).getTime()) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [lastSync])

  return (
    <header className="fixed inset-x-0 top-0 z-20 h-14 border-b border-slate-800 bg-slate-950/90 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-[1800px] items-center justify-between gap-3 px-3">
        <div className="flex items-center gap-4">
          <div className="font-mono text-sm uppercase tracking-[0.2em] text-cyan-400">Mission Control</div>
          <div className="hidden items-center gap-3 md:flex">
            {tabs.map((tab, index) => (
              <button
                key={tab}
                type="button"
                className={cls(
                  'border-b-2 px-1 py-1 text-xs uppercase tracking-wider',
                  index === 0 ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200',
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-300">
          <div className="hidden sm:block font-mono">{now.toUTCString().slice(17, 25)} GMT</div>
          <div className="flex items-center gap-1">
            <span
              className={cls(
                'h-2.5 w-2.5 rounded-full',
                health === 'green' && 'animate-pulse bg-emerald-400',
                health === 'yellow' && 'animate-pulse bg-amber-400',
                health === 'red' && 'animate-pulse bg-red-400',
              )}
            />
            {health === 'red' ? <AlertTriangle size={14} className="text-red-400" /> : <CheckCircle2 size={14} className="text-emerald-400" />}
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-slate-300 hover:border-slate-600 hover:text-white"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
          <span className="font-mono text-slate-400">Last sync: {secondsAgo}s ago</span>
        </div>
      </div>
    </header>
  )
}
