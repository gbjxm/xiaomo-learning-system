# 领航终端连接层

本模块让个人终端读取和追加领航室记录。原 `tools/room.py`、`tools/continuity.py` 与 `状态/领航状态.json` 仍是权威；不建第二份数据库，不迁移学习、素材或信息库。

## 挂载和配置

宿主使用 `createNavigationHandler({ projectRoot, env, runModel, providerStatus })`，按布尔返回值判断接口是否已处理。静态页面由原统一宿主挂载。

正式个人终端根目录的 `navigation-connection.json` 显式提供：

```json
{"schemaVersion":1,"navigationRoot":"原领航室绝对路径"}
```

生产入口拒绝 `NAVIGATION_ROOT` 环境覆盖。隔离模式要求 `WORKSPACE_MODE=isolated`、独立个人终端 root 和该 root 内部的 `NAVIGATION_ROOT`；不得落到正式目录。Python 桥再次核对这些条件。

`runModel(messages, metadata)` 返回自然文字字符串，复用原宿主模型。`providerStatus()` 仅返回 `configured/provider/model/reason`，不包含凭据。模型不可用不影响旅程读取或保存。

## 接口

所有接口以 `/api/navigation/` 开头。成功返回 `{ok:true,data}`；失败返回 `{ok:false,error:{code,message,retryable,details}}`。

| 接口 | 内容 |
| --- | --- |
| GET `bootstrap?asOf=` | 版本、稳定数据身份、令牌、旅程目录、现有上下文和公开模型状态 |
| GET `journeys?query=&date=&since=&until=&type=` | 目录查找，日期按事件日期；类型为 `life/idea/note` |
| GET `journeys/<id>` | 全文、原始转写、原文件来源、对应 record IDs |
| GET `context?asOf=&query=` | 原 continuity 相关视图及共同资源检查 |
| GET `review?asOf=&since=&until=` | 期间旅程、分层依据、覆盖说明和 Codex 接续文本；`generated:false` |
| GET `profile?asOf=` | 从原个人资料及原领航状态构建来源视图，返回分区、补充、更正与旧版本关系 |
| GET `analyses?since=&until=&query=` | 查找以前明确保存的 AI 理解，仍为 `ai_inference` |
| POST `record` | 用户明确保存的旅程原文 |
| POST `profile-correction` | 本人明确补充或更正，追加原领航 `user_report` 并回读资料 |
| POST `chat` | 自然交流或弹性回看，`saved:false` |
| GET `requests/<requestId>` | 本进程模型请求的 pending/completed/failed 回执 |
| POST `analysis` | 用户明确保存的 AI 理解，始终为 `ai_inference` |

POST 必须带单个 `X-Navigation-Token` 和 `application/json`；请求最大 96 KiB。Host/Origin 由原宿主核对。桥使用无 shell 的隐藏 Python 子进程，禁写 Python 缓存；读取不初始化状态。

旅程保存输入：

```json
{"eventId":"E-example","expectedRevision":33,"entry":{"id":"J-example","title":"","date":"2026-10-04","type":"note","content":"本人原话"}}
```

标题可空，原文和标题保留起止空白。旅程保存为 `user_report`，以 `journey:{title,type}` 标记，不自动分析、采用路线或关闭任务。既有两份生活和灵感资料按固定名单只读复用，文档与原转写不复制或改写。全文为含理解的既有整理文件时，`contentKind` 明示 `mixed_document`。

AI 保存输入：

```json
{"eventId":"E-analysis","expectedRevision":33,"id":"A-example","content":"待校正的AI理解","relatedIds":["现有record标识"]}
```

`relatedIds` 只接受原 room record ID。AI 理解不成为旅程或事实，不自动推动路线。

版本冲突返回 409 和 `details.currentRevision`。响应未知时保留原输入、原 eventId 和 id，先读旅程详情核对，再原样重试；同提交不会重复记录，改内容复用提交标识会拒绝。AI 保存同样复用原请求标识。

聊天输入为 `{requestId,message,mode:'chat'|'review',asOf,since?,until?,history?}`。同进程相同请求共用模型调用；等待超时保留原 Promise，确认失败后可明确重试。未保存聊天回执不跨进程保留，重启后明确返回未找到，不能据此宣称已永久保存。

页面的领航桌只保留记录和聊天，`?view=profile` 为独立个人资料页；旧 `?view=review` 转为聊天且不自动发送。自然回看按客户端 `asOf` 解析明确期间，普通未来安排或背景日期不触发回看筛选；模糊期间不擅自定长，不支持的明确日期表达返回一句澄清。聊天与回执返回 `period/coverage`；重试冻结原请求、期间和已读取的材料。

个人资料补充输入为 `{identity,eventId,expectedRevision,id,sectionId,content,asOf,targetId?}`，`sectionId` 为 `about/values/current`，`content` 最多 8000 字。带 `targetId` 时只更正具体来源条目或本人补充，不能更正 AI 理解、已采用阶段或整个分区。原话保存到原 `room.apply`，包含来源快照与关系，不修改原 Markdown 或学习记录。当前交流视图优先使用最新具体更正；旧版本保留在资料历史中。来源摘录仍标作 `source_summary`，资料日期与经历日期不能混用。

## 验证范围

`node --test web/navigation/navigation.test.mjs` 使用两套独立 fixture root 和明确模型 mock，验证全文、GET 零写、原话、CAS、幂等、明确 AI 保存、模型失败/超时和隔离路径。宿主独立检查另见 `web/test/navigation-integration.test.mjs`。这类检查不证明模型判断质量、个人成长或实际日常体验。

本次资料与自然期间检查：`node --test web/navigation/profile.test.mjs web/navigation/period.test.mjs web/navigation/http-period.test.mjs`。完整本轮验收与数据保护见 `三系统工作台/领航减负交付记录.md`。
