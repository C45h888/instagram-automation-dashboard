const ngrok = require('ngrok');

async function startTunnel() {
  try {
    console.log('🚀 Starting tunnel from frontend directory...');
    
    // Connect to backend server on port 3001
    const url = await ngrok.connect(3001);
    
    console.log('✅ SUCCESS! Tunnel is running');
    console.log('🌐 Public URL:', url);
    console.log('📊 Backend Server: http://localhost:3001');
    console.log('');
    console.log('📋 N8N WEBHOOK URLS:');
    console.log('=====================================');
    console.log('Response Data:     ', url + '/webhook/n8n-response');
    console.log('Performance Metrics:', url + '/webhook/n8n-metrics');
    console.log('Urgent Alerts:     ', url + '/webhook/n8n-alerts');
    console.log('System Status:     ', url + '/webhook/n8n-status');
    console.log('Instagram Webhook: ', url + '/webhook/instagram');
    console.log('=====================================');
    console.log('');
    console.log('🔄 Tunnel is active. Keep this terminal open.');
    console.log('   Press Ctrl+C to stop the tunnel');
    
    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\n🛑 Stopping tunnel...');
      await ngrok.kill();
      process.exit();
    });
    
  } catch (error) {
    console.error('❌ Tunnel failed:', error.message);
    
    if (error.message.includes('authtoken')) {
      console.log('');
      console.log('🔑 Ngrok requires authentication:');
      console.log('1. Sign up at: https://ngrok.com (free)');
      console.log('2. Get your auth token from dashboard');
      console.log('3. Run: npx ngrok config add-authtoken YOUR_TOKEN');
      console.log('4. Then run this script again');
    }
  }
}

startTunnel();