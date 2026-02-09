// backend/middleware/agent-auth.js - Agent API Key Authentication
// Secures agent proxy endpoints with X-API-Key header validation

const crypto = require('crypto');

/**
 * Validates X-API-Key header for agent proxy endpoints
 * Uses timing-safe comparison to prevent timing attacks
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function validateAgentApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.AGENT_API_KEY;

  // Check if AGENT_API_KEY is configured
  if (!expectedKey) {
    console.error('❌ AGENT_API_KEY environment variable not configured');
    return res.status(500).json({
      error: 'Server configuration error',
      code: 'AGENT_API_KEY_NOT_CONFIGURED',
      message: 'Agent API authentication is not configured on the server'
    });
  }

  // Check if API key is provided
  if (!apiKey) {
    console.warn('⚠️ Agent request received without X-API-Key header');
    return res.status(401).json({
      error: 'Missing API key',
      code: 'MISSING_API_KEY',
      message: 'X-API-Key header is required for agent endpoints'
    });
  }

  // Timing-safe comparison to prevent timing attacks
  try {
    const apiKeyBuffer = Buffer.from(apiKey);
    const expectedKeyBuffer = Buffer.from(expectedKey);

    // Ensure buffers are same length before comparison
    if (apiKeyBuffer.length !== expectedKeyBuffer.length) {
      console.warn('⚠️ Invalid agent API key (length mismatch)');
      return res.status(401).json({
        error: 'Invalid API key',
        code: 'INVALID_API_KEY',
        message: 'The provided API key is invalid'
      });
    }

    if (!crypto.timingSafeEqual(apiKeyBuffer, expectedKeyBuffer)) {
      console.warn('⚠️ Invalid agent API key');
      return res.status(401).json({
        error: 'Invalid API key',
        code: 'INVALID_API_KEY',
        message: 'The provided API key is invalid'
      });
    }
  } catch (error) {
    console.error('❌ API key validation error:', error.message);
    return res.status(401).json({
      error: 'Invalid API key',
      code: 'INVALID_API_KEY',
      message: 'The provided API key is invalid'
    });
  }

  // API key is valid
  console.log('✅ Agent API key validated');
  next();
}

module.exports = { validateAgentApiKey };
