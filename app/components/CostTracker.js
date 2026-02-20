'use client'

import './CostTracker.css'
import './Card.css'

const COST_DATA = [
  { name: 'Claude API', cost: 24.50, percent: 35, color: '#ef4444' },
  { name: 'Cloud Storage', cost: 12.00, percent: 17, color: '#f59e0b' },
  { name: 'Compute', cost: 18.75, percent: 27, color: '#3b82f6' },
  { name: 'Database', cost: 9.25, percent: 13, color: '#8b5cf6' },
  { name: 'Other', cost: 5.50, percent: 8, color: '#64748b' },
]

export default function CostTracker() {
  const totalCost = COST_DATA.reduce((sum, item) => sum + item.cost, 0)

  return (
    <div className="card cost-card">
      <div className="card-header">
        <h2 className="card-title">💳 Cost Tracker</h2>
        <span className="card-meta">Monthly estimates</span>
      </div>

      <div className="cost-summary">
        <div className="total-cost">
          <div className="label">Total Monthly Cost</div>
          <div className="amount">£{totalCost.toFixed(2)}</div>
        </div>
      </div>

      <div className="cost-breakdown">
        {COST_DATA.map((item) => (
          <div key={item.name} className="cost-item">
            <div className="cost-bar-container">
              <div className="cost-label">
                <span>{item.name}</span>
                <span className="cost-amount">£{item.cost.toFixed(2)}</span>
              </div>
              <div className="cost-bar-wrapper">
                <div 
                  className="cost-bar" 
                  style={{ 
                    width: `${item.percent}%`,
                    backgroundColor: item.color
                  }}
                ></div>
              </div>
              <div className="cost-percent">{item.percent}%</div>
            </div>
          </div>
        ))}
      </div>

      <div className="cost-note">
        <span className="note-icon">💡</span>
        <span className="note-text">Estimates based on current usage patterns</span>
      </div>
    </div>
  )
}
