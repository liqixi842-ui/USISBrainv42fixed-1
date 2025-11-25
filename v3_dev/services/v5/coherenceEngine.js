function calculateSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;
  
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

function removeDuplicates(sections) {
  const cleaned = [];
  const seen = new Map();
  
  sections.forEach(section => {
    let isDuplicate = false;
    
    for (const [idx, prevSection] of seen.entries()) {
      const similarity = calculateSimilarity(section, prevSection);
      if (similarity > 0.4) {
        isDuplicate = true;
        break;
      }
    }
    
    if (!isDuplicate) {
      cleaned.push(section);
      seen.set(cleaned.length - 1, section);
    }
  });
  
  return cleaned;
}

function addTransitions(sections) {
  const transitions = [
    'Building on this analysis,',
    'From a different perspective,',
    'Shifting to valuation,',
    'On the operational front,',
    'From a macro standpoint,',
    'Examining industry dynamics,',
    'Turning to the competitive landscape,'
  ];
  
  return sections.map((section, idx) => {
    if (idx > 0 && !section.match(/^(Building|From|Shifting|On|Examining|Turning)/)) {
      const transition = transitions[idx % transitions.length];
      return `${transition} ${section.charAt(0).toLowerCase()}${section.slice(1)}`;
    }
    return section;
  });
}

function rewriteSections(report) {
  if (!report) return report;
  
  const sections = [
    report.investment_thesis,
    report.company_overview,
    report.valuation_text,
    report.industry_text,
    report.macro_text
  ].filter(s => s && s.length > 100);
  
  // Remove duplicates
  const unique = removeDuplicates(sections);
  
  // Add transitions
  const withTransitions = addTransitions(unique);
  
  // Map back to report fields
  if (withTransitions.length >= 5) {
    report.investment_thesis = withTransitions[0];
    report.company_overview = withTransitions[1];
    report.valuation_text = withTransitions[2];
    report.industry_text = withTransitions[3];
    report.macro_text = withTransitions[4];
  } else if (withTransitions.length >= 3) {
    report.investment_thesis = withTransitions[0];
    report.company_overview = withTransitions[1];
    report.valuation_text = withTransitions[2];
  }
  
  return report;
}

module.exports = {
  rewriteSections,
  calculateSimilarity,
  removeDuplicates
};
