'use client'

import './ProductStatus.css'
import './Card.css'

const PRODUCTS = [
  { name: 'ClawPhone', emoji: '📱', status: 'in-development', users: 0, revenue: 0 },
  { name: 'MyMeme', emoji: '😂', status: 'planning', users: 0, revenue: 0 },
  { name: 'MySongs', emoji: '🎵', status: 'planning', users: 0, revenue: 0 },
  { name: 'DealFind', emoji: '🤝', status: 'planning', users: 0, revenue: 0 },
  { name: 'CricBook', emoji: '🏏', status: 'planning', users: 0, revenue: 0 },
  { name: 'Schoolgle', emoji: '📚', status: 'planning', users: 0, revenue: 0 },
  { name: 'Sleep Sounds', emoji: '😴', status: 'planning', users: 0, revenue: 0 },
]

const STATUS_COLORS = {
  'planning': '#fbbf24',
  'in-development': '#60a5fa',
  'beta': '#8b5cf6',
  'live': '#22c55e',
  'paused': '#ef4444',
}

const STATUS_LABELS = {
  'planning': 'Planning',
  'in-development': 'In Development',
  'beta': 'Beta',
  'live': 'Live',
  'paused': 'Paused',
}

export default function ProductStatus() {
  return (
    <div className="card products-card">
      <div className="card-header">
        <h2 className="card-title">📊 Product Status</h2>
        <span className="card-meta">{PRODUCTS.length} products in pipeline</span>
      </div>

      <div className="products-grid">
        {PRODUCTS.map((product) => (
          <div key={product.name} className="product-card">
            <div className="product-header">
              <span className="product-emoji">{product.emoji}</span>
              <span className="product-name">{product.name}</span>
            </div>

            <div className="product-status-badge" style={{ 
              backgroundColor: `${STATUS_COLORS[product.status]}20`,
              borderColor: STATUS_COLORS[product.status],
              color: STATUS_COLORS[product.status]
            }}>
              {STATUS_LABELS[product.status]}
            </div>

            <div className="product-stats">
              <div className="product-stat">
                <span className="stat-label">Users</span>
                <span className="stat-value">{product.users.toLocaleString()}</span>
              </div>
              <div className="product-stat">
                <span className="stat-label">Revenue</span>
                <span className="stat-value">£{product.revenue.toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
