'use client'

import { useState, useEffect } from 'react'
import './PMActivity.css'
import './Card.css'

const SAMPLE_ACTIVITIES = [
  {
    id: 1,
    pm: 'Sarah Chen',
    product: 'ClawPhone',
    activity: 'Completed user testing for authentication flow',
    timestamp: '2 hours ago',
    emoji: '✅'
  },
  {
    id: 2,
    pm: 'Marcus Williams',
    product: 'MyMeme',
    activity: 'Reviewed design mockups and approved v2.0',
    timestamp: '4 hours ago',
    emoji: '🎨'
  },
  {
    id: 3,
    pm: 'Elena Rodriguez',
    product: 'MySongs',
    activity: 'Created API specification document',
    timestamp: '6 hours ago',
    emoji: '📝'
  },
  {
    id: 4,
    pm: 'James Park',
    product: 'DealFind',
    activity: 'Conducted competitor analysis and drafted strategy',
    timestamp: '8 hours ago',
    emoji: '🔍'
  },
  {
    id: 5,
    pm: 'Priya Sharma',
    product: 'CricBook',
    activity: 'Onboarded 3 new team members to project',
    timestamp: '1 day ago',
    emoji: '👥'
  },
  {
    id: 6,
    pm: 'David Lee',
    product: 'Schoolgle',
    activity: 'Presented roadmap to stakeholders',
    timestamp: '1 day ago',
    emoji: '📊'
  },
  {
    id: 7,
    pm: 'Nina Patel',
    product: 'Sleep Sounds',
    activity: 'Set up analytics and metrics dashboard',
    timestamp: '2 days ago',
    emoji: '📈'
  },
]

export default function PMActivity() {
  const [activities, setActivities] = useState(SAMPLE_ACTIVITIES)

  return (
    <div className="card pm-activity-card">
      <div className="card-header">
        <h2 className="card-title">👥 PM Activity Log</h2>
        <span className="card-meta">{activities.length} recent activities</span>
      </div>

      <div className="activity-list">
        {activities.map((activity) => (
          <div key={activity.id} className="activity-item">
            <div className="activity-left">
              <div className="activity-emoji">{activity.emoji}</div>
              <div className="activity-details">
                <div className="activity-title">
                  <strong>{activity.pm}</strong>
                  <span className="product-badge">{activity.product}</span>
                </div>
                <div className="activity-description">{activity.activity}</div>
              </div>
            </div>
            <div className="activity-time">{activity.timestamp}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
