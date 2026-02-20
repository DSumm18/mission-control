'use client'

import { Lock, Unlock } from 'lucide-react'
import { useState } from 'react'
import { cls } from '../lib/utils'
import Panel from './Panel'

const states = {
  passed: '●',
  'in-progress': '◐',
  locked: '○',
  failed: '✕',
}

const colors = {
  passed: 'text-emerald-400',
  'in-progress': 'text-amber-400 animate-pulseSoft',
  locked: 'text-slate-600',
  failed: 'text-red-500',
}

const filters = ['all', 'in-progress', 'blocked', 'complete']

export default function GateTracker({ data }) {
  const [filter, setFilter] = useState('all')
  const [active, setActive] = useState(null)

  const filtered = data.filter((module) => {
    if (filter === 'in-progress') return Object.values(module.gates).some((g) => g.status === 'in-progress')
    if (filter === 'blocked') return module.releaseBlocked
    if (filter === 'complete') return module.gates?.G5?.status === 'passed'
    return true
  })

  return (
    <Panel
      title="Gate Tracker"
      right={
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-300">
          {filters.map((item) => (
            <option value={item} key={item}>{item}</option>
          ))}
        </select>
      }
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="pb-2 text-left">Module</th>
              {['G1', 'G2', 'G3', 'G4', 'G5'].map((gate) => (
                <th key={gate} className="pb-2 text-center">{gate}</th>
              ))}
              <th className="pb-2 text-center">Docs</th>
              <th className="pb-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((module) => {
              const docsDone = Object.values(module.docs || {}).filter(Boolean).length
              return (
                <tr key={module.id} className="cursor-pointer border-t border-slate-800 hover:bg-slate-900/70" onClick={() => setActive(module)}>
                  <td className="py-2 pr-3">
                    <div className="font-medium text-slate-200">{module.name}</div>
                    <div className="text-xs text-slate-500">Assignee: {module.assignee}</div>
                    <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                      {['RESEARCH.md', 'SPEC.md', 'TEST-CASES.md', 'QA-REPORT.md'].map((doc) => (
                        <a key={doc} href={`/api/docs/${module.id}/${doc}`} target="_blank" className="rounded border border-slate-700 px-1 text-cyan-400 hover:text-cyan-300" rel="noreferrer">
                          {doc.split('.')[0]}
                        </a>
                      ))}
                    </div>
                  </td>
                  {['G1', 'G2', 'G3', 'G4', 'G5'].map((gate) => {
                    const status = module.gates?.[gate]?.status || 'locked'
                    return (
                      <td key={gate} className="py-2 text-center">
                        <span className={cls('text-base', colors[status])}>{states[status]}</span>
                      </td>
                    )
                  })}
                  <td className={cls('py-2 text-center font-mono text-xs', docsDone < 4 ? 'text-red-400' : 'text-emerald-400')}>
                    {docsDone}/4
                  </td>
                  <td className="py-2 text-right text-xs">
                    {module.releaseBlocked ? (
                      <span className="inline-flex items-center gap-1 text-red-400"><Lock size={13} /> blocked</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-400"><Unlock size={13} /> clear</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {active ? (
        <div className="mt-3 rounded border border-slate-700 bg-slate-950/70 p-3 text-xs text-slate-300">
          <div className="mb-1 font-medium text-slate-100">{active.name} detail</div>
          <div>Current gate: {active.currentGate}</div>
          <div>Priority: {active.priority}</div>
          <div className="text-red-400">{active.releaseBlocked ? active.blockReason : 'Release gate open'}</div>
        </div>
      ) : null}
    </Panel>
  )
}
