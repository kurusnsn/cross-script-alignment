import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MessageSquare, Languages, Brain, BarChart3, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/Logo"


export default function OverviewPage() {
  return (
    <div className="space-y-8">
          <div className="flex items-center gap-3">
            <Logo size={40} />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
              <p className="text-[#9CA3AF]">
                Welcome to your Translit dashboard. Choose a feature to get started.
              </p>
            </div>
          </div>


          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Voice Sessions</CardTitle>
                <MessageSquare className="h-4 w-4 text-[#9CA3AF]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">23</div>
                <p className="text-xs text-[#9CA3AF]">
                  +2 from last week
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Transliterations</CardTitle>
                <Languages className="h-4 w-4 text-[#9CA3AF]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">1,234</div>
                <p className="text-xs text-[#9CA3AF]">
                  +15% from last month
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Quiz Score</CardTitle>
                <Brain className="h-4 w-4 text-[#9CA3AF]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">87%</div>
                <p className="text-xs text-[#9CA3AF]">
                  +5% improvement
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Learning Streak</CardTitle>
                <BarChart3 className="h-4 w-4 text-[#9CA3AF]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12 days</div>
                <p className="text-xs text-[#9CA3AF]">
                  Keep it up!
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Feature Cards */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="relative overflow-hidden">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <MessageSquare className="h-5 w-5" />
                  <CardTitle>Voice Chat</CardTitle>
                  <Badge variant="secondary">Beta</Badge>
                </div>
                <CardDescription>
                  Practice pronunciation with AI-powered voice conversations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#9CA3AF] mb-4">
                  Engage in real-time voice conversations to improve your pronunciation and fluency across different languages.
                </p>
                <Link href="/dashboard/voice-chat">
                  <Button className="w-full">
                    Start Voice Chat
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Languages className="h-5 w-5" />
                  <CardTitle>Transliteration</CardTitle>
                </div>
                <CardDescription>
                  Convert text between different writing systems
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#9CA3AF] mb-4">
                  Transform text from one script to another while maintaining pronunciation and meaning.
                </p>
                <Link href="/dashboard/aligneration">
                  <Button className="w-full">
                    Open CrossScriptAlignment
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Brain className="h-5 w-5" />
                  <CardTitle>Quiz</CardTitle>
                  <Badge variant="outline">New</Badge>
                </div>
                <CardDescription>
                  Test your knowledge with interactive quizzes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#9CA3AF] mb-4">
                  Challenge yourself with multiple choice questions, fill-in-the-blanks, and matching exercises.
                </p>
                <Link href="/dashboard/quiz">
                  <Button className="w-full">
                    Take Quiz
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <CardTitle>Progress</CardTitle>
                </div>
                <CardDescription>
                  Track your learning journey and achievements
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#9CA3AF] mb-4">
                  View detailed analytics of your learning progress, streaks, and performance metrics.
                </p>
                <Link href="/dashboard/progress">
                  <Button className="w-full">
                    View Progress
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your latest interactions and achievements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Completed Arabic to Latin quiz</p>
                    <p className="text-xs text-[#9CA3AF]">2 hours ago</p>
                  </div>
                  <Badge variant="secondary">Quiz</Badge>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Transliterated 50 words from Russian</p>
                    <p className="text-xs text-[#9CA3AF]">5 hours ago</p>
                  </div>
                  <Badge variant="secondary">Transliteration</Badge>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Voice chat session in Japanese</p>
                    <p className="text-xs text-[#9CA3AF]">1 day ago</p>
                  </div>
                  <Badge variant="secondary">Voice Chat</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
    </div>
  )
}