/**
 * Vision Chart Analyzer v7.7.1
 * 用户上传图表图片的 AI 视觉分析
 */

const axios = require('axios');

/**
 * 分析用户上传的图表图片
 * @param {Buffer} imageBuffer - 图片数据
 * @param {string} userContext - 用户提供的上下文（股票代码、问题等）
 * @returns {Promise<string>} 分析结果（Markdown格式）
 */
async function analyzeChartImage(imageBuffer, userContext = '') {
  console.log(`\n📊 [Vision Chart Analyzer] 开始分析用户图表`);
  console.log(`   ├─ 图片大小: ${(imageBuffer.length / 1024).toFixed(2)} KB`);
  console.log(`   └─ 用户上下文: "${userContext || '无'}"`);
  
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error('OpenAI API Key 未配置');
  }
  
  try {
    const base64Image = imageBuffer.toString('base64');
    
    // 构建分析提示词
    const systemPrompt = buildChartAnalysisPrompt(userContext);
    
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: systemPrompt
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${base64Image}`,
              detail: 'high'
            }
          }
        ]
      }],
      max_tokens: 2000,
      temperature: 0.3
    }, {
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 45000
    });
    
    const analysis = response.data.choices[0].message.content;
    console.log(`✅ [Vision Chart Analyzer] 分析完成 (${analysis.length} 字符)`);
    
    return formatAnalysisOutput(analysis, userContext);
    
  } catch (error) {
    console.error(`❌ [Vision Chart Analyzer] 分析失败: ${error.message}`);
    
    // 详细记录错误信息
    if (error.response) {
      console.error(`   ├─ HTTP Status: ${error.response.status}`);
      console.error(`   ├─ Response Data:`, JSON.stringify(error.response.data || {}).substring(0, 500));
    }
    if (error.code) {
      console.error(`   └─ Error Code: ${error.code}`);
    }
    
    if (error.response?.status === 429) {
      throw new Error('AI 服务繁忙，请稍后重试');
    }
    if (error.response?.status === 401) {
      throw new Error('API 认证失败，请检查配置');
    }
    if (error.response?.status === 400) {
      throw new Error('请求格式错误，请重试');
    }
    if (error.code === 'ECONNABORTED') {
      throw new Error('分析超时，请稍后重试');
    }
    
    throw error;
  }
}

/**
 * 构建图表分析提示词
 */
function buildChartAnalysisPrompt(userContext) {
  const contextInfo = userContext 
    ? `用户说明: "${userContext}"\n\n` 
    : '';
  
  return `${contextInfo}你是一位专业的技术分析师，请仔细分析这张K线/股票图表。

## 分析要求

请根据图表内容提供以下分析:

### 📈 I. 趋势识别
- 主要趋势方向：上涨/下跌/横盘
- 趋势强度评估：1-10分
- 趋势持续性判断

### 🎯 II. 关键价格水平
- 重要支撑位：约在 $X.XX
- 重要阻力位：约在 $X.XX
- 突破/跌破信号

### 📊 III. 技术形态分析
- K线形态：识别任何明显的形态
- 图表形态：头肩顶/底、三角形、旗形等
- 缺口分析：如有缺口，分析其意义

### 📉 IV. 技术指标解读
（如图中显示指标，请分析）
- 移动平均线：趋势方向和交叉信号
- MACD：动量和背离
- RSI：超买/超卖状态
- 成交量：量价关系

### 💡 V. 操作建议
- 短期操作建议（1-5天）
- 风险提示
- 建议止损/止盈位

## 输出格式要求
1. 使用简洁的Markdown格式
2. 价格目标必须具体（如 $XX.XX）
3. 给出明确的操作方向
4. 控制在400字以内

**重要提示**: 如果图片不是K线图或无法识别，请说明并建议用户发送股票代码获取实时分析。`;
}

/**
 * 格式化输出
 */
function formatAnalysisOutput(analysis, userContext) {
  // 提取可能的股票代码
  const symbolMatch = userContext.match(/[A-Z]{1,5}/);
  const symbol = symbolMatch ? symbolMatch[0] : null;
  
  let header = `📊 **图表技术分析**\n`;
  if (symbol) {
    header += `🏷️ 股票: ${symbol}\n`;
  }
  header += `⏰ 时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n`;
  
  const footer = `\n---\n` +
    `💡 *分析基于图表形态，仅供参考*\n` +
    `📌 获取实时数据：发送 \`解票 股票代码\``;
  
  return header + analysis + footer;
}

module.exports = {
  analyzeChartImage
};
