'use client'

import { useState, useEffect } from 'react'
import './TaskQueue.css'
import './Card.css'

export default function TaskQueue() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Try to fetch TASKQUEUE.md
    fetch('/api/taskqueue')
      .then(res => res.json())
      .catch(() => {
        // Fallback to sample data
        return {
          tasks: [
            { id: 1, title: 'Fix ClawPhone auth bug', priority: 'high', status: 'in-progress' },
            { id: 2, title: 'Design MyMeme landing page', priority: 'medium', status: 'pending' },
            { id: 3, title: 'Set up MySongs API', priority: 'high', status: 'pending' },
            { id: 4, title: 'Review DealFind MVP', priority: 'medium', status: 'pending' },
            { id: 5, title: 'Update CricBook database', priority: 'low', status: 'pending' },
          ]
        }
      })
      .then(data => {
        setTasks(data.tasks || [])
      })
      .finally(() => setLoading(false))
  }, [])

  const getPriorityColor = (priority) => {
    const colors = {
      'high': '#ef4444',
      'medium': '#fbbf24',
      'low': '#60a5fa',
    }
    return colors[priority] || colors.medium
  }

  const getStatusColor = (status) => {
    const colors = {
      'pending': '#64748b',
      'in-progress': '#fbbf24',
      'completed': '#22c55e',
    }
    return colors[status] || colors.pending
  }

  return (
    <div className="card task-queue-card">
      <div className="card-header">
        <h2 className="card-title">📋 Task Queue</h2>
        <span className="card-meta">{tasks.length} tasks</span>
      </div>

      <div className="task-list">
        {loading ? (
          <div className="loading">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">No tasks queued</div>
        ) : (
          tasks.slice(0, 5).map((task) => (
            <div key={task.id} className="task-item">
              <div className="task-content">
                <div className="task-title">{task.title}</div>
                <div className="task-meta">
                  <span 
                    className="task-priority"
                    style={{ color: getPriorityColor(task.priority) }}
                  >
                    {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority
                  </span>
                </div>
              </div>
              <span 
                className="task-status"
                style={{ 
                  backgroundColor: `${getStatusColor(task.status)}20`,
                  color: getStatusColor(task.status),
                  borderColor: getStatusColor(task.status)
                }}
              >
                {task.status.replace('-', ' ')}
              </span>
            </div>
          ))
        )}
      </div>

      {tasks.length > 5 && (
        <div className="view-more">
          +{tasks.length - 5} more tasks
        </div>
      )}
    </div>
  )
}
