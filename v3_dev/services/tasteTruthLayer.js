/**
 * ═══════════════════════════════════════════════════════════════
 * TASTE & TRUTH PROFESSIONAL CORRECTION LAYER (TasteTruthLayer)
 * ═══════════════════════════════════════════════════════════════
 * 
 * Institutional-grade content review system for research reports
 * Transforms raw v3.2 multi-model AI text into professional sell-side language
 * 
 * Core Functions:
 * - deduplicateSentences(): Remove repeated sentences within text
 * - deduplicateParagraphs(): Merge duplicate paragraphs (>60% similarity)
 * - removeHallucinatedNumbers(): Eliminate invented dollar amounts & percentages
 * - ensureLogicalConsistency(): Check for contradictions in rating vs. targets
 * - enforceInstitutionalTone(): Replace AI-generic words with professional equivalents
 * - removeIncompleteSentences(): Delete fragments and incomplete statements
 * - removePlaceholders(): Strip "N/A", "TBD", "Placeholder" content
 * 
 * Usage:
 *   const TasteTruthLayer = require('./tasteTruthLayer');
 *   const correctedReport = await TasteTruthLayer.process(report);
 */

class TasteTruthLayer {
  constructor() {
    this.stats = {
      enabled: true,
      duplicateSentencesRemoved: 0,
      duplicateParagraphsMerged: 0,
      hallucinatedNumbersRemoved: 0,
      incompleteSentencesRemoved: 0,
      placeholdersRemoved: 0,
      logicalInconsistenciesFixed: 0,
      beforeBytes: 0,
      afterBytes: 0
    };
  }

  /**
   * Main processing pipeline
   * @param {object} report - Full ResearchReport object with v3.2 text
   * @returns {object} Corrected text sections
   */
  async process(report) {
    console.log(`\n🎯 [TasteTruthLayer] enabled`);
    
    // Reset stats
    this.stats.duplicateSentencesRemoved = 0;
    this.stats.duplicateParagraphsMerged = 0;
    this.stats.hallucinatedNumbersRemoved = 0;
    this.stats.incompleteSentencesRemoved = 0;
    this.stats.placeholdersRemoved = 0;
    this.stats.logicalInconsistenciesFixed = 0;
    
    // Extract original text sections
    const originalTexts = {
      summary: report.summary_text || '',
      thesis: report.thesis_text || '',
      valuation: report.valuation_text || '',
      segments: report.segment_text || '',
      macro: report.macro_text || '',
      catalysts: report.catalysts_text || [],
      risks: report.risks_text || [],
      technical: report.tech_view_text || '',
      action: report.action_text || ''
    };
    
    // Calculate before bytes
    this.stats.beforeBytes = this._calculateTotalBytes(originalTexts);
    
    // ══════════════════════════════════════════════════════════════
    // Apply correction pipeline to each section
    // ══════════════════════════════════════════════════════════════
    
    // Summary: 3-5 bullet points with data references
    let refinedSummary = this._processTextSection(originalTexts.summary, report);
    
    // Thesis: 3 structured paragraphs
    let refinedThesis = this._processTextSection(originalTexts.thesis, report);
    
    // Valuation: Must reference PE TTM, Forward PE, targets
    let refinedValuation = this._processTextSection(originalTexts.valuation, report);
    if (refinedValuation && report.valuation) {
      if (!refinedValuation.includes('PE') && report.valuation.pe_ttm) {
        refinedValuation = `Current P/E (TTM): ${report.valuation.pe_ttm}x. ` + refinedValuation;
      }
    }
    
    // Segments: Handle missing data gracefully
    let refinedSegments = this._processTextSection(originalTexts.segments, report);
    if (!report.segments || report.segments.length === 0) {
      refinedSegments = `${report.symbol} does not disclose detailed segment-level revenue. We base our analysis on publicly known business lines and industry positioning.`;
    }
    
    // Macro: Clean and deduplicate
    let refinedMacro = this._processTextSection(originalTexts.macro, report);
    
    // Catalysts: Ensure 6-8 items, remove ALL invented dollar projections
    let refinedCatalysts = Array.isArray(originalTexts.catalysts) ? originalTexts.catalysts : [];
    refinedCatalysts = refinedCatalysts.map(c => this._processTextSection(c, report, true));
    refinedCatalysts = refinedCatalysts.filter(c => c.trim().length > 30);
    while (refinedCatalysts.length < 6) {
      refinedCatalysts.push('Continued operational execution in core business segments.');
    }
    refinedCatalysts = refinedCatalysts.slice(0, 8);
    
    // Risks: Ensure 6-8 items, remove ALL invented dollar projections
    let refinedRisks = Array.isArray(originalTexts.risks) ? originalTexts.risks : [];
    refinedRisks = refinedRisks.map(r => this._processTextSection(r, report, true));
    refinedRisks = refinedRisks.filter(r => r.trim().length > 30);
    while (refinedRisks.length < 6) {
      refinedRisks.push('General market volatility and macroeconomic uncertainty.');
    }
    refinedRisks = refinedRisks.slice(0, 8);
    
    // Technical: Must reference RSI, support/resistance
    let refinedTechnical = this._processTextSection(originalTexts.technical, report);
    if (refinedTechnical && report.techs) {
      const techDataParts = [];
      
      if (!refinedTechnical.includes('RSI') && report.techs.rsi_14) {
        techDataParts.push(`RSI(14): ${report.techs.rsi_14.toFixed(2)}`);
      }
      
      if (!refinedTechnical.includes('support') && report.techs.support_level) {
        techDataParts.push(`Support: $${report.techs.support_level.toFixed(2)}`);
      }
      if (!refinedTechnical.includes('resistance') && report.techs.resistance_level) {
        techDataParts.push(`Resistance: $${report.techs.resistance_level.toFixed(2)}`);
      }
      
      if (techDataParts.length > 0) {
        refinedTechnical = techDataParts.join(', ') + '. ' + refinedTechnical;
      }
    }
    
    // Action: Clean and deduplicate
    let refinedAction = this._processTextSection(originalTexts.action, report);
    
    // ══════════════════════════════════════════════════════════════
    // Logical Consistency Check (Cross-section validation)
    // ══════════════════════════════════════════════════════════════
    const consistencyResult = this.ensureLogicalConsistency(report, {
      summary: refinedSummary,
      thesis: refinedThesis,
      action: refinedAction
    });
    
    if (consistencyResult.fixed) {
      refinedSummary = consistencyResult.summary;
      refinedAction = consistencyResult.action;
      this.stats.logicalInconsistenciesFixed++;
    }
    
    // Calculate after bytes
    const refinedTexts = {
      summary_text: refinedSummary,
      thesis_text: refinedThesis,
      valuation_text: refinedValuation,
      segment_text: refinedSegments,
      macro_text: refinedMacro,
      catalysts_text: refinedCatalysts,
      risks_text: refinedRisks,
      tech_view_text: refinedTechnical,
      action_text: refinedAction
    };
    
    this.stats.afterBytes = this._calculateTotalBytes(refinedTexts);
    
    // Print debug metrics
    this._printDebugMetrics();
    
    return refinedTexts;
  }

  /**
   * Process a single text section through all correction filters
   * @param {string} text - Input text
   * @param {object} report - Full report object (for context)
   * @param {boolean} strict - Use strict truth correction (for catalysts/risks)
   * @returns {string} Corrected text
   */
  _processTextSection(text, report, strict = false) {
    if (!text || text.length === 0) return text;
    
    let corrected = text;
    
    // Step 1: Remove placeholders
    corrected = this.removePlaceholders(corrected);
    
    // Step 2: Enforce institutional tone
    corrected = this.enforceInstitutionalTone(corrected);
    
    // Step 3: Remove hallucinated numbers
    corrected = this.removeHallucinatedNumbers(corrected, report, strict);
    
    // Step 4: Remove incomplete sentences
    corrected = this.removeIncompleteSentences(corrected);
    
    // Step 5: Deduplicate sentences
    corrected = this.deduplicateSentences(corrected);
    
    // Step 6: Deduplicate paragraphs
    corrected = this.deduplicateParagraphs(corrected);
    
    return corrected;
  }

  /**
   * Remove duplicate sentences within text
   * @param {string} text - Input text
   * @returns {string} Text with duplicate sentences removed
   */
  deduplicateSentences(text) {
    if (!text || text.length === 0) return text;
    
    const sentences = text.split(/\.\s+/).filter(s => s.trim().length > 0);
    const seenSentences = new Set();
    const uniqueSentences = [];
    
    for (const sentence of sentences) {
      const normalized = sentence.trim().toLowerCase();
      if (!seenSentences.has(normalized)) {
        seenSentences.add(normalized);
        uniqueSentences.push(sentence);
      } else {
        this.stats.duplicateSentencesRemoved++;
      }
    }
    
    return uniqueSentences.join('. ') + (uniqueSentences.length > 0 ? '.' : '');
  }

  /**
   * Merge duplicate paragraphs (>60% word similarity)
   * @param {string} text - Input text
   * @returns {string} Text with duplicate paragraphs merged
   */
  deduplicateParagraphs(text) {
    if (!text || text.length === 0) return text;
    
    const paragraphs = text.split('\n').filter(p => p.trim());
    const uniqueParagraphs = [];
    
    for (const para of paragraphs) {
      const isDuplicate = uniqueParagraphs.some(existing => 
        this._calculateSimilarity(para, existing) > 0.6
      );
      
      if (!isDuplicate) {
        uniqueParagraphs.push(para);
      } else {
        this.stats.duplicateParagraphsMerged++;
      }
    }
    
    return uniqueParagraphs.join('\n\n');
  }

  /**
   * Remove hallucinated numbers (invented dollar amounts, percentages, dates)
   * @param {string} text - Input text
   * @param {object} report - Full report object (for verification)
   * @param {boolean} strict - Use strict mode (surgical removal for catalysts/risks)
   * @returns {string} Text with hallucinated numbers removed
   */
  removeHallucinatedNumbers(text, report, strict = false) {
    if (!text || text.length === 0) return text;
    
    let corrected = text;
    const beforeLength = corrected.length;
    
    // Forbidden events/topics (always delete entire sentence)
    const forbiddenPatterns = [
      /ARM acquisition/gi,
      /Arm acquisition/gi,
      /\bARM\b.*acquisition/gi,
      /acquisition.*\bARM\b/gi,
      /such as ARM/gi,
      /including ARM/gi,
      /\bmetaverse\b/gi,
      /Metaverse partnership/gi,
      /metaverse collaboration/gi,
      /Q[1-4] 202[34] (product launch|event|release)/gi,
      /upcoming (Q[1-4]|quarter)/gi
    ];
    
    for (const pattern of forbiddenPatterns) {
      corrected = corrected.split(/[,.]/).filter(part => !pattern.test(part)).join('. ');
    }
    
    // Remove invented monetary impacts
    const inventedMoneyPattern = /\$(\d+(?:\.\d+)?)\s*([BM])\s+(revenue|growth|impact|addition|increase)/gi;
    corrected = corrected.split('.').filter(sentence => {
      const matches = [...sentence.matchAll(new RegExp(inventedMoneyPattern, 'gi'))];
      if (matches.length === 0) return true;
      
      const dataStr = JSON.stringify(report.price) + JSON.stringify(report.valuation) + 
                      JSON.stringify(report.fundamentals) + JSON.stringify(report.targets);
      
      for (const match of matches) {
        const fullAmount = match[1];
        const scale = match[2].toUpperCase();
        
        const amountPatterns = [
          fullAmount + scale,
          fullAmount + scale.toLowerCase(),
          fullAmount + '0' + scale,
          (parseFloat(fullAmount) * 1000).toFixed(0) + 'M'
        ];
        
        const found = amountPatterns.some(pattern => dataStr.includes(pattern));
        if (!found) return false;
      }
      
      return true;
    }).join('.');
    
    // Remove invented percentage claims
    const inventedPercentPattern = /(grow|increase|expand) \d+%/gi;
    corrected = corrected.split('.').filter(sentence => {
      if (!inventedPercentPattern.test(sentence)) return true;
      
      const growthStr = JSON.stringify(report.growth) + JSON.stringify(report.fundamentals);
      const percentMatch = sentence.match(/\d+%/);
      return percentMatch && growthStr.includes(percentMatch[0]);
    }).join('.');
    
    // Remove ALL specific quarter+year references (2022-2025)
    corrected = corrected.replace(/in Q[1-4] 202[2-5]/gi, 'over recent quarters');
    corrected = corrected.replace(/by Q[1-4] 202[2-5]/gi, 'in the near term');
    corrected = corrected.replace(/Q[1-4] 202[2-5] (product launch|event|release|results)/gi, 'recent period');
    corrected = corrected.replace(/during Q[1-4] 202[2-5]/gi, 'in recent periods');
    
    // Remove specific month+year references
    corrected = corrected.replace(/in (January|February|March|April|May|June|July|August|September|October|November|December) 202[2-5]/gi, 'over recent quarters');
    corrected = corrected.replace(/(January|February|March|April|May|June|July|August|September|October|November|December) 202[2-5]/gi, 'recent periods');
    
    // Remove year-only references
    corrected = corrected.replace(/\b(in|by|for|during|mid-|early-|late-|H1-|H2-)?\s*202[2-5]\b/gi, '');
    corrected = corrected.replace(/\bby (the )?(end of |mid-)?FY\s*202[2-5]/gi, 'in the near term');
    corrected = corrected.replace(/\bFY\s*202[2-5]\b/gi, 'the fiscal year');
    
    // Remove sentences that still contain specific date patterns
    corrected = corrected.split('.').filter(sentence => {
      const specificDatePattern = /(Q[1-4]|January|February|March|April|May|June|July|August|September|October|November|December|FY)\s*202[2-5]|202[2-5]/i;
      return !specificDatePattern.test(sentence);
    }).join('.');
    
    // STRICT MODE: Surgical removal of dollar amounts (for catalysts/risks)
    if (strict) {
      corrected = corrected.replace(/(add|generate|contribute|increase revenue by|boost sales to|drive revenue growth by|expected to add|projected to add)\s+\$\d+\.?\d*\s*(billion|million|B|M)(\s+in revenue|\s+in sales)?/gi, '');
      corrected = corrected.replace(/(impact|loss|decline|decrease|cost|expense|fine)(s)?\s+(of|up to|approximately|estimated at)\s+\$\d+\.?\d*\s*(billion|million|B|M)/gi, '');
      corrected = corrected.replace(/(revenue|sales|earnings|profits?|income)\s+(of|by|to)\s+\$\d+\.?\d*\s*(billion|million|B|M)/gi, '$1');
      corrected = corrected.replace(/\$\d+\.?\d*\s*(billion|million)/gi, '');
      corrected = corrected.replace(/(potentially|approximately|estimated|projected)\s+\$\d+\.?\d*\s*[BM]/gi, '');
      
      // Clean up double spaces and orphaned commas
      corrected = corrected.replace(/\s+/g, ' ');
      corrected = corrected.replace(/,\s*,/g, ',');
      corrected = corrected.replace(/\s+(,|;)\s+/g, '$1 ');
      corrected = corrected.replace(/\s+(in|by|to|of)\s+,/g, ',');
      corrected = corrected.replace(/,\s+(in|by|to|of)\s+\./g, '.');
      
      // Remove sentences that are now too gutted (< 40 chars)
      corrected = corrected.split(/\.\s+/).filter(sentence => sentence.trim().length > 40).join('. ');
    }
    
    const afterLength = corrected.length;
    if (afterLength < beforeLength) {
      this.stats.hallucinatedNumbersRemoved++;
    }
    
    return corrected;
  }

  /**
   * Ensure logical consistency between rating, targets, and narrative
   * @param {object} report - Full report object
   * @param {object} texts - Text sections (summary, thesis, action)
   * @returns {object} { fixed: boolean, summary, action }
   */
  ensureLogicalConsistency(report, texts) {
    let fixed = false;
    let { summary, action } = texts;
    
    // Check: BUY rating but negative action language
    if ((report.rating === 'BUY' || report.rating === 'STRONG_BUY') && action) {
      const negativePatterns = /\b(avoid|sell|reduce|exit|downside|bearish|negative|decline)\b/gi;
      if (negativePatterns.test(action)) {
        // Fix: Replace negative language with positive
        action = action.replace(/\bavoid\b/gi, 'consider');
        action = action.replace(/\bsell\b/gi, 'hold');
        action = action.replace(/\breduce\b/gi, 'maintain');
        action = action.replace(/\bexit\b/gi, 'review');
        action = action.replace(/\bdownside\b/gi, 'upside');
        action = action.replace(/\bbearish\b/gi, 'bullish');
        action = action.replace(/\bnegative\b/gi, 'positive');
        action = action.replace(/\bdecline\b/gi, 'growth');
        fixed = true;
      }
    }
    
    // Check: SELL rating but positive action language
    if ((report.rating === 'SELL' || report.rating === 'STRONG_SELL') && action) {
      const positivePatterns = /\b(buy|accumulate|add|bullish|upside|growth opportunity)\b/gi;
      if (positivePatterns.test(action)) {
        // Fix: Replace positive language with neutral/negative
        action = action.replace(/\bbuy\b/gi, 'avoid');
        action = action.replace(/\baccumulate\b/gi, 'reduce');
        action = action.replace(/\badd\b/gi, 'trim');
        action = action.replace(/\bbullish\b/gi, 'cautious');
        action = action.replace(/\bupside\b/gi, 'downside');
        action = action.replace(/\bgrowth opportunity\b/gi, 'headwind');
        fixed = true;
      }
    }
    
    // Check: Target price vs current price consistency
    if (report.targets && report.price) {
      const targetPrice = report.targets.base?.price;
      const currentPrice = report.price.last;
      
      if (targetPrice && currentPrice) {
        const upside = ((targetPrice - currentPrice) / currentPrice) * 100;
        
        // BUY but target below current (inconsistent)
        if ((report.rating === 'BUY' || report.rating === 'STRONG_BUY') && upside < 0) {
          summary = summary.replace(/\bupside\b/gi, 'limited upside');
          fixed = true;
        }
        
        // SELL but target above current (inconsistent)
        if ((report.rating === 'SELL' || report.rating === 'STRONG_SELL') && upside > 0) {
          summary = summary.replace(/\bdownside\b/gi, 'limited downside');
          fixed = true;
        }
      }
    }
    
    return { fixed, summary, action };
  }

  /**
   * Enforce institutional tone (replace AI-generic words)
   * @param {string} text - Input text
   * @returns {string} Text with institutional tone
   */
  enforceInstitutionalTone(text) {
    if (!text || text.length === 0) return text;
    
    let corrected = text;
    
    const wordReplacements = {
      'strong growth': 'solid growth',
      'rapidly growing': 'expanding',
      'dominant position': 'leading position',
      'huge opportunity': 'meaningful opportunity',
      'massive potential': 'significant potential',
      'strong': 'solid',
      'rapidly': 'materially',
      'dominant': 'leading',
      'huge': 'meaningful',
      'massive': 'significant'
    };
    
    for (const [aiWord, professionalWord] of Object.entries(wordReplacements)) {
      const regex = new RegExp(aiWord, 'gi');
      corrected = corrected.replace(regex, professionalWord);
    }
    
    // Replace absolute phrases with professional qualifiers
    corrected = corrected.replace(/\bwill (grow|increase|expand|reach)\b/gi, 'we expect to $1');
    corrected = corrected.replace(/\bis guaranteed to\b/gi, 'is expected to');
    corrected = corrected.replace(/\bcertain to\b/gi, 'likely to');
    corrected = corrected.replace(/\bwill definitely\b/gi, 'should');
    
    return corrected;
  }

  /**
   * Remove incomplete sentences (fragments, trailing commas, etc.)
   * @param {string} text - Input text
   * @returns {string} Text with incomplete sentences removed
   */
  removeIncompleteSentences(text) {
    if (!text || text.length === 0) return text;
    
    const beforeCount = text.split(/\.\s+/).length;
    
    let sentences = text.split(/\.\s+/).filter(sentence => {
      const trimmed = sentence.trim();
      
      // Remove if too short (< 20 chars)
      if (trimmed.length < 20) return false;
      
      // Remove if ends with comma/preposition (incomplete)
      if (/[,;:]$/.test(trimmed)) return false;
      if (/\b(in|by|to|of|with|for|and|or|but)\s*$/.test(trimmed)) return false;
      
      // Remove if no verb (likely fragment)
      const hasVerb = /\b(is|are|was|were|has|have|had|will|would|should|could|can|may|might|do|does|did|expect|believe|estimate|project|forecast)\b/i.test(trimmed);
      if (!hasVerb && trimmed.length < 50) return false;
      
      return true;
    });
    
    const afterCount = sentences.length;
    if (afterCount < beforeCount) {
      this.stats.incompleteSentencesRemoved += (beforeCount - afterCount);
    }
    
    return sentences.join('. ') + (sentences.length > 0 ? '.' : '');
  }

  /**
   * Remove placeholder content (N/A, TBD, Placeholder, etc.)
   * @param {string} text - Input text
   * @returns {string} Text with placeholders removed
   */
  removePlaceholders(text) {
    if (!text || text.length === 0) return text;
    
    const beforeLength = text.length;
    
    let corrected = text;
    
    // Remove common placeholder patterns
    const placeholderPatterns = [
      /\bN\/A\b/gi,
      /\bTBD\b/gi,
      /\bTBA\b/gi,
      /\bPlaceholder\b/gi,
      /\bComing soon\b/gi,
      /\bTo be determined\b/gi,
      /\bTo be announced\b/gi,
      /\bData unavailable\b/gi,
      /\bNot available\b/gi,
      /\bPending\b/gi
    ];
    
    for (const pattern of placeholderPatterns) {
      corrected = corrected.replace(pattern, '');
    }
    
    // Remove sentences that are now empty or too short after placeholder removal
    corrected = corrected.split(/\.\s+/).filter(s => s.trim().length > 15).join('. ');
    
    const afterLength = corrected.length;
    if (afterLength < beforeLength) {
      this.stats.placeholdersRemoved++;
    }
    
    return corrected;
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
   * Calculate total byte size of all text sections
   * @param {object} texts - Text sections object
   * @returns {number} Total bytes
   */
  _calculateTotalBytes(texts) {
    let total = 0;
    
    for (const key in texts) {
      const value = texts[key];
      if (typeof value === 'string') {
        total += Buffer.byteLength(value, 'utf8');
      } else if (Array.isArray(value)) {
        total += value.reduce((sum, item) => sum + Buffer.byteLength(item, 'utf8'), 0);
      }
    }
    
    return total;
  }

  /**
   * Print debug metrics to console
   */
  _printDebugMetrics() {
    const bytesReduced = this.stats.beforeBytes - this.stats.afterBytes;
    const reductionPct = ((bytesReduced / this.stats.beforeBytes) * 100).toFixed(1);
    
    console.log(`\n📊 [TasteTruthLayer Debug Metrics]`);
    console.log(`   ├─ Before: ${this.stats.beforeBytes.toLocaleString()} bytes`);
    console.log(`   ├─ After: ${this.stats.afterBytes.toLocaleString()} bytes`);
    console.log(`   ├─ Reduced: ${bytesReduced.toLocaleString()} bytes (${reductionPct}%)`);
    console.log(`   ├─ Duplicate sentences removed: ${this.stats.duplicateSentencesRemoved}`);
    console.log(`   ├─ Duplicate paragraphs merged: ${this.stats.duplicateParagraphsMerged}`);
    console.log(`   ├─ Hallucinated numbers removed: ${this.stats.hallucinatedNumbersRemoved}`);
    console.log(`   ├─ Incomplete sentences removed: ${this.stats.incompleteSentencesRemoved}`);
    console.log(`   ├─ Placeholders removed: ${this.stats.placeholdersRemoved}`);
    console.log(`   └─ Logical inconsistencies fixed: ${this.stats.logicalInconsistenciesFixed}`);
    console.log(`✅ [TasteTruthLayer] Professional correction complete\n`);
  }
}

// Export singleton instance
module.exports = new TasteTruthLayer();
