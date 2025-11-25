#!/usr/bin/env bash
# USIS Brain v4.2_fixed 发布命令
# 请按顺序执行以下命令

echo "=========================================="
echo "USIS Brain v4.2_fixed 发布流程"
echo "=========================================="
echo ""

# 第一步：提交 CHANGELOG 和发布文档
echo "步骤 1: 提交新文件到 Git"
echo "----------------------------------------"
echo "git add CHANGELOG.md RELEASE_v4.2_fixed.md scripts/smoke.sh GIT_RELEASE_COMMANDS.sh"
echo "git commit -m 'docs: add v4.2_fixed release documentation and smoke test'"
echo ""

# 第二步：创建主版本提交
echo "步骤 2: 创建稳定版本提交"
echo "----------------------------------------"
echo "git add ."
echo "git commit -m 'USIS Brain v4.2_fixed: normalizeSymbol(.MC->BME) + soft-dependency + debug.data_errors scope'"
echo ""

# 第三步：打标签
echo "步骤 3: 创建版本标签"
echo "----------------------------------------"
echo "git tag -a v4.2_fixed -m 'USIS Brain v4.2_fixed (stable) — symbol normalizer, soft dependency, debug scope'"
echo ""

# 第四步：推送到远程
echo "步骤 4: 推送到远程仓库"
echo "----------------------------------------"
echo "git push origin main"
echo "git push origin v4.2_fixed"
echo "git push origin --tags"
echo ""

# 第五步：远端健康检查
echo "步骤 5: 远端健康检查（可选）"
echo "----------------------------------------"
echo "# 替换 <DEV_URL> 为实际的开发环境地址"
echo "DEV_URL='be5f54bc-7f5c-4e6d-bda7-196ae8475f74-00-1elilbahtopcb.sisko.replit.dev'"
echo ""
echo "curl -s https://\$DEV_URL/health"
echo ""
echo "curl -s -X POST https://\$DEV_URL/brain/ping \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"test\":\"v4.2_fixed\"}'"
echo ""
echo "# 运行远端烟测"
echo "./scripts/smoke.sh \$DEV_URL"
echo ""

echo "=========================================="
echo "注意事项"
echo "=========================================="
echo "1. 确保所有测试通过后再推送"
echo "2. 检查 .gitignore 避免提交敏感信息"
echo "3. 推送后在 GitHub/GitLab 创建 Release"
echo "4. 更新团队文档和通知相关人员"
echo ""
echo "✅ 准备完成！请手动执行上述命令"
