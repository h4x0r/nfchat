import { useState, useEffect } from 'react'
import { Eye, EyeOff, X, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const API_KEY_STORAGE_KEY = 'anthropic_api_key'
const MODEL_STORAGE_KEY = 'anthropic_model'

const MODELS = [
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
]

interface SettingsProps {
  onClose: () => void
}

export function Settings({ onClose }: SettingsProps) {
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(MODELS[0].value)
  const [showKey, setShowKey] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const savedKey = localStorage.getItem(API_KEY_STORAGE_KEY)
    const savedModel = localStorage.getItem(MODEL_STORAGE_KEY)
    if (savedKey) setApiKey(savedKey)
    if (savedModel) setModel(savedModel)
  }, [])

  const validateApiKey = (key: string): boolean => {
    // Basic validation: Anthropic keys start with "sk-ant-" or "sk-"
    return key.startsWith('sk-ant-') || key.startsWith('sk-')
  }

  const handleSave = () => {
    // Validate Anthropic API key if provided
    if (apiKey.trim() && !validateApiKey(apiKey)) {
      setMessage({ type: 'error', text: 'Invalid API key format. Keys should start with "sk-"' })
      return
    }

    // Save settings
    if (apiKey.trim()) {
      localStorage.setItem(API_KEY_STORAGE_KEY, apiKey)
    }
    localStorage.setItem(MODEL_STORAGE_KEY, model)

    setMessage({ type: 'success', text: 'Settings saved successfully!' })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleClear = () => {
    localStorage.removeItem(API_KEY_STORAGE_KEY)
    localStorage.removeItem(MODEL_STORAGE_KEY)
    setApiKey('')
    setModel(MODELS[0].value)
    setMessage({ type: 'success', text: 'All settings cleared' })
    setTimeout(() => setMessage(null), 3000)
  }

  return (
    <div data-testid="settings-panel" className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Settings</h2>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="close">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4">
        {/* API Key */}
        <div className="space-y-2">
          <Label htmlFor="api-key">Anthropic API Key</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowKey(!showKey)}
              aria-label={showKey ? 'hide' : 'show'}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Your API key is stored locally in your browser and never sent to our servers.
          </p>
        </div>

        {/* Model Selection */}
        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger id="model">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-500/10 text-green-600'
                : 'bg-red-500/10 text-red-600'
            }`}
          >
            {message.type === 'success' ? (
              <Check className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {message.text}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={handleSave} className="flex-1">
            Save
          </Button>
          {apiKey && (
            <Button variant="outline" onClick={handleClear} aria-label="clear">
              Clear All
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper to get API key for use in other components
export function getApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE_KEY)
}

export function getModel(): string {
  return localStorage.getItem(MODEL_STORAGE_KEY) || MODELS[0].value
}
