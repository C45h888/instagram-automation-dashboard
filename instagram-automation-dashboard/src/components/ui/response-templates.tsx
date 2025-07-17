"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./card"
import { Button } from "./button"
import { Badge } from "./badge"
import { ScrollArea } from "./scroll-area"
import { FileText, Star } from "lucide-react"

interface Template {
  id: number
  category: string
  title: string
  content: string
  usage_count: number
  performance_score: number
}

interface ResponseTemplatesProps {
  template_categories: string[]
  templates: Template[]
  performance_metrics: any
  ab_testing_data: any
  usage_stats: any
}

export function ResponseTemplates({ template_categories, templates }: ResponseTemplatesProps) {
  const [activeCategory, setActiveCategory] = useState("all")

  const filtered = templates.filter((t) => activeCategory === "all" || t.category === activeCategory)

  return (
    <Card className="glass-morphism-card">
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center space-x-3 text-white font-sf-pro">
          <FileText className="w-5 h-5 text-gold-500" />
          <span>Response Templates</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-6">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setActiveCategory("all")}
            className={`font-sf-pro ${activeCategory === "all" ? "text-gold-500 bg-gold-500/10" : "text-white/70"}`}
          >
            All
          </Button>
          {template_categories.map((cat) => (
            <Button
              key={cat}
              size="sm"
              variant="ghost"
              onClick={() => setActiveCategory(cat)}
              className={`capitalize font-sf-pro ${
                activeCategory === cat ? "text-gold-500 bg-gold-500/10" : "text-white/70"
              }`}
            >
              {cat}
            </Button>
          ))}
        </div>

        <ScrollArea className="h-[32rem] custom-scrollbar-premium">
          {filtered.map((tpl) => (
            <div
              key={tpl.id}
              className="glass-morphism-workflow p-4 rounded-xl mb-4 hover:bg-white/5 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-white font-sf-pro">{tpl.title}</h4>
                <Badge className="bg-gold-500/20 text-gold-400 border-gold-500/30 font-sf-pro">{tpl.category}</Badge>
              </div>
              <p className="text-sm text-white/70 font-sf-pro my-3">{tpl.content}</p>
              <div className="flex items-center space-x-4 text-xs text-white/50 font-sf-pro">
                <span>Used {tpl.usage_count}×</span>
                <div className="flex items-center space-x-1">
                  <Star className="w-3 h-3 text-yellow-400" />
                  <span>{tpl.performance_score.toFixed(1)}</span>
                </div>
              </div>
            </div>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
