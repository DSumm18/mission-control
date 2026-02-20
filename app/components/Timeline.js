'use client'

import './Timeline.css'
import './Card.css'

const TIMELINE_ITEMS = [
  {
    id: 1,
    date: 'Feb 2026',
    milestone: 'ClawPhone Beta Launch',
    status: 'in-progress',
    progress: 75,
  },
  {
    id: 2,
    date: 'Mar 2026',
    milestone: 'MyMeme MVP Release',
    status: 'planning',
    progress: 40,
  },
  {
    id: 3,
    date: 'Mar 2026',
    milestone: 'Revenue Target: £10K/month',
    status: 'planning',
    progress: 0,
  },
  {
    id: 4,
    date: 'Apr 2026',
    milestone: 'MySongs API Integration',
    status: 'planning',
    progress: 20,
  },
  {
    id: 5,
    date: 'May 2026',
    milestone: 'DealFind Smart Matching',
    status: 'planning',
    progress: 0,
  },
  {
    id: 6,
    date: 'Jun 2026',
    milestone: 'Series A Funding Round',
    status: 'planning',
    progress: 0,
  },
]

export default function Timeline() {
  const getStatusColor = (status) => {
    const colors = {
      'completed': '#22c55e',
      'in-progress': '#60a5fa',
      'planning': '#fbbf24',
    }
    return colors[status] || colors.planning
  }

  return (
    <div className="card timeline-card">
      <div className="card-header">
        <h2 className="card-title">🗓️ Roadmap & Timeline</h2>
        <span className="card-meta">Next 5 months</span>
      </div>

      <div className="timeline">
        {TIMELINE_ITEMS.map((item, index) => (
          <div key={item.id} className="timeline-item">
            <div className="timeline-dot" style={{ backgroundColor: getStatusColor(item.status) }}></div>
            
            {index < TIMELINE_ITEMS.length - 1 && (
              <div className="timeline-line" style={{ borderColor: getStatusColor(item.status) }}></div>
            )}

            <div className="timeline-content">
              <div className="timeline-date">{item.date}</div>
              <div className="timeline-milestone">{item.milestone}</div>
              
              <div className="timeline-status" style={{ color: getStatusColor(item.status) }}>
                {item.status.replace('-', ' ').charAt(0).toUpperCase() + item.status.slice(1).replace('-', ' ')}
              </div>

              {item.progress > 0 && (
                <div className="timeline-progress">
                  <div className="progress-bar-container">
                    <div 
                      className="progress-bar" 
                      style={{ width: `${item.progress}%`, backgroundColor: getStatusColor(item.status) }}
                    ></div>
                  </div>
                  <span className="progress-text">{item.progress}% complete</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
