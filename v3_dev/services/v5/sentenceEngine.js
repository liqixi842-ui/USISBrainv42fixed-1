function normalize(text) {
  if (!text || typeof text !== 'string') return text;
  
  let normalized = text;
  
  // Fix broken sentences: ". supported" → ". Supported" etc.
  normalized = normalized.replace(/\.\s+([a-z])/g, (match, letter) => '. ' + letter.toUpperCase());
  
  // Fix specific AI patterns
  const brokenPatterns = [
    /\.\s*(supported|driven|fueled|coupled|backed|enhanced|enabled)/gi,
    /\.\s*(this|these|that|those)/gi,
    /\.\s*(additionally|moreover|furthermore)/gi
  ];
  
  brokenPatterns.forEach(pattern => {
    normalized = normalized.replace(pattern, (match, word) => {
      return '. ' + word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
  });
  
  // Remove repetitive sentence starters
  const lines = normalized.split('. ');
  const deduplicated = [];
  const starters = new Map();
  
  lines.forEach(line => {
    const firstThreeWords = line.split(' ').slice(0, 3).join(' ');
    const count = starters.get(firstThreeWords) || 0;
    
    if (count < 2) {
      deduplicated.push(line);
      starters.set(firstThreeWords, count + 1);
    } else {
      // Rewrite with variation
      const variations = [
        'Additionally, ' + line.charAt(0).toLowerCase() + line.slice(1),
        'Furthermore, ' + line.charAt(0).toLowerCase() + line.slice(1),
        'Notably, ' + line.charAt(0).toLowerCase() + line.slice(1)
      ];
      deduplicated.push(variations[count % variations.length]);
    }
  });
  
  normalized = deduplicated.join('. ');
  
  // Fix spacing issues
  normalized = normalized.replace(/\s+/g, ' ');
  normalized = normalized.replace(/\s+\./g, '.');
  normalized = normalized.replace(/\.\./g, '.');
  
  // Ensure proper capitalization after periods
  normalized = normalized.replace(/\.\s+([a-z])/g, (match, letter) => {
    return '. ' + letter.toUpperCase();
  });
  
  // Remove AI template phrases
  const aiTemplates = [
    /^(Overall|In summary|In conclusion),?\s*/gi,
    /\b(it is worth noting that|it should be noted that)\b/gi,
    /\b(as mentioned earlier|as previously discussed)\b/gi
  ];
  
  aiTemplates.forEach(pattern => {
    normalized = normalized.replace(pattern, '');
  });
  
  // Add sentence variety - avoid starting every sentence the same way
  const sentences = normalized.split(/\.\s+/);
  const varied = sentences.map((sent, idx) => {
    if (idx > 0 && idx % 4 === 0) {
      // Add variety every 4th sentence
      if (!sent.match(/^(Given|Considering|While|Although)/)) {
        const variations = ['Given this backdrop, ', 'Considering these factors, ', 'With this in mind, '];
        return variations[idx % variations.length] + sent.charAt(0).toLowerCase() + sent.slice(1);
      }
    }
    return sent;
  });
  
  normalized = varied.join('. ');
  
  // Final cleanup
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  // Ensure ends with period
  if (!normalized.endsWith('.')) {
    normalized += '.';
  }
  
  return normalized;
}

module.exports = {
  normalize
};
