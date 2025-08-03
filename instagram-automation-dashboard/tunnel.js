const ngrok = require('ngrok');
const path = require('path');

async function startTunnel() {
  try {
    console.log('🌐 Starting ngrok tunnel...');
    
    // Kill any existing ngrok processes first
    await ngrok.kill();
    
    const url = await ngrok.connect({
      addr: 3001,
      proto: 'http',
      region: 'us',
      authtoken: 'YOUR_ACTUAL_TOKEN_HERE',  // Replace with your real token
      binPath: (opts) => {
        // Let ngrok handle binary path automatically
        return path.join(__dirname, 'node_modules', 'ngrok', 'bin', 'ngrok');
      }
    });
    
    console.log('✅ Ngrok tunnel active!');
    console.log('📡 Public URL:', url);
    console.log('🔗 Webhook URL:', `${url}/webhook/instagram`);
    console.log('💚 Health URL:', `${url}/health`);
    
    process.on('SIGINT', async () => {
      console.log('\n🛑 Closing tunnel...');
      await ngrok.kill();
      process.exit(0);
    });
    
    return url;
  } catch (error) {
    console.error('❌ Ngrok Error:', error.message);
    
    // Fallback: try without explicit binary path
    console.log('🔄 Trying fallback method...');
    try {
      const fallbackUrl = await ngrok.connect({
        addr: 3001,
        authtoken: 'YOUR_ACTUAL_TOKEN_HERE'  // Replace with your real token
      });
      
      console.log('✅ Fallback tunnel active!');
      console.log('📡 Public URL:', fallbackUrl);
      return fallbackUrl;
    } catch (fallbackError) {
      console.error('❌ Fallback failed:', fallbackError.message);
    }
  }
}

startTunnel();