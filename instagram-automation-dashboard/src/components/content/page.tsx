"use client"

import { useState } from "react"
import { HeaderNavigation } from "../ui/header-navigation"
import { ContentCalendar } from "../ui/content-calendar"
import { ContentLibraryGrid } from "../ui/content-library-grid"
import { PostComposer } from "../ui/post-composer"
import { AutoGenerationSettings } from "../ui/auto-generation-settings"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { Calendar, Grid3X3, PenTool, Settings } from "lucide-react"

export default function ContentPage() {
  const [activeTab, setActiveTab] = useState("calendar")

  const calendarData = {
    calendar_view: "monthly",
    scheduled_posts: [
      {
        id: 1,
        date: "2024-01-15",
        time: "09:00",
        type: "feed",
        title: "Morning Motivation",
        status: "scheduled",
        thumbnail: "/placeholder.svg?height=100&width=100",
      },
      {
        id: 2,
        date: "2024-01-15",
        time: "15:30",
        type: "story",
        title: "Behind the Scenes",
        status: "scheduled",
        thumbnail: "/placeholder.svg?height=100&width=100",
      },
      {
        id: 3,
        date: "2024-01-16",
        time: "12:00",
        type: "reel",
        title: "Product Showcase",
        status: "draft",
        thumbnail: "/placeholder.svg?height=100&width=100",
      },
    ],
    content_types: ["feed", "story", "reel"],
    drag_drop_handlers: {},
    post_previews: [],
  }

  const libraryData = {
    content_items: [
      {
        id: 1,
        type: "image",
        title: "Summer Collection 2024",
        thumbnail: "/placeholder.svg?height=200&width=200",
        performance: { likes: 1250, comments: 89, shares: 45 },
        created_at: "2024-01-10",
        tags: ["summer", "collection", "fashion"],
      },
      {
        id: 2,
        type: "video",
        title: "Behind the Scenes",
        thumbnail: "/placeholder.svg?height=200&width=200",
        performance: { likes: 2100, comments: 156, shares: 78 },
        created_at: "2024-01-08",
        tags: ["bts", "process", "team"],
      },
      {
        id: 3,
        type: "carousel",
        title: "Product Features",
        thumbnail: "/placeholder.svg?height=200&width=200",
        performance: { likes: 890, comments: 67, shares: 23 },
        created_at: "2024-01-05",
        tags: ["product", "features", "showcase"],
      },
    ],
    filters: ["all", "image", "video", "carousel"],
    search_query: "",
    sort_options: ["newest", "oldest", "performance"],
    selection_state: [],
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <HeaderNavigation />

      <main className="max-w-7xl mx-auto px-8 py-12">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">Content Management</h1>
          <p className="text-gray-300 text-lg">Create, schedule, and manage your Instagram content</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 p-2 h-auto">
            <TabsTrigger
              value="calendar"
              className="flex items-center space-x-2 px-6 py-3 text-gray-300 data-[state=active]:text-yellow-500 data-[state=active]:bg-yellow-500/10"
            >
              <Calendar className="w-4 h-4" />
              <span>Calendar</span>
            </TabsTrigger>
            <TabsTrigger
              value="library"
              className="flex items-center space-x-2 px-6 py-3 text-gray-300 data-[state=active]:text-yellow-500 data-[state=active]:bg-yellow-500/10"
            >
              <Grid3X3 className="w-4 h-4" />
              <span>Library</span>
            </TabsTrigger>
            <TabsTrigger
              value="composer"
              className="flex items-center space-x-2 px-6 py-3 text-gray-300 data-[state=active]:text-yellow-500 data-[state=active]:bg-yellow-500/10"
            >
              <PenTool className="w-4 h-4" />
              <span>Composer</span>
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="flex items-center space-x-2 px-6 py-3 text-gray-300 data-[state=active]:text-yellow-500 data-[state=active]:bg-yellow-500/10"
            >
              <Settings className="w-4 h-4" />
              <span>Auto-Gen</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="animate-fade-in">
            <ContentCalendar {...calendarData} />
          </TabsContent>

          <TabsContent value="library" className="animate-fade-in">
            <ContentLibraryGrid {...libraryData} />
          </TabsContent>

          <TabsContent value="composer" className="animate-fade-in">
            <PostComposer />
          </TabsContent>

          <TabsContent value="settings" className="animate-fade-in">
            <AutoGenerationSettings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
