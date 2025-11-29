/**
 * ═══════════════════════════════════════════════════════════════
 * DATA VALIDATOR MODULE
 * ═══════════════════════════════════════════════════════════════
 * 
 * Pipeline Node 2: Validates data completeness and quality
 * 
 * Validation Rules:
 * - prices.length >= 60 (90 preferred, 60 minimum)
 * - revenue_quarters.length >= 8 (12 preferred)
 * - eps_quarters.length >= 8 (12 preferred)
 * - fundamentals must have: gross_margin, roa, roe
 * - peers >= 3 entries
 * 
 * Output:
 * {
 *   valid: boolean,
 *   degraded: boolean,
 *   validations: { prices: true/false, revenue: true/false, ... },
 *   warnings: ["Revenue data insufficient: 4 quarters (min 8)"],
 *   errors: [],
 *   data: <original or enhanced data>
 * }
 */

class DataValidator {
  constructor() {
    this.rules = {
      prices: { min: 60, preferred: 90, field: 'prices' },
      revenue: { min: 8, preferred: 12, field: 'revenue_quarters' },
      eps: { min: 8, preferred: 12, field: 'eps_quarters' },
      peers: { min: 3, preferred: 5, field: 'peers' }
    };
    
    this.requiredFundamentals = ['gross_margin', 'roa', 'roe'];
  }

  validate(data) {
    console.log(`[DataValidator] Validating data for ${data.ticker}...`);
    
    const result = {
      valid: true,
      degraded: false,
      validations: {
        prices: false,
        revenue: false,
        eps: false,
        fundamentals: false,
        peers: false
      },
      warnings: [],
      errors: [],
      missing_data: [],
      data: data
    };

    for (const [name, rule] of Object.entries(this.rules)) {
      const array = data[rule.field] || [];
      const count = array.length;
      
      if (count >= rule.min) {
        result.validations[name] = true;
        
        if (count < rule.preferred) {
          result.warnings.push(`${name}: ${count} items (preferred ${rule.preferred})`);
          result.degraded = true;
        }
      } else {
        result.validations[name] = false;
        result.warnings.push(`${name}: ${count} items (minimum ${rule.min} required)`);
        result.missing_data.push(name);
        result.degraded = true;
      }
    }

    const fundamentals = data.fundamentals || {};
    const missingFundamentals = [];
    
    for (const field of this.requiredFundamentals) {
      if (fundamentals[field] == null || isNaN(fundamentals[field])) {
        missingFundamentals.push(field);
      }
    }
    
    if (missingFundamentals.length === 0) {
      result.validations.fundamentals = true;
    } else {
      result.validations.fundamentals = false;
      result.warnings.push(`fundamentals missing: ${missingFundamentals.join(', ')}`);
      result.missing_data.push(...missingFundamentals.map(f => `fundamentals.${f}`));
      result.degraded = true;
    }

    const criticalMissing = [];
    if (!result.validations.prices) criticalMissing.push('prices');
    
    if (criticalMissing.length > 0) {
      result.valid = false;
      result.errors.push(`Critical data missing: ${criticalMissing.join(', ')} - report cannot be generated`);
    }

    result.validation_score = this._calculateScore(result.validations);
    result.data_quality = this._assessQuality(result.validation_score, result.degraded);

    console.log(`[DataValidator] Result: valid=${result.valid}, degraded=${result.degraded}, score=${result.validation_score}`);
    
    return result;
  }

  _calculateScore(validations) {
    const weights = { prices: 30, revenue: 25, eps: 20, fundamentals: 15, peers: 10 };
    let score = 0;
    
    for (const [key, valid] of Object.entries(validations)) {
      if (valid && weights[key]) {
        score += weights[key];
      }
    }
    
    return score;
  }

  _assessQuality(score, degraded) {
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'fair';
    if (score >= 30) return 'poor';
    return 'insufficient';
  }

  generateExecutiveSummaryWarning(result) {
    if (result.missing_data.length === 0) {
      return null;
    }
    
    const warnings = [];
    
    if (!result.validations.prices) {
      warnings.push('⚠️ Price data insufficient - technical analysis degraded');
    }
    if (!result.validations.revenue) {
      warnings.push('⚠️ Revenue history limited - growth analysis may be incomplete');
    }
    if (!result.validations.eps) {
      warnings.push('⚠️ EPS history limited - earnings trend analysis affected');
    }
    if (!result.validations.peers) {
      warnings.push('⚠️ Peer comparison limited due to insufficient peer data');
    }
    if (!result.validations.fundamentals) {
      warnings.push('⚠️ Some fundamental metrics unavailable');
    }
    
    return warnings.length > 0 ? warnings.join('\n') : null;
  }
}

module.exports = new DataValidator();
