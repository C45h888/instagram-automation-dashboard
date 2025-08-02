const ngrok = require('ngrok');

(async function() {
  try {
    console.log('🚀 Starting Ngrok tunnel...');
    
    // Start ngrok tunnel
    const url = await ngrok.connect({
      addr: 3001,
      region: 'us'
    });
    
    console.log('✅ Ngrok tunnel started!');
    console.log('🌐 Public URL:', url);
    console.log('📊 Local server:', 'http://localhost:3001');
    console.log('🔗 Ngrok dashboard:', 'http://localhost:4040');
    
    console.log('
📋 N8N WEBHOOK URLS:');
    console.log('===================================');
    console.log('Response Data:    ', url + '/webhook/n8n-response');
    console.log('Performance Metrics:', url + '/webhook/n8n-metrics');  
    console.log('Urgent Alerts:    ', url + '/webhook/n8n-alerts');
    console.log('System Status:    ', url + '/webhook/n8n-status');
    console.log('===================================');
    
    // Test the tunnel
    console.log('
🧪 Testing tunnel...');
    const fetch = require('node-fetch');
    try {
      const response = await fetch(url + '/health');
      const data = await response.json();
      console.log('✅ Tunnel test successful:', data);
    } catch (err) {
      console.log('⚠️ Tunnel test failed, but URL should work:', err.message);
    }
    
    // Keep running
    console.log('
🔄 Tunnel is running... Press Ctrl+C to stop');
    process.on('SIGINT', async () => {
      console.log('
🛑 Stopping Ngrok tunnel...');
      await ngrok.kill();
      process.exit();
    });
    
  } catch (error) {
    console.error('❌ Error starting Ngrok:', error.message);
    if (error.message.includes('authtoken')) {
      console.log('💡 You may need to sign up at https://ngrok.com and set auth token');
    }
    process.exit(1);
  }
})();