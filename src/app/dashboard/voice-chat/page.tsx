"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Mic, MicOff, Volume2, Settings, Play, Pause } from "lucide-react"

const dummyMessages = [
  {
    id: 1,
    sender: "ai",
    content: "Hello! Let's practice some Arabic pronunciation. Can you say 'مرحبا' (marhaban)?",
    timestamp: "2:30 PM",
    audioUrl: null,
  },
  {
    id: 2,
    sender: "user",
    content: "marhaban",
    timestamp: "2:31 PM",
    audioUrl: null,
    pronunciation: "Good! Your pronunciation is 85% accurate.",
  },
  {
    id: 3,
    sender: "ai",
    content: "Excellent! Now try 'كيف حالك؟' (kayf halak?)",
    timestamp: "2:31 PM",
    audioUrl: null,
  },
  {
    id: 4,
    sender: "user",
    content: "kayf halak",
    timestamp: "2:32 PM",
    audioUrl: null,
    pronunciation: "Great pronunciation! 92% accuracy.",
  },
  {
    id: 5,
    sender: "ai",
    content: "Perfect! Let's try something more challenging: 'أنا أتعلم العربية' (ana ata'alam al-arabiyya)",
    timestamp: "2:33 PM",
    audioUrl: null,
  },
]

export default function VoiceChatPage() {
  const [isRecording, setIsRecording] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState("Arabic")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Voice Chat</h1>
          <p className="text-[#9CA3AF]">
            Practice pronunciation with AI-powered conversations
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary">{selectedLanguage}</Badge>
          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chat Area */}
        <div className="lg:col-span-2">
          <Card className="h-[600px] flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Conversation</CardTitle>
                  <CardDescription>AI Language Partner</CardDescription>
                </div>
                <Badge variant="outline" className="bg-green-50">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Active
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-4">
              {dummyMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start space-x-2 max-w-[80%] ${message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <Avatar className="w-8 h-8">
                      {message.sender === 'ai' ? (
                        <AvatarFallback className="bg-blue-500 text-white">AI</AvatarFallback>
                      ) : (
                        <AvatarFallback className="bg-green-500 text-white">U</AvatarFallback>
                      )}
                    </Avatar>
                    <div className={`rounded-lg p-3 ${message.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-[#2A2A28]'}`}>
                      <p className="text-sm">{message.content}</p>
                      {message.pronunciation && (
                        <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded text-xs">
                          <div className="flex items-center space-x-1">
                            <Volume2 className="h-3 w-3" />
                            <span>{message.pronunciation}</span>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs opacity-70">{message.timestamp}</span>
                        {message.audioUrl && (
                          <Button variant="ghost" size="sm">
                            <Play className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>

            {/* Voice Controls */}
            <div className="border-t p-4">
              <div className="flex items-center justify-center space-x-4">
                <Button
                  variant={isRecording ? "destructive" : "default"}
                  size="lg"
                  className="rounded-full w-16 h-16"
                  onClick={() => setIsRecording(!isRecording)}
                >
                  {isRecording ? (
                    <MicOff className="h-6 w-6" />
                  ) : (
                    <Mic className="h-6 w-6" />
                  )}
                </Button>
                <div className="text-center">
                  <p className="text-sm font-medium">
                    {isRecording ? "Recording..." : "Tap to speak"}
                  </p>
                  <p className="text-xs text-[#9CA3AF]">
                    {isRecording ? "Release when done" : "Hold and speak"}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Session Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Session Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Words Practiced</span>
                <Badge variant="secondary">8</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Avg. Accuracy</span>
                <Badge variant="secondary">88%</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Session Time</span>
                <Badge variant="secondary">12:34</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Streak</span>
                <Badge variant="secondary">5 days</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Language Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Languages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {["Arabic", "Russian", "Japanese", "Hindi", "Korean"].map((lang) => (
                <Button
                  key={lang}
                  variant={selectedLanguage === lang ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => setSelectedLanguage(lang)}
                >
                  {lang}
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Recent Topics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Topics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="p-2 rounded bg-[#2A2A28]">
                <p className="text-sm font-medium">Greetings</p>
                <p className="text-xs text-[#9CA3AF]">Basic hello/goodbye phrases</p>
              </div>
              <div className="p-2 rounded bg-[#2A2A28]">
                <p className="text-sm font-medium">Family</p>
                <p className="text-xs text-[#9CA3AF]">Family member names</p>
              </div>
              <div className="p-2 rounded bg-[#2A2A28]">
                <p className="text-sm font-medium">Numbers</p>
                <p className="text-xs text-[#9CA3AF]">Counting 1-20</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}