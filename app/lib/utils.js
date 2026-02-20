export function formatTime(value) {
  return new Date(value).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  })
}

export function formatDate(value) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  })
}

export function relativeTime(value) {
  const delta = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
  if (delta < 1) return 'just now'
  if (delta < 60) return `${delta}m ago`
  const hours = Math.floor(delta / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function cls(...values) {
  return values.filter(Boolean).join(' ')
}
