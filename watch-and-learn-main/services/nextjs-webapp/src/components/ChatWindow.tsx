'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import RecordingMetadataModal from './RecordingMetadataModal'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'memory'
  content: string
  timestamp: Date
  thumbnail?: string
  imageCount?: number
}

interface ChatWindowProps {
  isRecording?: boolean
}

export default function ChatWindow({ isRecording = false }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'system',
      content: 'Connected to AI agent. You can ask me to interact with the browser or ask questions about what you see.',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [showMetadataModal, setShowMetadataModal] = useState(false)
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const prevIsRecordingRef = useRef<boolean>(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const connectWebSocket = useCallback(() => {
    const wsUrl = typeof window !== 'undefined'
      ? `ws://${window.location.hostname}:8000/ws`
      : 'ws://localhost:8000/ws'

    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      setIsConnected(true)
      console.log('Connected to agent')
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'response') {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: 'assistant',
              content: data.content,
              timestamp: new Date(),
            },
          ])
          setIsLoading(false)
        } else if (data.type === 'memory_injected') {
          // Memory was injected - show it immediately
          if (data.metadata) {
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now().toString() + '-memory',
                role: 'memory',
                content: `Memory retrieved: ${data.metadata.description}`,
                timestamp: new Date(),
                thumbnail: data.metadata.thumbnail,
                imageCount: data.metadata.image_count,
              },
            ])
          }
        } else if (data.type === 'status') {
          // Handle status updates (e.g., "thinking", "executing action")
          console.log('Status:', data.content)
        } else if (data.type === 'recording_status') {
          // Handle recording status updates
          if (data.session_id) {
            setSessionId(data.session_id)
            console.log('Recording session ID:', data.session_id)
          } else {
            setSessionId(null)
          }
        }
      } catch (e) {
        console.error('Failed to parse message:', e)
      }
    }

    ws.onclose = () => {
      setIsConnected(false)
      console.log('Disconnected from agent')
      // Attempt to reconnect after 3 seconds
      setTimeout(connectWebSocket, 3000)
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    wsRef.current = ws
  }, [])

  useEffect(() => {
    connectWebSocket()

    return () => {
      wsRef.current?.close()
    }
  }, [connectWebSocket])

  // Send recording state changes to backend
  useEffect(() => {
    const updateRecording = async () => {
      // Detect recording stopped (was true, now false)
      const wasRecording = prevIsRecordingRef.current
      const nowRecording = isRecording
      const currentSessionId = sessionId

      // Send via WebSocket for agent mode
      if (isConnected && wsRef.current) {
        wsRef.current.send(
          JSON.stringify({
            type: 'set_recording',
            recording: isRecording,
          })
        )
      }

      // Also call HTTP endpoint for control mode
      try {
        const agentUrl = typeof window !== 'undefined'
          ? `http://${window.location.hostname}:8000`
          : 'http://localhost:8000';

        const endpoint = isRecording ? '/recording/start' : '/recording/stop';
        const response = await fetch(`${agentUrl}${endpoint}`, { method: 'POST' });
        const data = await response.json();

        if (data.session_id) {
          setSessionId(data.session_id);
          console.log('Recording session ID:', data.session_id);
        } else if (!isRecording) {
          setSessionId(null);
        }

        // Show metadata modal when recording stops
        if (wasRecording && !nowRecording && currentSessionId) {
          setPendingSessionId(currentSessionId)
          setShowMetadataModal(true)
        }
      } catch (error) {
        console.error('Failed to update recording state:', error);
      }

      // Update previous recording state
      prevIsRecordingRef.current = isRecording
    };

    updateRecording();
  }, [isRecording, isConnected])

  const sendMessage = () => {
    if (!input.trim() || !isConnected || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    wsRef.current?.send(
      JSON.stringify({
        type: 'message',
        content: input.trim(),
      })
    )

    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleMetadataSubmit = async (description: string) => {
    if (!pendingSessionId) {
      throw new Error('No session ID available')
    }

    const agentUrl = typeof window !== 'undefined'
      ? `http://${window.location.hostname}:8000`
      : 'http://localhost:8000'

    const response = await fetch(`${agentUrl}/recording/metadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        session_id: pendingSessionId,
        description,
      }),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.message || 'Failed to save metadata')
    }

    // Close modal on success
    setShowMetadataModal(false)
    setPendingSessionId(null)

    // Show success message
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'system',
        content: `Recording saved: "${description}"`,
        timestamp: new Date(),
      },
    ])
  }

  const handleMetadataClose = () => {
    setShowMetadataModal(false)
    setPendingSessionId(null)
  }

  return (
    <>
      <RecordingMetadataModal
        isOpen={showMetadataModal}
        sessionId={pendingSessionId || ''}
        onClose={handleMetadataClose}
        onSubmit={handleMetadataSubmit}
      />
      <div className="flex flex-col h-full min-h-0">
        {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">AI Agent</h2>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            ></div>
            <span className="text-xs text-gray-400">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        {sessionId && isRecording && (
          <div className="mt-2 text-xs text-gray-500">
            Session: <span className="font-mono">{sessionId}</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : message.role === 'system'
                  ? 'bg-gray-800 text-gray-300 text-sm italic'
                  : message.role === 'memory'
                  ? 'bg-purple-900 text-purple-100 border border-purple-700'
                  : 'bg-gray-700 text-white'
              }`}
            >
              {message.role === 'memory' && message.thumbnail && (
                <div className="mb-2">
                  <img
                    src={message.thumbnail}
                    alt="Memory thumbnail"
                    className="w-32 h-auto rounded border border-purple-600"
                  />
                  {message.imageCount && (
                    <span className="text-xs text-purple-300 mt-1 block">
                      +{message.imageCount - 1} more images
                    </span>
                  )}
                </div>
              )}
              <p className="whitespace-pre-wrap">{message.content}</p>
              <span className="text-xs opacity-50 mt-1 block">
                {message.timestamp.toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-700 rounded-lg px-4 py-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.1s' }}
                ></div>
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.2s' }}
                ></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-800 shrink-0">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the agent to do something..."
            className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={1}
            disabled={!isConnected}
          />
          <button
            onClick={sendMessage}
            disabled={!isConnected || !input.trim() || isLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
          >
            Send
          </button>
        </div>
      </div>
      </div>
    </>
  )
}
