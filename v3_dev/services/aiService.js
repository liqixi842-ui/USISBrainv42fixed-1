/**
 * AI Service Wrapper for v5 Report Engine
 * Provides a simple callOpenAI function that wraps multiAiProvider
 */

// Use lazy loading to avoid circular dependencies
let multiAiProvider = null;

function getMultiAiProvider() {
  if (!multiAiProvider) {
    const { getMultiAIProvider } = require('../../multiAiProvider');
    multiAiProvider = getMultiAIProvider();
  }
  return multiAiProvider;
}

/**
 * Call OpenAI (or best available AI model) with given prompt
 * @param {string|Array} promptOrMessages - Either a string prompt or an array of messages
 * @param {Object} options - Additional options (model, systemPrompt, maxTokens, temperature, max_tokens)
 * @returns {Promise<string>} - Generated text
 */
async function callOpenAI(promptOrMessages, options = {}) {
  try {
    const provider = getMultiAiProvider();
    
    // Build messages array - support both string and array inputs
    let messages;
    if (Array.isArray(promptOrMessages)) {
      // Already a messages array
      messages = promptOrMessages;
    } else {
      // String prompt - build messages array
      messages = [
        {
          role: 'system',
          content: options.systemPrompt || 'You are a professional equity research analyst writing institutional-grade investment reports.'
        },
        {
          role: 'user',
          content: promptOrMessages
        }
      ];
    }
    
    // Call the AI provider with correct method signature
    const result = await provider.generate(
      options.model || 'gpt-4o',
      messages,
      {
        maxTokens: options.maxTokens || options.max_tokens || 2000,
        temperature: options.temperature || 0.7
      }
    );
    
    if (!result.success) {
      throw new Error(result.error || 'AI call failed');
    }
    
    // Ensure result is always a string
    let text = result.text;
    if (typeof text !== 'string') {
      text = JSON.stringify(text);
    }
    
    return text.trim();
  } catch (error) {
    console.error(`❌ [aiService] callOpenAI failed:`, error.message);
    throw error;
  }
}

module.exports = {
  callOpenAI
};
