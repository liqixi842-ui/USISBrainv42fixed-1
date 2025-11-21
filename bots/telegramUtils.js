// Telegram API Utilities
// Provides reusable Telegram API functions for all bots

const https = require('https');
const FormData = require('form-data');

/**
 * Create a Telegram API function for a specific bot token
 * @param {string} botToken - Telegram bot token
 * @returns {Function} telegramAPI function
 */
function createTelegramAPI(botToken) {
  return function telegramAPI(method, params = {}, timeout = 35000) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(params);
      const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${botToken}/${method}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data, 'utf8')
        },
        timeout
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(body);
            if (!result.ok) {
              reject(new Error(result.description || 'API call failed'));
            } else {
              resolve(result);
            }
          } catch (e) {
            reject(new Error(`Failed to parse response: ${body.slice(0, 200)}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout after ${timeout}ms`));
      });

      req.write(data);
      req.end();
    });
  };
}

/**
 * Send a document (PDF, image, etc.) using multipart/form-data
 * @param {string} botToken - Telegram bot token
 * @param {number} chatId - Chat ID
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - File name
 * @param {string} caption - Caption text
 * @returns {Promise<Object>} Telegram API response
 */
async function sendDocument(botToken, chatId, buffer, filename, caption = '') {
  return new Promise((resolve, reject) => {
    if (!Buffer.isBuffer(buffer)) {
      return reject(new Error('Buffer is required'));
    }
    
    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('caption', caption.slice(0, 1000));
    form.append('document', buffer, { 
      filename: filename || 'document.pdf', 
      contentType: 'application/pdf' 
    });

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/sendDocument`,
      method: 'POST',
      headers: form.getHeaders()
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (!result.ok) {
            reject(new Error(result.description || 'sendDocument failed'));
          } else {
            resolve(result);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    form.pipe(req);
  });
}

module.exports = {
  createTelegramAPI,
  sendDocument
};
