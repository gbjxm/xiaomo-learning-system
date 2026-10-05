# 私有云端同步包说明

生成时间（UTC）：2026-10-05T16:44:14.811635+00:00；来源根 alias：`learning-system`。清单用 alias 和相对路径标注来源，本机构建 sidecar 在上传包之外记录实际绝对根。原样正文和 SQLite 身份中的历史 Windows 绝对路径保留，仅用于追溯，不能当云端可用路径。每个来源文件的源哈希、包内哈希与分类见 [清单](source-manifest.json)。

## 内容与权威

入口、共识、运行约定、学习记录、10 项项目 Skills、正式应用源码、必要静态图与原附件原样保留。原本机 AGENTS 字节保留于 `local-AGENTS.source.md`，包根 AGENTS 增加云端范围约束。

两个 SQLite 从只读源连接通过 `sqlite3.Connection.backup` 生成各自一致性快照，位于 `cloud-data/snapshots/`。完整性检查和表计数见清单；素材登记附件及信息登记证据逐件检查大小与 SHA-256。UI JSON 是原文件单次快照。各数据库分别一致，不宣称跨库同时刻事务。原数据库与应用源码未修改。

每个表的全部行、全部列导出为 UTF-8 JSON；可读 Markdown 保持原列名，原话、个人笔记、来源、AI 分析与候选不互相覆盖。导出用于阅读，仍是快照派生资料。数据库快照与登记原件负责保全；不要从 JSON 重新造一套权威库。浏览器未提交草稿没有进入本包。

排除了账号/密钥/登录 cookie、浏览器 profile、依赖与缓存、旧备份、运行锁、嵌套 Git 和全量验证产物；保留有用回归测试源码。仅保留当前入口引用的结构层设计源稿，未批量带入其他设计试验。

## 在云端继续

先读取 `CLOUD-START.md`，然后按当前问题读取明确的记录/素材 ID/信息 ID 与项目 Skill。新学习、研究或代码修订保存到工作分支或 `cloud/proposals/`，标为云端候选；本机复核应用后才算采用。任何候选必须保留原话和原件引用，AI 解释另存。

SQLite 的同库 `expectedRevision` 与 `submissionId` 不能合并两个分别写过的数据库。第一阶段本机仍为唯一正式数据库写入端；云端不覆写快照，不运行服务，不初始化空库。Markdown 同样先取最新基准，再形成候选补丁；冲突由本机读取双方内容并合并。

变更包推荐格式（保存在 `cloud/proposals/<唯一任务名>/change.json`，正文另用相对路径文件；这是交接格式，尚无自动导入器）：

~~~~json
{
  "format": "xiaomo-learning-cloud-proposal",
  "version": 1,
  "status": "candidate",
  "proposalId": "<唯一 ID>",
  "sourceCommit": "<实际读取的 Git commit>",
  "target": {"rootAlias": "learning-system", "relativePath": "运行记录/当前状态.md", "recordId": null},
  "base": {"sha256": "<读取基准的 SHA-256>", "revision": null},
  "operation": "append-proposed-record",
  "candidateBodyPath": "candidate.md",
  "preservation": {"originalQuotesUntouched": true, "sourceReferencesRetained": true, "aiAnalysisSeparate": true},
  "verification": {"cloudCandidateSaved": true, "appliedToLocalAuthority": false}
}
~~~~

数据库目标填写素材/专题/信息等实际 ID、已读 revision（存在时）及快照基准 SHA-256，操作描述不能当自由 SQL；本机按现有 CLI/API 验证身份、版本和提交后应用并回读。没有数据库级合并或自动回写实现。

## 运行边界

目前 UI JSON 与素材 SQLite 中的身份绑定本机绝对 `projectRoot`；复制到 Linux 或不同根目录会被当前读取器拒绝。原生聊天 provider 仅发现 Windows `codex.exe`；原文档的 Windows 知识树、工作流和 Skill 路径尚未改为云端配置。

源码要求 Node >=24.15（素材 `node:sqlite`）、Python 3.12；媒体检查使用 FFmpeg/FFprobe，普通应用无需第三方 npm/Python 运行依赖。服务只监听 `127.0.0.1` 且有 Host/Origin 约束。上传不是部署，运行/公网访问/认证与数据库身份迁移需要单独适配及验证。本次只验证同步包完整性，没有启动云端网页或请求真实模型。
