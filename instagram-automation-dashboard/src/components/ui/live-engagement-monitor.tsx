"use client"

import { Card, CardContent, CardHeader, CardTitle } from "./card"
import { ScrollArea } from "./scroll-area"
import { Badge } from "./badge"
import { MessageCircle, Mail, AtSign } from "lucide-react"

interface Comment {
  id: number
  post_id: string
  user: string
  comment: string
  timestamp: string
  sentiment: string
  priority: string
}

interface DM {
  id: number
  user: string
  last_message: string
  timestamp: string
  status: string
  priority: string
}

interface Mention {
  id: number
  user: string
  content: string
  timestamp: string
  platform: string
}

interface LiveEngagementMonitorProps {
  live_comments: Comment[]
  dm_conversations: DM[]
  mentions: Mention[]
  response_queue: any[]
  auto_response_settings: any
}

export function LiveEngagementMonitor({ live_comments, dm_conversations, mentions }: LiveEngagementMonitorProps) {
  const getPriorityBadge = (p: string) => {
    switch (p) {
      case "high":
        return "bg-red-500/20 text-red-400 border-red-500/30"
      case "medium":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30"
      default:
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      {/* Live Comments */}
      <Card className="glass-morphism-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-3 text-white font-sf-pro">
            <MessageCircle className="w-5 h-5 text-gold-500" />
            <span>Live Comments</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-96 custom-scrollbar-premium">
            {live_comments.map((item) => (
              <div key={item.id} className="p-4 border-b border-white/10 hover:bg-white/5 transition-colors group">
                <p className="text-sm text-white font-sf-pro">{item.comment}</p>
                <div className="flex items-center justify-between mt-2 text-xs text-white/60 font-sf-pro">
                  <span>{item.user}</span>
                  <div className="flex items-center space-x-2">
                    <span>{item.timestamp}</span>
                    <Badge className={getPriorityBadge(item.priority)}>{item.priority}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Direct Messages */}
      <Card className="glass-morphism-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-3 text-white font-sf-pro">
            <Mail className="w-5 h-5 text-gold-500" />
            <span>Direct Messages</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-96 custom-scrollbar-premium">
            {dm_conversations.map((dm) => (
              <div key={dm.id} className="p-4 border-b border-white/10 hover:bg-white/5 group">
                <p className="text-sm text-white font-sf-pro">{dm.last_message}</p>
                <div className="flex items-center justify-between mt-2 text-xs text-white/60 font-sf-pro">
                  <span>{dm.user}</span>
                  <div className="flex items-center space-x-2">
                    <span>{dm.timestamp}</span>
                    <Badge className={getPriorityBadge(dm.priority)}>{dm.priority}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Mentions */}
      <Card className="glass-morphism-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-3 text-white font-sf-pro">
            <AtSign className="w-5 h-5 text-gold-500" />
            <span>Mentions</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-96 custom-scrollbar-premium">
            {mentions.map((m) => (
              <div key={m.id} className="p-4 border-b border-white/10 hover:bg-white/5 group">
                <p className="text-sm text-white font-sf-pro">{m.content}</p>
                <div className="flex items-center justify-between mt-2 text-xs text-white/60 font-sf-pro">
                  <span>{m.user}</span>
                  <span>{m.timestamp}</span>
                </div>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

