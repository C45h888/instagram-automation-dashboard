import { AutoGenerationSettings } from "../components/ui/auto-generation-settings"

export default function Settings() {
  return (
    <div className="space-y-10 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">System Settings</h1>
        <p className="text-gray-300 text-lg">Configure your automation and system preferences</p>
      </div>
      <div className="animate-fade-in">
        <AutoGenerationSettings />
      </div>
    </div>
  )
} 