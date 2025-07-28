# Meta API Webhook Configuration Guide

## Prerequisites for Meta API Approval

### 1. Set Up Your Development Environment

1. **Install ngrok** (for local testing):
   ```bash
   npm install -g ngrok
   # or download from https://ngrok.com/
   ```

2. **Start your local server**:
   ```bash
   npm run dev
   ```

3. **Expose your local server** (in a new terminal):
   ```bash
   ngrok http 5173
   ```
   Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### 2. Configure Environment Variables

Create a `.env` file in your project root:

```env
VITE_WEBHOOK_URL=https://your-ngrok-url.ngrok.io
VITE_WEBHOOK_VERIFY_TOKEN=your_unique_verify_token_123
VITE_META_APP_ID=your_meta_app_id
VITE_META_APP_SECRET=your_meta_app_secret
VITE_API_BASE_URL=https://your-ngrok-url.ngrok.io
```

### 3. Meta Developer App Setup

1. **Go to Meta for Developers**: https://developers.facebook.com/
2. **Create a new app** → Business → Instagram Basic Display
3. **Add Instagram Basic Display product**
4. **Configure Instagram Basic Display**:
   - Valid OAuth Redirect URIs: `https://your-ngrok-url.ngrok.io/auth/callback`
   - Deauthorize Callback URL: `https://your-ngrok-url.ngrok.io/auth/deauthorize`
   - Data Deletion Request URL: `https://your-ngrok-url.ngrok.io/auth/data-deletion`

### 4. Webhook Configuration

1. **In your Meta app dashboard**:
   - Go to Products → Webhooks
   - Click "Add Subscription"
   - Callback URL: `https://your-ngrok-url.ngrok.io/webhook/instagram`
   - Verify Token: Use the same token from your `.env` file
   - Subscribe to fields: `comments`, `mentions`, `story_insights`

### 5. Required Webhook Endpoints

Your app needs these endpoints for Meta approval:

```javascript
// GET /webhook/instagram - Webhook verification
app.get('/webhook/instagram', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// POST /webhook/instagram - Handle webhook events
app.post('/webhook/instagram', (req, res) => {
  const body = req.body;
  
  if (body.object === 'instagram') {
    // Process the webhook event
    console.log('Received webhook:', JSON.stringify(body, null, 2));
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});
```

### 6. Testing Your Webhooks

1. **Test webhook verification**:
   ```bash
   curl -X GET "https://your-ngrok-url.ngrok.io/webhook/instagram?hub.verify_token=your_verify_token&hub.challenge=test_challenge&hub.mode=subscribe"
   ```

2. **Test webhook reception**:
   ```bash
   curl -X POST https://your-ngrok-url.ngrok.io/webhook/instagram \
     -H "Content-Type: application/json" \
     -d '{"object":"instagram","entry":[{"id":"test","changes":[{"field":"comments","value":{"test":"data"}}]}]}'
   ```

### 7. App Review Requirements

For Meta API approval, you need:

1. **Privacy Policy URL**: Required for app review
2. **Terms of Service URL**: Required for app review
3. **App Icon**: 1024x1024px PNG
4. **Detailed App Description**: Explain how you use Instagram data
5. **Screen Recording**: Show your app functionality
6. **Use Case Documentation**: Explain why you need each permission

### 8. Permissions to Request

For Instagram automation, request these permissions:
- `instagram_basic`: Basic profile info
- `instagram_content_publish`: Post content
- `instagram_manage_comments`: Manage comments
- `instagram_manage_insights`: Access analytics

### 9. Common Issues & Solutions

**Webhook not receiving events**:
- Ensure ngrok is running and URL is correct
- Check that webhook is subscribed to correct fields
- Verify your verify_token matches exactly

**SSL Certificate errors**:
- Always use HTTPS URLs (ngrok provides this)
- Don't use localhost URLs in Meta configuration

**App Review Rejection**:
- Provide clear use case documentation
- Show actual functionality in screen recordings
- Ensure privacy policy covers Instagram data usage

### 10. Next Steps

1. Set up the webhook endpoints in your backend
2. Test webhook verification and event reception
3. Implement proper error handling and logging
4. Prepare app review materials (privacy policy, terms, etc.)
5. Submit for Meta app review

### Testing Checklist

- [ ] ngrok tunnel is active and HTTPS
- [ ] Environment variables are configured
- [ ] Webhook verification endpoint responds correctly
- [ ] Webhook event endpoint processes test data
- [ ] Meta app configuration matches your URLs
- [ ] Privacy policy and terms of service are accessible
- [ ] App functionality is documented with screenshots/videos