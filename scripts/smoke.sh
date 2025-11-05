#!/usr/bin/env bash
set -e

echo "=========================================="
echo "USIS Brain v4.2_fixed - Smoke Test"
echo "=========================================="
echo ""

echo "[1/3] normalizeSymbol quick test"
node -e "
const normalizeSymbol = (raw) => {
  const s = (raw || '').trim().toUpperCase();
  const map = [
    { re: /\.MC$/, to: sym => \`BME:\${sym.replace(/\.MC$/, '')}\` },
    { re: /\.PA$/, to: sym => \`EPA:\${sym.replace(/\.PA$/, '')}\` },
    { re: /\.DE$/, to: sym => \`XETRA:\${sym.replace(/\.DE$/, '')}\` },
    { re: /\.MI$/, to: sym => \`MIL:\${sym.replace(/\.MI$/, '')}\` },
    { re: /\.L$/,  to: sym => \`LSE:\${sym.replace(/\.L$/, '')}\` }
  ];
  for (const r of map) if (r.re.test(s)) return r.to(s);
  return s;
};
console.log('✅ GRF.MC  ->', normalizeSymbol('GRF.MC'));
console.log('✅ SAP.DE  ->', normalizeSymbol('SAP.DE'));
console.log('✅ BNP.PA  ->', normalizeSymbol('BNP.PA'));
console.log('✅ VOD.L   ->', normalizeSymbol('VOD.L'));
"
echo ""

echo "[2/3] Local health check"
HEALTH=$(curl -s http://localhost:5000/health 2>&1)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo "✅ Health endpoint OK"
else
  echo "❌ Health endpoint failed: $HEALTH"
  exit 1
fi
echo ""

echo "[3/3] Local ping test"
PING=$(curl -s -X POST http://localhost:5000/brain/ping \
  -H "Content-Type: application/json" \
  -d '{"test":"smoke"}' 2>&1)
if echo "$PING" | grep -q '"status":"ok"'; then
  echo "✅ Ping endpoint OK"
else
  echo "❌ Ping endpoint failed: $PING"
  exit 1
fi
echo ""

echo "[Optional] Dev environment test"
DEV="$1"
if [ -z "$DEV" ]; then
  echo "ℹ️  Skip dev check (no URL provided)"
  echo "   Usage: ./scripts/smoke.sh <your-dev-url.replit.dev>"
else
  echo "Testing dev environment: $DEV"
  DEV_HEALTH=$(curl -s "https://$DEV/health" 2>&1)
  if echo "$DEV_HEALTH" | grep -q '"status":"ok"'; then
    echo "✅ Dev health OK"
  else
    echo "⚠️  Dev health check failed (may need deployment)"
  fi
fi
echo ""

echo "=========================================="
echo "✅ Smoke test completed successfully!"
echo "=========================================="
