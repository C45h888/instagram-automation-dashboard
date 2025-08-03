import ngrok from 'ngrok';

async function startTunnel() {
  try {
    console.log('🌐 Starting ngrok tunnel...');
    
    // Set authtoken first (stable version method)
    await ngrok.authtoken('30jGfwyimSMPLu4bcgiowYQ1lVS_6CgcAjPDxtX4Qe6ae1Kpt');
    
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