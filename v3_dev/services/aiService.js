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
 * @param {string} prompt - The user prompt
 * @param {string} model - Model to use (optional, defaults to intelligent selection)
 * @returns {Promise<string>} - Generated text
 */
async function callOpenAI(prompt, model = 'gpt-4o') {
  try {
    const provider = getMultiAiProvider();
    
    // Call the AI with the prompt
    const result = await provider.call({
      model,
      systemPrompt: 'You are a professional equity research analyst writing institutional-grade investment reports.',
      userPrompt: prompt,
      maxTokens: 2000,
      temperature: 0.7
    });
    
    if (!result.success) {
      throw new Error(result.error || 'AI call failed');
    }
    
    return result.text;
  } catch (error) {
    console.error(`❌ [aiService] callOpenAI failed:`, error.message);
    throw error;
  }
}

module.exports = {
  callOpenAI
};
