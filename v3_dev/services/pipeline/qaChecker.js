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
    this.placeholderPatterns = [
      /undefined/gi,
      /\{[A-Z_]+\}/g,
      /\[PLACEHOLDER\]/gi,
      /TODO:/gi,
      /FIXME:/gi,
      /\bNULL\b/g,
      /\bNaN\b/g
    ];
    
    this.duplicatePattern = /\b(\w{3,})\s+\1\b/gi;
    
    this.excessiveDecimalPattern = /\d+\.\d{4,}/g;
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

  autoFix(reportObject) {
    console.log(`[QAChecker] Applying auto-fixes...`);
    
    const fixed = JSON.parse(JSON.stringify(reportObject));
    let fixCount = 0;

    const fixString = (str) => {
      let result = str;
      
      for (const pattern of this.placeholderPatterns) {
        result = result.replace(pattern, 'N/A');
      }
      
      result = result.replace(this.duplicatePattern, '$1');
      
      result = result.replace(this.excessiveDecimalPattern, (match) => {
        return parseFloat(match).toFixed(2);
      });
      
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
}

module.exports = new QAChecker();
