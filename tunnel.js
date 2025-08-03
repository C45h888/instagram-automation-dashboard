import ngrok from 'ngrok';

async function startTunnel() {
  try {
    console.log('🌐 Starting ngrok tunnel...');
    
    // NO authtoken line needed - it's set globally via command line
    const url = await ngrok.connect({
      addr: 3001,
      proto: 'http',
      region: 'us'
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