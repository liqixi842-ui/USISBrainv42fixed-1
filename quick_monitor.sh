#!/bin/bash

# USIS Brain v4.0 实时监控（简化版）
# 实时显示：响应时间、成本、错误率

echo "🔍 v4.0 实时监控启动..."
echo "================================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 计数器
total=0
success=0
failed=0
total_time=0
total_cost=0

# 监控日志文件
LOG_FILE="/tmp/v4_production.log"

# 如果日志文件不存在，等待服务器启动
if [ ! -f "$LOG_FILE" ]; then
    echo "⏳ 等待服务器启动..."
    sleep 3
fi

# 显示表头
printf "%-8s %-12s %-12s %-10s %-12s\n" "请求#" "响应时间" "成本" "状态" "错误率"
echo "----------------------------------------------------------------"

# 实时监控（tail -f 持续读取新日志）
tail -f "$LOG_FILE" 2>/dev/null | while read line; do
    # 捕获响应完成事件
    if echo "$line" | grep -q "✅ 响应完成"; then
        # 提取响应时间（毫秒）
        response_time=$(echo "$line" | grep -oP '\(\K[0-9]+(?=ms\))')
        
        if [ -n "$response_time" ]; then
            total=$((total + 1))
            success=$((success + 1))
            total_time=$((total_time + response_time))
            
            # 从上下文中提取成本（向上查找最近的成本追踪行）
            cost=$(tail -20 "$LOG_FILE" | grep "💰 成本追踪" | tail -1 | grep -oP '\$\K[0-9.]+' | head -1)
            if [ -z "$cost" ]; then
                cost="0.0075"  # 默认成本
            fi
            
            total_cost=$(echo "$total_cost + $cost" | bc)
            
            # 计算平均值
            avg_time=$((total_time / success))
            avg_cost=$(echo "scale=4; $total_cost / $success" | bc)
            error_rate=$(echo "scale=2; ($failed / $total) * 100" | bc)
            
            # 响应时间着色
            if [ "$response_time" -lt 8000 ]; then
                time_color=$GREEN
            elif [ "$response_time" -lt 15000 ]; then
                time_color=$YELLOW
            else
                time_color=$RED
            fi
            
            # 成本着色
            cost_num=$(echo "$cost" | awk '{print int($1*1000)}')
            if [ "$cost_num" -lt 10 ]; then
                cost_color=$GREEN
            elif [ "$cost_num" -lt 30 ]; then
                cost_color=$YELLOW
            else
                cost_color=$RED
            fi
            
            # 输出实时数据
            printf "#%-7d ${time_color}%-11dms${NC} ${cost_color}\$%-10s${NC} ${GREEN}✅ OK${NC}     %.2f%%\n" \
                "$total" "$response_time" "$cost" "$error_rate"
            
            # 每10次显示统计
            if [ $((total % 10)) -eq 0 ]; then
                echo "----------------------------------------------------------------"
                echo "📊 统计 (最近${total}次): 平均${avg_time}ms, 平均\$${avg_cost}, 错误率${error_rate}%"
                echo "----------------------------------------------------------------"
            fi
        fi
    fi
    
    # 捕获错误事件
    if echo "$line" | grep -q "❌ Orchestrator 错误"; then
        total=$((total + 1))
        failed=$((failed + 1))
        error_rate=$(echo "scale=2; ($failed / $total) * 100" | bc)
        
        printf "#%-7d ${RED}ERROR${NC}       -          ${RED}✗ FAIL${NC}   %.2f%%\n" \
            "$total" "$error_rate"
    fi
done
