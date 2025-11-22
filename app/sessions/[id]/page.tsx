'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

interface SessionDetail {
  id: string
  title: string
  status: string
  duration: number
  createdAt: string
  transcripts: {
    id: string
    content: string
    summary: string
  }[]
}

export default function SessionDetail() {
  const params = useParams()
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params.id) {
      fetchSession(params.id as string)
    }
  }, [params.id])

  const fetchSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        setSession(data)
      }
    } catch (error) {
      console.error('Failed to fetch session:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const downloadTranscript = () => {
    if (!session || !session.transcripts[0]) return
    
    const content = session.transcripts[0].content
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${session.title}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading session...</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Session not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/sessions" className="text-xl font-semibold">← Sessions</Link>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={downloadTranscript}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
              >
                Download Transcript
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">{session.title}</h1>
            <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
              <span>Duration: {formatDuration(session.duration)}</span>
              <span>•</span>
              <span>Created: {new Date(session.createdAt).toLocaleString()}</span>
              <span>•</span>
              <span className="capitalize">{session.status}</span>
            </div>
          </div>

          {session.transcripts.length > 0 && (
            <>
              {/* Summary Section */}
              <div className="bg-white shadow rounded-lg mb-6">
                <div className="px-4 py-5 sm:p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">AI-Generated Summary</h2>
                  <div className="prose max-w-none">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                      {session.transcripts[0].summary}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Transcript Section */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Full Transcript</h2>
                  <div className="prose max-w-none">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                      {session.transcripts[0].content}
                    </pre>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}