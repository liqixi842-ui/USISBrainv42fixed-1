/**
 * ═══════════════════════════════════════════════════════════════
 * ScreenshotAPI TradingView 弹窗修复脚本 (方案 1: 添加 JS 参数)
 * ═══════════════════════════════════════════════════════════════
 * 
 * 尝试在 ScreenshotAPI 请求中添加 JS 注入参数来关闭弹窗
 */

const { getN8NClient } = require('./n8nClient');

console.log('\n╔════════════════════════════════════════════════════╗');
console.log('║   ScreenshotAPI 弹窗修复 - 添加 JS 参数           ║');
console.log('╚════════════════════════════════════════════════════╝\n');

/**
 * 弹窗关闭 JS（简化版，适合 URL 参数）
 */
const POPUP_CLOSE_JS_COMPACT = `
(function(){
  setTimeout(function(){
    const selectors=['button[aria-label="Close"]','button[title="Close"]','#overlap-manager-root','div[role="dialog"]','div[class*="modal"]','div[class*="Modal"]'];
    selectors.forEach(function(s){
      document.querySelectorAll(s).forEach(function(e){
        if(e.tagName==='BUTTON'){e.click()}else{const r=e.getBoundingClientRect();if(r.width>400&&r.height>200){e.remove()}}
      })
    });
    console.log('[TV-Fix] Popup removal completed');
  },3000);
})();
`.trim().replace(/\n/g, ' ');

async function main() {
  const client = getN8NClient();
  
  try {
    // Step 1: 获取 workflow
    console.log('🔍 [Step 1] 获取 Stock Screenshot workflow...\n');
    
    const result = await client.getWorkflows();
    if (!result.ok) {
      throw new Error(`获取 workflows 失败: ${result.error}`);
    }
    
    const workflow = result.workflows.find(w => 
      w.name.includes('Stock') && w.name.includes('Screenshot')
    );
    
    if (!workflow) {
      throw new Error('未找到 Stock Screenshot workflow');
    }
    
    console.log(`   找到 workflow: ${workflow.name}`);
    console.log(`   ID: ${workflow.id}\n`);
    
    // Step 2: 修改 ScreenshotAPI 节点参数
    console.log('🔧 [Step 2] 修改 ScreenshotAPI 节点参数...\n');
    
    let modified = false;
    
    workflow.nodes.forEach(node => {
      // 查找调用 screenshotapi.net 的节点
      if (node.type === 'n8n-nodes-base.httpRequest' && 
          node.parameters.url && 
          node.parameters.url.includes('screenshotapi.net')) {
        
        console.log(`   找到节点: ${node.name}`);
        
        // 检查是否已有 execute 参数
        const params = node.parameters.queryParameters?.parameters || [];
        const hasExecute = params.some(p => p.name === 'execute');
        
        if (hasExecute) {
          console.log(`   ⚠️  节点已有 execute 参数，跳过`);
          return;
        }
        
        // 添加新参数
        if (!node.parameters.queryParameters) {
          node.parameters.queryParameters = { parameters: [] };
        }
        
        // 添加 execute 参数（ScreenshotAPI 支持执行 JS）
        node.parameters.queryParameters.parameters.push({
          name: 'execute',
          value: POPUP_CLOSE_JS_COMPACT
        });
        
        // 增加延迟，等待弹窗关闭
        const delayParam = params.find(p => p.name === 'delay');
        if (delayParam) {
          // 增加延迟到 5000ms
          delayParam.value = '5000';
        } else {
          node.parameters.queryParameters.parameters.push({
            name: 'delay',
            value: '5000'
          });
        }
        
        modified = true;
        console.log(`   ✅ 已添加 execute 和 delay 参数`);
      }
    });
    
    if (!modified) {
      console.log('   ⚠️  未找到需要修改的节点');
      return;
    }
    
    // Step 3: 保存 workflow
    console.log('\n💾 [Step 3] 保存修改后的 workflow...\n');
    
    const saveResult = await client.updateWorkflow(workflow.id, workflow);
    
    if (!saveResult.ok) {
      throw new Error(`保存失败: ${saveResult.error}`);
    }
    
    console.log(`   ✅ Workflow 已保存`);
    
    // 打印修复报告
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║   修复报告                                         ║');
    console.log('╚════════════════════════════════════════════════════╝\n');
    
    console.log(`✅ 修改的 Workflow:`);
    console.log(`   ├─ ID: ${workflow.id}`);
    console.log(`   └─ 名称: ${workflow.name}\n`);
    
    console.log(`✅ 添加的参数:`);
    console.log(`   ├─ execute: 弹窗关闭 JS 代码`);
    console.log(`   └─ delay: 5000ms (等待弹窗关闭)\n`);
    
    console.log(`📊 下一步:`);
    console.log(`   1. 在 Telegram 中测试「解票 NVDA」`);
    console.log(`   2. 检查返回的图片是否正常显示 K 线图`);
    console.log(`   3. 如果仍有弹窗，可能需要使用 Browserless 方案\n`);
    
    console.log('╔════════════════════════════════════════════════════╗');
    console.log('║   修复完成！                                       ║');
    console.log('╚════════════════════════════════════════════════════╝\n');
    
  } catch (error) {
    console.error('\n❌ 修复失败:\n');
    console.error(`   ${error.message}\n`);
    process.exit(1);
  }
}

main();
