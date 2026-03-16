#!/usr/bin/env node

/**
 * MVP 项目配置检查
 * 用法: node setup-check.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('🔍 开始配置检查...\n');

// 检查 1: 环境变量
console.log('1️⃣  检查环境变量...');
const requiredEnvs = ['SUPABASE_URL', 'SUPABASE_KEY', 'JWT_SECRET'];
let envOk = true;

requiredEnvs.forEach(env => {
  if (process.env[env]) {
    console.log(`   ✅ ${env} 已设置`);
  } else {
    console.log(`   ❌ ${env} 未设置`);
    envOk = false;
  }
});

if (!envOk) {
  console.log('\n⚠️  请在 .env 文件中配置所有必需的环境变量\n');
  process.exit(1);
}

// 检查 2: 目录结构
console.log('\n2️⃣  检查目录结构...');
const dirs = ['config', 'routes', 'middleware', 'public', 'utils'];
dirs.forEach(dir => {
  if (fs.existsSync(path.join(__dirname, dir))) {
    console.log(`   ✅ ${dir}/ 目录存在`);
  } else {
    console.log(`   ❌ ${dir}/ 目录不存在`);
  }
});

// 检查 3: 关键文件
console.log('\n3️⃣  检查关键文件...');
const files = [
  'app.js',
  'config/supabase.js',
  'routes/auth.js',
  'middleware/auth.js',
  'public/index.html',
  'public/style.css',
  'public/script.js',
  'utils/helpers.js'
];

files.forEach(file => {
  if (fs.existsSync(path.join(__dirname, file))) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} 不存在`);
  }
});

// 检查 4: 依赖
console.log('\n4️⃣  检查依赖...');
const packageJson = require('./package.json');
const requiredDeps = [
  'express',
  'bcryptjs',
  'jsonwebtoken',
  '@supabase/supabase-js',
  'cors',
  'dotenv'
];

requiredDeps.forEach(dep => {
  if (packageJson.dependencies[dep]) {
    console.log(`   ✅ ${dep}`);
  } else {
    console.log(`   ❌ ${dep} 未安装`);
  }
});

// 试试测试连接
console.log('\n5️⃣  测试 Supabase 连接...');
try {
  const supabase = require('./config/supabase');
  console.log('   ✅ Supabase 配置已加载');
} catch (err) {
  console.log('   ❌ Supabase 配置加载失败:', err.message);
}

console.log('\n✨ 配置检查完成！');
console.log('\n📝 下一步:');
console.log('1. 在 Supabase 中执行 SCHEMA.sql');
console.log('2. 运行 npm run dev 启动服务器');
console.log('3. 访问 http://localhost:3000');
