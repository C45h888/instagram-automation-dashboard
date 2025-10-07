// backend/config/n8n.js
const N8N_WEBHOOKS = {
    // N8N Workflow URLs - Update these with YOUR actual N8N webhook URLs
    instagram_comment_processor: process.env.N8N_COMMENT_WEBHOOK || 'https://your-n8n-instance.com/webhook/instagram-comment',
    engagement_analyzer: process.env.N8N_ENGAGEMENT_WEBHOOK || 'https://your-n8n-instance.com/webhook/engagement-analysis',
    auto_responder: process.env.N8N_AUTORESPOND_WEBHOOK || 'https://your-n8n-instance.com/webhook/auto-respond',
    metrics_processor: process.env.N8N_METRICS_WEBHOOK || 'https://your-n8n-instance.com/webhook/metrics-processing',
    alert_handler: process.env.N8N_ALERTS_WEBHOOK || 'https://your-n8n-instance.com/webhook/alert-processing',
    graph_api_caller: process.env.N8N_GRAPH_API_WEBHOOK || 'https://your-n8n-instance.com/webhook/graph-api-calls'
  };
  
  module.exports = N8N_WEBHOOKS;