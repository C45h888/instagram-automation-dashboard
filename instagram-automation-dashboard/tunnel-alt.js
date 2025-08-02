import localtunnel from 'localtunnel';

async function startTunnel() {
  try {
    console.log('🚀 Starting LocalTunnel (ngrok alternative)...');
    
    // Create tunnel to port 3001
    const tunnel = await localtunnel({ 
      port: 3001,
      subdomain: 'instagram-auto-' + Date.now().toString().slice(-6) // Random subdomain
    });
    
    console.log('✅ SUCCESS! Tunnel is running');
    console.log('🌐 Public URL:', tunnel.url);
    console.log('📊 Backend Server: http://localhost:3001');
    console.log('');
    console.log('📋 N8N WEBHOOK URLS:');
    console.log('=====================================');
    console.log('Response Data:     ', tunnel.url + '/webhook/n8n-response');
    console.log('Performance Metrics:', tunnel.url + '/webhook/n8n-metrics');
    console.log('Urgent Alerts:     ', tunnel.url + '/webhook/n8n-alerts');
    console.log('System Status:     ', tunnel.url + '/webhook/n8n-status');
    console.log('Instagram Webhook: ', tunnel.url + '/webhook/instagram');
    console.log('=====================================');
    console.log('');
    console.log('🔄 Tunnel is active. Keep this terminal open.');
    console.log('   Press Ctrl+C to stop the tunnel');
    
    // Keep the process running
    tunnel.on('close', () => {
      console.log('🛑 Tunnel closed');
    });
    
    process.on('SIGINT', async () => {
      console.log('\n🛑 Stopping tunnel...');
      tunnel.close();
      process.exit();
    });
    
  } catch (error) {
    console.error('❌ Tunnel failed:', error.message);
    
    if (error.message.includes('ENOTFOUND')) {
      console.log('');
      console.log('🌐 CONNECTION ISSUE:');
      console.log('1. Check your internet connection');
      console.log('2. Make sure backend server is running on port 3001');
      console.log('3. Try again in a few seconds');
    }
  }
}

startTunnel();