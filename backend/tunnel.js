const ngrok = require('ngrok');

async function startTunnel() {
  try {
    console.log('🌐 Starting ngrok tunnel...');
    
    const url = await ngrok.connect({
      addr: 3001,
      proto: 'http',
      region: 'us',
      authtoken: '30jGfwyimSMPLu4bcgiowYQ1lVS_6CgcAjPDxtX4Qe6ae1Kpt'  // Replace with your real token
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
  }
}

startTunnel();