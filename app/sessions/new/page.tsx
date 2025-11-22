import Link from 'next/link'
import AudioRecorder from '@/components/AudioRecorder'

export default function NewSession() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-xl font-semibold">ScribeAI</Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/sessions" className="text-gray-700 hover:text-gray-900">
                All Sessions
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="py-6">
        <AudioRecorder />
      </main>
    </div>
  )
}