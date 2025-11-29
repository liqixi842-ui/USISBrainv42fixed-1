/**
 * ═══════════════════════════════════════════════════════════════
 * QA/CHECK MODULE
 * ═══════════════════════════════════════════════════════════════
 * 
 * Pipeline Node 6: Quality Assurance and Bug Detection
 * 
 * Checks:
 * 1. Undefined / placeholder detection (undefined, {TICKER}, {.*})
 * 2. NaN detection and formatting
 * 3. Duplicate word detection
 * 4. Chart URL validation
 * 5. Number formatting issues (too many decimals)
 * 
 * Output:
 * {
 *   passed: boolean,
 *   placeholders_found: number,
 *   duplicate_words: number,
 *   nan_values: number,
 *   chart_errors: number,
 *   issues: [{type, location, value, fix}],
 *   auto_fixes: [{type, location, original, fixed}]
 * }
 */

class QAChecker {
  constructor() {
    this.THRESHOLDS = {
      MAX_PLACEHOLDERS: 0,
      MIN_CHART_SUCCESS_RATE: 0.70,
      MAX_DUPLICATE_TOKEN_RATE: 0.01,
      MAX_NUMERIC_FORMAT_ERRORS: 0,
      MIN_CHARTS_REQUIRED: 1
    };
    
    this.placeholderPatterns = [
      /\bundefined\b/gi,
      /\{[A-Z_]+\}/g,
      /\[PLACEHOLDER\]/gi,
      /TODO:/gi,
      /FIXME:/gi,
      /\bNULL\b/g,
      /\bNaN\b/g,
      /0 data points/gi,
      /unavailable/gi
    ];
    
    this.duplicatePattern = /\b(\w{3,})\s+\1\b/gi;
    
    this.excessiveDecimalPattern = /\d+\.\d{4,}/g;
    
    this.numericOverflowPattern = /(\d+\.\d{8,})/g;
    
    this.brokenSentencePatterns = [
      /\.\s*\./g,
      /,\s*,/g,
      /\s+,/g,
      /^\s*,/gm,
      /\s{3,}/g
    ];
  }

  check(reportObject) {
    console.log(`[QAChecker] Running quality checks...`);
    
    const result = {
      passed: true,
      placeholders_found: 0,
      duplicate_words: 0,
      nan_values: 0,
      chart_errors: 0,
      formatting_issues: 0,
      issues: [],
      auto_fixes: [],
      checked_fields: 0
    };

    this._checkObject(reportObject, '', result);

    if (reportObject.charts) {
      for (const chart of reportObject.charts) {
        if (chart.url === null && !chart.error) {
          result.chart_errors++;
          result.issues.push({
            type: 'chart_missing',
            location: `charts.${chart.name}`,
            value: null,
            fix: 'N/A - data unavailable'
          });
        }
      }
    }

    result.passed = result.placeholders_found === 0 && 
                    result.nan_values === 0 && 
                    result.issues.filter(i => i.type === 'placeholder' || i.type === 'nan').length === 0;

    console.log(`[QAChecker] Result: passed=${result.passed}, placeholders=${result.placeholders_found}, duplicates=${result.duplicate_words}`);
    
    return result;
  }

  _checkObject(obj, path, result) {
    if (obj === null || obj === undefined) return;
    
    if (typeof obj === 'string') {
      result.checked_fields++;
      this._checkString(obj, path, result);
    } else if (typeof obj === 'number') {
      result.checked_fields++;
      this._checkNumber(obj, path, result);
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        this._checkObject(item, `${path}[${index}]`, result);
      });
    } else if (typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith('_')) continue;
        this._checkObject(value, path ? `${path}.${key}` : key, result);
      }
    }
  }

  _checkString(str, path, result) {
    for (const pattern of this.placeholderPatterns) {
      const matches = str.match(pattern);
      if (matches) {
        result.placeholders_found += matches.length;
        for (const match of matches) {
          result.issues.push({
            type: 'placeholder',
            location: path,
            value: match,
            fix: 'N/A'
          });
        }
      }
    }

    const duplicates = str.match(this.duplicatePattern);
    if (duplicates) {
      result.duplicate_words += duplicates.length;
      for (const dup of duplicates) {
        result.issues.push({
          type: 'duplicate_word',
          location: path,
          value: dup,
          fix: dup.split(/\s+/)[0]
        });
      }
    }

    const excessiveDecimals = str.match(this.excessiveDecimalPattern);
    if (excessiveDecimals) {
      result.formatting_issues += excessiveDecimals.length;
      for (const num of excessiveDecimals) {
        result.auto_fixes.push({
          type: 'decimal_format',
          location: path,
          original: num,
          fixed: parseFloat(num).toFixed(2)
        });
      }
    }
  }

  _checkNumber(num, path, result) {
    if (isNaN(num)) {
      result.nan_values++;
      result.issues.push({
        type: 'nan',
        location: path,
        value: 'NaN',
        fix: 'null'
      });
    }
  }

  autoFix(reportObject, options = {}) {
    console.log(`[QAChecker] Applying auto-fixes...`);
    
    const { companyName = null, symbol = null } = options;
    const fixed = JSON.parse(JSON.stringify(reportObject));
    let fixCount = 0;

    const fixString = (str) => {
      let result = str;
      
      if (companyName) {
        result = result.replace(/\bundefined\b(?!\s*=|\s*:)/gi, companyName);
      } else {
        result = result.replace(/\bundefined\b(?!\s*=|\s*:)/gi, 'the company');
      }
      
      for (const pattern of this.placeholderPatterns.slice(1)) {
        result = result.replace(pattern, 'N/A');
      }
      
      result = result.replace(this.duplicatePattern, '$1');
      
      result = result.replace(this.excessiveDecimalPattern, (match) => {
        return parseFloat(match).toFixed(1);
      });
      
      result = result.replace(this.numericOverflowPattern, (match) => {
        return parseFloat(match).toFixed(2);
      });
      
      for (const pattern of this.brokenSentencePatterns) {
        if (pattern.source === '\\.\\s*\\.') {
          result = result.replace(pattern, '.');
        } else if (pattern.source === ',\\s*,') {
          result = result.replace(pattern, ',');
        } else if (pattern.source === '\\s+,') {
          result = result.replace(pattern, ',');
        } else if (pattern.source === '\\s{3,}') {
          result = result.replace(pattern, ' ');
        }
      }
      
      result = result.replace(/\s+/g, ' ').trim();
      
      if (result !== str) fixCount++;
      return result;
    };

    const processObject = (obj) => {
      if (obj === null || obj === undefined) return obj;
      
      if (typeof obj === 'string') {
        return fixString(obj);
      } else if (typeof obj === 'number') {
        return isNaN(obj) ? null : obj;
      } else if (Array.isArray(obj)) {
        return obj.map(item => processObject(item));
      } else if (typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = processObject(value);
        }
        return result;
      }
      return obj;
    };

    const result = processObject(fixed);
    console.log(`[QAChecker] Applied ${fixCount} auto-fixes`);
    
    return result;
  }

  generateQASummary(checkResult) {
    const lines = [];
    
    if (checkResult.passed) {
      lines.push('✅ QA Check Passed');
    } else {
      lines.push('⚠️ QA Check Found Issues');
    }
    
    lines.push(`  • Placeholders: ${checkResult.placeholders_found}`);
    lines.push(`  • Duplicate Words: ${checkResult.duplicate_words}`);
    lines.push(`  • NaN Values: ${checkResult.nan_values}`);
    lines.push(`  • Chart Errors: ${checkResult.chart_errors}`);
    lines.push(`  • Formatting Issues: ${checkResult.formatting_issues}`);
    lines.push(`  • Fields Checked: ${checkResult.checked_fields}`);
    
    return lines.join('\n');
  }

  _extractAllText(obj, texts = []) {
    if (obj === null || obj === undefined) return texts;
    
    if (typeof obj === 'string') {
      texts.push(obj);
    } else if (Array.isArray(obj)) {
      obj.forEach(item => this._extractAllText(item, texts));
    } else if (typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith('_')) continue;
        this._extractAllText(value, texts);
      }
    }
    
    return texts.join(' ');
  }

  _countActualDuplicates(tokens) {
    let duplicateCount = 0;
    const normalizedTokens = tokens.map(t => t.toLowerCase().replace(/[.,;:!?'"()]/g, ''));
    
    for (let i = 0; i < normalizedTokens.length - 1; i++) {
      const token = normalizedTokens[i];
      if (token.length < 3) continue;
      
      if (token === normalizedTokens[i + 1]) {
        duplicateCount++;
      }
    }
    
    return duplicateCount;
  }

  filterValidCharts(charts) {
    if (!charts || !Array.isArray(charts)) return [];
    
    const validCharts = charts.filter(chart => {
      if (!chart) return false;
      if (chart.url === null || chart.url === undefined) return false;
      if (chart.error) return false;
      return true;
    });
    
    const skipped = charts.length - validCharts.length;
    if (skipped > 0) {
      console.log(`[QAChecker] Filtered out ${skipped} unavailable charts from PDF output`);
    }
    
    return validCharts;
  }

  getChartDebugInfo(charts) {
    if (!charts || !Array.isArray(charts)) return { available: 0, unavailable: 0, details: [] };
    
    const details = charts.map(chart => ({
      name: chart.name,
      available: chart.url !== null && !chart.error,
      data_points: chart.data_points || 0,
      error: chart.error || null
    }));
    
    return {
      available: details.filter(d => d.available).length,
      unavailable: details.filter(d => !d.available).length,
      details
    };
  }

  runFinalQA(reportObject, options = {}) {
    console.log(`[QAChecker] Running final QA pass before PDF generation...`);
    
    const checkResult = this.check(reportObject);
    
    let fixedReport = reportObject;
    if (!checkResult.passed || checkResult.formatting_issues > 0) {
      fixedReport = this.autoFix(reportObject, options);
      console.log(`[QAChecker] Auto-fixes applied`);
    }
    
    if (fixedReport.charts) {
      const chartDebug = this.getChartDebugInfo(fixedReport.charts);
      fixedReport._chart_debug = chartDebug;
      
      fixedReport.charts = this.filterValidCharts(fixedReport.charts);
      console.log(`[QAChecker] ${fixedReport.charts.length} charts passed validation`);
    }
    
    const finalCheck = this.check(fixedReport);
    
    return {
      report: fixedReport,
      qa_result: finalCheck,
      summary: this.generateQASummary(finalCheck),
      ready_for_pdf: finalCheck.passed || 
                     (finalCheck.placeholders_found === 0 && finalCheck.nan_values === 0)
    };
  }

  runMandatoryGating(reportObject, chartStats, options = {}) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`[QAChecker] ⚠️  MANDATORY QA GATING - ABORT ON FAILURE`);
    console.log(`${'═'.repeat(60)}`);
    
    const { companyName = 'Unknown', symbol = 'N/A' } = options;
    const timestamp = new Date().toISOString();
    
    const metrics = {
      placeholder_count: 0,
      placeholder_rate: 0,
      chart_success_rate: 0,
      duplicate_token_count: 0,
      duplicate_token_rate: 0,
      numeric_format_errors: 0,
      total_tokens: 0
    };
    
    const violations = [];
    
    const initialCheck = this.check(reportObject);
    metrics.placeholder_count = initialCheck.placeholders_found;
    metrics.duplicate_token_count = initialCheck.duplicate_words;
    metrics.numeric_format_errors = initialCheck.formatting_issues;
    
    const totalCharts = chartStats?.total || 0;
    const successfulCharts = chartStats?.successful || 0;
    
    if (totalCharts === 0) {
      metrics.chart_success_rate = 0;
    } else {
      metrics.chart_success_rate = successfulCharts / totalCharts;
    }
    
    const allText = this._extractAllText(reportObject);
    const tokens = allText.split(/\s+/).filter(t => t.length > 0);
    metrics.total_tokens = tokens.length;
    
    if (metrics.total_tokens > 0) {
      const duplicateCount = this._countActualDuplicates(tokens);
      metrics.duplicate_token_count = duplicateCount;
      metrics.duplicate_token_rate = duplicateCount / metrics.total_tokens;
    } else {
      metrics.duplicate_token_rate = 0;
    }
    
    const totalFields = Math.max(initialCheck.checked_fields, 1);
    metrics.placeholder_rate = metrics.placeholder_count / totalFields;
    
    if (metrics.placeholder_count > this.THRESHOLDS.MAX_PLACEHOLDERS) {
      violations.push({
        rule: 'MAX_PLACEHOLDERS',
        threshold: this.THRESHOLDS.MAX_PLACEHOLDERS,
        actual: metrics.placeholder_count,
        severity: 'CRITICAL',
        message: `Found ${metrics.placeholder_count} placeholders/undefined values (max: ${this.THRESHOLDS.MAX_PLACEHOLDERS})`
      });
    }
    
    if (totalCharts > 0 && metrics.chart_success_rate < this.THRESHOLDS.MIN_CHART_SUCCESS_RATE) {
      violations.push({
        rule: 'MIN_CHART_SUCCESS_RATE',
        threshold: this.THRESHOLDS.MIN_CHART_SUCCESS_RATE,
        actual: metrics.chart_success_rate,
        severity: 'CRITICAL',
        message: `Chart success rate ${(metrics.chart_success_rate * 100).toFixed(1)}% below minimum ${(this.THRESHOLDS.MIN_CHART_SUCCESS_RATE * 100)}%`
      });
    } else if (totalCharts === 0) {
      violations.push({
        rule: 'NO_CHARTS_GENERATED',
        threshold: 1,
        actual: 0,
        severity: 'CRITICAL',
        message: `No charts were generated - report requires at least 1 chart`
      });
    }
    
    if (metrics.duplicate_token_rate > this.THRESHOLDS.MAX_DUPLICATE_TOKEN_RATE) {
      violations.push({
        rule: 'MAX_DUPLICATE_TOKEN_RATE',
        threshold: this.THRESHOLDS.MAX_DUPLICATE_TOKEN_RATE,
        actual: metrics.duplicate_token_rate,
        severity: 'HIGH',
        message: `Duplicate token rate ${(metrics.duplicate_token_rate * 100).toFixed(2)}% exceeds maximum ${(this.THRESHOLDS.MAX_DUPLICATE_TOKEN_RATE * 100)}%`
      });
    }
    
    if (metrics.numeric_format_errors > this.THRESHOLDS.MAX_NUMERIC_FORMAT_ERRORS) {
      violations.push({
        rule: 'MAX_NUMERIC_FORMAT_ERRORS',
        threshold: this.THRESHOLDS.MAX_NUMERIC_FORMAT_ERRORS,
        actual: metrics.numeric_format_errors,
        severity: 'HIGH',
        message: `Found ${metrics.numeric_format_errors} numeric format errors (max: ${this.THRESHOLDS.MAX_NUMERIC_FORMAT_ERRORS})`
      });
    }
    
    const criticalViolations = violations.filter(v => v.severity === 'CRITICAL');
    const shouldAbort = criticalViolations.length > 0;
    const canAutoFix = !shouldAbort && violations.length > 0;
    
    console.log(`\n[QA Metrics]`);
    console.log(`  • Placeholders: ${metrics.placeholder_count}`);
    console.log(`  • Chart Success Rate: ${(metrics.chart_success_rate * 100).toFixed(1)}%`);
    console.log(`  • Duplicate Token Rate: ${(metrics.duplicate_token_rate * 100).toFixed(2)}%`);
    console.log(`  • Numeric Format Errors: ${metrics.numeric_format_errors}`);
    
    if (violations.length > 0) {
      console.log(`\n[QA Violations]`);
      violations.forEach(v => {
        const icon = v.severity === 'CRITICAL' ? '🛑' : '⚠️';
        console.log(`  ${icon} ${v.message}`);
      });
    }
    
    const gatingResult = {
      timestamp,
      symbol,
      company_name: companyName,
      metrics,
      violations,
      thresholds: this.THRESHOLDS,
      decision: {
        should_abort: shouldAbort,
        can_auto_fix: canAutoFix,
        ready_for_publish: violations.length === 0,
        staging_required: violations.length > 0 && !shouldAbort
      },
      qa_pass: violations.length === 0
    };
    
    if (shouldAbort) {
      console.log(`\n🛑 [QA GATE] ABORT - Report blocked from publishing`);
      console.log(`   Reason: ${criticalViolations.map(v => v.rule).join(', ')}`);
    } else if (violations.length > 0) {
      console.log(`\n⚠️  [QA GATE] STAGING - Report requires review before publishing`);
    } else {
      console.log(`\n✅ [QA GATE] PASSED - Report approved for publishing`);
    }
    
    console.log(`${'═'.repeat(60)}\n`);
    
    return gatingResult;
  }

  generateDiagnosticsJSON(reportResult, gatingResult) {
    return {
      status: gatingResult.qa_pass ? 'PASSED' : (gatingResult.decision.should_abort ? 'BLOCKED' : 'STAGING'),
      timestamp: gatingResult.timestamp,
      ticker: gatingResult.symbol,
      company: gatingResult.company_name,
      metrics: {
        placeholder_rate: (gatingResult.metrics.placeholder_rate * 100).toFixed(2) + '%',
        chart_success_rate: (gatingResult.metrics.chart_success_rate * 100).toFixed(1) + '%',
        duplicate_token_rate: (gatingResult.metrics.duplicate_token_rate * 100).toFixed(2) + '%',
        numeric_format_errors: gatingResult.metrics.numeric_format_errors
      },
      violations: gatingResult.violations.map(v => ({
        rule: v.rule,
        severity: v.severity,
        message: v.message
      })),
      decision: gatingResult.decision,
      thresholds: gatingResult.thresholds,
      pipeline_meta: reportResult?._meta || {}
    };
  }
}

module.exports = new QAChecker();
