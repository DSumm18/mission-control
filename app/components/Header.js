'use client'

import './Header.css'

export default function Header({ refreshTime }) {
  const formattedTime = refreshTime.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <header className="dashboard-header">
      <div className="header-left">
        <h1 className="header-title">🚀 Mission Control</h1>
        <p className="header-subtitle">David's Business Dashboard</p>
      </div>
      
      <div className="header-right">
        <div className="refresh-info">
          <span className="refresh-label">Last updated:</span>
          <span className="refresh-time">{formattedTime}</span>
        </div>
        <div className="status-indicator">
          <div className="status-dot alive"></div>
          <span className="status-text">Live</span>
        </div>
      </div>
    </header>
  )
}
