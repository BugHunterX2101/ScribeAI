import './globals.css'
import { Inter } from 'next/font/google'
import SocketProvider from '@/components/SocketProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'ScribeAI',
  description: 'AI-powered audio transcription',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SocketProvider>
          {children}
        </SocketProvider>
      </body>
    </html>
  )
}