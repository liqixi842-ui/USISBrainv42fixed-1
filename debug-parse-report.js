const { parseResearchReportCommand } = require('./semanticIntentAgent');

const input = '研报, NVDA, Aberdeen Investments, Anthony Venn Dutton, 英文';

console.log('Input:', input);
try {
  const parsed = parseResearchReportCommand(input);
  console.log('Parsed result:', parsed);
} catch (err) {
  console.error('parseResearchReportCommand threw error:', err);
}
