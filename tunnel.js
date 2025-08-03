import { spawn } from 'child_process';

async function startTunnel() {
  try {
    console.log('🌐 Starting ngrok tunnel...');
    
    const ngrokProcess = spawn('npx', ['ngrok', 'http', '3001'], {
      stdio: 'pipe'
    });
    
    ngrokProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(output);
      
      // Extract URL from ngrok output
      const urlMatch = output.match(/https:\/\/[a-z0-9-]+\.ngrok\.io/);
      if (urlMatch) {
        console.log('📡 Public URL:', urlMatch[0]);
        console.log('🔗 Webhook URL:', `${urlMatch[0]}/webhook/instagram`);
      }
    });
    
  } catch (error) {
    console.error('❌ Ngrok Error:', error.message);
  }
}

startTunnel();