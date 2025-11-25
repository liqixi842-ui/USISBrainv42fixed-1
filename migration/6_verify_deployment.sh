#!/bin/bash
# ═══════════════════════════════════════════════════════════
# USIS Brain 部署验证脚本
# 用途：验证所有服务是否正常运行
# ═══════════════════════════════════════════════════════════

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ USIS Brain 部署验证"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

BASE_URL="https://myusis.net"
ERRORS=0

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 测试函数
test_endpoint() {
  local name="$1"
  local url="$2"
  local expected_code="${3:-200}"
  
  echo -n "Testing $name... "
  
  response=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "$url" 2>/dev/null)
  
  if [ "$response" = "$expected_code" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $response)"
  else
    echo -e "${RED}✗ FAIL${NC} (Expected $expected_code, got $response)"
    ERRORS=$((ERRORS + 1))
  fi
}

# ═══════════════════════════════════════════════════════════
# 1. 系统服务检查
# ═══════════════════════════════════════════════════════════
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[1/5] 系统服务状态"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# PM2
if command -v pm2 &> /dev/null; then
  echo -e "${GREEN}✓${NC} PM2 已安装"
  pm2 status
else
  echo -e "${RED}✗${NC} PM2 未安装"
  ERRORS=$((ERRORS + 1))
fi

echo ""

# PostgreSQL
if systemctl is-active --quiet postgresql; then
  echo -e "${GREEN}✓${NC} PostgreSQL 运行中"
else
  echo -e "${RED}✗${NC} PostgreSQL 未运行"
  ERRORS=$((ERRORS + 1))
fi

# Nginx
if systemctl is-active --quiet nginx; then
  echo -e "${GREEN}✓${NC} Nginx 运行中"
else
  echo -e "${RED}✗${NC} Nginx 未运行"
  ERRORS=$((ERRORS + 1))
fi

echo ""

# ═══════════════════════════════════════════════════════════
# 2. 网络连通性
# ═══════════════════════════════════════════════════════════
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[2/5] 网络连通性测试"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 本地端口
if netstat -tuln | grep -q ':3000'; then
  echo -e "${GREEN}✓${NC} Node.js 监听端口 3000"
else
  echo -e "${RED}✗${NC} Node.js 未监听端口 3000"
  ERRORS=$((ERRORS + 1))
fi

if netstat -tuln | grep -q ':80'; then
  echo -e "${GREEN}✓${NC} Nginx 监听端口 80"
else
  echo -e "${RED}✗${NC} Nginx 未监听端口 80"
  ERRORS=$((ERRORS + 1))
fi

if netstat -tuln | grep -q ':443'; then
  echo -e "${GREEN}✓${NC} Nginx 监听端口 443 (HTTPS)"
else
  echo -e "${YELLOW}⚠${NC} Nginx 未监听端口 443 (HTTPS未配置)"
fi

echo ""

# ═══════════════════════════════════════════════════════════
# 3. HTTP 端点测试
# ═══════════════════════════════════════════════════════════
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[3/5] HTTP 端点测试"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint "Health Check" "${BASE_URL}/health"
test_endpoint "v3 Report Test" "${BASE_URL}/v3/report/test"
test_endpoint "Replit Health" "${BASE_URL}/_replit_health"

echo ""

# ═══════════════════════════════════════════════════════════
# 4. 研报生成测试
# ═══════════════════════════════════════════════════════════
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[4/5] 研报生成测试"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "Testing JSON report generation... "
response=$(curl -s "${BASE_URL}/v3/report/AAPL?format=json" | jq -r '.ok' 2>/dev/null)
if [ "$response" = "true" ]; then
  echo -e "${GREEN}✓ PASS${NC} (JSON report generated)"
else
  echo -e "${RED}✗ FAIL${NC} (JSON report failed)"
  ERRORS=$((ERRORS + 1))
fi

echo "Testing HTML report generation... "
http_code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/v3/report/AAPL?format=html")
if [ "$http_code" = "200" ]; then
  echo -e "${GREEN}✓ PASS${NC} (HTML report generated)"
else
  echo -e "${RED}✗ FAIL${NC} (HTML report failed, HTTP $http_code)"
  ERRORS=$((ERRORS + 1))
fi

echo -e "${YELLOW}⚠${NC} PDF 测试已跳过（需要较长时间）"
echo "  手动测试: curl ${BASE_URL}/v3/report/AAPL?format=pdf -o test.pdf"

echo ""

# ═══════════════════════════════════════════════════════════
# 5. 数据库连接测试
# ═══════════════════════════════════════════════════════════
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[5/5] 数据库连接测试"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "/opt/usis-brain/.env" ]; then
  source /opt/usis-brain/.env
  
  if psql "$DATABASE_URL" -c "SELECT 1" &>/dev/null; then
    echo -e "${GREEN}✓${NC} 数据库连接成功"
    
    # 列出所有表
    echo ""
    echo "数据库表:"
    psql "$DATABASE_URL" -t -c "\dt" | grep public | awk '{print "  - " $3}'
  else
    echo -e "${RED}✗${NC} 数据库连接失败"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo -e "${YELLOW}⚠${NC} .env 文件未找到，跳过数据库测试"
fi

echo ""

# ═══════════════════════════════════════════════════════════
# 总结
# ═══════════════════════════════════════════════════════════
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ 所有测试通过!${NC}"
  echo ""
  echo "🎉 USIS Brain 部署成功!"
  echo ""
  echo "📊 访问地址:"
  echo "   - 主页: ${BASE_URL}"
  echo "   - 健康检查: ${BASE_URL}/health"
  echo "   - 研报测试: ${BASE_URL}/v3/report/AAPL?format=json"
  echo ""
  echo "📱 管理命令:"
  echo "   - 查看日志: sudo -u usis pm2 logs"
  echo "   - 重启应用: sudo -u usis pm2 restart all"
  echo "   - 查看状态: sudo -u usis pm2 status"
  echo ""
else
  echo -e "${RED}❌ 发现 $ERRORS 个错误${NC}"
  echo ""
  echo "请检查:"
  echo "   1. PM2 日志: sudo -u usis pm2 logs"
  echo "   2. Nginx 日志: tail -f /var/log/nginx/usis-brain-error.log"
  echo "   3. 系统日志: journalctl -u pm2-usis -f"
  echo ""
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
