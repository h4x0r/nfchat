import { useState, useRef, useEffect, memo } from 'react'
import { Send, X, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/lib/store'

interface ChatProps {
  messages: ChatMessage[]
  onSend: (message: string) => void
  onClose?: () => void
  isLoading?: boolean
}

export function Chat({ messages, onSend, onClose, isLoading = false }: ChatProps) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      onSend(input.trim())
      setInput('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      data-testid="chat-panel"
      className="flex flex-col h-full border-l bg-background"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="font-semibold">Chat</h2>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="close"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} onPivot={onSend} />
          ))}
          {isLoading && (
            <div data-testid="chat-loading" className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Thinking...</span>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the NetFlow data..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            aria-label="send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

interface MessageBubbleProps {
  message: ChatMessage
  onPivot?: (query: string) => void
}

/**
 * Memoized message bubble - prevents re-rendering when Chat input state changes.
 * Important because ReactMarkdown is expensive to render.
 */
const MessageBubble = memo(function MessageBubble({ message, onPivot }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        )}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-2 prose-pre:my-2 prose-code:text-xs">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}


        {/* Suggested Pivots */}
        {message.suggestedPivots && message.suggestedPivots.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.suggestedPivots.map((pivot, index) => (
              <button
                key={index}
                onClick={() => onPivot?.(pivot)}
                className="text-xs px-2 py-1 rounded bg-background/50 hover:bg-background/80 transition-colors"
              >
                {pivot}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})
