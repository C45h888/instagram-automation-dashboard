import lt from 'localtunnel';

async function startTunnel() {
  try {
    console.log('🌐 Starting localtunnel...');
    
    const tunnel = await lt({ port: 3001 });
    
    console.log('✅ Tunnel active!');
    console.log('📡 Public URL:', tunnel.url);
    console.log('🔗 Webhook URL:', `${tunnel.url}/webhook/instagram`);
    console.log('💚 Health URL:', `${tunnel.url}/health`);
    
    tunnel.on('close', () => {
      console.log('🛑 Tunnel closed');
    });
    
    return tunnel.url;
  } catch (error) {
    console.error('❌ Tunnel Error:', error.message);
  }
}

startTunnel();