const SELL_SIDE_PHRASES = [
  'We believe',
  'Our analysis suggests',
  'We note that',
  'In our view',
  'We expect',
  'Our channel checks indicate',
  'We estimate',
  'We project',
  'Our thesis centers on',
  'We maintain our view that',
  'Based on our proprietary framework',
  'Our bottom-up analysis points to'
];

const TRANSITIONS = [
  'Moreover',
  'Furthermore',
  'In addition',
  'However',
  'Nevertheless',
  'Going forward',
  'Looking ahead',
  'That said',
  'On the other hand',
  'Notably',
  'Importantly',
  'Critically'
];

const SELL_SIDE_VOCABULARY = {
  'decrease': 'compression',
  'increase': 'expansion',
  'risk': 'execution risk',
  'spending': 'capital allocation',
  'profit': 'margin profile',
  'growth': 'organic growth trajectory',
  'market': 'addressable market opportunity',
  'advantage': 'competitive moat',
  'problem': 'headwind',
  'opportunity': 'tailwind'
};

function applyStyle(text) {
  if (!text || typeof text !== 'string') return text;
  
  let styled = text;
  
  // Remove AI flavors
  styled = styled.replace(/\b(Let's|Let me|I think|I believe)\b/gi, '');
  styled = styled.replace(/\b(exciting|amazing|incredible)\b/gi, match => {
    return match.toLowerCase() === 'exciting' ? 'compelling' : 'notable';
  });
  
  // Add conditional phrasing at paragraph starts
  const paragraphs = styled.split('\n\n');
  const styledParagraphs = paragraphs.map((para, idx) => {
    if (idx % 3 === 0 && para.length > 50) {
      const phrase = SELL_SIDE_PHRASES[idx % SELL_SIDE_PHRASES.length];
      if (!para.match(/^(We |Our |In our)/)) {
        return `${phrase} ${para.charAt(0).toLowerCase()}${para.slice(1)}`;
      }
    }
    return para;
  });
  
  styled = styledParagraphs.join('\n\n');
  
  // Inject sell-side vocabulary
  Object.entries(SELL_SIDE_VOCABULARY).forEach(([simple, professional]) => {
    const regex = new RegExp(`\\b${simple}\\b`, 'gi');
    let count = 0;
    styled = styled.replace(regex, (match) => {
      count++;
      return count % 3 === 0 ? professional : match;
    });
  });
  
  // Add transitions between sections
  const sections = styled.split(/\n\n/);
  if (sections.length > 3) {
    for (let i = 2; i < sections.length; i += 3) {
      const transition = TRANSITIONS[i % TRANSITIONS.length];
      if (!sections[i].match(/^(Moreover|Furthermore|However|In addition)/)) {
        sections[i] = `${transition}, ${sections[i].charAt(0).toLowerCase()}${sections[i].slice(1)}`;
      }
    }
    styled = sections.join('\n\n');
  }
  
  // Ensure professional disclaimers
  styled = styled.replace(/\bwill definitely\b/gi, 'is positioned to');
  styled = styled.replace(/\bguaranteed\b/gi, 'highly probable');
  styled = styled.replace(/\bcertainly\b/gi, 'likely');
  
  // Fix overly casual language
  styled = styled.replace(/\breally good\b/gi, 'well-positioned');
  styled = styled.replace(/\bvery strong\b/gi, 'robust');
  styled = styled.replace(/\bvery weak\b/gi, 'challenged');
  
  return styled.trim();
}

module.exports = {
  applyStyle
};
