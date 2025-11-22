'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false
})

export const useSocket = () => {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}

export default function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // CRITICAL FIX: Connect to the correct server port with proper options
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'
    console.log('🔗 Socket connecting to:', socketUrl)
    
    const socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling'], // Try websocket first, fallback to polling
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 10000,
      forceNew: true
    })

    socketInstance.on('connect', () => {
      console.log('✅ Socket connected successfully:', socketInstance.id)
      setIsConnected(true)
    })

    socketInstance.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason)
      setIsConnected(false)
    })

    socketInstance.on('connect_error', (error) => {
      console.log('❌ Socket connection error:', error.message)
      console.log('🔍 Error details:', {
        type: error.type,
        description: error.description
      })
      setIsConnected(false)
    })

    socketInstance.on('error', (error) => {
      console.log('❌ Socket error:', error)
    })

    setSocket(socketInstance)

    return () => {
      console.log('🔌 Cleaning up socket connection')
      socketInstance.disconnect()
    }
  }, [])

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  )
}
