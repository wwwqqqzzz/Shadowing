# Shadowing — 部署与运维

> 最后更新：2026-06-01

## 环境变量

```bash
# 后端必须
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=wang
DATABASE_PASSWORD=        # 本地开发空密码
DATABASE_NAME=shadowing_dev
JWT_SECRET=your-secret-here

# 可选
PORT=3000                 # 默认 3000
```

## 本地开发启动

```bash
# 1. PostgreSQL — 确保 shadowing_dev 数据库存在
psql -U wang -d shadowing_dev

# 2. 后端
cd backend
npm install
npm run start:dev        # http://localhost:3000/api

# 3. 管理后台
cd admin
npm install
npm run dev              # http://localhost:5173

# 4. 小程序
# 微信开发者工具打开 miniprogram/ 目录
# 本地设置：不校验合法域名
```

## 生产部署注意事项

### 后端
- `TypeORM synchronize: true` 必须改为 `synchronize: process.env.NODE_ENV !== 'production'`
- JWT secret 不能从 process.env 直接读，应该用 ConfigService
- CORS 需要配置实际域名
- 上传目录需要持久化存储

### 数据库
- 首次启动 TypeORM 自动建表（synchronize: true）
- 收藏表会创建唯一索引 `UNIQUE(user, material)`
- accent 列默认值为 'american'，现有数据自动填充

### 管理后台
- `admin/src/api/materials.ts` 第3行硬编码 `http://localhost:3000/api`
- 部署前需改为实际后端地址
- Vite 生产构建：`npm run build`

### 小程序
- `miniprogram/utils/request.js` 第1行硬编码 `http://localhost:3000/api`
- 发布前改为实际后端域名
- 需要在微信后台配置 request 合法域名

## 常用操作

```bash
# 导入素材（后端运行时）
# POST /api/admin/materials/import — multipart: audioFile + vttFile

# 批量设置 published
# psql -U wang -d shadowing_dev -c "UPDATE material SET status = 'published';"

# 查看 mastery_threshold
# psql -U wang -d shadowing_dev -c "SELECT * FROM app_config;"
# 默认值: mastery_threshold = 80

# 清除练习数据（测试用）
# psql -U wang -d shadowing_dev -c "DELETE FROM practice_record;"

# 重置用户数据
# psql -U wang -d shadowing_dev -c "DELETE FROM favorite; DELETE FROM practice_record; DELETE FROM \"user\";"
```

## 数据迁移

TypeORM `synchronize: true` 会自动同步实体定义到数据库。新增字段（如 `accent`）会自动添加列并填充默认值。不需要手动 migration。

**生产环境必须关闭 synchronize 或加条件守卫。**