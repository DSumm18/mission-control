import { NextResponse } from 'next/server'

export async function POST(request) {
  const body = await request.json().catch(() => ({}))
  const message = String(body.message || '').trim()

  if (!message) {
    return NextResponse.json({ error: 'message is required', status: 400 }, { status: 400 })
  }

  try {
    const response = await fetch('http://localhost:18789/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })

    if (!response.ok) throw new Error('proxy-failed')
    const data = await response.json()
    return NextResponse.json({ reply: data.reply || data.message || 'No reply from Ed.' })
  } catch {
    return NextResponse.json({
      reply: `Ed fallback: command received - ${message}. Live Ed API unavailable, using local response.`
    })
  }
}
