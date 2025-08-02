const ngrok = require('ngrok');

async function startTunnel() {
  try {
    console.log('Starting ngrok...');
    const url = await ngrok.connect(3001);
    console.log('Public URL:', url);
    console.log('');
    console.log('N8N Webhook URLs:');
    console.log('Response:', url + '/webhook/n8n-response');
    console.log('Metrics:', url + '/webhook/n8n-metrics');
    console.log('Alerts:', url + '/webhook/n8n-alerts');
    console.log('Status:', url + '/webhook/n8n-status');
    return url;
  } catch (error) {
    console.error('Error:', error.message);
  }
}

startTunnel();