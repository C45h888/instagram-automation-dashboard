import { useState } from "react"
import { ContentCalendar } from "../components/ui/content-calendar"
import { ContentLibraryGrid } from "../components/ui/content-library-grid"
import { PostComposer } from "../components/ui/post-composer"
import { AutoGenerationSettings } from "../components/ui/auto-generation-settings"
import { Calendar, Grid3X3, PenTool, Settings } from "lucide-react"

const ContentManagement: React.FC = () => {
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

  const tabList = [
    { value: "calendar", label: "Calendar", icon: <Calendar className="w-4 h-4" /> },
    { value: "library", label: "Library", icon: <Grid3X3 className="w-4 h-4" /> },
    { value: "composer", label: "Composer", icon: <PenTool className="w-4 h-4" /> },
    { value: "settings", label: "Auto-Gen", icon: <Settings className="w-4 h-4" /> },
  ]

  return (
    <div className="space-y-10 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Content Management</h1>
        <p className="text-gray-300 text-lg">Create, schedule, and manage your Instagram content</p>
      </div>
      {/* Premium Tabs */}
      <div className="flex flex-wrap gap-4 mb-8">
        {tabList.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 border border-gray-700 backdrop-blur-sm shadow-sm text-base
              ${activeTab === tab.value ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' : 'bg-gray-800/50 text-gray-300 hover:text-white hover:bg-white/10'}`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      {/* Tab Content */}
      <div className="animate-fade-in">
        {activeTab === "calendar" && <ContentCalendar {...calendarData} />}
        {activeTab === "library" && <ContentLibraryGrid {...libraryData} />}
        {activeTab === "composer" && <PostComposer />}
        {activeTab === "settings" && <AutoGenerationSettings />}
      </div>
    </div>
  )
}

export default ContentManagement; 