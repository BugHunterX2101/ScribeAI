import './globals.css'
import SocketProvider from '@/components/SocketProvider'

export const metadata = {
  title: 'ScribeAI — AI-powered transcription',
  description: 'Real-time audio transcription and AI summaries with Gemini 2.0 Flash',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <SocketProvider>
          {children}
        </SocketProvider>
      </body>
    </html>
  )
}
