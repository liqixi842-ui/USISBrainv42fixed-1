// visionAnalyzer.js - 新增视觉分析模块
const axios = require('axios');
const { formatMarkdownToChinese } = require('./responseFormatter');

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
        },
        timeout: 30000 // 30秒超时
      });

      const visionContent = response.data.choices[0].message.content;
      
      // 🔧 P0 FIX: 格式化热力图分析输出
      const formattedContent = formatMarkdownToChinese(visionContent, { addEmoji: true });
      
      return this.parseVisionResponse(formattedContent);
    } catch (error) {
      console.error('[Vision AI] Heatmap analysis error:', {
        index: marketContext?.index,
        error: error.message,
        code: error.code
      });
      
      if (error.code === 'ECONNABORTED') {
        throw new Error(`热力图分析超时，请稍后重试`);
      }
      throw new Error(`视觉分析失败: ${error.message}`);
    }
  }

  buildVisionPrompt(marketContext) {
    const isSectorFocused = marketContext.sectorName || marketContext.dataset;
    const contextInfo = isSectorFocused 
      ? `${marketContext.sectorName || marketContext.index}板块热力图` 
      : `${marketContext.index}市场热力图`;
    
    return `作为Morgan Stanley/Goldman Sachs首席策略分析师，对${contextInfo}进行机构级深度解读。

## 结构性市场分析框架

### I. 价格动能分布特征
- 动量集中度：具体个股及其涨跌幅（如JPM +2.3%、BAC +1.8%）
- 离散度分析：波动幅度差异的统计特征（标准差、极值比）
- 市值分层表现：超大市值/中型股/小型股的分化程度

### II. 板块内部结构分析${isSectorFocused ? `（${marketContext.sectorName}专项）` : ''}
- 子行业轮动：识别板块内细分领域的相对强弱
- 龙头vs跟随者：领先公司与二线公司的表现差异
- 相关性矩阵：个股间联动性（高相关/低相关集群）

### III. 资金流向深度解析
- 净流入/流出方向：识别资金迁移路径
- 机构调仓迹象：尾盘大宗交易、异常成交量信号
- 做空压力监测：空头仓位变化、卖空量异常

### IV. 基本面驱动因素${isSectorFocused ? '（板块特定）' : ''}
${this.getSectorSpecificDrivers(marketContext)}

### V. 技术分析要素
- 关键价格水平：阻力位/支撑位（具体价格）
- 技术形态识别：突破/回调/盘整状态
- 成交量验证：价格突破是否伴随量能配合

### VI. 风险评估矩阵
- 系统性风险：宏观环境、政策风险
- 板块特有风险：行业周期、监管变化
- 仓位风险：市场情绪过热/过冷指标

【输出要求】
1. 标准Markdown格式（## ### -）无星号强调
2. 每个观点必须有数据支撑（具体个股代码+涨跌幅）
3. 使用机构术语（避免颜色描述）
4. 提供量化评分（如风险等级1-5、情绪强度1-10）
5. 给出可执行的交易启示和价格目标`;
  }

  getSectorSpecificDrivers(marketContext) {
    const sector = marketContext.sectorName || '';
    
    if (sector.includes('金融')) {
      return `- 利率敏感性：联储政策预期对银行净息差的影响
- 信贷质量：商业地产敞口、贷款损失拨备变化
- 监管环境：资本充足率、压力测试结果`;
    } else if (sector.includes('科技')) {
      return `- 估值水平：市盈率相对历史均值的位置
- 增长动能：云计算/AI/半导体细分景气度
- 竞争格局：市场份额变化、定价权强弱`;
    } else if (sector.includes('能源')) {
      return `- 油价走势：WTI/Brent原油价格动态
- 供需平衡：OPEC+政策、库存变化
- 替代能源冲击：清洁能源政策影响`;
    } else if (sector.includes('医疗')) {
      return `- 政策风险：药价谈判、医保改革
- 研发管线：新药审批、专利到期
- 人口结构：老龄化趋势、医疗需求`;
    } else {
      return `- 宏观经济：GDP增长、消费信心
- 行业周期：当前所处景气阶段
- 政策导向：财政刺激、监管变化`;
    }
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

  async analyzeStockChart(imageBuffer, marketContext) {
    try {
      const base64Image = imageBuffer.toString('base64');
      
      // 🔧 P0 FIX: 30秒超时保护，防止长时间等待
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: this.buildStockChartPrompt(marketContext)
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
        },
        timeout: 30000 // 30秒超时
      });

      const rawAnalysis = response.data.choices[0].message.content;
      
      // 🔧 P0 FIX: 强制格式化Vision AI输出，确保使用【】和•符号
      const formattedAnalysis = formatMarkdownToChinese(rawAnalysis, { addEmoji: true });
      
      return {
        rawAnalysis: formattedAnalysis,
        confidence: 0.85,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('[Vision AI] Stock chart analysis error:', {
        symbol: marketContext?.symbol,
        error: error.message,
        code: error.code,
        timeout: error.code === 'ECONNABORTED'
      });
      
      // 🔧 P0 FIX: 优雅降级，避免整个服务崩溃
      if (error.code === 'ECONNABORTED') {
        throw new Error(`K线图分析超时，请稍后重试`);
      }
      throw new Error(`K线图视觉分析失败: ${error.message}`);
    }
  }

  buildStockChartPrompt(marketContext) {
    const symbol = marketContext.symbol || 'N/A';
    const currentPrice = marketContext.currentPrice || 'N/A';
    const changePercent = marketContext.changePercent || 0;
    const positionContext = marketContext.positionContext || null;
    
    let prompt = `作为专业技术分析师，对${symbol}的K线图进行深度技术分析。

## 当前市场状态

股票代码: ${symbol}
当前价格: $${currentPrice}
涨跌幅: ${changePercent >= 0 ? '+' : ''}${changePercent}%
`;

    // 🆕 v3.2: 持仓信息（个性化分析关键）
    if (positionContext && positionContext.buyPrice) {
      const buyPrice = positionContext.buyPrice;
      let profitLoss = 'N/A';
      let profitPercent = 'N/A';
      
      if (currentPrice !== 'N/A' && typeof currentPrice === 'number') {
        profitLoss = (currentPrice - buyPrice).toFixed(2);
        profitPercent = (((currentPrice - buyPrice) / buyPrice) * 100).toFixed(2);
      }
      
      prompt += `
⚠️ **重要：用户持仓信息**
买入成本: $${buyPrice}
当前盈亏: ${profitLoss !== 'N/A' ? (profitLoss >= 0 ? '+$' : '-$') + Math.abs(profitLoss) : 'N/A'}
盈亏比例: ${profitPercent !== 'N/A' ? (profitPercent >= 0 ? '+' : '') + profitPercent + '%' : 'N/A'}
持仓意图: ${positionContext.holdingIntent ? '询问操作建议（续抱/止盈/止损）' : '一般查询'}
`;
    }

    prompt += `
## 技术分析框架

请基于图表提供以下分析：

【I. 趋势识别】
• 主要趋势方向（上涨/下跌/盘整）
• 趋势强度评估（1-10分）
• 趋势持续性判断

【II. 关键价格水平】⚠️ 必须提供具体数字
• 重要支撑位：具体价格（例如：约在$420, $410, $400）
• 重要阻力位：具体价格（例如：约在$460, $470, $480）
• 突破/跌破信号（需说明具体价格）

【III. 技术形态分析】
• K线形态（如吞没、十字星、锤子线等）
• 图表形态（如头肩顶、双底、三角形等）
• 缺口分析

【IV. 技术指标解读】
• 均线系统（MA5/MA10/MA20等交叉情况）
• 布林带位置（上轨/中轨/下轨）
• MACD状态（金叉/死叉、柱状图趋势）
• 成交量特征（放量/缩量）

【V. 交易信号】
• 买入信号强度（1-10分）
• 卖出信号强度（1-10分）`;

    // 🆕 个性化持仓建议
    if (positionContext && positionContext.buyPrice) {
      prompt += `
• 持仓操作建议（基于买入成本$${positionContext.buyPrice}）:
  - 明确说明：继续持有/部分止盈/全部止盈/止损
  - 止盈位建议：具体价格
  - 止损位建议：具体价格
  - 风险收益比分析`;
    } else {
      prompt += `
• 持仓建议（通用）`;
    }

    prompt += `

【VI. 风险评估】
• 技术面风险等级（1=低风险 到 5=高风险）
• 短期波动预期
• 止损位建议

⚠️ 【重要格式要求】
1. **支撑/压力位必须给出具体数字**（如$260.00, $270.50），不要用"当前价附近"或"前高"等模糊描述
2. 如果从图表难以识别精确价格，基于可见的K线高低点估算并说明"约在$XX"
3. 使用中文符号格式：标题用【】包裹，列表用•开头
4. 不要使用Markdown符号（如##, ###, **, -, *）
5. 每个观点必须引用图表具体特征
6. 提供量化评分和具体价格位
7. 保持简洁专业的表达，避免模糊表述
8. 给出明确判断和具体建议`;
    
    return prompt;
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
