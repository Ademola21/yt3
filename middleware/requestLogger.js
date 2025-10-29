const { db, requestLogs } = require('../db');

async function logRequest(apiKeyId, req, statusCode, responseTime, payloadSize = null) {
  try {
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    await db.insert(requestLogs).values({
      apiKeyId,
      endpoint: req.originalUrl || req.url,
      method: req.method,
      statusCode,
      responseTime,
      payloadSize,
      ipAddress,
      userAgent
    });
  } catch (error) {
    console.error('Error logging request:', error);
  }
}

function requestLoggerMiddleware(req, res, next) {
  const startTime = Date.now();
  let logged = false;
  
  const originalSend = res.send;
  res.send = function(data) {
    res.send = originalSend;
    
    if (!logged && req.apiKeyId) {
      const responseTime = Date.now() - startTime;
      const payloadSize = data ? Buffer.byteLength(JSON.stringify(data)) : 0;
      
      logged = true;
      logRequest(req.apiKeyId, req, res.statusCode, responseTime, payloadSize).catch(err => {
        console.error('Failed to log request:', err);
      });
    }
    
    return res.send(data);
  };
  
  res.on('finish', () => {
    if (!logged && res.headersSent && req.apiKeyId) {
      const responseTime = Date.now() - startTime;
      
      logged = true;
      logRequest(req.apiKeyId, req, res.statusCode, responseTime).catch(err => {
        console.error('Failed to log request on finish:', err);
      });
    }
  });
  
  next();
}

module.exports = { requestLoggerMiddleware, logRequest };
