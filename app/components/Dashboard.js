'use client'

import { useState, useEffect } from 'react'
import Header from './Header'
import RevenueTracker from './RevenueTracker'
import ProductStatus from './ProductStatus'
import TaskQueue from './TaskQueue'
import CostTracker from './CostTracker'
import PMActivity from './PMActivity'
import Timeline from './Timeline'
import './Dashboard.css'

export default function Dashboard() {
  const [refreshTime, setRefreshTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshTime(new Date())
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="dashboard">
      <Header refreshTime={refreshTime} />
      
      <div className="dashboard-grid">
        {/* Row 1: Revenue Tracker (full width) */}
        <div className="grid-span-2">
          <RevenueTracker />
        </div>

        {/* Row 2: Product Status Cards */}
        <div className="grid-span-2">
          <ProductStatus />
        </div>

        {/* Row 3: Task Queue + Cost Tracker */}
        <div className="grid-item">
          <TaskQueue />
        </div>
        <div className="grid-item">
          <CostTracker />
        </div>

        {/* Row 4: PM Activity (full width) */}
        <div className="grid-span-2">
          <PMActivity />
        </div>

        {/* Row 5: Timeline (full width) */}
        <div className="grid-span-2">
          <Timeline />
        </div>
      </div>
    </div>
  )
}
