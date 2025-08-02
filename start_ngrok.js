const ngrok = require('ngrok');

(async function() {
  try {
    console.log('🚀 Starting Ngrok tunnel...');
    
    const url = await ngrok.connect(3001);
    
    console.log('✅ Ngrok tunnel started!');
    console.log('🌐 Public URL:', url);
    console.log('📊 Local server:', 'http://localhost:3001');
    
    console.log('\n📋 N8N WEBHOOK URLS:');
    console.log('===================================');
    console.log('Response Data:    ', url + '/webhook/n8n-response');
    console.log('Performance Metrics:', url + '/webhook/n8n-metrics');
    console.log('Urgent Alerts:    ', url + '/webhook/n8n-alerts');
    console.log('System Status:    ', url + '/webhook/n8n-status');
    console.log('===================================');
    
    // Keep running
    console.log('\n🔄 Tunnel is running... Press Ctrl+C to stop');
    
  } catch (error) {
    console.error('❌ Error starting Ngrok:', error.message);
    if (error.message.includes('authtoken')) {
      console.log('💡 Sign up at https://ngrok.com for free auth token');
    }
  }
})();