import { useState, useCallback } from 'react'
import { useStore } from '@/lib/store'
import { useNetflowData } from '@/hooks/useNetflowData'
import { Dashboard } from '@/components/Dashboard'
import { Chat } from '@/components/Chat'
import { Settings } from '@/components/Settings'
import { FileUploader } from '@/components/FileUploader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Database, AlertCircle, Loader2, Settings as SettingsIcon, Upload, Globe } from 'lucide-react'
import { getApiKey } from '@/components/Settings'
import { loadParquetFromFile } from '@/lib/duckdb'

const PARQUET_URL = '/data/NF-UNSW-NB15-v3.parquet'

function App() {
  const [showChat, setShowChat] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [loadStarted, setLoadStarted] = useState(false)
  const [localFileLoading, setLocalFileLoading] = useState(false)
  const [localFileLoaded, setLocalFileLoaded] = useState(false)
  const [localFileError, setLocalFileError] = useState<string | null>(null)

  const { loading, error } = useNetflowData(loadStarted ? PARQUET_URL : '')

  const handleLocalFileSelect = useCallback(async (file: File) => {
    setLocalFileLoading(true)
    setLocalFileError(null)

    try {
      await loadParquetFromFile(file)
      setLocalFileLoaded(true)
    } catch (err) {
      setLocalFileError(err instanceof Error ? err.message : 'Failed to load file')
    } finally {
      setLocalFileLoading(false)
    }
  }, [])

  const {
    messages,
    addMessage,
    isLoading: chatLoading,
    setIsLoading: setChatLoading,
  } = useStore()

  const handleLoadData = () => {
    setLoadStarted(true)
  }

  const handleSendMessage = async (content: string) => {
    // Add user message
    addMessage({ role: 'user', content })
    setChatLoading(true)

    const apiKey = getApiKey()
    if (!apiKey) {
      addMessage({
        role: 'assistant',
        content: 'Please configure your Anthropic API key in Settings to use the chat feature.',
      })
      setChatLoading(false)
      setShowSettings(true)
      return
    }

    try {
      // TODO: Implement actual AI chat
      // For now, show a placeholder response
      addMessage({
        role: 'assistant',
        content: `I received your query: "${content}"\n\nAI chat integration coming soon. For now, use the dashboard filters to explore the data.`,
        suggestedPivots: ['Show attack breakdown', 'Filter by Exploits', 'Top source IPs'],
      })
    } catch (err) {
      addMessage({
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      })
    } finally {
      setChatLoading(false)
    }
  }

  // Landing page - show load options
  if (!loadStarted && !localFileLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              nfchat - NetFlow Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload File
                </TabsTrigger>
                <TabsTrigger value="demo">
                  <Globe className="h-4 w-4 mr-2" />
                  Demo Data
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="mt-4">
                <FileUploader
                  onFileSelect={handleLocalFileSelect}
                  isLoading={localFileLoading}
                />
                {localFileError && (
                  <div className="mt-4 p-3 bg-destructive/10 border border-destructive/50 rounded-lg">
                    <p className="text-destructive text-sm">{localFileError}</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="demo" className="mt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Load the NF-UNSW-NB15 netflow dataset to begin analysis.
                  The dataset contains ~2.3M flow records with 10 attack types.
                </p>
                <Button onClick={handleLoadData} className="w-full">
                  Load Demo Dataset
                </Button>
              </TabsContent>
            </Tabs>

            <div className="pt-4 border-t">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowSettings(true)}
              >
                <SettingsIcon className="h-4 w-4 mr-2" />
                Configure API Key
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
              <Settings onClose={() => setShowSettings(false)} />
            </Card>
          </div>
        )}
      </div>
    )
  }

  // Loading state (for both URL and local file)
  if (loading || localFileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading NetFlow data...</p>
            <p className="text-xs text-muted-foreground">
              {localFileLoading
                ? 'Processing your parquet file...'
                : 'This may take 30-60 seconds for ~100MB of data'}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 flex flex-col items-center gap-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-destructive">{error}</p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Main dashboard
  return (
    <div className="h-screen flex">
      {/* Dashboard */}
      <div className={`flex-1 ${showChat ? 'mr-96' : ''}`}>
        <Dashboard
          onChatToggle={() => setShowChat(!showChat)}
        />
      </div>

      {/* Chat Panel */}
      {showChat && (
        <div className="fixed right-0 top-0 bottom-0 w-96 border-l bg-background">
          <Chat
            messages={messages}
            onSend={handleSendMessage}
            onClose={() => setShowChat(false)}
            isLoading={chatLoading}
          />
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <Settings onClose={() => setShowSettings(false)} />
          </Card>
        </div>
      )}
    </div>
  )
}

export default App
