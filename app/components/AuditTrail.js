'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { formatTime } from '../lib/utils'
import Panel from './Panel'

export default function AuditTrail() {
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [page, setPage] = useState(0)
  const limit = 10

  const query = `/api/audit?limit=${limit}&offset=${page * limit}&search=${encodeURIComponent(search)}&type=${type}`
  const { data } = useSWR(query, { refreshInterval: 10000 })

  const entries = data?.entries || []
  const total = data?.total || 0
  const maxPage = Math.max(0, Math.ceil(total / limit) - 1)

  return (
    <Panel
      title="Audit Trail"
      right={
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            placeholder="Search..."
            className="w-32 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-300"
          />
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value)
              setPage(0)
            }}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-300"
          >
            <option value="">All</option>
            <option value="build">Build</option>
            <option value="test">Test</option>
            <option value="gate_approval">Gate Approval</option>
            <option value="issue_created">Issue</option>
          </select>
        </div>
      }
    >
      <div className="space-y-1 text-xs">
        {entries.map((entry, idx) => (
          <div key={`${entry.ts}-${idx}`} className="rounded border border-slate-800 bg-slate-950/70 px-2 py-1.5">
            <span className="mr-2 font-mono text-slate-500">{formatTime(entry.ts)}</span>
            <span className="mr-2 uppercase text-cyan-400">{entry.type}</span>
            <span className="mr-2 text-slate-300">{entry.module}</span>
            <span className="mr-2 text-slate-500">{entry.actor}</span>
            <span className="text-slate-400">{entry.detail}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>Showing {entries.length} of {total}</span>
        <div className="space-x-2">
          <button type="button" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="rounded border border-slate-700 px-2 py-1 disabled:opacity-40">Prev</button>
          <button type="button" disabled={page >= maxPage} onClick={() => setPage((p) => Math.min(maxPage, p + 1))} className="rounded border border-slate-700 px-2 py-1 disabled:opacity-40">Next</button>
        </div>
      </div>
    </Panel>
  )
}
