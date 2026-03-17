# alma-lossless-memory

基于 SQLite + FTS5 全文检索与 DAG 分层摘要的 AI 代理无损长期记忆存储。

[![CI](https://github.com/huluma1314/almamem/actions/workflows/ci.yml/badge.svg)](https://github.com/huluma1314/almamem/actions/workflows/ci.yml)

## 特性

- **无损存储** — 每条消息都原样保存，不丢弃任何数据
- **FTS5 全文检索** — 跨所有记忆的快速相关性检索
- **DAG 摘要** — 分层摘要树在不丢失数据的前提下压缩历史
- **增量摘要** — 每个会话保存检查点，重复执行 `summarize` 快速且幂等
- **上下文组装器** — 智能 Token 预算感知的上下文窗口构建，含去重逻辑
- **配置文件** — 通过 `--config` 传入 JSON 配置文件设置所有默认值
- **批量导入** — `ingest --json` 从标准输入接受 JSON 对象或数组
- **CLI** — `alm` 命令行工具支持所有操作
- **TypeScript** — 完整类型定义，CommonJS，Node 18+

## 快速开始

```bash
npm ci
npm run build

# 添加记忆
node dist/cli.js add my-session user "你好，我在做一个 TypeScript 项目"
node dist/cli.js add my-session assistant "太好了！是什么类型的项目？"

# 从 JSON 批量导入
echo '[{"role":"user","content":"消息1"},{"role":"assistant","content":"回复1"}]' \
  | node dist/cli.js ingest my-session --json

# 搜索
node dist/cli.js search "TypeScript" --session my-session

# 构建 DAG 摘要（增量式，可安全重复执行）
node dist/cli.js summarize my-session

# 组装上下文窗口
node dist/cli.js context my-session --query "TypeScript" --max-tokens 2000

# 带 Token 预算调试信息的上下文组装
node dist/cli.js context my-session --debug
```

## 配置文件

创建 JSON 配置文件（如 `alma.config.json`），通过 `--config` 传入：

```json
{
  "dbPath": "./my-project.db",
  "keepRecentRaw": 30,
  "leafChunkSize": 600,
  "fanIn": 4,
  "tokenBudget": 8000,
  "retrievalLimit": 50
}
```

```bash
node dist/cli.js --config alma.config.json context my-session
```

配置字段（全部可选，未设置时使用默认值）：

| 字段 | 默认值 | 说明 |
|---|---|---|
| `dbPath` | `./alma.db` | SQLite 数据库路径（可被 `ALMA_DB` 环境变量覆盖）|
| `keepRecentRaw` | `20` | 摘要之外保留的最近原始消息数 |
| `leafChunkSize` | `800` | 每个叶子摘要块的最大 Token 数 |
| `fanIn` | `4` | 合并为一个父节点的摘要节点数 |
| `tokenBudget` | `4000` | 上下文组装的默认 Token 预算 |
| `retrievalLimit` | `30` | FTS 检索的默认结果数上限 |

## CLI 命令参考

| 命令 | 说明 |
|---|---|
| `alm add <session> <role> <content>` | 插入一条记忆 |
| `alm ingest <session> --json` | 从标准输入批量导入 JSON（对象或数组）|
| `alm list <session>` | 列出会话的所有记忆 |
| `alm search <query>` | 全文搜索 |
| `alm sessions` | 列出所有会话 ID |
| `alm summarize <session>` | 构建/更新 DAG 摘要（增量式）|
| `alm roots <session>` | 显示根摘要节点 |
| `alm context <session>` | 组装上下文窗口 |
| `alm delete <id>` | 按 ID 删除记忆 |

全局选项：
- `--config <path>` — JSON 配置文件路径

命令选项：
- `add -i, --importance <n>` — 重要性评分 0-1（默认：0.5）
- `list -n, --limit <n>` — 最大结果数（默认：50）
- `search -s, --session <id>` — 按会话过滤
- `search -n, --limit <n>` — 最大结果数（默认：10）
- `context -q, --query <text>` — FTS 相关性提升查询
- `context -t, --max-tokens <n>` — Token 预算（默认：配置中的 `tokenBudget`）
- `context --debug` — 打印 Token 预算使用明细

环境变量：
- `ALMA_DB` — SQLite 数据库文件路径（默认：`./alma.db`）

## 架构

```
alma-lossless-memory/
├── src/
│   ├── db/
│   │   ├── database.ts        # SQLite 连接 + 迁移
│   │   ├── migrations.ts      # 迁移执行器
│   │   └── schema.ts          # Schema SQL（v1-v4）
│   ├── memory/
│   │   ├── types.ts            # TypeScript 接口定义
│   │   ├── tokenizer.ts        # Token 估算
│   │   └── store.ts            # CRUD + FTS5 检索
│   ├── dag/
│   │   └── summarizer.ts      # 增量 DAG 摘要构建器
│   ├── context/
│   │   └── assembler.ts       # 上下文窗口组装器（去重 + 调试）
│   ├── fts/
│   │   └── sanitizer.ts       # FTS5 查询净化器
│   ├── config.ts              # JSON 配置加载器
│   ├── cli.ts                 # Commander CLI
│   └── index.ts               # 公共 API 导出
├── tests/
│   ├── memory.test.ts
│   ├── dag.test.ts
│   ├── context.test.ts
│   └── tokenizer.test.ts
└── .github/
    └── workflows/
        └── ci.yml             # GitHub Actions CI（Node 20 & 22）
```

## 开发

```bash
npm ci          # 安装依赖
npm run build   # 编译 TypeScript
npm test        # 运行 Jest 测试套件
npm run lint    # 仅类型检查
```

## 许可证

MIT
