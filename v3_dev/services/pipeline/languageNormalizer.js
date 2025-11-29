/**
 * ═══════════════════════════════════════════════════════════════
 * LANGUAGE NORMALIZER MODULE
 * ═══════════════════════════════════════════════════════════════
 * 
 * Pipeline Node 5: Transforms AI-generated text into sell-side style
 * 
 * Rules Applied:
 * 1. Remove duplicate tokens (regex: \b(\w+)\s+\1\b)
 * 2. Break long paragraphs (max 3 lines per paragraph, max 25 words per sentence)
 * 3. Remove forbidden phrases (given this backdrop, in our view, considering these factors)
 * 4. Apply word replacements (big growth → accelerated expansion, very good → robust)
 * 5. Format numbers properly (ROE → 1 decimal, $ → thousand separators)
 * 
 * Style Output:
 * - Thesis: 3 paragraphs (Moat / Growth Drivers / Margins), 2-4 lines each
 * - Catalysts: max 3, each with timeframe + conservative financial impact
 * - Risks: table format (Probability / Impact / Horizon / $ impact)
 */

class LanguageNormalizer {
  constructor() {
    this.forbiddenPhrases = [
      'given this backdrop',
      'in our view',
      'considering these factors',
      'it is worth noting that',
      'it should be noted that',
      'we believe that',
      'going forward',
      'at the end of the day',
      'in terms of',
      'with respect to',
      'in light of',
      'as a result of this',
      'due to the fact that',
      'in order to',
      'at this point in time',
      'for all intents and purposes',
      'in the near term',
      'looking ahead',
      'it is important to note',
      'one could argue that',
      'there is no doubt that',
      'it goes without saying',
      'needless to say',
      'as everyone knows',
      'for what it\'s worth',
      'having said that',
      'that being said',
      'all things considered',
      'when all is said and done',
      'at the present time',
      'in today\'s market',
      'in the current environment',
      'as we move forward',
      'in this context',
      'taking everything into account',
      'from our perspective',
      'in summary',
      'to summarize',
      'in conclusion',
      'to conclude'
    ];
    
    this.wordReplacements = {
      'big growth': 'accelerated expansion',
      'very good': 'robust',
      'very strong': 'robust',
      'very high': 'elevated',
      'very low': 'subdued',
      'huge': 'substantial',
      'massive': 'significant',
      'amazing': 'notable',
      'incredible': 'substantial',
      'tremendous': 'significant',
      'great': 'strong',
      'excellent': 'robust',
      'fantastic': 'favorable',
      'wonderful': 'favorable',
      'basically': '',
      'actually': '',
      'really': '',
      'definitely': '',
      'absolutely': '',
      'certainly': '',
      'obviously': '',
      'clearly': '',
      'literally': '',
      'essentially': ''
    };

    this.maxWordsPerSentence = 25;
    this.maxLinesPerParagraph = 3;
    this.maxAnalystMentions = 3;
  }

  normalize(text, section = 'general') {
    if (!text || typeof text !== 'string') {
      return { text: '', changes: [], warnings: [] };
    }

    const changes = [];
    let result = text;

    const duplicatePattern = /\b(\w{3,})\s+\1\b/gi;
    let match;
    while ((match = duplicatePattern.exec(result)) !== null) {
      changes.push({ type: 'duplicate_removed', word: match[1] });
    }
    result = result.replace(duplicatePattern, '$1');

    for (const phrase of this.forbiddenPhrases) {
      const regex = new RegExp(phrase, 'gi');
      if (regex.test(result)) {
        changes.push({ type: 'phrase_removed', phrase });
        result = result.replace(regex, '');
      }
    }

    for (const [from, to] of Object.entries(this.wordReplacements)) {
      const regex = new RegExp(`\\b${from}\\b`, 'gi');
      if (regex.test(result)) {
        changes.push({ type: 'word_replaced', from, to: to || '[removed]' });
        result = result.replace(regex, to);
      }
    }

    result = result.replace(/\s+/g, ' ').trim();
    result = result.replace(/\s+([.,;:!?])/g, '$1');
    result = result.replace(/([.,;:!?])([^\s])/g, '$1 $2');

    result = this._formatNumbers(result);

    result = this._limitAnalystMentions(result);

    if (section === 'thesis') {
      result = this._enforceThesisStructure(result);
    } else if (section === 'catalysts') {
      result = this._enforceCatalystStructure(result);
    } else if (section === 'risks') {
      result = this._enforceRiskStructure(result);
    }

    return {
      text: result,
      changes,
      warnings: changes.length > 5 ? ['Heavy normalization applied'] : []
    };
  }

  _formatNumbers(text) {
    text = text.replace(/\$(\d+)(\d{3})(\d{3})(\d{3})/g, '$$$1,$2,$3,$4');
    text = text.replace(/\$(\d+)(\d{3})(\d{3})/g, '$$$1,$2,$3');
    text = text.replace(/\$(\d+)(\d{3})/g, '$$$1,$2');
    
    text = text.replace(/(\d+\.\d{4,})%/g, (match, num) => parseFloat(num).toFixed(1) + '%');
    
    text = text.replace(/ROE of (\d+\.\d{3,})/g, (match, num) => `ROE of ${parseFloat(num).toFixed(1)}`);
    text = text.replace(/ROA of (\d+\.\d{3,})/g, (match, num) => `ROA of ${parseFloat(num).toFixed(1)}`);
    
    return text;
  }

  _limitAnalystMentions(text) {
    const patterns = [
      /\b(we believe|we expect|we estimate|we project|we forecast|we anticipate|our view|our analysis|our team|our model)\b/gi
    ];
    
    let count = 0;
    for (const pattern of patterns) {
      text = text.replace(pattern, (match) => {
        count++;
        if (count > this.maxAnalystMentions) {
          return 'analysis indicates';
        }
        return match;
      });
    }
    
    return text;
  }

  _enforceThesisStructure(text) {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const paragraphs = [];
    let currentPara = [];
    
    for (const sentence of sentences) {
      currentPara.push(sentence);
      if (currentPara.length >= 3) {
        paragraphs.push(currentPara.join(' '));
        currentPara = [];
      }
    }
    
    if (currentPara.length > 0) {
      paragraphs.push(currentPara.join(' '));
    }
    
    return paragraphs.slice(0, 3).join('\n\n');
  }

  _enforceCatalystStructure(text) {
    const bullets = text.split(/\n|•|·|\d+\./);
    const cleaned = bullets
      .map(b => b.trim())
      .filter(b => b.length > 20)
      .slice(0, 3);
    
    return cleaned.map((c, i) => `${i + 1}. ${c}`).join('\n');
  }

  _enforceRiskStructure(text) {
    return text;
  }

  cleanTextLight(text) {
    if (!text) return '';
    
    let result = text;
    result = result.replace(/\b(\w{3,})\s+\1\b/gi, '$1');
    result = result.replace(/\s+/g, ' ').trim();
    
    return result;
  }

  enforceSellSideStyle(text) {
    if (!text || typeof text !== 'string') return '';
    
    let result = text;
    
    result = result.replace(/\b(\w{3,})\s+\1\b/gi, '$1');
    
    for (const phrase of this.forbiddenPhrases) {
      const regex = new RegExp(phrase, 'gi');
      result = result.replace(regex, '');
    }
    
    for (const [from, to] of Object.entries(this.wordReplacements)) {
      const regex = new RegExp(`\\b${from}\\b`, 'gi');
      result = result.replace(regex, to);
    }
    
    result = result.replace(/\d+\.\d{4,}/g, (match) => parseFloat(match).toFixed(2));
    result = result.replace(/(\d+\.\d{2,})%/g, (match, num) => parseFloat(num).toFixed(1) + '%');
    
    const sentences = result.split(/(?<=[.!?])\s+/);
    const shortSentences = sentences.map(sentence => {
      const words = sentence.split(' ');
      if (words.length > this.maxWordsPerSentence) {
        return words.slice(0, this.maxWordsPerSentence).join(' ') + '.';
      }
      return sentence;
    });
    
    const paragraphs = [];
    let currentPara = [];
    
    for (const sentence of shortSentences) {
      currentPara.push(sentence);
      if (currentPara.length >= this.maxLinesPerParagraph) {
        paragraphs.push(currentPara.join(' '));
        currentPara = [];
      }
    }
    
    if (currentPara.length > 0) {
      paragraphs.push(currentPara.join(' '));
    }
    
    result = paragraphs.join('\n\n');
    
    result = result.replace(/\s+/g, ' ').replace(/\n\n+/g, '\n\n').trim();
    result = result.replace(/\s+([.,;:!?])/g, '$1');
    result = result.replace(/([.,;:!?])([^\s\n])/g, '$1 $2');
    
    return result;
  }

  runFinalPass(text) {
    if (!text || typeof text !== 'string') return text;
    
    let result = text;
    
    result = result.replace(/\b(\w{3,})\s+\1\b/gi, '$1');
    
    result = result.replace(/\d+\.\d{6,}/g, (match) => parseFloat(match).toFixed(2));
    
    for (const phrase of this.forbiddenPhrases) {
      const regex = new RegExp(phrase, 'gi');
      result = result.replace(regex, '');
    }
    
    result = result.replace(/\s+/g, ' ').trim();
    
    return result;
  }
}

module.exports = new LanguageNormalizer();
