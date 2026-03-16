const { createClient } = require('@supabase/supabase-js');

// 初始化 Supabase 客户端
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// 测试连接（仅在开发环境显示状态）
if (process.env.NODE_ENV !== 'production') {
  (async () => {
    try {
      if (!process.env.SUPABASE_URL?.startsWith('https://') || 
          process.env.SUPABASE_URL?.includes('your-project')) {
        console.warn('⚠️  Supabase 未配置 - 请在 .env 中设置 SUPABASE_URL 和 SUPABASE_KEY');
        return;
      }
      
      const { error } = await supabase.from('users').select('count').limit(1);
      if (error) throw error;
      console.log('✓ Supabase connected successfully');
    } catch (err) {
      console.warn('⚠️  Supabase 连接失败 - 请检查配置');
      console.warn('   错误:', err.message);
    }
  })();
}

module.exports = supabase;
