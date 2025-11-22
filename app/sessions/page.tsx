'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { PrismaClient } from '@prisma/client'

interface Session {
  id: string
  title: string
  status: string
  duration: number
  createdAt: string
  transcripts: {
    id: string
    summary: string
  }[]
}

export default function Sessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/sessions')
      if (response.ok) {
        const data = await response.json()
        setSessions(data)
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'processing': return 'bg-blue-100 text-blue-800'
      case 'recording': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-xl font-semibold">ScribeAI</Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/sessions/new" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                New Recording
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="sm:flex sm:items-center">
            <div className="sm:flex-auto">
              <h1 className="text-xl font-semibold text-gray-900">Sessions</h1>
              <p className="mt-2 text-sm text-gray-700">
                A list of all your transcription sessions.
              </p>
            </div>
          </div>
          
          {loading ? (
            <div className="mt-8 bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6 text-center">
                <p className="text-gray-500">Loading sessions...</p>
              </div>
            </div>
          ) : sessions.length === 0 ? (
            <div className="mt-8 bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6 text-center">
                <div className="text-gray-500">
                  <p className="text-lg">No sessions yet</p>
                  <p className="mt-2">Start your first recording to see it here.</p>
                  <div className="mt-4">
                    <Link href="/sessions/new" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
                      Start Recording
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-8 bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {sessions.map((session) => (
                  <li key={session.id}>
                    <Link href={`/sessions/${session.id}`} className="block hover:bg-gray-50">
                      <div className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-indigo-600 truncate">
                              {session.title}
                            </p>
                            <p className="mt-2 flex items-center text-sm text-gray-500">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                                {session.status}
                              </span>
                              <span className="ml-4">
                                Duration: {formatDuration(session.duration)}
                              </span>
                            </p>
                            {session.transcripts.length > 0 && (
                              <p className="mt-2 text-sm text-gray-600">
                                {session.transcripts[0].summary.substring(0, 100)}...
                              </p>
                            )}
                          </div>
                          <div className="ml-2 flex-shrink-0 flex">
                            <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              {new Date(session.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}