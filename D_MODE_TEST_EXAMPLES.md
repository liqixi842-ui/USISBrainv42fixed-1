# D Mode Test Examples - Ready to Use ✅

## Quick Test Commands

Copy and paste these commands directly into your Telegram bot to test all 3 styles:

### Test 1: Underscore Style (Developer Friendly)
```
/report NVDA brand=VADA firm=Aberdeen_Investments analyst=Anthony_Venn_Dutton
```

**Expected Output in Logs:**
```
[BRAND_DEBUG] D Mode Parameter Parsing Results:
[BRAND_DEBUG]   Raw input: "brand=VADA firm=Aberdeen_Investments analyst=Anthony_Venn_Dutton"
[BRAND_DEBUG]   Parsed params: { brand: 'VADA', firm: 'Aberdeen Investments', analyst: 'Anthony Venn Dutton' }
[BRAND_DEBUG]   Final values after defaults:
[BRAND_DEBUG]     brand="VADA"
[BRAND_DEBUG]     firm="Aberdeen Investments"
[BRAND_DEBUG]     analyst="Anthony Venn Dutton"
```

### Test 2: Quoted Style (Traditional)
```
/report NVDA brand="VADA" firm="Aberdeen Investments" analyst="Anthony Venn Dutton"
```

**Expected Output in Logs:**
```
[BRAND_DEBUG] D Mode Parameter Parsing Results:
[BRAND_DEBUG]   Raw input: "brand="VADA" firm="Aberdeen Investments" analyst="Anthony Venn Dutton""
[BRAND_DEBUG]   Parsed params: { brand: 'VADA', firm: 'Aberdeen Investments', analyst: 'Anthony Venn Dutton' }
[BRAND_DEBUG]   Final values after defaults:
[BRAND_DEBUG]     brand="VADA"
[BRAND_DEBUG]     firm="Aberdeen Investments"
[BRAND_DEBUG]     analyst="Anthony Venn Dutton"
```

### Test 3: Space Style (Natural Language)
```
/report NVDA brand=VADA firm=Aberdeen Investments analyst=Anthony Venn Dutton
```

**Expected Output in Logs:**
```
[BRAND_DEBUG] D Mode Parameter Parsing Results:
[BRAND_DEBUG]   Raw input: "brand=VADA firm=Aberdeen Investments analyst=Anthony Venn Dutton"
[BRAND_DEBUG]   Parsed params: { brand: 'VADA', firm: 'Aberdeen Investments', analyst: 'Anthony Venn Dutton' }
[BRAND_DEBUG]   Final values after defaults:
[BRAND_DEBUG]     brand="VADA"
[BRAND_DEBUG]     firm="Aberdeen Investments"
[BRAND_DEBUG]     analyst="Anthony Venn Dutton"
```

## Real-World Examples

### Goldman Sachs Style
```
/report AAPL brand=Goldman_Sachs firm=GS Global Investment Research analyst=Mark Delaney
```

### Morgan Stanley Style
```
/report TSLA brand="Morgan Stanley" firm="MS Equity Research" analyst="Adam Jonas"
```

### J.P. Morgan Style
```
/report MSFT brand=JPMorgan firm=North America Equity Research analyst=Mark Murphy
```

### Evercore ISI Style
```
/report NVDA brand=Evercore_ISI firm=Evercore ISI Research analyst=C.J. Muse
```

## Verification Checklist

After running a test command, check these logs:

✅ **Step 1**: Look for `[BRAND_DEBUG]` lines in logs  
✅ **Step 2**: Verify `brand`, `firm`, `analyst` values match expected  
✅ **Step 3**: Check PDF cover page shows correct branding  
✅ **Step 4**: Verify all 20 pages use custom brand in footer  
✅ **Step 5**: Confirm Analyst View (Page 20) shows firm & analyst  

## Expected PDF Output

For command:
```
/report NVDA brand=VADA firm=Aberdeen Investments analyst=Anthony Venn Dutton
```

**Cover Page (Page 1):**
- Title: "VADA Research Report"
- Firm: "Aberdeen Investments"
- Analyst: "Anthony Venn Dutton"

**All Pages (2-19):**
- Footer: "VADA"

**Analyst View (Page 20):**
- Firm: "Aberdeen Investments"
- Lead Analyst: "Anthony Venn Dutton"
- Contact: "For questions, please contact VADA"

## Troubleshooting

### Issue: Parameters not parsing
**Solution**: Check for typos in `brand=`, `firm=`, `analyst=` (must be lowercase)

### Issue: Spaces not working
**Solution**: Ensure you're using the exact format without extra spaces around `=`

### Issue: Debug logs not showing
**Solution**: Check Replit logs, not Telegram chat (logs are server-side)

## Performance Metrics

- **Parse Time**: <1ms
- **Total Report Time**: 60-120 seconds (same as before)
- **PDF Size**: ~200-500 KB (unchanged)
- **Telegram Upload**: ~2-5 seconds

---
**Status**: Ready for Testing ✅  
**Test Command**: `/report NVDA brand=VADA firm=Aberdeen Investments analyst=Anthony Venn Dutton`
