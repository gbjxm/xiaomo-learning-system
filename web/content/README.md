# 共享个人内容

正式网页：`/learning/content/`。本模块属于学习系统，收纳个人创作、想法、自有练习与观看经历；不建立新的生活、素材或影视项目权威库。

## 保存位置

- 创作及练习：`运行记录/我的内容/content_*.json`，每条包含当前内容、版本和提交回执。
- 观看：原 `运行记录/观影记录.md`。旧 W 表保留，新登记、补充、更正与再看追加人可读正文和 `personal-watch:v1` 元信息。同一作品的后续经历使用同一 W 编号。
- 旧 UI 书签、草稿、正式学习任务、文字产物与领航灵感只读引用，来源接口失败有明确提示。正式作品文件只保存用户明确提供的位置，不从任意磁盘路径读取或搬迁文件。

读取不初始化记录。保存采用来源身份、内容版本、同提交标识去重、共享学习锁、单文件原子替换与回读；新目录只在实际保存时建立。未知保存结果先重试原请求，不能先修改请求或换标识。

## Codex 与网页共用操作

在项目根目录运行：

```powershell
node web/content/cli.mjs bootstrap
node web/content/cli.mjs list --kind watch
node web/content/cli.mjs detail --id W001
node web/content/cli.mjs save --input '完整请求文件.json'
```

写前读取 `bootstrap` 的实际 `identity` 与 `revision`。下面仅为输入结构示意，不可原样作为个人经历保存：

```json
{
  "identity": "从当前 bootstrap 读取",
  "expectedRevision": "从当前 bootstrap 读取的 revision",
  "submissionId": "本次唯一且重试不变的标识",
  "action": "append",
  "item": {
    "kind": "watch",
    "title": "用户提供的作品名",
    "body": "本次原话，可为空",
    "date": null,
    "watch": {"status": "unknown", "progress": ""}
  }
}
```

新观看省略 `item.id`，成功后从回执取得 W 编号；后续明确属于同一作品时加入该编号。只提供片名也可保存；没有提供的观看日期、集数与状态保持未知。`append` 只提交本次新增原话，不重复提交累计正文；`correct` 提交当前完整修正版，旧版本保留；`rewatch` 记录同一作品的新观看经历，未提供的新观看状态与日期重新保持未知。

创作使用 `kind: creation`，至少有标题或正文；`domains` 可包含 `story/visual/post`，不是必填任务分工。`artifact` 保存原工坊草稿，不能用工具示例声称本人已经做过练习。`links` 可记录 http(s) 或本机绝对路径文字。保存后通过回执 id 执行 `detail`，核对原话、版本与接续位置。

CLI 的 `bootstrap/list/detail` 与网页显示同样的只读来源；`save` 只允许本模块自有内容和观看台账，不能借引用修改原领航、课程或影视工程。演练须指定 `--root <隔离副本> --scope isolated`，隔离领航连接必须在该副本内部。

## HTTP 与边界

接口前缀 `/api/learning/content/`：GET `bootstrap`、`items?kind=all|creation|watch&q=`、`items/<id>`；POST `save`。返回直接的数据对象，错误为 `{error:{code,message,details}}`。网页 POST 需要本次 bootstrap 的单一 `X-Content-Token` 与 JSON；Host/Origin 由原统一宿主检查。

本模块不调用模型，不自动生成学习任务、采用方案或能力判断。普通学习向导聊天对观影的原有受限处理仍保留；需要正式登记时使用本内容接口／CLI，不能把一条聊天答复当作已更新片单。

新内容位置位于原数据备份脚本递归覆盖的 `运行记录/` 中；备份仍须遵守原恢复身份核对，不能将隔离副本覆盖正式数据。领航原件的外部备份范围保持原说明。
