const ngrok = require('ngrok');

async function startTunnel() {
  try {
    console.log('🌐 Starting ngrok tunnel...');
    
    const url = await ngrok.connect({
      addr: 3001,                    // Backend server port
      proto: 'http',
      region: 'us',
      authtoken: '30jGfwyimSMPLu4bcgiowYQ1lVS_6CgcAjPDxtX4Qe6ae1Kpt'  // Keep your existing token
    });
    
    console.log('✅ Ngrok tunnel active!');
    console.log('📡 Public URL:', url);
    console.log('🔗 Webhook URL:', `${url}/webhook/instagram`);
    console.log('💚 Health URL:', `${url}/health`);
    
    // Test backend connection through tunnel
    await testConnection(url);
    
    // Keep tunnel alive
    process.on('SIGINT', async () => {
      console.log('\n🛑 Closing tunnel...');
      await ngrok.kill();
      process.exit(0);
    });
    
    return url;
  } catch (error) {
    console.error('❌ Ngrok Error:', error.message);
  }
}

async function testConnection(url) {
  console.log('\n🧪 Testing tunnel connection...');
  
  try {
    const http = require('http');
    const testUrl = new URL('/health', url);
    
    const req = http.get(testUrl, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('✅ Tunnel test successful:', data);
      });
    });
    
    req.on('error', (error) => {
      console.log('❌ Tunnel test failed:', error.message);
    });
  } catch (error) {
    console.log('❌ Connection test error:', error.message);
  }
}

startTunnel();