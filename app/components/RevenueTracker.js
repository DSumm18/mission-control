'use client'

import './Card.css'
import './RevenueTracker.css'

export default function RevenueTracker() {
  const currentRevenue = 0
  const targetRevenue = 10000
  const monthlyTarget = 10000
  const progressPercent = (currentRevenue / targetRevenue) * 100

  // Days since start of February, days until end of March
  const today = new Date()
  const daysInFeb = 28
  const totalDaysTarget = daysInFeb + 31 // Feb + March
  const daysElapsed = today.getDate()
  const daysRemaining = totalDaysTarget - daysElapsed

  return (
    <div className="card revenue-card">
      <div className="card-header">
        <h2 className="card-title">💰 Revenue Tracker</h2>
        <span className="card-meta">Target: £{monthlyTarget.toLocaleString()} by March 31st</span>
      </div>

      <div className="revenue-grid">
        <div className="revenue-stat">
          <div className="stat-label">Current Revenue</div>
          <div className="stat-value">£{currentRevenue.toLocaleString()}</div>
          <div className="stat-sublabel">as of today</div>
        </div>

        <div className="revenue-stat">
          <div className="stat-label">Target Revenue</div>
          <div className="stat-value">£{targetRevenue.toLocaleString()}</div>
          <div className="stat-sublabel">by March 31st</div>
        </div>

        <div className="revenue-stat">
          <div className="stat-label">Days Remaining</div>
          <div className="stat-value">{daysRemaining}</div>
          <div className="stat-sublabel">until target date</div>
        </div>

        <div className="revenue-stat">
          <div className="stat-label">Daily Average Needed</div>
          <div className="stat-value">£{Math.ceil(targetRevenue / daysRemaining).toLocaleString()}</div>
          <div className="stat-sublabel">to hit target</div>
        </div>
      </div>

      <div className="progress-section">
        <div className="progress-header">
          <span className="progress-label">Progress to Target</span>
          <span className="progress-percent">{progressPercent.toFixed(1)}%</span>
        </div>
        <div className="progress-bar-container">
          <div className="progress-bar" style={{ width: `${Math.max(progressPercent, 2)}%` }}></div>
        </div>
        <div className="progress-info">
          <span>£{currentRevenue.toLocaleString()}</span>
          <span>£{targetRevenue.toLocaleString()}</span>
        </div>
      </div>

      <div className="revenue-breakdown">
        <h3 className="breakdown-title">Revenue by Product</h3>
        <div className="breakdown-items">
          <div className="breakdown-item">
            <span className="breakdown-name">ClawPhone</span>
            <span className="breakdown-amount">£0</span>
          </div>
          <div className="breakdown-item">
            <span className="breakdown-name">MyMeme</span>
            <span className="breakdown-amount">£0</span>
          </div>
          <div className="breakdown-item">
            <span className="breakdown-name">MySongs</span>
            <span className="breakdown-amount">£0</span>
          </div>
          <div className="breakdown-item">
            <span className="breakdown-name">DealFind</span>
            <span className="breakdown-amount">£0</span>
          </div>
          <div className="breakdown-item">
            <span className="breakdown-name">CricBook</span>
            <span className="breakdown-amount">£0</span>
          </div>
          <div className="breakdown-item">
            <span className="breakdown-name">Schoolgle</span>
            <span className="breakdown-amount">£0</span>
          </div>
          <div className="breakdown-item">
            <span className="breakdown-name">Sleep Sounds</span>
            <span className="breakdown-amount">£0</span>
          </div>
        </div>
      </div>
    </div>
  )
}
