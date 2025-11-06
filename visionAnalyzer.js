// visionAnalyzer.js - 新增视觉分析模块
const axios = require('axios');

class VisionAnalyzer {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
  }

  async analyzeHeatmapImage(imageBuffer, marketContext) {
    try {
      const base64Image = imageBuffer.toString('base64');
      
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: this.buildVisionPrompt(marketContext)
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
        temperature: 0.1
      }, {
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return this.parseVisionResponse(response.data.choices[0].message.content);
    } catch (error) {
      console.error('Vision analysis failed:', error);
      throw new Error(`视觉分析失败: ${error.message}`);
    }
  }

  buildVisionPrompt(marketContext) {
    return `作为专业金融分析师，深度分析这张${marketContext.index}热力图：

【视觉特征提取】
1. 颜色分布分析：
   - 红色板块占比及强度（上涨）
   - 绿色板块占比及强度（下跌） 
   - 颜色饱和度对应的涨跌幅程度

2. 市值权重分析：
   - 大市值股票（大区块）表现
   - 中小市值股票（小区块）表现
   - 权重股对指数的影响程度

3. 板块轮动特征：
   - 强势板块集中度
   - 弱势板块分布情况
   - 板块间的相关性模式

4. 市场广度指标：
   - 上涨股票数量占比
   - 下跌股票数量占比
   - 涨跌停板股票识别

【专业洞察】
- 识别异常波动个股
- 板块轮动节奏判断
- 市场情绪温度计
- 关键支撑阻力位识别

请提供具体数值估计和可视化特征描述。`;
  }

  parseVisionResponse(visionText) {
    const sectors = visionText.match(/[🟥🟩🟨][^:]+:[^%\n]+%?/g) || [];
    const metrics = visionText.match(/(上涨|下跌|占比|广度)[^%\d]*(\d+\.?\d*)%/g) || [];
    
    return {
      rawAnalysis: visionText,
      sectors: this.extractSectors(sectors),
      metrics: this.extractMetrics(metrics),
      timestamp: new Date().toISOString()
    };
  }

  extractSectors(sectorMatches) {
    return sectorMatches.map(sector => {
      const match = sector.match(/([🟥🟩🟨])([^:]+):\s*([+-]?\d+\.?\d*)%?/);
      return match ? {
        trend: match[1] === '🟥' ? 'up' : match[1] === '🟩' ? 'down' : 'neutral',
        name: match[2].trim(),
        change: parseFloat(match[3]) || 0
      } : null;
    }).filter(Boolean);
  }

  extractMetrics(metricMatches) {
    const metrics = {};
    metricMatches.forEach(metric => {
      if (metric.includes('上涨') && metric.includes('%')) {
        metrics.advanceRatio = parseFloat(metric.match(/(\d+\.?\d*)%/)[1]);
      } else if (metric.includes('下跌') && metric.includes('%')) {
        metrics.declineRatio = parseFloat(metric.match(/(\d+\.?\d*)%/)[1]);
      }
    });
    return metrics;
  }
}

module.exports = VisionAnalyzer;
