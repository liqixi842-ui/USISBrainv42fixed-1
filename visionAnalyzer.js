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
    return `作为机构级量化分析师，对${marketContext.index}热力图进行专业解读，采用华尔街研报标准术语：

【市场微观结构分析】
1. 价格离散度特征（Price Dispersion）：
   - 上行动能集中度（多头主导区域的市值占比）
   - 下行压力分布（空头施压区域的分散程度）
   - 波动幅度光谱（价格变动的离散特征而非颜色深浅）

2. 市值加权效应（Market Cap Weighted Impact）：
   - 权重股价格行为（大盘蓝筹的方向性）
   - 中小盘个股离散度（非权重股的分化程度）
   - 指数贡献度分析（单一成分股对指数的牵引效应）

3. 板块资金流向特征（Sector Rotation Dynamics）：
   - 获得增量资金青睐的板块（净流入板块识别）
   - 遭遇抛压的板块（净流出板块定位）
   - 板块间相关性模式（行业轮动节奏）

4. 市场广度指标（Market Breadth Metrics）：
   - 上涨成分股占比（Advance Ratio）
   - 下跌成分股占比（Decline Ratio）
   - 极端波动个股识别（Tail Events）

【量化洞察要求】
- 异常波动标的识别（Statistical Outliers）
- 板块轮动周期判断（Rotation Cycle Phase）
- 市场情绪强度评估（Sentiment Intensity Score 1-10）
- 技术形态关键位（Support/Resistance Levels）

务必使用机构研报标准术语，避免"红色/绿色"等视觉描述，改用"多头动能/空头压力"等专业表达。提供具体数值估计和量化特征。`;
  }

  parseVisionResponse(visionText) {
    const sectors = this.extractSectorsFromInstitutionalText(visionText);
    const metrics = this.extractMetricsFromInstitutionalText(visionText);
    
    return {
      rawAnalysis: visionText,
      sectors: sectors,
      metrics: metrics,
      timestamp: new Date().toISOString()
    };
  }

  extractSectorsFromInstitutionalText(text) {
    const sectors = [];
    
    const positivePatterns = [
      /([^\s]+)(?:板块|行业|sector)(?:获得|青睐|流入|领涨|强势)[^，。！？]*?(?:([+-]?\d+\.?\d+)%)?/gi,
      /([^\s]+)(?:板块|行业|sector)[^，。！？]*?(?:上涨|上行|多头)[^，。！？]*?(?:([+-]?\d+\.?\d+)%)?/gi
    ];
    
    const negativePatterns = [
      /([^\s]+)(?:板块|行业|sector)(?:遭遇|承压|流出|领跌|弱势)[^，。！？]*?(?:([+-]?\d+\.?\d+)%)?/gi,
      /([^\s]+)(?:板块|行业|sector)[^，。！？]*?(?:下跌|下行|空头)[^，。！？]*?(?:([+-]?\d+\.?\d+)%)?/gi
    ];
    
    positivePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1].trim();
        const change = match[2] ? parseFloat(match[2]) : 0;
        if (name && !sectors.some(s => s.name === name)) {
          sectors.push({ trend: 'up', name, change });
        }
      }
    });
    
    negativePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1].trim();
        const change = match[2] ? parseFloat(match[2]) : 0;
        if (name && !sectors.some(s => s.name === name)) {
          sectors.push({ trend: 'down', name, change: -Math.abs(change) });
        }
      }
    });
    
    const emojiSectors = text.match(/[🟥🟩🟨][^:]+:[^%\n]+%?/g) || [];
    emojiSectors.forEach(sector => {
      const match = sector.match(/([🟥🟩🟨])([^:]+):\s*([+-]?\d+\.?\d*)%?/);
      if (match) {
        const name = match[2].trim();
        if (!sectors.some(s => s.name === name)) {
          sectors.push({
            trend: match[1] === '🟥' ? 'up' : match[1] === '🟩' ? 'down' : 'neutral',
            name: name,
            change: parseFloat(match[3]) || 0
          });
        }
      }
    });
    
    return sectors;
  }

  extractMetricsFromInstitutionalText(text) {
    const metrics = {};
    
    const advancePatterns = [
      /(?:上涨|advance)[^%\d]*?(\d+\.?\d*)%/gi,
      /(\d+\.?\d*)%[^，。！？]*?(?:成分股|标的|个股)[^，。！？]*?(?:上涨|参与上行)/gi,
      /advance\s+ratio[^:：]*?[:：]\s*(\d+\.?\d*)%/gi
    ];
    
    const declinePatterns = [
      /(?:下跌|decline)[^%\d]*?(\d+\.?\d*)%/gi,
      /(\d+\.?\d*)%[^，。！？]*?(?:成分股|标的|个股)[^，。！？]*?(?:下跌|下行)/gi,
      /decline\s+ratio[^:：]*?[:：]\s*(\d+\.?\d*)%/gi
    ];
    
    for (const pattern of advancePatterns) {
      const match = text.match(pattern);
      if (match) {
        const value = parseFloat(match[1] || match[0].match(/(\d+\.?\d*)%/)?.[1]);
        if (value && !isNaN(value)) {
          metrics.advanceRatio = value;
          break;
        }
      }
    }
    
    for (const pattern of declinePatterns) {
      const match = text.match(pattern);
      if (match) {
        const value = parseFloat(match[1] || match[0].match(/(\d+\.?\d*)%/)?.[1]);
        if (value && !isNaN(value)) {
          metrics.declineRatio = value;
          break;
        }
      }
    }
    
    const breadthMatch = text.match(/市场广度[^%\d]*?(\d+\.?\d*)%/i) || 
                         text.match(/market\s+breadth[^%\d]*?(\d+\.?\d*)%/gi);
    if (breadthMatch) {
      metrics.marketBreadth = parseFloat(breadthMatch[1]);
    }
    
    return metrics;
  }
}

module.exports = VisionAnalyzer;
