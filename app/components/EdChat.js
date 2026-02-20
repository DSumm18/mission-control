'use client'

import { Send } from 'lucide-react'
import { useState } from 'react'
import Panel from './Panel'

export default function EdChat() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([
    { role: 'ed', text: 'Ready. What do you need?' },
  ])

  const submit = async (event) => {
    event.preventDefault()
    const message = input.trim()
    if (!message) return

    setMessages((prev) => [...prev, { role: 'you', text: message }])
    setInput('')

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const data = await response.json()
      setMessages((prev) => [...prev, { role: 'ed', text: data.reply || 'No response' }])
    } catch {
      setMessages((prev) => [...prev, { role: 'ed', text: 'Chat service unavailable.' }])
    }
  }

  return (
    <Panel title="Ed Chat">
      <div className="mb-2 max-h-52 space-y-2 overflow-y-auto rounded border border-slate-800 bg-slate-950/70 p-2 text-xs">
        {messages.map((msg, idx) => (
          <div key={idx} className={msg.role === 'you' ? 'text-cyan-300' : 'text-slate-300'}>
            <span className="font-semibold uppercase text-[10px] text-slate-500">{msg.role}:</span> {msg.text}
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a command..."
          className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100"
        />
        <button type="submit" className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1.5 text-xs text-slate-200 hover:border-slate-500">
          <Send size={12} />
          Send
        </button>
      </form>
    </Panel>
  )
}
