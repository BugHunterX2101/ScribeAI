'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import AudioRecorder from '../../components/AudioRecorder'
import SocketProvider from '../../components/SocketProvider'

interface DashboardStats {
  totalSessions: number
  hoursTranscribed: number
  completedSessions: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalSessions: 0,
    hoursTranscribed: 0,
    completedSessions: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/sessions')
      if (response.ok) {
        const sessions = await response.json()
        const totalHours = sessions.reduce((sum: number, session: any) => sum + (session.duration || 0), 0) / 3600
        const completed = sessions.filter((s: any) => s.status === 'completed').length
        
        setStats({
          totalSessions: sessions.length,
          hoursTranscribed: Math.round(totalHours * 10) / 10,
          completedSessions: completed
        })
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    document.cookie = 'userId=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    window.location.href = '/auth/login'
  }
  return (
    <SocketProvider>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold">ScribeAI Dashboard</h1>
              </div>
              <div className="flex items-center space-x-4">
                <Link href="/sessions" className="text-gray-700 hover:text-gray-900">
                  View Sessions
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-600 hover:text-gray-800 underline"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">{loading ? '...' : stats.totalSessions}</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Sessions
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">{loading ? 'Loading...' : stats.totalSessions}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">{loading ? '...' : stats.hoursTranscribed}</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Hours Transcribed
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">{loading ? 'Loading...' : stats.hoursTranscribed}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">{loading ? '...' : stats.completedSessions}</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Completed Sessions
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">{loading ? 'Loading...' : stats.completedSessions}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

            {/* Audio Recorder */}
            <AudioRecorder />
        </div>
      </main>
    </div>
    </SocketProvider>
  )
}