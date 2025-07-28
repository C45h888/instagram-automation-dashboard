import axios from 'axios';

const WEBHOOK_BASE_URL = import.meta.env.VITE_WEBHOOK_URL || 'https://your-app.ngrok.io';
const VERIFY_TOKEN = import.meta.env.VITE_WEBHOOK_VERIFY_TOKEN || 'your_verify_token_here';

// Webhook verification for Meta
export const verifyWebhook = (mode: string, token: string, challenge: string) => {
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return challenge;
  }
  throw new Error('Webhook verification failed');
};

// Handle incoming webhook events from Meta
export const handleWebhookEvent = (body: any) => {
  console.log('Received webhook event:', body);
  
  if (body.object === 'instagram') {
    body.entry?.forEach((entry: any) => {
      entry.changes?.forEach((change: any) => {
        if (change.field === 'comments') {
          handleCommentEvent(change.value);
        } else if (change.field === 'mentions') {
          handleMentionEvent(change.value);
        }
      });
    });
  }
  
  return { status: 'success' };
};

const handleCommentEvent = (commentData: any) => {
  // Process new comments
  console.log('New comment:', commentData);
  // Add to your engagement store or trigger notifications
};

const handleMentionEvent = (mentionData: any) => {
  // Process new mentions
  console.log('New mention:', mentionData);
  // Add to your engagement store or trigger notifications
};

// Test webhook endpoints
export const testWebhookEndpoints = async () => {
  const endpoints = [
    '/webhook/instagram',
    '/webhook/test-connection',
    '/webhook/verify'
  ];
  
  const results = [];
  
  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(`${WEBHOOK_BASE_URL}${endpoint}`);
      results.push({ endpoint, status: 'success', response: response.data });
    } catch (error) {
      results.push({ endpoint, status: 'error', error: error.message });
    }
  }
  
  return results;
};