const crypto = require('crypto');

function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function generateSecureApiKey() {
  const prefix = 'vpa_';
  const randomBytes = crypto.randomBytes(24);
  const key = prefix + randomBytes.toString('base64url');
  return key;
}

function verifyApiKey(plainKey, hashedKey) {
  const hash = hashApiKey(plainKey);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hashedKey));
}

const rateLimitStore = new Map();

function checkRateLimit(apiKeyId, limit) {
  const now = Date.now();
  const windowMs = 60000;
  
  if (!rateLimitStore.has(apiKeyId)) {
    rateLimitStore.set(apiKeyId, []);
  }
  
  const requests = rateLimitStore.get(apiKeyId);
  const recentRequests = requests.filter(timestamp => now - timestamp < windowMs);
  
  if (recentRequests.length >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(recentRequests[0] + windowMs)
    };
  }
  
  recentRequests.push(now);
  rateLimitStore.set(apiKeyId, recentRequests);
  
  return {
    allowed: true,
    remaining: limit - recentRequests.length,
    resetAt: new Date(now + windowMs)
  };
}

function cleanupRateLimitStore() {
  const now = Date.now();
  const windowMs = 60000;
  
  for (const [apiKeyId, requests] of rateLimitStore.entries()) {
    const recentRequests = requests.filter(timestamp => now - timestamp < windowMs);
    if (recentRequests.length === 0) {
      rateLimitStore.delete(apiKeyId);
    } else {
      rateLimitStore.set(apiKeyId, recentRequests);
    }
  }
}

setInterval(cleanupRateLimitStore, 60000);

module.exports = {
  hashApiKey,
  generateSecureApiKey,
  verifyApiKey,
  checkRateLimit
};
