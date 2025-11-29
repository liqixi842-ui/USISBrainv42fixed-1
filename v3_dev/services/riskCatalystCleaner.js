/**
 * ════════════════════════════════════════════════════════════════
 * RISK & CATALYST CLEANER (Phase 3.2)
 * ════════════════════════════════════════════════════════════════
 * 
 * Professional cleanup layer for research report catalysts and risks
 * Ensures institutional-grade quality for bullet point sections
 * 
 * Key Functions:
 * - Remove placeholder text ("Additional factor 1", "N/A", etc.)
 * - Filter out incomplete sentences (no subject/verb)
 * - Remove short fragments (< 20 chars)
 * - Deduplicate similar items (> 0.7 similarity)
 * - Auto-fill to minimum 5 items using GPT-4o-mini
 * 
 * Usage:
 *   const RiskCatalystCleaner = require('./riskCatalystCleaner');
 *   const cleanedCatalysts = await RiskCatalystCleaner.cleanRiskCatalystList(report.catalysts_text, 'catalyst', report);
 *   const cleanedRisks = await RiskCatalystCleaner.cleanRiskCatalystList(report.risks_text, 'risk', report);
 */

const fetch = require('node-fetch');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

class RiskCatalystCleaner {
  constructor() {
    this.minItems = 5;
    this.maxItems = 8;
    this.minLength = 30; // Increased from 20 to 30 to filter out short placeholders
    this.similarityThreshold = 0.7;
  }

  /**
   * Clean and enhance a list of catalysts or risks
   * @param {array|string} list - Array of items or comma-separated string
   * @param {string} type - "catalyst" or "risk"
   * @param {object} report - Full report object for context
   * @returns {array} Cleaned and validated list (5-8 items)
   */
  async cleanRiskCatalystList(list, type = 'catalyst', report = null) {
    console.log(`\n🧹 [RiskCatalystCleaner] Cleaning ${type} list...`);
    
    // Convert to array if string
    let items = Array.isArray(list) ? list : (typeof list === 'string' ? [list] : []);
    
    const originalCount = items.length;
    
    // ══════════════════════════════════════════════════════════════
    // Step 1: Remove placeholders and invalid content
    // ══════════════════════════════════════════════════════════════
    items = items.filter(item => {
      if (!item || typeof item !== 'string') return false;
      
      const text = item.trim();
      
      // STRICT FILTER: Remove ANY item containing "Additional factor" or "factor 1/2/3"
      if (/additional factor/i.test(text)) {
        console.log(`   │  Rejected (Additional factor): "${text.substring(0, 60)}..."`);
        return false;
      }
      
      if (/\bfactor\s*[123]\b/i.test(text)) {
        console.log(`   │  Rejected (factor 1/2/3): "${text.substring(0, 60)}..."`);
        return false;
      }
      
      // Remove other placeholder patterns
      const placeholderPatterns = [
        /placeholder/i,
        /\bn\/a\b/i,
        /\btbd\b/i,
        /\bcoming soon\b/i,
        /\bto be determined\b/i,
        /\bnot available\b/i,
        /^n\/a$/i,
        /^tbd$/i
      ];
      
      for (const pattern of placeholderPatterns) {
        if (pattern.test(text)) {
          console.log(`   │  Rejected (placeholder): "${text.substring(0, 60)}..."`);
          return false;
        }
      }
      
      return true;
    });
    
    console.log(`   ├─ After placeholder removal: ${items.length} items (removed ${originalCount - items.length})`);
    
    // ══════════════════════════════════════════════════════════════
    // Step 2: Filter by minimum length
    // ══════════════════════════════════════════════════════════════
    items = items.filter(item => item.trim().length >= this.minLength);
    console.log(`   ├─ After length filter (>=${this.minLength} chars): ${items.length} items`);
    
    // ══════════════════════════════════════════════════════════════
    // Step 3: Remove sentences without subject or verb
    // ══════════════════════════════════════════════════════════════
    items = items.filter(item => {
      const text = item.trim();
      
      // Check for verb presence (essential for complete sentences)
      const hasVerb = /\b(is|are|was|were|has|have|had|will|would|should|could|can|may|might|do|does|did|expects?|believes?|estimates?|projects?|forecasts?|drives?|impacts?|affects?|presents?|creates?|leads?|results?|causes?|poses?|introduces?|represents?|remains?|continues?|maintains?|provides?|offers?|delivers?|generates?|produces?)\b/i.test(text);
      
      // If no verb and short, likely incomplete
      if (!hasVerb && text.length < 50) return false;
      
      // Check for basic subject (noun or pronoun at start)
      const hasSubject = /^(the|a|an|our|we|this|that|these|those|its?|their|his|her|company|market|industry|demand|growth|expansion|competition|regulatory|economic|financial|operational|strategic|technology|product|service|customer|management|revenue|earnings|profit|margin|costs?|risks?|opportunities?|challenges?|trends?|dynamics?|factors?|conditions?|environment|landscape|ecosystem|platform|infrastructure|innovation|disruption|transformation|adoption|penetration|saturation|volatility|uncertainty|headwinds?|tailwinds?|momentum|trajectory|outlook|prospects?|potential|capability|capacity|execution|performance|results?|developments?|initiatives?|programs?|partnerships?|acquisitions?|investments?|capital|debt|liquidity|cash|valuation|multiples?|sentiment|expectations?|guidance|forecasts?|estimates?|targets?)\b/i.test(text);
      
      if (!hasSubject && text.length < 60) return false;
      
      return true;
    });
    
    console.log(`   ├─ After sentence structure check: ${items.length} items`);
    
    // ══════════════════════════════════════════════════════════════
    // Step 4: Remove duplicates (>0.7 similarity)
    // ══════════════════════════════════════════════════════════════
    const uniqueItems = [];
    
    for (const item of items) {
      const isDuplicate = uniqueItems.some(existing => 
        this._calculateSimilarity(item, existing) > this.similarityThreshold
      );
      
      if (!isDuplicate) {
        uniqueItems.push(item);
      }
    }
    
    items = uniqueItems;
    console.log(`   ├─ After deduplication (>${this.similarityThreshold} similarity): ${items.length} items`);
    
    // ══════════════════════════════════════════════════════════════
    // Step 5: Auto-fill to minimum 5 items if needed
    // ══════════════════════════════════════════════════════════════
    if (items.length < this.minItems) {
      console.log(`   ├─ Below minimum (${this.minItems}), generating ${this.minItems - items.length} additional items...`);
      
      const generated = await this._generateAdditionalItems(
        items,
        type,
        this.minItems - items.length,
        report
      );
      
      items = [...items, ...generated];
      console.log(`   ├─ After GPT-4o-mini generation: ${items.length} items`);
    }
    
    // ══════════════════════════════════════════════════════════════
    // Step 6: Cap at maximum 8 items
    // ══════════════════════════════════════════════════════════════
    if (items.length > this.maxItems) {
      items = items.slice(0, this.maxItems);
      console.log(`   ├─ Capped at maximum ${this.maxItems} items`);
    }
    
    // ══════════════════════════════════════════════════════════════
    // Step 7: Remove exaggerated projections from all items
    // ══════════════════════════════════════════════════════════════
    items = items.map(item => this._removeExaggeratedProjections(item)).filter(item => item.length >= 20);
    console.log(`   ├─ After removing exaggerated projections: ${items.length} items`);
    
    console.log(`✅ [RiskCatalystCleaner] Final count: ${items.length} ${type}s (original: ${originalCount})`);
    
    return items;
  }

  /**
   * Calculate word-based similarity between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score (0-1)
   */
  _calculateSimilarity(str1, str2) {
    const words1 = new Set(str1.toLowerCase().split(/\s+/));
    const words2 = new Set(str2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size;
  }

  /**
   * Generate additional items using GPT-4o-mini
   * @param {array} existingItems - Current list of items
   * @param {string} type - "catalyst" or "risk"
   * @param {number} count - Number of items to generate
   * @param {object} report - Full report object for context
   * @returns {array} Generated items
   */
  async _generateAdditionalItems(existingItems, type, count, report) {
    // Fail-safe: Always use generic items if no API key
    if (!OPENAI_API_KEY || OPENAI_API_KEY === 'undefined' || OPENAI_API_KEY.length < 20) {
      console.warn(`⚠️ [RiskCatalystCleaner] No valid OpenAI API key, using generic ${type}s`);
      return this._getGenericItems(type, count);
    }

    try {
      const context = {
        symbol: report?.symbol || 'UNKNOWN',
        name: report?.name || 'Company',
        rating: report?.rating || 'HOLD',
        sector: report?.industry || 'Technology',
        existing: existingItems
      };

      const systemPrompt = type === 'catalyst' 
        ? `You are a Morgan Stanley equity research analyst writing investment catalysts for ${context.name} (${context.symbol}). Generate ${count} CONSERVATIVE, realistic catalysts.

RULES:
- Each catalyst: 30-50 words MAX (concise bullet points)
- NO specific dollar amounts or percentage projections
- NO exaggerated claims like "massive upside" or "significant revenue boost"
- Use professional, measured language: "may support", "could contribute", "potential for"
- Focus on qualitative drivers, not quantified impact
- Do NOT repeat existing catalysts.

BAD: "AI integration expected to add $5-7B in revenue"
GOOD: "AI-related services could support incremental demand growth"`
        : `You are a Goldman Sachs equity research analyst writing investment risks for ${context.name} (${context.symbol}). Generate ${count} specific, realistic risks.

RULES:
- Each risk: 30-50 words MAX (concise bullet points)
- NO specific dollar amounts or percentage projections
- Use measured language: "may pressure", "could weigh on", "presents uncertainty"
- Be specific about the risk category but not the quantified impact
- Do NOT repeat existing risks.

BAD: "Margin compression of 2-4 percentage points could impact earnings by $X"
GOOD: "Margin pressure from competitive pricing dynamics in core segments"`;

      const userPrompt = `Existing ${type}s:\n${existingItems.map((item, idx) => `${idx + 1}. ${item}`).join('\n')}\n\nGenerate ${count} NEW ${type}s (different from above). Return ONLY a JSON array of strings, no other text. Format: ["item 1", "item 2", ...]`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 500
        }),
        signal: AbortSignal.timeout(15000) // 15 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content?.trim();

      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      // Parse JSON array with error handling
      let generated;
      try {
        generated = JSON.parse(content);
      } catch (parseError) {
        console.error(`⚠️ [RiskCatalystCleaner] Failed to parse JSON: ${content.substring(0, 100)}`);
        throw new Error(`JSON parse failed: ${parseError.message}`);
      }

      if (!Array.isArray(generated)) {
        throw new Error('Generated content is not an array');
      }

      console.log(`   └─ GPT-4o-mini generated ${generated.length} new ${type}s`);
      return generated.slice(0, count);

    } catch (error) {
      console.error(`⚠️ [RiskCatalystCleaner] GPT generation failed: ${error.message}`);
      console.error(`   └─ Falling back to generic ${type}s`);
      return this._getGenericItems(type, count);
    }
  }

  /**
   * Replace exaggerated projections with conservative wording
   * @param {string} text - Item text
   * @returns {string} Cleaned text with conservative phrasing
   */
  _removeExaggeratedProjections(text) {
    if (!text) return text;
    
    let cleaned = text;
    
    const replacements = [
      { pattern: /\$\d+[\.\d]*\s*(B|M|billion|million)\s*(in\s+)?(revenue|value)/gi, replacement: 'incremental revenue contribution' },
      { pattern: /\d+[-–]\d+%\s+revenue\s+(growth|increase)/gi, replacement: 'potential revenue expansion' },
      { pattern: /\d+[-–]\d+%\s+(margin\s+)?expansion/gi, replacement: 'margin improvement potential' },
      { pattern: /add(ing|s)?\s+\$\d+[\.\d]*\s*(B|M)\s*(in\s+)?revenue/gi, replacement: 'could support revenue growth' },
      { pattern: /increase\s+revenue\s+by\s+\d+[-–]?\d*%/gi, replacement: 'may drive incremental revenue' },
      { pattern: /\d+[-–]\d+\s*(percentage\s+)?point(s)?\s+margin\s+compression/gi, replacement: 'margin pressure' },
      { pattern: /\d+[-–]\d+\s*(percentage\s+)?point(s)?\s+margin\s+expansion/gi, replacement: 'margin improvement' },
      { pattern: /\$\d+[\.\d]*[-–]\$?\d+[\.\d]*\s*(B|M)\s+impact/gi, replacement: 'material financial impact' },
      { pattern: /\d+[-–]\d+%\s+upside/gi, replacement: 'upside potential' },
      { pattern: /\d+[-–]\d+%\s+decline/gi, replacement: 'downside risk' },
    ];
    
    replacements.forEach(({ pattern, replacement }) => {
      cleaned = cleaned.replace(pattern, replacement);
    });
    
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
    cleaned = cleaned.replace(/could\s+,/gi, 'could');
    cleaned = cleaned.replace(/may\s+,/gi, 'may');
    cleaned = cleaned.replace(/\s+\./g, '.');
    
    return cleaned;
  }

  /**
   * Get generic fallback items
   * @param {string} type - "catalyst" or "risk"
   * @param {number} count - Number of items needed
   * @returns {array} Generic items
   */
  _getGenericItems(type, count) {
    const genericCatalysts = [
      'Continued execution on core business initiatives and operational improvements.',
      'Market share gains in key product categories driven by competitive positioning.',
      'Expansion into adjacent markets and new geographic regions.',
      'Operating leverage from scale efficiencies and cost optimization programs.',
      'Strong secular demand trends supporting long-term growth trajectory.'
    ];

    const genericRisks = [
      'Macroeconomic headwinds including inflation, interest rates, and recession concerns.',
      'Intensifying competitive pressure from established players and new entrants.',
      'Regulatory uncertainty and potential adverse policy changes.',
      'Execution risk related to strategic initiatives and operational complexity.',
      'Market volatility and investor sentiment shifts impacting valuation multiples.'
    ];

    const items = type === 'catalyst' ? genericCatalysts : genericRisks;
    return items.slice(0, count);
  }
}

// Export singleton instance
module.exports = new RiskCatalystCleaner();
