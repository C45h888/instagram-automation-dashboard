import ActivityFeed from '../components/ui/activity-feed';

const activityData = [
  {
    activity_type: "post",
    description: "New post published: Summer Collection Launch",
    timestamp: "2 minutes ago",
    user: "@fashionbrand",
    status: "success",
    details: "Reached 2.3K users, 145 likes, 23 comments",
  },
  {
    activity_type: "comment",
    description: "Auto-replied to customer inquiry about sizing",
    timestamp: "5 minutes ago",
    user: "@customer_sarah",
    status: "success",
    details: "Template: Sizing Guide used",
  },
];

export default function ActivityFeedPage() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <ActivityFeed activities={activityData} />
    </div>
  );
} 