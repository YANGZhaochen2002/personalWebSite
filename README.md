# 🔐 简单登录系统 MVP

一个使用 Express.js + Supabase + JWT 的最小可用产品（MVP）登录系统。

## 📋 功能

- ✅ 用户注册
- ✅ 用户登录
- ✅ JWT 认证
- ✅ 用户信息查看
- ✅ 用户登出

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 Supabase

访问 [supabase.com](https://supabase.com)，创建一个新项目。

在项目的 Settings → API 中获取：
- **Project URL** → `SUPABASE_URL`
- **Anon Key** → `SUPABASE_KEY`

### 3. 初始化数据库

在 Supabase SQL Editor 中执行 `SCHEMA.sql` 的内容：

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users(username);
```

### 4. 配置环境变量

编辑 `.env` 文件：

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key-here
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key-here
JWT_EXPIRE=7d
CORS_ORIGIN=http://localhost:3000
```

### 5. 启动服务器

```bash
# 开发模式（使用 nodemon 自动重启）
npm run dev

# 生产模式
npm start
```

服务器将在 `http://localhost:3000` 运行。

## 📁 项目结构

```
backend/
├── app.js                  # 主 Express 应用
├── package.json            # 依赖配置
├── .env                    # 环境变量
├── SCHEMA.sql              # 数据库 Schema
├── config/
│   └── supabase.js         # Supabase 配置
├── middleware/
│   └── auth.js             # JWT 认证中间件
├── routes/
│   └── auth.js             # 认证路由（登录/注册）
├── utils/
│   └── helpers.js          # 密码哈希工具
└── public/
    ├── index.html          # 登录页面
    ├── style.css           # 样式
    └── script.js           # 前端逻辑
```

## 🔌 API 端点

### POST `/api/auth/register`

注册新用户。

**请求：**
```json
{
  "username": "john",
  "password": "password123"
}
```

**响应：**
```json
{
  "success": true,
  "message": "User registered successfully",
  "userId": 1
}
```

### POST `/api/auth/login`

用户登录。

**请求：**
```json
{
  "username": "john",
  "password": "password123"
}
```

**响应：**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "john"
  }
}
```

### GET `/api/auth/me`

获取当前用户信息（需要 JWT Token）。

**请求头：**
```
Authorization: Bearer <token>
```

**响应：**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "john",
    "created_at": "2024-01-01T12:00:00Z"
  }
}
```

## 🎨 前端功能

- 注册/登录选项卡切换
- 表单验证
- 错误/成功消息提示
- 登录后显示用户信息面板
- 登出功能
- Token 本地存储
- 响应式设计

## 🔒 安全特性

- ✅ 密码使用 bcrypt 加密
- ✅ JWT Token 认证
- ✅ CORS 配置
- ✅ 环境变量管理
- ✅ 错误消息不泄露敏感信息

## 📝 认证流程

```
1. 用户卡注册 → 密码 bcrypt 加密 → 存储到数据库
2. 用户登录 → 验证用户名和密码 → 生成 JWT Token
3. 前端存储 Token 到 localStorage
4. 调用受保护的 API 时，在请求头中附加 Token
5. 服务器验证 Token → 返回用户数据
```

## ⚠️ 注意事项

- **开发环境**：使用示例 JWT_SECRET，生产环境必须更改
- **HTTPS**：生产环境必须使用 HTTPS
- **CORS**：根据实际前端地址配置 CORS_ORIGIN
- **Token 有效期**：默认 7 天，可根据需要调整

## 🧪 测试

### 测试注册
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}'
```

### 测试登录
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}'
```

### 测试获取用户信息
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 🚀 下一步扩展

可以基于这个 MVP 添加：

- [ ] 邮箱验证
- [ ] 密码重置功能
- [ ] 用户资料编辑
- [ ] 用户头像上传
- [ ] 刷新 Token 机制
- [ ] 用户禁用/删除
- [ ] 登录历史记录
- [ ] 双因素认证（2FA）

## 📞 故障排除

### "Cannot POST /api/auth/login"
- 确保服务器正在运行
- 检查 API 路由是否正确配置

### "Invalid token"
- Token 可能已过期
- 重新登录获取新 Token
- 检查 JWT_SECRET 配置是否一致

### "User not found"
- 检查注册时使用的用户名
- 用户名区分大小写

### "Internal server error"
- 检查 Supabase 连接配置
- 查看服务器日志获取详细信息
- SUPABASE_URL 和 SUPABASE_KEY 是否正确

## 📚 相关资源

- [Express.js 文档](https://expressjs.com/)
- [Supabase 文档](https://supabase.com/docs)
- [JWT 介绍](https://jwt.io/introduction)
- [bcryptjs 文档](https://www.npmjs.com/package/bcryptjs)

## 📄 许可证

MIT License
