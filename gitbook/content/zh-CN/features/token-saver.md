# Token 节省（Token Saver）

Agent 编程工具会把 30–50% 的 prompt 预算浪费在样板内容上：大段工具输出（`git diff`、`grep`、测试日志）、重复的工具结果、以及每轮都在重放的历史。9Router 的 **Token Saver** 在请求发出*之前*就地裁剪或压缩这些死重——按节省器逐个开关，并配有实时节省记分板。

所有节省器对模型的决策都是无损的：真正重要的失败与细节会保留，只有冗余体积被压缩或丢弃。

## 节省器一览

| 节省器 | 作用 | 默认 |
|---|---|---|
| **RTK 过滤器** | 识别工具输出类型（git diff/status、grep、find、ls、tree、日志）并用类型感知的无损过滤器压缩 | 开 |
| **工具结果去重** | 同一请求中字节级相同的工具输出变为一行引用（`duplicate of tool result #N`） | 开 |
| **History GC** | 早于最近 N 个用户轮次的工具结果被压成摘要（头部 + 大小 + 指纹 + 重跑提示） | 关（`historyGcEnabled`，保留轮数可配，默认 6） |
| **test-runner 过滤器** | 压缩 vitest/jest/pytest/go/mocha/TAP 输出——保留失败与摘要，略过通过墙 | 自动识别 |
| **响应缓存** | 非流式对话的精确请求缓存（LRU + TTL）；命中时带 `x-9r-cache: hit` | 关（`responseCacheEnabled`） |
| **自定义系统提示** | 在 OpenAI/Claude/Gemini/Kiro 请求形态中注入你自己的系统提示 | 关 |
| **Headroom** | 通过本地 Headroom 服务压缩上下文（工具输出、长文本；原生 Gemini/Responses/Claude 形态） | 关 |
| **Caveman** | 在 LLM *输出*重新进入对话前压缩它 | 关 |
| **Ponytail** | "懒惰资深工程师"模式——精简冗长的助手历史 | 关 |
| **Pxpipe** | 把大段文本上下文转换为优化图像（视觉模型） | 关 |

## 开启方式

仪表盘 → **Token Saver**：工具结果去重、History GC（含保留轮数输入）和响应缓存的开关，其余也在同一页面或各提供商设置中。

在本地数据库上通过 CLI：

```bash
node scripts/enable-token-savers.mjs            # RTK + 去重 + History GC
node scripts/enable-token-savers.mjs --response-cache --smart-combo
node scripts/enable-token-savers.mjs --revert   # 恢复默认
```

## 记分板

仪表盘 → **Usage → Token Saver Scoreboard** 实时显示各节省器自进程启动以来的命中次数、节省字节数与响应缓存统计（`GET /api/usage/savers`，POST 重置）。Usage 概览还展示**缓存命中率**——由提供商 prompt 缓存服务的输入 token 占比。

## 绕过

任意一次对话请求带上请求头 `X-9Router-Token-Saver: off` 即可原样发送。
