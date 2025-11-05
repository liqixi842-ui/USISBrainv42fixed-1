// 强制清除所有require缓存并启动
console.log('🔄 清除所有模块缓存...');

// 清除所有缓存
Object.keys(require.cache).forEach(key => {
  delete require.cache[key];
  console.log(`   清除: ${key.split('/').pop()}`);
});

console.log('✅ 缓存已清除');
console.log('🚀 启动应用（强制重新加载）...\n');

// 重新加载主应用
require('./index.js');
