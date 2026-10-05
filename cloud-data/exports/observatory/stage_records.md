# stage_records

源快照：`cloud-data/snapshots/素材观察室/data/observatory.sqlite3`；记录数：16。

这是字段原样目录，不是新研究结论。原话、个人笔记、来源、AI 分析和候选仍按原字段分开；完整字段见同名 JSON。

## 记录 1：stage_7613d1b3-a4bc-4788-b93a-19d6f2f05bc7

- `id`：stage_7613d1b3-a4bc-4788-b93a-19d6f2f05bc7
- `topic_id`：topic_9611264e-1653-46a1-83aa-8e9dcb12c39b
- `topic_revision`：2
- `created_at`：2026-10-01T16:41:35.682Z

### 原字段 `body_json`

~~~~json
{
  "focus": "隔离真实文本研究：精卫条的证据层次、转录差异与单一主题边界",
  "confirmed": [
    "所读数字转录的精卫正文可定位在KR3l0090_003叶14b；正文、郭注、吴补注分层。",
    "塞／寒是已核电子文本差异，尚未核对应影印页。",
    "另读陶、李两篇原文件，确有具体诗句与上下文支撑后世不同使用语境。"
  ],
  "candidates": [
    "微木与海面尺度差、重复动作、局部颜色及结果悬置可作创作形式候选；未采用。"
  ],
  "parked": [
    "完整精卫接受史与地方庙传统不是本轮问题，暂放下。",
    "图像复原与正式剧本/分镜未进入本轮。"
  ],
  "unknown": [
    "寒／塞是否古本异文或录入问题；须原页/可信校勘。",
    "作品精确成书年、此条单一作者意图、少女排行及东海现代地理落实。",
    "神话与地方仪式的连续传承、两故事共同起源。"
  ],
  "nextStep": "若继续校勘，只找《山海经》WYG卷三14b与《广注》WYG卷三26a对应原页；未取得则不升级版本断言。若转向表达感觉，只在小陌选定的一个形式线索继续。",
  "limitations": [
    "全部为公开数字转录；没有目验对应古籍影印页。",
    "CText工具与正文open受限，未运行相似段落分析；检索摘要未充作独立版本证据。",
    "实际研究由当前Codex执行者完成；未调用网页模型API或另配模型。",
    "没有Docling/OCR/STORM/Whisper模型调用，无素材外传或依赖安装。",
    "原文公有领域；只存必要摘录；示意图不是古籍原页。",
    "本例支持规程质量与闭环验证，不证明完整题材研究或真实作品效果。"
  ],
  "paragraphs": [
    {
      "paragraphId": "case-scope",
      "heading": "验收范围·自设问题",
      "markdown": "本例是公开文本真实研究的隔离验收，关注点由执行者设定，不是小陌的原话。问题：精卫条实际写了哪些动作和形象，正文、注释、后世诗歌各怎样加入意思？本轮只读六份WYG数字转录的目标段及上下文，不做神话全史。停止条件：原文可定位；注释层分开；核实一处会影响释义的差异及一个单一主题的反例；未核原页和作者意图停在未知。",
      "basisKind": "demo",
      "sourceRefs": [],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-original",
      "heading": "文本记载·原文与本次白话",
      "markdown": "所读《山海经》卷三叶14b记：\n\n> 其狀如烏，文首白喙赤足，名曰精衛。\n> 女娃遊于東海，溺而不返，故為精衛。\n> 常銜西山之木石，以堙于東海。\n\n标点与分段为本次阅读添加。自译白话：鸟的形状像乌鸦，头有纹彩，喙白、足红；原文把它与炎帝的少女女娃相连，女娃在东海游玩、溺水未返，因此成为精卫，常衔西山木石去填塞东海。该条接着回到漳水的地理记述。本轮保存的是文本所记，不把神话事件当历史实况；“少女”的准确排行和“东海”对应现代哪片海域不在本次证据内。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "jing-original",
          "locator": "KR3l0090_003.txt；KR3l0090_WYG_003-14b；行251–255",
          "note": "支持精卫外形、女娃叙述及反复衔木石的正文；括号小注另拆"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-time",
      "heading": "来源事实·所读见证与四层时间",
      "markdown": "六份文件的BASEEDITION均标WYG，所读见证是标作文渊阁四库本的数字转录。《山海经》提要称郭璞注，《广注》提要称国朝吴任臣撰并补郭注。四层时间分别保留：故事写炎帝女娃，没有可由本段落实的公历年代；作品成书在本轮仍有归属与成层争议；当前所读底本是清代四库体系，提要落款分别为乾隆四十六年正月、九月；文件DATE是2015年数字记录，本次核查为2026-10-01。这些时间不能合并为“精卫发生于四库时代”或“2015年成书”。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "jing-preface",
          "locator": "KR3l0090_000.txt提要叶1a、3a；行11及47–48；文件头DATE/BASEEDITION",
          "note": "支持郭璞注的题署及提要落款，不独立证明作品原始作者"
        },
        {
          "sourceId": "guang-preface",
          "locator": "KR3l0091_000.txt提要叶1a、2a；行11–13及30–31；文件头DATE/BASEEDITION",
          "note": "支持吴任臣补郭注的性质及四库提要落款"
        },
        {
          "sourceId": "jing-original",
          "locator": "KR3l0090_003.txt叶14b；行253；文件头",
          "note": "故事名号来自正文，转录时间和底本标签来自metadata"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-composition",
      "heading": "来源作者解释·四库编者的成书判断",
      "markdown": "所读《山海经》提要先报告刘秀奏所称伯益作，又根据正文所见人名、地名提出周秦间人叙述、后来附益的疑问。这是清代四库编者的考辨，不等于已核现代学界定论。本轮据此保留成书归属的不同说法，不把伯益题署或炎帝故事时间认作已证的写作年代，也没有另查现代论文来宣布精确成书年。",
      "basisKind": "author_interpretation",
      "sourceRefs": [
        {
          "sourceId": "jing-preface",
          "locator": "KR3l0090_000.txt；提要叶1a–2a；行11–26",
          "note": "实际支持四库编者报告旧归属说并提出不同判断；不证明哪说已最终成立"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-variant",
      "heading": "已核差异·数字转录的塞／寒",
      "markdown": "同一精卫条的郭注，在KR3l0090_003.txt叶14b数字转录为“堙塞也，音因”；在KR3l0091_003.txt叶26a为“郭曰堙寒也，音因”。两份正文都保留“以堙于東海”，不同的是注文中的一个字。本例保存双方字样和定位，没有静默改掉“寒”。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "jing-original",
          "locator": "KR3l0090_003.txt；叶14b；行255",
          "note": "支持本数字转录作塞"
        },
        {
          "sourceId": "jing-guangzhu",
          "locator": "KR3l0091_003.txt；叶26a；行460",
          "note": "支持本数字转录作寒；只证明电子见证的字样"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-variant-limit",
      "heading": "未知·何时不能宣布古本异文",
      "markdown": "尚未实际目验两本对应影印页，不能判断“寒”是原页如此、录入误字或其他环节问题，也不能把这一个数字差异称作古本异文定论。白话暂按已读郭注“塞”的读法译为填塞，并明确是本次采用的读法。最小补证是核对WYG《山海经》卷三14b与《广注》卷三26a原页，或可信校勘记录；拿不到时停止寒／塞的版本断言。",
      "basisKind": "unknown",
      "sourceRefs": [
        {
          "sourceId": "jing-original",
          "locator": "叶14b行255",
          "note": "提供当前暂译依据"
        },
        {
          "sourceId": "jing-guangzhu",
          "locator": "叶26a行460",
          "note": "提供必须保留的冲突见证"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-guang-layer",
      "heading": "文本层次·吴注的引文链与图像限制",
      "markdown": "《广注》这两叶转引多种书及诗赋，其中出现左思“償怨”、崔融“償寃”和陶潜诗句。它们是本轮实际读到的清人补注引文链，不冒充已经逐一核过每部原书。《广注》提要还说明旧本载图及图说问题，并说此次只录注、图从删；不能凭当前数字转录假装看过古代精卫图。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "jing-guangzhu",
          "locator": "KR3l0091_003.txt；叶26a–26b；行461–472",
          "note": "支持所读补注内确有相关转引，不能证明被引书的全文与原版本"
        },
        {
          "sourceId": "guang-preface",
          "locator": "KR3l0091_000.txt；叶1b–2a；行22–28",
          "note": "支持四库提要说明载图与删图；本例不据此提供假原图"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-reception-facts",
      "heading": "后世正文·两种精卫意象用法",
      "markdown": "另行读了两篇后世诗的数字原文件，不只依赖吴注转引。陶潜《读山海经》其十把精卫与刑天并写，有“精衛銜微木，將以塡滄海”“猛志故常在”，结尾仍有“良晨詎可待”。李白《江夏寄汉阳辅录事》在“報國有壯心，龍顔不迴眷”之后写“西飛精衛鳥，東海何由填”。这里的事实是诗句与相邻语境，不是诗人生平心理的确认。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "tao-poem",
          "locator": "KR4b0008_004.txt；卷四叶20a；行350–351",
          "note": "支持并写、猛志与结尾所问；实际读取目标诗和附近注文"
        },
        {
          "sourceId": "li-poem",
          "locator": "KR4c0012_011.txt；卷十一叶10b；行181–186",
          "note": "支持报国壮心、不迴眷、精卫及何由填的相邻语境"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-analysis",
      "heading": "研究解释·反复行动与单一励志读法的边界",
      "markdown": "本执行者的解释：正文“常”可以支撑持续或反复行动，但没有明说填海为了报仇、救人、证明毅力或最终成功。后世诗歌把相同意象放进不同语境：陶诗的微木、猛志与未可待，李诗的报国壮心、何由填，都保留行动力量与结果难成之间的张力。因此不能把整个接受史压成唯一“励志成功”，也不能反向认定《山海经》作者唯一要赞美徒劳。这一判断可被更多原始接受材料修正；当前证据足够阻止单一主题的泛化。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "jing-original",
          "locator": "卷三叶14b；行251–255",
          "note": "限定正文实际用词与未明说的动机"
        },
        {
          "sourceId": "tao-poem",
          "locator": "卷四叶20a；行350–351",
          "note": "支持持志与结果不确定的解释条件"
        },
        {
          "sourceId": "li-poem",
          "locator": "卷十一叶10b；行183–186",
          "note": "为唯一励志成功的概括提供具体反例"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-connections",
      "heading": "研究解释·关联等级与文化背景取舍",
      "markdown": "文献支持：陶诗同一首并写精卫、刑天，这个关联有明确文本依据。研究解释：可比较两者持续行动的表达，但共同起源、共同仪式传统、互相影响并未由这首诗证明。仅相似：精卫与愚公都可让当代创作想到个体对巨大尺度的持续动作；本例没有读取《列子》原文，不把它升级为历史传承关系。《广注》所引某地庙和神女白鸠叙述只证明清注记录了一条地方说法，采录与仪式连续史、現存遗迹均未核；不能当作远古一直连续传承。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "tao-poem",
          "locator": "卷四叶20a；行350–351",
          "note": "支持精卫和刑天的明确并写，只支持该文学见证"
        },
        {
          "sourceId": "jing-guangzhu",
          "locator": "卷三叶25b–26a；行453–456",
          "note": "支持吴补注所引地方庙与白鸠说法的存在，不证明现代现场与连续历史"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-creation",
      "heading": "创作联想·候选形式感觉",
      "markdown": "可带去创作的候选：用微小木石与广大水面的尺度差，保留重复动作的节奏；以有纹彩的头、白喙、赤足形成局部视觉记忆，而“像乌鸦”不自动补成全身特定颜色；用一次次同向行动承载意志与难成的悬置。若要加入海浪、鸟鸣、落石声或静默，这是创作声音设想，本例没有原始音视频可听，不把文字声音描写当实际声音分析。这些线索未被小陌采用，也不是已完成剧本或镜头方案。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "jing-original",
          "locator": "卷三叶14b；行251–255",
          "note": "形体、局部颜色和重复衔物构成联想的文本起点"
        },
        {
          "sourceId": "tao-poem",
          "locator": "卷四叶20a；行350",
          "note": "微木提供尺度联想起点"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-image",
      "heading": "自制文本定位示意·非古籍原页",
      "markdown": "![自制文本定位示意：精卫条的四个证据层次，非古籍影印页](attachment:att_8ee49b3313b6145a1871109dcb346bdcfd87c2ff)\n\n本机已有Pillow绘制，实际打开核对。只展示必要古文片段与本次分析标签；不证明古籍原页字形、版式、真实鸟类外貌或作者意图。",
      "basisKind": "demo",
      "sourceRefs": [
        {
          "sourceId": "text-locator",
          "locator": "整图及顶部、底部标识",
          "note": "支持这张图是实际生成和查看的本次示意附件"
        },
        {
          "sourceId": "jing-original",
          "locator": "卷三叶14b",
          "note": "图卡1文本来源"
        },
        {
          "sourceId": "jing-guangzhu",
          "locator": "卷三叶26a–26b",
          "note": "图卡2文本来源"
        },
        {
          "sourceId": "tao-poem",
          "locator": "卷四叶20a",
          "note": "图卡3文本来源"
        },
        {
          "sourceId": "li-poem",
          "locator": "卷十一叶10b",
          "note": "图卡4文本来源"
        }
      ],
      "attachmentIds": [
        "att_8ee49b3313b6145a1871109dcb346bdcfd87c2ff"
      ]
    }
  ],
  "sources": [
    {
      "sourceId": "jing-original",
      "kind": "external",
      "title": "KR3l0090_003.txt",
      "locator": "KR3l0090_WYG_003-14b；本次保存摘录行 251–259（UTF-8文件1起算）",
      "accessedAt": "2026-10-01T15:57:38.372923+00:00",
      "verificationScope": "实际读取公开数字转录及标记；未目验对应古籍原页；非OCR质量认证",
      "licenseStatus": "古代原文公有领域；本例只存必要摘录，不声称仓库整体许可或全本再利用许可",
      "uri": "https://raw.githubusercontent.com/kanripo/KR3l0090/master/KR3l0090_003.txt"
    },
    {
      "sourceId": "jing-guangzhu",
      "kind": "external",
      "title": "KR3l0091_003.txt",
      "locator": "KR3l0091_WYG_003-26a；本次保存摘录行 453–475（UTF-8文件1起算）",
      "accessedAt": "2026-10-01T15:57:38.372923+00:00",
      "verificationScope": "实际读取公开数字转录及标记；未目验对应古籍原页；非OCR质量认证",
      "licenseStatus": "古代原文公有领域；本例只存必要摘录，不声称仓库整体许可或全本再利用许可",
      "uri": "https://raw.githubusercontent.com/kanripo/KR3l0091/master/KR3l0091_003.txt"
    },
    {
      "sourceId": "jing-preface",
      "kind": "external",
      "title": "KR3l0090_000.txt",
      "locator": "KR3l0090_WYG_000-1a；本次保存摘录行 11–49（UTF-8文件1起算）",
      "accessedAt": "2026-10-01T15:57:38.372923+00:00",
      "verificationScope": "实际读取公开数字转录及标记；未目验对应古籍原页；非OCR质量认证",
      "licenseStatus": "古代原文公有领域；本例只存必要摘录，不声称仓库整体许可或全本再利用许可",
      "uri": "https://raw.githubusercontent.com/kanripo/KR3l0090/master/KR3l0090_000.txt"
    },
    {
      "sourceId": "guang-preface",
      "kind": "external",
      "title": "KR3l0091_000.txt",
      "locator": "KR3l0091_WYG_000-1a；本次保存摘录行 11–31（UTF-8文件1起算）",
      "accessedAt": "2026-10-01T15:57:38.372923+00:00",
      "verificationScope": "实际读取公开数字转录及标记；未目验对应古籍原页；非OCR质量认证",
      "licenseStatus": "古代原文公有领域；本例只存必要摘录，不声称仓库整体许可或全本再利用许可",
      "uri": "https://raw.githubusercontent.com/kanripo/KR3l0091/master/KR3l0091_000.txt"
    },
    {
      "sourceId": "tao-poem",
      "kind": "external",
      "title": "KR4b0008_004.txt",
      "locator": "KR4b0008_WYG_004-20a；本次保存摘录行 350–364（UTF-8文件1起算）",
      "accessedAt": "2026-10-01T15:57:38.372923+00:00",
      "verificationScope": "实际读取公开数字转录及标记；未目验对应古籍原页；非OCR质量认证",
      "licenseStatus": "古代原文公有领域；本例只存必要摘录，不声称仓库整体许可或全本再利用许可",
      "uri": "https://raw.githubusercontent.com/kanripo/KR4b0008/master/KR4b0008_004.txt"
    },
    {
      "sourceId": "li-poem",
      "kind": "external",
      "title": "KR4c0012_011.txt",
      "locator": "KR4c0012_WYG_011-10b；本次保存摘录行 181–186（UTF-8文件1起算）",
      "accessedAt": "2026-10-01T15:57:38.372923+00:00",
      "verificationScope": "实际读取公开数字转录及标记；未目验对应古籍原页；非OCR质量认证",
      "licenseStatus": "古代原文公有领域；本例只存必要摘录，不声称仓库整体许可或全本再利用许可",
      "uri": "https://raw.githubusercontent.com/kanripo/KR4c0012/master/KR4c0012_011.txt"
    },
    {
      "sourceId": "text-locator",
      "kind": "attachment",
      "title": "精卫文本定位示意·非古籍原页",
      "locator": "整张图的四个文本层次卡片及底部说明",
      "accessedAt": "2026-10-01T15:57:38.372923+00:00",
      "verificationScope": "使用本机已有Pillow绘制，并实际打开图像核对文字、标识与定位；不是古籍扫描",
      "licenseStatus": "自制文本定位示意；随本例使用时保留非原页标识及古文来源",
      "attachmentId": "att_8ee49b3313b6145a1871109dcb346bdcfd87c2ff"
    }
  ],
  "researchStatus": "stage_complete",
  "materialVersions": [
    {
      "materialId": "mat_5759b519-f594-428d-943c-b4fa1a9045df",
      "revision": 1
    }
  ],
  "author": "ai"
}
~~~~


## 记录 2：stage_a62ec105-6c5b-4239-9d1e-a95f4b49e7e0

- `id`：stage_a62ec105-6c5b-4239-9d1e-a95f4b49e7e0
- `topic_id`：topic_45f964ee-7fbb-4734-b1e2-e1fb44659570
- `topic_revision`：2
- `created_at`：2026-10-01T16:41:41.149Z

### 原字段 `body_json`

~~~~json
{
  "focus": "验收设定：13.5至22秒人物面部、动作空间与街巷几何的局部画面深拆；声音能力受限。",
  "confirmed": [
    "实际取得并哈希公开Sintel预告；实际读静帧与本地切点/ASR输出。",
    "13.875至13.916667相邻原帧人物切换可查。",
    "没有实际听音或连续声画审看；不能宣称完整声画拆解。"
  ],
  "candidates": [
    "可进一步检验亮暗锚点与人物尺度变化怎样引导注意。",
    "由可听/可连续读的执行者复核13.5至22秒原音及动作后再讨论声画交接。"
  ],
  "parked": [
    "未读全片上下文，暂不推人物身份、动机或作者意图。",
    "本轮不为补能力调用额外云端模型或下载模型。"
  ],
  "unknown": [
    "原音中的对白准确起止、语气、环境、音乐及声画同步。",
    "镜内运动、完整动作过程和其余自动边界是否是真切换。",
    "W3C MP4与Blender官网原始发布文件的字节/版本关系。"
  ],
  "nextStep": "若继续声画关系研究，先在具备实际听音与连续读视频的能力下核对原片13.5至22秒；沿用本素材ID、文件哈希与已保存帧，不重问收藏动机。",
  "limitations": [
    "真实影片局部画面研究与真实本地技术调用；不是完整声画专业分析验证。",
    "当前对话明确不支持音频输入，未听、未合看。",
    "模型视觉读取是16＋20张联系表静帧（有重复），不是连续视频输入。",
    "ASR宽时间窗和自动切点不作已人工核实语义。",
    "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
    "登记的ASR附件为去本机路径副本；未复听，未认证准确对白或声画关系。"
  ],
  "paragraphs": [
    {
      "paragraphId": "para_av_scope",
      "heading": "范围与实际读取：真实公开视频的局部画面研究",
      "markdown": "本例为Sintel预告的局部形式研究，不是自制短片。W3C官方video示例使用同一公开视频链接。已下载原MP4（4,372,373字节，SHA256 b670602fa00934ca27c4351bb0efe7ea7a07fae57284e44226025eeed7c51254），FFprobe实测H.264 854×480、24fps、1253帧，视频时长52.208333秒，AAC双声道48kHz。视觉只看了0至30秒16张静帧与13.5至22秒20张聚焦静帧；工具解码完整不等于模型连续观看。当前对话不支持音频输入，因此声音与合看未完成。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_av_video",
          "locator": "ffprobe.json format/streams；frame-pts.json1253条",
          "note": "支持媒体技术事实，不支持影片语义。"
        },
        {
          "sourceId": "src_av_w3c",
          "locator": "Example video/source",
          "note": "核对合法公开镜像来源。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_av_focus",
      "heading": "本例研究问题：验收设定，非小陌原话",
      "markdown": "验收设定的关注点：13.5至22秒从人物面部近景转到雪地动作空间，再转入狭长街巷；怎样用画面占比、明暗与空间关系改变注意位置？这不是小陌的收藏动机，不覆盖用户原话。先做可由静帧支持的画面层判断，保留运动、声音与完整节奏未知。",
      "basisKind": "demo",
      "sourceRefs": [],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_av_map",
      "heading": "原帧地图与读取边界",
      "markdown": "![0至30秒原帧联系表；每2秒一帧；仅标签与缩放](attachment:att_99e3401e863bca41f57a050940a86623ab709880)\n\n![13.5至22秒原帧联系表；相邻边界帧及局部；仅标签与缩放](attachment:att_d2de5501491edbda7291cefe1e2eab41dc0598eb)\n\n0至30秒这些帧可见雪山/雪地、文字卡、暖色人物面部、街巷和飞行物等不同画面。联系表只让它们的位置和差异可查；帧间发生的完整动作、运动速度及声音尚不能由表格证明。图像署名：© copyright Blender Foundation | www.sintel.org，CC BY3.0；改动为截帧、缩放与时间标签。",
      "basisKind": "direct_observation",
      "sourceRefs": [
        {
          "sourceId": "src_av_overview",
          "locator": "PTS0,2,...30秒",
          "note": "支持离散画面种类与顺序。"
        },
        {
          "sourceId": "src_av_focus",
          "locator": "PTS13.5至22秒的20帧",
          "note": "支持局部构图及边界邻帧。"
        }
      ],
      "attachmentIds": [
        "att_99e3401e863bca41f57a050940a86623ab709880",
        "att_d2de5501491edbda7291cefe1e2eab41dc0598eb"
      ]
    },
    {
      "paragraphId": "para_av_cut",
      "heading": "13.875到13.916667：相邻原帧的人物切换",
      "markdown": "![原片零基帧333；PTS13.875秒；未改画面](attachment:att_a30faf0ac2a80d0f868a35ceb6a504e76d7050bd)\n\n![原片零基帧334；PTS13.916667秒；未改画面](attachment:att_551494f107a32d58e49cc7579cb6317be697a81b)\n\n相邻原帧从胡须人物面部切到红发人物面部；两者都以脸部和上身占较大画面面积，背景较暗，可见重复线条图案与竖向物体。暖色亮部集中在面部附近，暗背景中的五官仍可分辨。这里可确认相邻帧发生直接画面切换，不能由此确认两人关系、台词语气或完整空间轴线。",
      "basisKind": "direct_observation",
      "sourceRefs": [
        {
          "sourceId": "src_av_frame333",
          "locator": "零基333；PTS13.875",
          "note": "切换前人物与面部光色。"
        },
        {
          "sourceId": "src_av_frame334",
          "locator": "零基334；PTS13.916667",
          "note": "相邻切换后人物与面部光色。"
        }
      ],
      "attachmentIds": [
        "att_a30faf0ac2a80d0f868a35ceb6a504e76d7050bd",
        "att_551494f107a32d58e49cc7579cb6317be697a81b"
      ]
    },
    {
      "paragraphId": "para_av_portrait_analysis",
      "heading": "AI分析解释：换人物，同时保留面部注意的条件",
      "markdown": "两帧的对象改变了，但“较大的面部占比＋暖亮面部/暗背景”仍相近。这个保留项可能让注意继续落在另一张脸上，而不是先重新搜寻环境。与把人物切成远景相比，它更保留面部细节的可读性。这里只提出形式作用：未经连续声画核对，不称之为已确认对话反应镜头，不推断红发人物的恐惧、决心或导演意图。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "src_av_frame333",
          "locator": "零基333",
          "note": "分析的观察前提：面部较大、暗背景。"
        },
        {
          "sourceId": "src_av_frame334",
          "locator": "零基334",
          "note": "分析的比较前提：另一个人物、相似亮暗组织。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_av_snow_fact",
      "heading": "16.5与17秒：从人物全身到两个人物的画面位置",
      "markdown": "![原片零基帧396；PTS16.5秒](attachment:att_f6df39f2f6a1ee564765d7d610409983ecbe6426)\n\n![原片零基帧408；PTS17秒](attachment:att_32bda614670723b899edd7154bdf2b6d38321bbf)\n\n16.5秒帧里可见较大雪地面积和一个人物全身；17秒帧里近处人物背部占画面中部，另一人物位于左侧，手臂及所持长物抬高，背景仍是灰白雪地/山石。它们支持观察取景尺度与人物位置的变化；仅凭这两个离散帧，不把完整挥击、闪躲或运动轨迹记成已观看事实。",
      "basisKind": "direct_observation",
      "sourceRefs": [
        {
          "sourceId": "src_av_frame396",
          "locator": "零基396；PTS16.5",
          "note": "人物尺度和雪地空间。"
        },
        {
          "sourceId": "src_av_frame408",
          "locator": "零基408；PTS17",
          "note": "两个可见人物及长物位置。"
        }
      ],
      "attachmentIds": [
        "att_f6df39f2f6a1ee564765d7d610409983ecbe6426",
        "att_32bda614670723b899edd7154bdf2b6d38321bbf"
      ]
    },
    {
      "paragraphId": "para_av_alley_fact",
      "heading": "20秒：街巷的纵深与明暗几何",
      "markdown": "![原片零基帧480；PTS20秒；未改画面](attachment:att_c3f92ac19140b89ddebecfa4cecc0fbc8e275f14)\n\n20秒帧里两侧墙面/屋檐围成狭长通道，地面和建筑线条向画面纵深延伸。一个较小的人物形体位于通道中，右侧墙面的亮区和左侧较暗墙面有明显差别。这个画面比13.916667秒的人物近景给了更多环境面积，脸部细节相应减少。",
      "basisKind": "direct_observation",
      "sourceRefs": [
        {
          "sourceId": "src_av_frame480",
          "locator": "零基480；PTS20",
          "note": "支持街巷构图、亮暗与人物占比。"
        },
        {
          "sourceId": "src_av_frame334",
          "locator": "零基334；PTS13.916667",
          "note": "支持与人物近景的占比比较。"
        }
      ],
      "attachmentIds": [
        "att_c3f92ac19140b89ddebecfa4cecc0fbc8e275f14"
      ]
    },
    {
      "paragraphId": "para_av_scale_analysis",
      "heading": "AI分析解释：观看任务从脸部细节转向空间关系",
      "markdown": "在已观察的帧之间，人物面部近景提供五官与朝向；雪地帧让人物全身与他人位置更可读；街巷帧让通道、纵深和人物的相对尺度更突出。两侧近景墙面与向纵深延伸的线条，可能把注意引向通道中的人物。可讨论这种“改变信息尺度”的形式线索，但不能用静帧确定人物是否被困、追逐是否紧张、镜头是否升降，或这组完整节奏是快是慢。街巷图也可能服务于单纯交代位置，需要前后连续证据区分。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "src_av_frame334",
          "locator": "PTS13.916667",
          "note": "面部细节的比较基准。"
        },
        {
          "sourceId": "src_av_frame396",
          "locator": "PTS16.5",
          "note": "人物全身与环境比例。"
        },
        {
          "sourceId": "src_av_frame408",
          "locator": "PTS17",
          "note": "人物间位置关系。"
        },
        {
          "sourceId": "src_av_frame480",
          "locator": "PTS20",
          "note": "街巷纵深与人物尺度。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_av_detector",
      "heading": "工具实测与反证：自动区间不能直接当镜头表",
      "markdown": "PySceneDetect0.7.1 detect-adaptive真实扫描1253帧，输出9个边界、10个区间。第一个自动区间0至13.917秒，但0至12秒所抽帧已经出现雪山/雪地、文字卡与胡须人物等不同画面，说明它没有给出这部分完整的语义镜头划分。13.917秒这个候选与零基333/334相邻画面变化一致；其余暗场/渐暗/渐亮处仍待连续回看。不能把10个区间宣布为全片只有10镜，也不把它们的平均时长当情绪节奏结论。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_av_cuts",
          "locator": "scene1：0至13.917；scene2开始13.917；共10区间",
          "note": "真实自动输出与算法读取范围。"
        },
        {
          "sourceId": "src_av_overview",
          "locator": "PTS0,2,4,6,8,10,12",
          "note": "提供自动首区间内不同画面的反证。"
        },
        {
          "sourceId": "src_av_focus",
          "locator": "零基333/334及暗场邻帧",
          "note": "只核对了局部画面边界，保留其他候选未审看。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_av_asr",
      "heading": "工具实测：本地ASR草稿不是已核实声音",
      "markdown": "既有faster-whisper1.2.1使用本机base.en缓存、CPU int8、local_files_only=True与offline环境完成一次真实转录，约1.97秒。输出四个宽窗；第一条0至15秒草稿为“What brings you to the land of the gatekeepers?”，第二条15至23秒为“I'm searching for someone.”。这些是模型输出，不是我已听见的台词，宽窗也不支持判定台词在哪一帧开始或是否跨切。未用它判断音乐、环境声、声线或表演。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_av_asr",
          "locator": "actual_call/version/model/local_files_only；segments0/1",
          "note": "支持真实本地ASR调用及草稿原文；不支持原音语义已经复听。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_av_unknown",
      "heading": "明确停止：声音、动作过程和合看未完成",
      "markdown": "8至11秒原片音频已本地抽取，尝试向当前对话提供音频，当前环境明确不支持音频输入。因此本例不判断声音种类、音色、音量体验、对白表演、音乐节拍、音画同步或完整节奏。没有连续视频输入，也不把抽帧当连续运动审看。作者意图、两人完整关系、镜内摄影机运动和其余候选切点保持未知。没有申请或调用额外云端模型，不安装/下载新模型来填这些空缺。",
      "basisKind": "unknown",
      "sourceRefs": [],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_av_association",
      "heading": "创作联想：只带走形式感觉线索",
      "markdown": "可带走的候选形式线索是：保持某个亮暗/色彩注意锚点，再改变人物在画面里的尺度；从脸部细节转向空间关系时，给观众足够可读的空间线条。它们只来自本次局部画面对照，不证明适用于任何题材，不是已采用方案，也不写成剧本或完整分镜。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "src_av_frame333",
          "locator": "PTS13.875",
          "note": "亮暗注意锚点的局部依据。"
        },
        {
          "sourceId": "src_av_frame334",
          "locator": "PTS13.916667",
          "note": "人物切换时保留的亮暗组织。"
        },
        {
          "sourceId": "src_av_frame480",
          "locator": "PTS20",
          "note": "空间线条与尺度变化的局部依据。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_av_rights",
      "heading": "来源、许可、改动与版本限制",
      "markdown": "本例公开源为W3C官方HTML video演示镜像。Commons对应Sintel预告页的Summary/Licensing/Metadata载明作者Durian Open Movie project、© copyright Blender Foundation | www.sintel.org、Creative Commons Attribution 3.0；Blender官方Sharing/About的搜索索引也声明CC BY3.0。当前未获得官网目录原文件，未逐字节比较W3C MP4与Commons OGV，不把二者当同一字节版本。研究图来源于本次已哈希的W3C MP4；单帧未改画面，联系表仅截帧、缩放和时间标签。需保留署名、https://creativecommons.org/licenses/by/3.0/ 和改动说明；本例不声明商标或标志另有授权。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_av_w3c",
          "locator": "Example video/source",
          "note": "W3C公开镜像的官方出处。"
        },
        {
          "sourceId": "src_av_license",
          "locator": "Summary/Licensing/Metadata",
          "note": "影片来源、署名、许可与版本读取限制。"
        }
      ],
      "attachmentIds": []
    }
  ],
  "sources": [
    {
      "sourceId": "src_av_video",
      "kind": "attachment",
      "title": "Sintel Trailer：W3C公开镜像原文件",
      "locator": "SHA256 b670602fa00934ca27c4351bb0efe7ea7a07fae57284e44226025eeed7c51254；ffprobe format/streams；PTS0至52.208333秒",
      "accessedAt": "2026-10-01",
      "verificationScope": "已实际下载与FFprobe读取；工具解码和PTS清单完整1253帧。当前Codex只观察所列静帧，未连续看视频、未听原音轨。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_e3117b2ce8acecf71fa72c6161ef1afac70a4221"
    },
    {
      "sourceId": "src_av_overview",
      "kind": "attachment",
      "title": "Sintel：0至30秒原帧联系表",
      "locator": "零基帧0,48,...720；PTS0,2,...30秒",
      "accessedAt": "2026-10-01",
      "verificationScope": "当前Codex用view_image实际看了16张缩放静帧；是离散帧观察，不是连续看片。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_99e3401e863bca41f57a050940a86623ab709880"
    },
    {
      "sourceId": "src_av_focus",
      "kind": "attachment",
      "title": "Sintel：13.5至22秒原帧联系表",
      "locator": "零基帧324,333,334,336,372,384,395,396,408,419,420,432,435,436,456,480,504,525,526,528；PTS13.5至22秒",
      "accessedAt": "2026-10-01",
      "verificationScope": "当前Codex用view_image实际看了20张缩放静帧，包括关键候选的相邻帧；未连续播放该段。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_d2de5501491edbda7291cefe1e2eab41dc0598eb"
    },
    {
      "sourceId": "src_av_frame333",
      "kind": "attachment",
      "title": "胡须人物关键帧",
      "locator": "零基帧333；PTS00:00:13.875",
      "accessedAt": "2026-10-01",
      "verificationScope": "已在联系表实际观察该原帧；人物位置与脸部亮暗可核，未听对应对白。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_a30faf0ac2a80d0f868a35ceb6a504e76d7050bd"
    },
    {
      "sourceId": "src_av_frame334",
      "kind": "attachment",
      "title": "红发人物关键帧",
      "locator": "零基帧334；原PTS00:00:13.916667（显示13.917）",
      "accessedAt": "2026-10-01",
      "verificationScope": "已在联系表实际观察该原帧；人物位置与脸部亮暗可核，未听对应对白。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_551494f107a32d58e49cc7579cb6317be697a81b"
    },
    {
      "sourceId": "src_av_frame396",
      "kind": "attachment",
      "title": "雪地较大空间关键帧",
      "locator": "零基帧396；PTS00:00:16.500",
      "accessedAt": "2026-10-01",
      "verificationScope": "已在联系表实际观察该原帧；可见雪地与人物全身，动作过程未连续读。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_f6df39f2f6a1ee564765d7d610409983ecbe6426"
    },
    {
      "sourceId": "src_av_frame408",
      "kind": "attachment",
      "title": "雪地人物关系关键帧",
      "locator": "零基帧408；PTS00:00:17.000",
      "accessedAt": "2026-10-01",
      "verificationScope": "已在联系表实际观察该原帧；可见两个人物与举起物，动作含义保持待核。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_32bda614670723b899edd7154bdf2b6d38321bbf"
    },
    {
      "sourceId": "src_av_frame480",
      "kind": "attachment",
      "title": "狭长街巷关键帧",
      "locator": "零基帧480；PTS00:00:20.000",
      "accessedAt": "2026-10-01",
      "verificationScope": "已在联系表实际观察该原帧；可见纵深、明暗与人物尺度，未读该段完整动作。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_c3f92ac19140b89ddebecfa4cecc0fbc8e275f14"
    },
    {
      "sourceId": "src_av_asr",
      "kind": "attachment",
      "title": "本地faster-whisper base.en实际转录草稿（去本机路径副本）",
      "locator": "segments[0..3]；对应原片0至51.9253125秒音频代理；起止是模型宽窗;本副本SHA256 693d5dd65f037279d68cf696f3f26dc8dedc4d3913eee2df999b44fc4f5ef38c",
      "accessedAt": "2026-10-01",
      "verificationScope": "faster-whisper1.2.1读取既有base.en本地缓存；CPU int8、local_files_only=True、HF_HUB_OFFLINE/TRANSFORMERS_OFFLINE；真实调用完成。只核工具输出，不把文字当已听台词。 附件是原工具输出的去本机路径衍生副本，仅移除model_path字段；四段文字及宽窗未改。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_200e684eab6c5e4aa95611bbba18926795bb603b"
    },
    {
      "sourceId": "src_av_cuts",
      "kind": "attachment",
      "title": "PySceneDetect0.7.1 detect-adaptive候选",
      "locator": "CSV scenes1至10；扫描原文件1253帧；原视频24fps；CLI场景号一基",
      "accessedAt": "2026-10-01",
      "verificationScope": "实际本地算法扫描完整文件并输出9候选边界/10区间。仅13.875/13.916667相邻画面变化经模型静帧核对；不称全部切点已人工确认。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_4cb6875ac64cf0732df03826cd38f4a59be49c78"
    },
    {
      "sourceId": "src_av_w3c",
      "kind": "external",
      "title": "W3C HTML Wiki：video元素官方演示",
      "locator": "Example：video/source src=http://media.w3.org/2010/05/sintel/trailer.mp4",
      "accessedAt": "2026-10-01",
      "verificationScope": "实际查阅官方示例页，核对相同公开视频链接；不是影片分析来源。",
      "licenseStatus": "说明页自身版权范围与影片许可分开；本例影片许可见Commons对应文件及Blender说明。",
      "uri": "https://www.w3.org/html/wiki/Elements/video.html"
    },
    {
      "sourceId": "src_av_license",
      "kind": "external",
      "title": "Sintel Trailer来源与许可记录",
      "locator": "Summary、Licensing、Metadata；作者Durian Open Movie project；CC BY3.0；© Blender Foundation",
      "accessedAt": "2026-10-01",
      "verificationScope": "实际读取Commons对应预告来源/许可正文及文件元数据，52秒及标题/作者/版权与W3C MP4一致；未逐字节比对OGV和MP4或取得Blender官网原文件。Blender官方Sharing/About仅能读搜索索引，目录403后未绕过。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "uri": "https://commons.wikimedia.org/wiki/File:Sintel_trailer-1080p.ogv"
    }
  ],
  "researchStatus": "paused",
  "materialVersions": [
    {
      "materialId": "mat_3f263ab2-db5a-4afc-9736-1ac20f8719e3",
      "revision": 1
    }
  ],
  "author": "ai"
}
~~~~


## 记录 3：stage_1dd7dbf0-64a3-4f3b-bb66-09f51263ffd2

- `id`：stage_1dd7dbf0-64a3-4f3b-bb66-09f51263ffd2
- `topic_id`：topic_9611264e-1653-46a1-83aa-8e9dcb12c39b
- `topic_revision`：3
- `created_at`：2026-10-02T01:38:33.798Z

### 原字段 `body_json`

~~~~json
{
  "focus": "阅读版：先看懂精卫填海，再分开原文、白话、后世读法与尚未核实的版本问题。沿用此前已核材料，未新增外部研究。",
  "confirmed": [
    "所读数字转录的精卫正文可定位在KR3l0090_003叶14b；正文、郭注、吴补注分层。",
    "塞／寒是已核电子文本差异，尚未核对应影印页。",
    "另读陶、李两篇原文件，确有具体诗句与上下文支撑后世不同使用语境。"
  ],
  "candidates": [
    "微木与海面尺度差、重复动作、局部颜色及结果悬置可作创作形式候选；未采用。"
  ],
  "parked": [
    "完整精卫接受史与地方庙传统不是本轮问题，暂放下。",
    "图像复原与正式剧本/分镜未进入本轮。"
  ],
  "unknown": [
    "寒／塞是否古本异文或录入问题；须原页/可信校勘。",
    "作品精确成书年、此条单一作者意图、少女排行及东海现代地理落实。",
    "神话与地方仪式的连续传承、两故事共同起源。"
  ],
  "nextStep": "若继续校勘，只找《山海经》WYG卷三14b与《广注》WYG卷三26a对应原页；未取得则不升级版本断言。若转向表达感觉，只在小陌选定的一个形式线索继续。",
  "limitations": [
    "全部为公开数字转录；没有目验对应古籍影印页。",
    "CText工具与正文open受限，未运行相似段落分析；检索摘要未充作独立版本证据。",
    "实际研究由当前Codex执行者完成；未调用网页模型API或另配模型。",
    "没有Docling/OCR/STORM/Whisper模型调用，无素材外传或依赖安装。",
    "原文公有领域；只存必要摘录；示意图不是古籍原页。",
    "本例支持规程质量与闭环验证，不证明完整题材研究或真实作品效果。"
  ],
  "paragraphs": [
    {
      "paragraphId": "case-reading-intro",
      "heading": "这份素材讲什么",
      "markdown": "《山海经》里，女娃在东海溺水后变成精卫鸟，反复衔来木头和石块填海。\n\n女娃是炎帝的女儿；原文还描述精卫像乌鸦，有带纹彩的头、白色的喙和红色的脚。故事写到反复填海，没有交代最后是否填成，也没有直接说填海为了报仇或救人。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "jing-original",
          "locator": "KR3l0090_003.txt；KR3l0090_WYG_003-14b；行251–255",
          "note": "支持精卫外形、女娃叙述及反复衔木石的正文；括号小注另拆"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-original",
      "heading": "原文与白话｜1. 精卫是什么样的鸟",
      "markdown": "> 其狀如烏，文首白喙赤足，名曰精衛。\n\n白话：这只鸟的样子像乌鸦，头上有纹彩，喙是白的，脚是红的，名字叫精卫。\n\n这里只写“像乌鸦”及这些局部颜色，没有写它全身是什么颜色。标点和分段是本次阅读添加的，依据仍是已读的数字转录。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "jing-original",
          "locator": "KR3l0090_003.txt；KR3l0090_WYG_003-14b；行251–255",
          "note": "支持精卫外形、女娃叙述及反复衔木石的正文；括号小注另拆"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-original-transformation",
      "heading": "原文与白话｜2. 女娃为什么变成精卫",
      "markdown": "> 是炎帝之少女，名曰女娃。女娃遊于東海，溺而不返，故為精衛。\n\n白话：女娃是炎帝的女儿。她到东海游玩，溺水后没有回来，因此成为精卫。\n\n这是神话文本的叙述，没有据此认定事件真实发生。“少女”的准确排行，以及这里的“东海”对应现代哪片海域，现有资料没有进一步确认。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "jing-original",
          "locator": "KR3l0090_003.txt；KR3l0090_WYG_003-14b；行251–255",
          "note": "支持精卫外形、女娃叙述及反复衔木石的正文；括号小注另拆"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-original-action",
      "heading": "原文与白话｜3. 精卫一直在做什么",
      "markdown": "> 常銜西山之木石，以堙于東海。\n\n白话：精卫常常衔着西山的木头和石块，拿去填塞东海。“常”写出了反复进行的动作，原文没有接着写最终填海成功。\n\n“堙”在这里暂按已读郭注的“塞”理解为填塞；另一份电子转录的注文写“寒”。两本古籍原页还没核过，所以这里只保留读法和差异，不能宣布古本异文已经确定。该条随后回到漳水的地理记述。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "jing-original",
          "locator": "KR3l0090_003.txt；KR3l0090_WYG_003-14b；行251–255",
          "note": "支持精卫外形、女娃叙述及反复衔木石的正文；括号小注另拆"
        },
        {
          "sourceId": "jing-original",
          "locator": "叶14b行255",
          "note": "提供当前暂译依据"
        },
        {
          "sourceId": "jing-guangzhu",
          "locator": "叶26a行460",
          "note": "提供必须保留的冲突见证"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-image",
      "heading": "辅助图｜原文、注释与后世诗句怎样分层",
      "markdown": "![自制文本定位示意：精卫条的四个证据层次，非古籍影印页](attachment:att_8ee49b3313b6145a1871109dcb346bdcfd87c2ff)\n\n本机已有Pillow绘制，实际打开核对。只展示必要古文片段与本次分析标签；不证明古籍原页字形、版式、真实鸟类外貌或作者意图。",
      "basisKind": "demo",
      "sourceRefs": [
        {
          "sourceId": "text-locator",
          "locator": "整图及顶部、底部标识",
          "note": "支持这张图是实际生成和查看的本次示意附件"
        },
        {
          "sourceId": "jing-original",
          "locator": "卷三叶14b",
          "note": "图卡1文本来源"
        },
        {
          "sourceId": "jing-guangzhu",
          "locator": "卷三叶26a–26b",
          "note": "图卡2文本来源"
        },
        {
          "sourceId": "tao-poem",
          "locator": "卷四叶20a",
          "note": "图卡3文本来源"
        },
        {
          "sourceId": "li-poem",
          "locator": "卷十一叶10b",
          "note": "图卡4文本来源"
        }
      ],
      "attachmentIds": [
        "att_8ee49b3313b6145a1871109dcb346bdcfd87c2ff"
      ]
    },
    {
      "paragraphId": "case-reception-facts",
      "heading": "后世读法｜陶潜和李白如何使用精卫意象",
      "markdown": "同一个精卫意象，放进后世诗歌后，会带出不同的意思。以下诗句是后来作品，不能倒过来补成《山海经》原始故事的动机或结局。\n\n另行读了两篇后世诗的数字原文件，不只依赖吴注转引。陶潜《读山海经》其十把精卫与刑天并写，有“精衛銜微木，將以塡滄海”“猛志故常在”，结尾仍有“良晨詎可待”。\n\n本次白话概意：“猛志故常在”说强烈的志向仍在，“良晨詎可待”则追问好的时日哪里能够等到。\n\n李白《江夏寄汉阳辅录事》在“報國有壯心，龍顔不迴眷”之后写“西飛精衛鳥，東海何由填”。\n\n本次白话概意：“東海何由填”是在问东海怎样才能填得上，放在“报国有壮心”之后，是有志向却不容易实现的疑问。\n\n这里的事实是诗句与相邻语境，不是诗人生平心理的确认。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "tao-poem",
          "locator": "KR4b0008_004.txt；卷四叶20a；行350–351",
          "note": "支持并写、猛志与结尾所问；实际读取目标诗和附近注文"
        },
        {
          "sourceId": "li-poem",
          "locator": "KR4c0012_011.txt；卷十一叶10b；行181–186",
          "note": "支持报国壮心、不迴眷、精卫及何由填的相邻语境"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-analysis",
      "heading": "分析解释｜为何不能只讲成励志成功",
      "markdown": "本执行者的解释：正文“常”可以支撑持续或反复行动，但没有明说填海为了报仇、救人、证明毅力或最终成功。后世诗歌把相同意象放进不同语境：陶诗的微木、猛志与未可待，李诗的报国壮心、何由填，都保留行动力量与结果难成之间的张力。因此不能把整个接受史压成唯一“励志成功”，也不能反向认定《山海经》作者唯一要赞美徒劳。这一判断可被更多原始接受材料修正；当前证据足够阻止单一主题的泛化。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "jing-original",
          "locator": "卷三叶14b；行251–255",
          "note": "限定正文实际用词与未明说的动机"
        },
        {
          "sourceId": "tao-poem",
          "locator": "卷四叶20a；行350–351",
          "note": "支持持志与结果不确定的解释条件"
        },
        {
          "sourceId": "li-poem",
          "locator": "卷十一叶10b；行183–186",
          "note": "为唯一励志成功的概括提供具体反例"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-connections",
      "heading": "文化关联｜哪些关系有文字依据，哪些只是相似",
      "markdown": "文献支持：陶诗同一首并写精卫、刑天，这个关联有明确文本依据。研究解释：可比较两者持续行动的表达，但共同起源、共同仪式传统、互相影响并未由这首诗证明。仅相似：精卫与愚公都可让当代创作想到个体对巨大尺度的持续动作；本例没有读取《列子》原文，不把它升级为历史传承关系。《广注》所引某地庙和神女白鸠叙述只证明清注记录了一条地方说法，采录与仪式连续史、現存遗迹均未核；不能当作远古一直连续传承。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "tao-poem",
          "locator": "卷四叶20a；行350–351",
          "note": "支持精卫和刑天的明确并写，只支持该文学见证"
        },
        {
          "sourceId": "jing-guangzhu",
          "locator": "卷三叶25b–26a；行453–456",
          "note": "支持吴补注所引地方庙与白鸠说法的存在，不证明现代现场与连续历史"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-time",
      "heading": "文本背景｜故事时代、书本年代和转录时间各指什么",
      "markdown": "故事发生的时代、书写下来的年代、今天所读底本的年代，以及把古书整理成电子文字的时间，是四件不同的事。\n\n六份文件的BASEEDITION均标WYG，所读见证是标作文渊阁四库本的数字转录。《山海经》提要称郭璞注，《广注》提要称国朝吴任臣撰并补郭注。四层时间分别保留：故事写炎帝女娃，没有可由本段落实的公历年代；作品成书在本轮仍有归属与成层争议；当前所读底本是清代四库体系，提要落款分别为乾隆四十六年正月、九月；文件DATE是2015年数字记录，本次核查为2026-10-01。这些时间不能合并为“精卫发生于四库时代”或“2015年成书”。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "jing-preface",
          "locator": "KR3l0090_000.txt提要叶1a、3a；行11及47–48；文件头DATE/BASEEDITION",
          "note": "支持郭璞注的题署及提要落款，不独立证明作品原始作者"
        },
        {
          "sourceId": "guang-preface",
          "locator": "KR3l0091_000.txt提要叶1a、2a；行11–13及30–31；文件头DATE/BASEEDITION",
          "note": "支持吴任臣补郭注的性质及四库提要落款"
        },
        {
          "sourceId": "jing-original",
          "locator": "KR3l0090_003.txt叶14b；行253；文件头",
          "note": "故事名号来自正文，转录时间和底本标签来自metadata"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-composition",
      "heading": "文本背景｜旧编者对成书年代的解释",
      "markdown": "所读《山海经》提要先报告刘秀奏所称伯益作，又根据正文所见人名、地名提出周秦间人叙述、后来附益的疑问。这是清代四库编者的考辨，不等于已核现代学界定论。本轮据此保留成书归属的不同说法，不把伯益题署或炎帝故事时间认作已证的写作年代，也没有另查现代论文来宣布精确成书年。",
      "basisKind": "author_interpretation",
      "sourceRefs": [
        {
          "sourceId": "jing-preface",
          "locator": "KR3l0090_000.txt；提要叶1a–2a；行11–26",
          "note": "实际支持四库编者报告旧归属说并提出不同判断；不证明哪说已最终成立"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-guang-layer",
      "heading": "注释背景｜补注引用了什么，哪些原书还没核过",
      "markdown": "《广注》这两叶转引多种书及诗赋，其中出现左思“償怨”、崔融“償寃”和陶潜诗句。它们是本轮实际读到的清人补注引文链，不冒充已经逐一核过每部原书。《广注》提要还说明旧本载图及图说问题，并说此次只录注、图从删；不能凭当前数字转录假装看过古代精卫图。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "jing-guangzhu",
          "locator": "KR3l0091_003.txt；叶26a–26b；行461–472",
          "note": "支持所读补注内确有相关转引，不能证明被引书的全文与原版本"
        },
        {
          "sourceId": "guang-preface",
          "locator": "KR3l0091_000.txt；叶1b–2a；行22–28",
          "note": "支持四库提要说明载图与删图；本例不据此提供假原图"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-variant",
      "heading": "版本疑点｜注文中的塞／寒差在哪儿",
      "markdown": "同一精卫条的郭注，在KR3l0090_003.txt叶14b数字转录为“堙塞也，音因”；在KR3l0091_003.txt叶26a为“郭曰堙寒也，音因”。两份正文都保留“以堙于東海”，不同的是注文中的一个字。本例保存双方字样和定位，没有静默改掉“寒”。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "jing-original",
          "locator": "KR3l0090_003.txt；叶14b；行255",
          "note": "支持本数字转录作塞"
        },
        {
          "sourceId": "jing-guangzhu",
          "locator": "KR3l0091_003.txt；叶26a；行460",
          "note": "支持本数字转录作寒；只证明电子见证的字样"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-variant-limit",
      "heading": "版本疑点｜为什么还不能认定古本异文",
      "markdown": "尚未实际目验两本对应影印页，不能判断“寒”是原页如此、录入误字或其他环节问题，也不能把这一个数字差异称作古本异文定论。白话暂按已读郭注“塞”的读法译为填塞，并明确是本次采用的读法。最小补证是核对WYG《山海经》卷三14b与《广注》卷三26a原页，或可信校勘记录；拿不到时停止寒／塞的版本断言。",
      "basisKind": "unknown",
      "sourceRefs": [
        {
          "sourceId": "jing-original",
          "locator": "叶14b行255",
          "note": "提供当前暂译依据"
        },
        {
          "sourceId": "jing-guangzhu",
          "locator": "叶26a行460",
          "note": "提供必须保留的冲突见证"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-creation",
      "heading": "创作线索｜微小木石、广大海面与重复动作",
      "markdown": "可带去创作的候选：用微小木石与广大水面的尺度差，保留重复动作的节奏；以有纹彩的头、白喙、赤足形成局部视觉记忆，而“像乌鸦”不自动补成全身特定颜色；用一次次同向行动承载意志与难成的悬置。若要加入海浪、鸟鸣、落石声或静默，这是创作声音设想，本例没有原始音视频可听，不把文字声音描写当实际声音分析。这些线索未被小陌采用，也不是已完成剧本或镜头方案。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "jing-original",
          "locator": "卷三叶14b；行251–255",
          "note": "形体、局部颜色和重复衔物构成联想的文本起点"
        },
        {
          "sourceId": "tao-poem",
          "locator": "卷四叶20a；行350",
          "note": "微木提供尺度联想起点"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-scope",
      "heading": "阅读范围｜这份案例做了什么，哪些没有做",
      "markdown": "原研究最初在隔离库完成，后来获小陌明确授权导入正式收藏。本次只调整阅读顺序并补白话解释，沿用已有证据，没有新增外部研究。以下保留最初的研究范围说明。\n\n本例是公开文本真实研究的隔离验收，关注点由执行者设定，不是小陌的原话。问题：精卫条实际写了哪些动作和形象，正文、注释、后世诗歌各怎样加入意思？本轮只读六份WYG数字转录的目标段及上下文，不做神话全史。停止条件：原文可定位；注释层分开；核实一处会影响释义的差异及一个单一主题的反例；未核原页和作者意图停在未知。",
      "basisKind": "demo",
      "sourceRefs": [],
      "attachmentIds": []
    }
  ],
  "sources": [
    {
      "sourceId": "jing-original",
      "kind": "external",
      "title": "KR3l0090_003.txt",
      "locator": "KR3l0090_WYG_003-14b；本次保存摘录行 251–259（UTF-8文件1起算）",
      "accessedAt": "2026-10-01T15:57:38.372923+00:00",
      "verificationScope": "实际读取公开数字转录及标记；未目验对应古籍原页；非OCR质量认证",
      "licenseStatus": "古代原文公有领域；本例只存必要摘录，不声称仓库整体许可或全本再利用许可",
      "uri": "https://raw.githubusercontent.com/kanripo/KR3l0090/master/KR3l0090_003.txt"
    },
    {
      "sourceId": "jing-guangzhu",
      "kind": "external",
      "title": "KR3l0091_003.txt",
      "locator": "KR3l0091_WYG_003-26a；本次保存摘录行 453–475（UTF-8文件1起算）",
      "accessedAt": "2026-10-01T15:57:38.372923+00:00",
      "verificationScope": "实际读取公开数字转录及标记；未目验对应古籍原页；非OCR质量认证",
      "licenseStatus": "古代原文公有领域；本例只存必要摘录，不声称仓库整体许可或全本再利用许可",
      "uri": "https://raw.githubusercontent.com/kanripo/KR3l0091/master/KR3l0091_003.txt"
    },
    {
      "sourceId": "jing-preface",
      "kind": "external",
      "title": "KR3l0090_000.txt",
      "locator": "KR3l0090_WYG_000-1a；本次保存摘录行 11–49（UTF-8文件1起算）",
      "accessedAt": "2026-10-01T15:57:38.372923+00:00",
      "verificationScope": "实际读取公开数字转录及标记；未目验对应古籍原页；非OCR质量认证",
      "licenseStatus": "古代原文公有领域；本例只存必要摘录，不声称仓库整体许可或全本再利用许可",
      "uri": "https://raw.githubusercontent.com/kanripo/KR3l0090/master/KR3l0090_000.txt"
    },
    {
      "sourceId": "guang-preface",
      "kind": "external",
      "title": "KR3l0091_000.txt",
      "locator": "KR3l0091_WYG_000-1a；本次保存摘录行 11–31（UTF-8文件1起算）",
      "accessedAt": "2026-10-01T15:57:38.372923+00:00",
      "verificationScope": "实际读取公开数字转录及标记；未目验对应古籍原页；非OCR质量认证",
      "licenseStatus": "古代原文公有领域；本例只存必要摘录，不声称仓库整体许可或全本再利用许可",
      "uri": "https://raw.githubusercontent.com/kanripo/KR3l0091/master/KR3l0091_000.txt"
    },
    {
      "sourceId": "tao-poem",
      "kind": "external",
      "title": "KR4b0008_004.txt",
      "locator": "KR4b0008_WYG_004-20a；本次保存摘录行 350–364（UTF-8文件1起算）",
      "accessedAt": "2026-10-01T15:57:38.372923+00:00",
      "verificationScope": "实际读取公开数字转录及标记；未目验对应古籍原页；非OCR质量认证",
      "licenseStatus": "古代原文公有领域；本例只存必要摘录，不声称仓库整体许可或全本再利用许可",
      "uri": "https://raw.githubusercontent.com/kanripo/KR4b0008/master/KR4b0008_004.txt"
    },
    {
      "sourceId": "li-poem",
      "kind": "external",
      "title": "KR4c0012_011.txt",
      "locator": "KR4c0012_WYG_011-10b；本次保存摘录行 181–186（UTF-8文件1起算）",
      "accessedAt": "2026-10-01T15:57:38.372923+00:00",
      "verificationScope": "实际读取公开数字转录及标记；未目验对应古籍原页；非OCR质量认证",
      "licenseStatus": "古代原文公有领域；本例只存必要摘录，不声称仓库整体许可或全本再利用许可",
      "uri": "https://raw.githubusercontent.com/kanripo/KR4c0012/master/KR4c0012_011.txt"
    },
    {
      "sourceId": "text-locator",
      "kind": "attachment",
      "title": "精卫文本定位示意·非古籍原页",
      "locator": "整张图的四个文本层次卡片及底部说明",
      "accessedAt": "2026-10-01T15:57:38.372923+00:00",
      "verificationScope": "使用本机已有Pillow绘制，并实际打开图像核对文字、标识与定位；不是古籍扫描",
      "licenseStatus": "自制文本定位示意；随本例使用时保留非原页标识及古文来源",
      "attachmentId": "att_8ee49b3313b6145a1871109dcb346bdcfd87c2ff"
    }
  ],
  "researchStatus": "stage_complete",
  "materialVersions": [
    {
      "materialId": "mat_5759b519-f594-428d-943c-b4fa1a9045df",
      "revision": 1
    }
  ],
  "author": "ai"
}
~~~~


## 记录 4：stage_cc6eeed3-1303-4d10-ae0d-5bff28ea4e44

- `id`：stage_cc6eeed3-1303-4d10-ae0d-5bff28ea4e44
- `topic_id`：topic_45f964ee-7fbb-4734-b1e2-e1fb44659570
- `topic_revision`：3
- `created_at`：2026-10-02T01:38:33.810Z

### 原字段 `body_json`

~~~~json
{
  "focus": "阅读版：先说明Sintel预告与局部可见情境，再把关键帧和实际画面说明相邻呈现；声音、连续动作及合看仍未完成，保持暂停。沿用已核材料，未新增外部研究。",
  "confirmed": [
    "实际取得并哈希公开Sintel预告；实际读静帧与本地切点/ASR输出。",
    "13.875至13.916667相邻原帧人物切换可查。",
    "没有实际听音或连续声画审看；不能宣称完整声画拆解。"
  ],
  "candidates": [
    "可进一步检验亮暗锚点与人物尺度变化怎样引导注意。",
    "由可听/可连续读的执行者复核13.5至22秒原音及动作后再讨论声画交接。"
  ],
  "parked": [
    "未读全片上下文，暂不推人物身份、动机或作者意图。",
    "本轮不为补能力调用额外云端模型或下载模型。"
  ],
  "unknown": [
    "原音中的对白准确起止、语气、环境、音乐及声画同步。",
    "镜内运动、完整动作过程和其余自动边界是否是真切换。",
    "W3C MP4与Blender官网原始发布文件的字节/版本关系。"
  ],
  "nextStep": "若继续声画关系研究，先在具备实际听音与连续读视频的能力下核对原片13.5至22秒；沿用本素材ID、文件哈希与已保存帧，不重问收藏动机。",
  "limitations": [
    "真实影片局部画面研究与真实本地技术调用；不是完整声画专业分析验证。",
    "当前对话明确不支持音频输入，未听、未合看。",
    "模型视觉读取是16＋20张联系表静帧（有重复），不是连续视频输入。",
    "ASR宽时间窗和自动切点不作已人工核实语义。",
    "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
    "登记的ASR附件为去本机路径副本；未复听，未认证准确对白或声画关系。"
  ],
  "paragraphs": [
    {
      "paragraphId": "para_av_reading_intro",
      "heading": "这份素材讲什么",
      "markdown": "这是一段约52秒的《Sintel》动画预告，已看的静帧中有雪地、人物近景和狭长街巷。\n\n未审听原音、未连续合看，声音研究保持暂停。\n\n当前关注的13.5至22秒，先可见胡须人物和红发人物的面部，随后是雪地中的人物全身、两人的位置与抬高的长物，再到街巷里的小人物。前面看得清脸，后面看得更多的是人物在环境中的位置。\n\n这里还不能确认两人完整关系、动作经过或整部影片的故事。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_av_video",
          "locator": "ffprobe视频时长52.208333秒；原文件及此前登记的读取范围",
          "note": "支持视频性质、时长与未连续看听的边界。"
        },
        {
          "sourceId": "src_av_overview",
          "locator": "PTS0,2,...30秒的已读静帧",
          "note": "支持已读静帧中出现雪地、人物面部、街巷等可见场景。"
        },
        {
          "sourceId": "src_av_frame333",
          "locator": "PTS13.875",
          "note": "支持胡须人物面部。"
        },
        {
          "sourceId": "src_av_frame334",
          "locator": "PTS13.916667",
          "note": "支持红发人物面部。"
        },
        {
          "sourceId": "src_av_frame408",
          "locator": "PTS17",
          "note": "支持雪地两个人物、抬高的长物。"
        },
        {
          "sourceId": "src_av_frame480",
          "locator": "PTS20",
          "note": "支持狭长街巷及其中的较小人物。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_av_cut",
      "heading": "画面与说明｜1. 近景中的两张脸（13.875—13.916667秒）",
      "markdown": "![原片零基帧333；PTS13.875秒；未改画面](attachment:att_a30faf0ac2a80d0f868a35ceb6a504e76d7050bd)\n\n这一帧可见胡须人物的面部和上身，脸部占较大面积，背景较暗。\n\n![原片零基帧334；PTS13.916667秒；未改画面](attachment:att_551494f107a32d58e49cc7579cb6317be697a81b)\n\n相邻原帧从胡须人物面部切到红发人物面部；两者都以脸部和上身占较大画面面积，背景较暗，可见重复线条图案与竖向物体。暖色亮部集中在面部附近，暗背景中的五官仍可分辨。这里可确认相邻帧发生直接画面切换，不能由此确认两人关系、台词语气或完整空间轴线。",
      "basisKind": "direct_observation",
      "sourceRefs": [
        {
          "sourceId": "src_av_frame333",
          "locator": "零基333；PTS13.875",
          "note": "切换前人物与面部光色。"
        },
        {
          "sourceId": "src_av_frame334",
          "locator": "零基334；PTS13.916667",
          "note": "相邻切换后人物与面部光色。"
        }
      ],
      "attachmentIds": [
        "att_a30faf0ac2a80d0f868a35ceb6a504e76d7050bd",
        "att_551494f107a32d58e49cc7579cb6317be697a81b"
      ]
    },
    {
      "paragraphId": "para_av_snow_fact",
      "heading": "画面与说明｜2. 雪地里的人物与位置（16.5—17秒）",
      "markdown": "![原片零基帧396；PTS16.5秒](attachment:att_f6df39f2f6a1ee564765d7d610409983ecbe6426)\n\n16.5秒这张帧里，雪地面积较大，人物以全身出现在画面中。\n\n![原片零基帧408；PTS17秒](attachment:att_32bda614670723b899edd7154bdf2b6d38321bbf)\n\n16.5秒帧里可见较大雪地面积和一个人物全身；17秒帧里近处人物背部占画面中部，另一人物位于左侧，手臂及所持长物抬高，背景仍是灰白雪地/山石。它们支持观察取景尺度与人物位置的变化；仅凭这两个离散帧，不把完整挥击、闪躲或运动轨迹记成已观看事实。",
      "basisKind": "direct_observation",
      "sourceRefs": [
        {
          "sourceId": "src_av_frame396",
          "locator": "零基396；PTS16.5",
          "note": "人物尺度和雪地空间。"
        },
        {
          "sourceId": "src_av_frame408",
          "locator": "零基408；PTS17",
          "note": "两个可见人物及长物位置。"
        }
      ],
      "attachmentIds": [
        "att_f6df39f2f6a1ee564765d7d610409983ecbe6426",
        "att_32bda614670723b899edd7154bdf2b6d38321bbf"
      ]
    },
    {
      "paragraphId": "para_av_alley_fact",
      "heading": "画面与说明｜3. 狭长街巷里的小人物（20秒）",
      "markdown": "![原片零基帧480；PTS20秒；未改画面](attachment:att_c3f92ac19140b89ddebecfa4cecc0fbc8e275f14)\n\n20秒帧里两侧墙面/屋檐围成狭长通道，地面和建筑线条向画面纵深延伸。一个较小的人物形体位于通道中，右侧墙面的亮区和左侧较暗墙面有明显差别。这个画面比13.916667秒的人物近景给了更多环境面积，脸部细节相应减少。",
      "basisKind": "direct_observation",
      "sourceRefs": [
        {
          "sourceId": "src_av_frame480",
          "locator": "零基480；PTS20",
          "note": "支持街巷构图、亮暗与人物占比。"
        },
        {
          "sourceId": "src_av_frame334",
          "locator": "零基334；PTS13.916667",
          "note": "支持与人物近景的占比比较。"
        }
      ],
      "attachmentIds": [
        "att_c3f92ac19140b89ddebecfa4cecc0fbc8e275f14"
      ]
    },
    {
      "paragraphId": "para_av_map",
      "heading": "画面总览｜这些静帧在预告中的位置",
      "markdown": "联系表把不同时间的画面排在一起，方便找位置；它保留的是离散画面，帧间过程仍需连续观看核实。\n\n![0至30秒原帧联系表；每2秒一帧；仅标签与缩放](attachment:att_99e3401e863bca41f57a050940a86623ab709880)\n\n![13.5至22秒原帧联系表；相邻边界帧及局部；仅标签与缩放](attachment:att_d2de5501491edbda7291cefe1e2eab41dc0598eb)\n\n0至30秒这些帧可见雪山/雪地、文字卡、暖色人物面部、街巷和飞行物等不同画面。联系表只让它们的位置和差异可查；帧间发生的完整动作、运动速度及声音尚不能由表格证明。图像署名：© copyright Blender Foundation | www.sintel.org，CC BY3.0；改动为截帧、缩放与时间标签。",
      "basisKind": "direct_observation",
      "sourceRefs": [
        {
          "sourceId": "src_av_overview",
          "locator": "PTS0,2,...30秒",
          "note": "支持离散画面种类与顺序。"
        },
        {
          "sourceId": "src_av_focus",
          "locator": "PTS13.5至22秒的20帧",
          "note": "支持局部构图及边界邻帧。"
        }
      ],
      "attachmentIds": [
        "att_99e3401e863bca41f57a050940a86623ab709880",
        "att_d2de5501491edbda7291cefe1e2eab41dc0598eb"
      ]
    },
    {
      "paragraphId": "para_av_portrait_analysis",
      "heading": "视听分析｜换一张脸，注意如何继续留在面部",
      "markdown": "两帧的对象改变了，但“较大的面部占比＋暖亮面部/暗背景”仍相近。这个保留项可能让注意继续落在另一张脸上，而不是先重新搜寻环境。与把人物切成远景相比，它更保留面部细节的可读性。这里只提出形式作用：未经连续声画核对，不称之为已确认对话反应镜头，不推断红发人物的恐惧、决心或导演意图。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "src_av_frame333",
          "locator": "零基333",
          "note": "分析的观察前提：面部较大、暗背景。"
        },
        {
          "sourceId": "src_av_frame334",
          "locator": "零基334",
          "note": "分析的比较前提：另一个人物、相似亮暗组织。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_av_scale_analysis",
      "heading": "视听分析｜脸部、雪地、街巷各让你看什么",
      "markdown": "在已观察的帧之间，人物面部近景提供五官与朝向；雪地帧让人物全身与他人位置更可读；街巷帧让通道、纵深和人物的相对尺度更突出。两侧近景墙面与向纵深延伸的线条，可能把注意引向通道中的人物。可讨论这种“改变信息尺度”的形式线索，但不能用静帧确定人物是否被困、追逐是否紧张、镜头是否升降，或这组完整节奏是快是慢。街巷图也可能服务于单纯交代位置，需要前后连续证据区分。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "src_av_frame334",
          "locator": "PTS13.916667",
          "note": "面部细节的比较基准。"
        },
        {
          "sourceId": "src_av_frame396",
          "locator": "PTS16.5",
          "note": "人物全身与环境比例。"
        },
        {
          "sourceId": "src_av_frame408",
          "locator": "PTS17",
          "note": "人物间位置关系。"
        },
        {
          "sourceId": "src_av_frame480",
          "locator": "PTS20",
          "note": "街巷纵深与人物尺度。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_av_unknown",
      "heading": "尚未核实｜声音、动作经过与连续合看",
      "markdown": "8至11秒原片音频已本地抽取，尝试向当前对话提供音频，当前环境明确不支持音频输入。因此本例不判断声音种类、音色、音量体验、对白表演、音乐节拍、音画同步或完整节奏。没有连续视频输入，也不把抽帧当连续运动审看。作者意图、两人完整关系、镜内摄影机运动和其余候选切点保持未知。没有申请或调用额外云端模型，不安装/下载新模型来填这些空缺。",
      "basisKind": "unknown",
      "sourceRefs": [],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_av_association",
      "heading": "创作线索｜保留注意锚点，再改变人物大小",
      "markdown": "可带走的候选形式线索是：保持某个亮暗/色彩注意锚点，再改变人物在画面里的尺度；从脸部细节转向空间关系时，给观众足够可读的空间线条。它们只来自本次局部画面对照，不证明适用于任何题材，不是已采用方案，也不写成剧本或完整分镜。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "src_av_frame333",
          "locator": "PTS13.875",
          "note": "亮暗注意锚点的局部依据。"
        },
        {
          "sourceId": "src_av_frame334",
          "locator": "PTS13.916667",
          "note": "人物切换时保留的亮暗组织。"
        },
        {
          "sourceId": "src_av_frame480",
          "locator": "PTS20",
          "note": "空间线条与尺度变化的局部依据。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_av_detector",
      "heading": "工具与核验｜自动切点为什么只能作候选",
      "markdown": "PySceneDetect0.7.1 detect-adaptive真实扫描1253帧，输出9个边界、10个区间。第一个自动区间0至13.917秒，但0至12秒所抽帧已经出现雪山/雪地、文字卡与胡须人物等不同画面，说明它没有给出这部分完整的语义镜头划分。13.917秒这个候选与零基333/334相邻画面变化一致；其余暗场/渐暗/渐亮处仍待连续回看。不能把10个区间宣布为全片只有10镜，也不把它们的平均时长当情绪节奏结论。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_av_cuts",
          "locator": "scene1：0至13.917；scene2开始13.917；共10区间",
          "note": "真实自动输出与算法读取范围。"
        },
        {
          "sourceId": "src_av_overview",
          "locator": "PTS0,2,4,6,8,10,12",
          "note": "提供自动首区间内不同画面的反证。"
        },
        {
          "sourceId": "src_av_focus",
          "locator": "零基333/334及暗场邻帧",
          "note": "只核对了局部画面边界，保留其他候选未审看。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_av_asr",
      "heading": "工具与核验｜转录草稿为什么还不能当准确台词",
      "markdown": "既有faster-whisper1.2.1使用本机base.en缓存、CPU int8、local_files_only=True与offline环境完成一次真实转录，约1.97秒。\n\n输出四个宽窗；第一条0至15秒草稿为“What brings you to the land of the gatekeepers?”，第二条15至23秒为“I'm searching for someone.”。\n\n这些是模型输出，不是我已听见的台词，宽窗也不支持判定台词在哪一帧开始或是否跨切。\n\n未用它判断音乐、环境声、声线或表演。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_av_asr",
          "locator": "actual_call/version/model/local_files_only；segments0/1",
          "note": "支持真实本地ASR调用及草稿原文；不支持原音语义已经复听。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_av_rights",
      "heading": "来源与许可｜本次视频版本、署名和改动",
      "markdown": "本例公开源为W3C官方HTML video演示镜像。\n\nCommons对应Sintel预告页的Summary/Licensing/Metadata载明作者Durian Open Movie project、© copyright Blender Foundation | www.sintel.org、Creative Commons Attribution 3.0；Blender官方Sharing/About的搜索索引也声明CC BY3.0。\n\n当前未获得官网目录原文件，未逐字节比较W3C MP4与Commons OGV，不把二者当同一字节版本。\n\n研究图来源于本次已哈希的W3C MP4；单帧未改画面，联系表仅截帧、缩放和时间标签。\n\n需保留署名、https://creativecommons.org/licenses/by/3.0/ 和改动说明；本例不声明商标或标志另有授权。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_av_w3c",
          "locator": "Example video/source",
          "note": "W3C公开镜像的官方出处。"
        },
        {
          "sourceId": "src_av_license",
          "locator": "Summary/Licensing/Metadata",
          "note": "影片来源、署名、许可与版本读取限制。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_av_scope",
      "heading": "阅读范围｜哪些看过，哪些还没看听",
      "markdown": "本例为Sintel预告的局部形式研究，不是自制短片。\n\nW3C官方video示例使用同一公开视频链接。\n\n已下载原MP4（4,372,373字节，SHA256 b670602fa00934ca27c4351bb0efe7ea7a07fae57284e44226025eeed7c51254），FFprobe实测H.264 854×480、24fps、1253帧，视频时长52.208333秒，AAC双声道48kHz。\n\n视觉只看了0至30秒16张静帧与13.5至22秒20张聚焦静帧；工具解码完整不等于模型连续观看。\n\n当前对话不支持音频输入，因此声音与合看未完成。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_av_video",
          "locator": "ffprobe.json format/streams；frame-pts.json1253条",
          "note": "支持媒体技术事实，不支持影片语义。"
        },
        {
          "sourceId": "src_av_w3c",
          "locator": "Example video/source",
          "note": "核对合法公开镜像来源。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_av_focus",
      "heading": "案例背景｜AI设定的研究问题，不是小陌原话",
      "markdown": "验收设定的关注点：13.5至22秒从人物面部近景转到雪地动作空间，再转入狭长街巷；怎样用画面占比、明暗与空间关系改变注意位置？这不是小陌的收藏动机，不覆盖用户原话。先做可由静帧支持的画面层判断，保留运动、声音与完整节奏未知。",
      "basisKind": "demo",
      "sourceRefs": [],
      "attachmentIds": []
    }
  ],
  "sources": [
    {
      "sourceId": "src_av_video",
      "kind": "attachment",
      "title": "Sintel Trailer：W3C公开镜像原文件",
      "locator": "SHA256 b670602fa00934ca27c4351bb0efe7ea7a07fae57284e44226025eeed7c51254；ffprobe format/streams；PTS0至52.208333秒",
      "accessedAt": "2026-10-01",
      "verificationScope": "已实际下载与FFprobe读取；工具解码和PTS清单完整1253帧。当前Codex只观察所列静帧，未连续看视频、未听原音轨。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_e3117b2ce8acecf71fa72c6161ef1afac70a4221"
    },
    {
      "sourceId": "src_av_overview",
      "kind": "attachment",
      "title": "Sintel：0至30秒原帧联系表",
      "locator": "零基帧0,48,...720；PTS0,2,...30秒",
      "accessedAt": "2026-10-01",
      "verificationScope": "当前Codex用view_image实际看了16张缩放静帧；是离散帧观察，不是连续看片。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_99e3401e863bca41f57a050940a86623ab709880"
    },
    {
      "sourceId": "src_av_focus",
      "kind": "attachment",
      "title": "Sintel：13.5至22秒原帧联系表",
      "locator": "零基帧324,333,334,336,372,384,395,396,408,419,420,432,435,436,456,480,504,525,526,528；PTS13.5至22秒",
      "accessedAt": "2026-10-01",
      "verificationScope": "当前Codex用view_image实际看了20张缩放静帧，包括关键候选的相邻帧；未连续播放该段。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_d2de5501491edbda7291cefe1e2eab41dc0598eb"
    },
    {
      "sourceId": "src_av_frame333",
      "kind": "attachment",
      "title": "胡须人物关键帧",
      "locator": "零基帧333；PTS00:00:13.875",
      "accessedAt": "2026-10-01",
      "verificationScope": "已在联系表实际观察该原帧；人物位置与脸部亮暗可核，未听对应对白。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_a30faf0ac2a80d0f868a35ceb6a504e76d7050bd"
    },
    {
      "sourceId": "src_av_frame334",
      "kind": "attachment",
      "title": "红发人物关键帧",
      "locator": "零基帧334；原PTS00:00:13.916667（显示13.917）",
      "accessedAt": "2026-10-01",
      "verificationScope": "已在联系表实际观察该原帧；人物位置与脸部亮暗可核，未听对应对白。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_551494f107a32d58e49cc7579cb6317be697a81b"
    },
    {
      "sourceId": "src_av_frame396",
      "kind": "attachment",
      "title": "雪地较大空间关键帧",
      "locator": "零基帧396；PTS00:00:16.500",
      "accessedAt": "2026-10-01",
      "verificationScope": "已在联系表实际观察该原帧；可见雪地与人物全身，动作过程未连续读。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_f6df39f2f6a1ee564765d7d610409983ecbe6426"
    },
    {
      "sourceId": "src_av_frame408",
      "kind": "attachment",
      "title": "雪地人物关系关键帧",
      "locator": "零基帧408；PTS00:00:17.000",
      "accessedAt": "2026-10-01",
      "verificationScope": "已在联系表实际观察该原帧；可见两个人物与举起物，动作含义保持待核。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_32bda614670723b899edd7154bdf2b6d38321bbf"
    },
    {
      "sourceId": "src_av_frame480",
      "kind": "attachment",
      "title": "狭长街巷关键帧",
      "locator": "零基帧480；PTS00:00:20.000",
      "accessedAt": "2026-10-01",
      "verificationScope": "已在联系表实际观察该原帧；可见纵深、明暗与人物尺度，未读该段完整动作。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_c3f92ac19140b89ddebecfa4cecc0fbc8e275f14"
    },
    {
      "sourceId": "src_av_asr",
      "kind": "attachment",
      "title": "本地faster-whisper base.en实际转录草稿（去本机路径副本）",
      "locator": "segments[0..3]；对应原片0至51.9253125秒音频代理；起止是模型宽窗;本副本SHA256 693d5dd65f037279d68cf696f3f26dc8dedc4d3913eee2df999b44fc4f5ef38c",
      "accessedAt": "2026-10-01",
      "verificationScope": "faster-whisper1.2.1读取既有base.en本地缓存；CPU int8、local_files_only=True、HF_HUB_OFFLINE/TRANSFORMERS_OFFLINE；真实调用完成。只核工具输出，不把文字当已听台词。 附件是原工具输出的去本机路径衍生副本，仅移除model_path字段；四段文字及宽窗未改。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_200e684eab6c5e4aa95611bbba18926795bb603b"
    },
    {
      "sourceId": "src_av_cuts",
      "kind": "attachment",
      "title": "PySceneDetect0.7.1 detect-adaptive候选",
      "locator": "CSV scenes1至10；扫描原文件1253帧；原视频24fps；CLI场景号一基",
      "accessedAt": "2026-10-01",
      "verificationScope": "实际本地算法扫描完整文件并输出9候选边界/10区间。仅13.875/13.916667相邻画面变化经模型静帧核对；不称全部切点已人工确认。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_4cb6875ac64cf0732df03826cd38f4a59be49c78"
    },
    {
      "sourceId": "src_av_w3c",
      "kind": "external",
      "title": "W3C HTML Wiki：video元素官方演示",
      "locator": "Example：video/source src=http://media.w3.org/2010/05/sintel/trailer.mp4",
      "accessedAt": "2026-10-01",
      "verificationScope": "实际查阅官方示例页，核对相同公开视频链接；不是影片分析来源。",
      "licenseStatus": "说明页自身版权范围与影片许可分开；本例影片许可见Commons对应文件及Blender说明。",
      "uri": "https://www.w3.org/html/wiki/Elements/video.html"
    },
    {
      "sourceId": "src_av_license",
      "kind": "external",
      "title": "Sintel Trailer来源与许可记录",
      "locator": "Summary、Licensing、Metadata；作者Durian Open Movie project；CC BY3.0；© Blender Foundation",
      "accessedAt": "2026-10-01",
      "verificationScope": "实际读取Commons对应预告来源/许可正文及文件元数据，52秒及标题/作者/版权与W3C MP4一致；未逐字节比对OGV和MP4或取得Blender官网原文件。Blender官方Sharing/About仅能读搜索索引，目录403后未绕过。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "uri": "https://commons.wikimedia.org/wiki/File:Sintel_trailer-1080p.ogv"
    }
  ],
  "researchStatus": "paused",
  "materialVersions": [
    {
      "materialId": "mat_3f263ab2-db5a-4afc-9736-1ac20f8719e3",
      "revision": 1
    }
  ],
  "author": "ai"
}
~~~~


## 记录 5：stage_a79a9b29-8e7f-4bc9-ae7e-cf86b99942cc

- `id`：stage_a79a9b29-8e7f-4bc9-ae7e-cf86b99942cc
- `topic_id`：topic_9611264e-1653-46a1-83aa-8e9dcb12c39b
- `topic_revision`：4
- `created_at`：2026-10-02T02:15:49.734Z

### 原字段 `body_json`

~~~~json
{
  "focus": "阅读整理：收藏预览与自足内容概要分开，以连续文章展开精卫原文、白话、后世语境、创作线索及版本依据；仅重组已核材料，无新增外部研究。",
  "confirmed": [
    "所读数字转录的精卫正文可定位在KR3l0090_003叶14b；正文、郭注、吴补注分层。",
    "塞／寒是已核电子文本差异，尚未核对应影印页。",
    "另读陶、李两篇原文件，确有具体诗句与上下文支撑后世不同使用语境。"
  ],
  "candidates": [
    "微木与海面尺度差、重复动作、局部颜色及结果悬置可作创作形式候选；未采用。"
  ],
  "parked": [
    "完整精卫接受史与地方庙传统不是本轮问题，暂放下。",
    "图像复原与正式剧本/分镜未进入本轮。"
  ],
  "unknown": [
    "寒／塞是否古本异文或录入问题；须原页/可信校勘。",
    "作品精确成书年、此条单一作者意图、少女排行及东海现代地理落实。",
    "神话与地方仪式的连续传承、两故事共同起源。"
  ],
  "nextStep": "若继续校勘，只找《山海经》WYG卷三14b与《广注》WYG卷三26a对应原页；未取得则不升级版本断言。若转向表达感觉，只在小陌选定的一个形式线索继续。",
  "limitations": [
    "全部为公开数字转录；没有目验对应古籍影印页。",
    "CText工具与正文open受限，未运行相似段落分析；检索摘要未充作独立版本证据。",
    "实际研究由当前Codex执行者完成；未调用网页模型API或另配模型。",
    "没有Docling/OCR/STORM/Whisper模型调用，无素材外传或依赖安装。",
    "原文公有领域；只存必要摘录；示意图不是古籍原页。",
    "本例支持规程质量与闭环验证，不证明完整题材研究或真实作品效果。"
  ],
  "paragraphs": [
    {
      "paragraphId": "case-card-preview",
      "heading": "收藏预览",
      "markdown": "《山海经》里的精卫填海神话：女娃溺水化为鸟，反复衔木石填海，结局未写。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "jing-original",
          "locator": "KR3l0090_003.txt；KR3l0090_WYG_003-14b；行251–255",
          "note": "支持精卫外形、女娃叙述及反复衔木石的正文；括号小注另拆"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-reading-intro",
      "heading": "内容概要",
      "markdown": "这段故事在《山海经》的山川记述里：发鸠山上有一种鸟，名叫精卫。书里说，精卫原是炎帝的女儿女娃；女娃在东海游玩时溺水，没有回来，于是成为这只鸟。\n\n精卫的形状像乌鸦，头有纹彩，喙是白的，脚是红的。成为鸟后，它常常衔起西山的木头和石块，拿去填海。故事中的行动持续、反复，原条写到这里就转回地理记述，没有交代最后填海是否成功，也没有说明是为了报仇、救人或证明毅力。\n\n后来诗人把精卫带进不同语境。陶潜写到微小木头和仍在的志向，同时追问好时日是否能等到；李白把精卫放在报国壮心之后，问东海怎样才能填得上。这些是后世诗歌赋予意象的表达，不能补成原始神话的动机或结局。\n\n所据是已核数字转录；两本古籍原页尚未核对。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "jing-original",
          "locator": "KR3l0090_003.txt；KR3l0090_WYG_003-14b；行251–255",
          "note": "支持精卫外形、女娃叙述及反复衔木石的正文；括号小注另拆"
        },
        {
          "sourceId": "tao-poem",
          "locator": "KR4b0008_004.txt；卷四叶20a；行350–351",
          "note": "支持并写、猛志与结尾所问；实际读取目标诗和附近注文"
        },
        {
          "sourceId": "li-poem",
          "locator": "KR4c0012_011.txt；卷十一叶10b；行181–186",
          "note": "支持报国壮心、不迴眷、精卫及何由填的相邻语境"
        },
        {
          "sourceId": "jing-original",
          "locator": "KR3l0090_003.txt；叶14b；行255–256：漳水出焉，東流注于河",
          "note": "支持精卫条之后回到地理记述，不支持填海已有结局。"
        },
        {
          "sourceId": "jing-original",
          "locator": "叶14b行255",
          "note": "提供当前暂译依据"
        },
        {
          "sourceId": "jing-guangzhu",
          "locator": "叶26a行460",
          "note": "提供必须保留的冲突见证"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-original",
      "heading": "原文与白话",
      "markdown": "先看《山海经》怎样介绍这只鸟，再顺着原文读女娃的经历和精卫的行动。以下标点和分段为本次阅读所加。\n\n> 其狀如烏，文首白喙赤足，名曰精衛。\n\n白话：这只鸟的样子像乌鸦，头上有纹彩，喙是白的，脚是红的，名字叫精卫。\n\n这里只写“像乌鸦”及这些局部颜色，没有写它全身是什么颜色。标点和分段是本次阅读添加的，依据仍是已读的数字转录。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "jing-original",
          "locator": "KR3l0090_003.txt；KR3l0090_WYG_003-14b；行251–255",
          "note": "支持精卫外形、女娃叙述及反复衔木石的正文；括号小注另拆"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-original-transformation",
      "heading": "",
      "markdown": "> 是炎帝之少女，名曰女娃。女娃遊于東海，溺而不返，故為精衛。\n\n白话：女娃是炎帝的女儿。她到东海游玩，溺水后没有回来，因此成为精卫。\n\n这是神话文本的叙述，没有据此认定事件真实发生。“少女”的准确排行，以及这里的“东海”对应现代哪片海域，现有资料没有进一步确认。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "jing-original",
          "locator": "KR3l0090_003.txt；KR3l0090_WYG_003-14b；行251–255",
          "note": "支持精卫外形、女娃叙述及反复衔木石的正文；括号小注另拆"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-original-action",
      "heading": "",
      "markdown": "> 常銜西山之木石，以堙于東海。\n\n白话：精卫常常衔着西山的木头和石块，拿去填塞东海。“常”写出了反复进行的动作，原文没有接着写最终填海成功。\n\n“堙”在这里暂按已读郭注的“塞”理解为填塞；另一份电子转录的注文写“寒”。两本古籍原页还没核过，所以这里只保留读法和差异，不能宣布古本异文已经确定。该条随后回到漳水的地理记述。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "jing-original",
          "locator": "KR3l0090_003.txt；KR3l0090_WYG_003-14b；行251–255",
          "note": "支持精卫外形、女娃叙述及反复衔木石的正文；括号小注另拆"
        },
        {
          "sourceId": "jing-original",
          "locator": "叶14b行255",
          "note": "提供当前暂译依据"
        },
        {
          "sourceId": "jing-guangzhu",
          "locator": "叶26a行460",
          "note": "提供必须保留的冲突见证"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-reception-facts",
      "heading": "后世诗歌怎样读精卫",
      "markdown": "这里提到的刑天，是陶潜同一首诗里并提的另一个神话形象。\n\n同一个精卫意象，放进后世诗歌后，会带出不同的意思。以下诗句是后来作品，不能倒过来补成《山海经》原始故事的动机或结局。\n\n另行读了两篇后世诗的数字原文件，不只依赖吴注转引。陶潜《读山海经》其十把精卫与刑天并写，有“精衛銜微木，將以塡滄海”“猛志故常在”，结尾仍有“良晨詎可待”。\n\n本次白话概意：“猛志故常在”说强烈的志向仍在，“良晨詎可待”则追问好的时日哪里能够等到。\n\n李白《江夏寄汉阳辅录事》在“報國有壯心，龍顔不迴眷”之后写“西飛精衛鳥，東海何由填”。\n\n本次白话概意：“東海何由填”是在问东海怎样才能填得上，放在“报国有壮心”之后，是有志向却不容易实现的疑问。\n\n这里的事实是诗句与相邻语境，不是诗人生平心理的确认。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "tao-poem",
          "locator": "KR4b0008_004.txt；卷四叶20a；行350–351",
          "note": "支持并写、猛志与结尾所问；实际读取目标诗和附近注文"
        },
        {
          "sourceId": "li-poem",
          "locator": "KR4c0012_011.txt；卷十一叶10b；行181–186",
          "note": "支持报国壮心、不迴眷、精卫及何由填的相邻语境"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-analysis",
      "heading": "",
      "markdown": "从这些诗句回到神话原条，可以把事实与解释分开。以下是本次研究的分析，仍可由更多原始材料修正。\n\n本执行者的解释：正文“常”可以支撑持续或反复行动，但没有明说填海为了报仇、救人、证明毅力或最终成功。后世诗歌把相同意象放进不同语境：陶诗的微木、猛志与未可待，李诗的报国壮心、何由填，都保留行动力量与结果难成之间的张力。因此不能把整个接受史压成唯一“励志成功”，也不能反向认定《山海经》作者唯一要赞美徒劳。这一判断可被更多原始接受材料修正；当前证据足够阻止单一主题的泛化。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "jing-original",
          "locator": "卷三叶14b；行251–255",
          "note": "限定正文实际用词与未明说的动机"
        },
        {
          "sourceId": "tao-poem",
          "locator": "卷四叶20a；行350–351",
          "note": "支持持志与结果不确定的解释条件"
        },
        {
          "sourceId": "li-poem",
          "locator": "卷十一叶10b；行183–186",
          "note": "为唯一励志成功的概括提供具体反例"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-creation",
      "heading": "可带去创作的形式线索",
      "markdown": "可带去创作的候选：用微小木石与广大水面的尺度差，保留重复动作的节奏；以有纹彩的头、白喙、赤足形成局部视觉记忆，而“像乌鸦”不自动补成全身特定颜色；用一次次同向行动承载意志与难成的悬置。若要加入海浪、鸟鸣、落石声或静默，这是创作声音设想，本例没有原始音视频可听，不把文字声音描写当实际声音分析。这些线索未被小陌采用，也不是已完成剧本或镜头方案。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "jing-original",
          "locator": "卷三叶14b；行251–255",
          "note": "形体、局部颜色和重复衔物构成联想的文本起点"
        },
        {
          "sourceId": "tao-poem",
          "locator": "卷四叶20a；行350",
          "note": "微木提供尺度联想起点"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-connections",
      "heading": "文本关联与未核线索",
      "markdown": "这里仅登记已读文本能支持的关联及明确待核的线索，刑天、愚公和地方传说的完整故事没有逐项核对，本节不展开这些故事。\n\n文献支持：陶诗同一首并写精卫、刑天，这个关联有明确文本依据。研究解释：可比较两者持续行动的表达，但共同起源、共同仪式传统、互相影响并未由这首诗证明。仅相似：精卫与愚公都可让当代创作想到个体对巨大尺度的持续动作；本例没有读取《列子》原文，不把它升级为历史传承关系。《广注》所引某地庙和神女白鸠叙述只证明清注记录了一条地方说法，采录与仪式连续史、現存遗迹均未核；不能当作远古一直连续传承。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "tao-poem",
          "locator": "卷四叶20a；行350–351",
          "note": "支持精卫和刑天的明确并写，只支持该文学见证"
        },
        {
          "sourceId": "jing-guangzhu",
          "locator": "卷三叶25b–26a；行453–456",
          "note": "支持吴补注所引地方庙与白鸠说法的存在，不证明现代现场与连续历史"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-time",
      "heading": "读到的是哪个版本",
      "markdown": "WYG在这里指文渊阁四库本这一底本；BASEEDITION是文件中记录底本信息的字段。\n\n故事发生的时代、书写下来的年代、今天所读底本的年代，以及把古书整理成电子文字的时间，是四件不同的事。\n\n六份文件的BASEEDITION均标WYG，所读见证是标作文渊阁四库本的数字转录。《山海经》提要称郭璞注，《广注》提要称国朝吴任臣撰并补郭注。四层时间分别保留：故事写炎帝女娃，没有可由本段落实的公历年代；作品成书在本轮仍有归属与成层争议；当前所读底本是清代四库体系，提要落款分别为乾隆四十六年正月、九月；文件DATE是2015年数字记录，本次核查为2026-10-01。这些时间不能合并为“精卫发生于四库时代”或“2015年成书”。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "jing-preface",
          "locator": "KR3l0090_000.txt提要叶1a、3a；行11及47–48；文件头DATE/BASEEDITION",
          "note": "支持郭璞注的题署及提要落款，不独立证明作品原始作者"
        },
        {
          "sourceId": "guang-preface",
          "locator": "KR3l0091_000.txt提要叶1a、2a；行11–13及30–31；文件头DATE/BASEEDITION",
          "note": "支持吴任臣补郭注的性质及四库提要落款"
        },
        {
          "sourceId": "jing-original",
          "locator": "KR3l0090_003.txt叶14b；行253；文件头",
          "note": "故事名号来自正文，转录时间和底本标签来自metadata"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-composition",
      "heading": "",
      "markdown": "成书年代还需要把旧编者的判断与已经确认的事实区别开来。\n\n所读《山海经》提要先报告刘秀奏所称伯益作，又根据正文所见人名、地名提出周秦间人叙述、后来附益的疑问。这是清代四库编者的考辨，不等于已核现代学界定论。本轮据此保留成书归属的不同说法，不把伯益题署或炎帝故事时间认作已证的写作年代，也没有另查现代论文来宣布精确成书年。",
      "basisKind": "author_interpretation",
      "sourceRefs": [
        {
          "sourceId": "jing-preface",
          "locator": "KR3l0090_000.txt；提要叶1a–2a；行11–26",
          "note": "实际支持四库编者报告旧归属说并提出不同判断；不证明哪说已最终成立"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-guang-layer",
      "heading": "",
      "markdown": "补注还带来了一条引文链；见到转引，并不等于已经读过所有被引用的书。\n\n《广注》这两叶转引多种书及诗赋，其中出现左思“償怨”、崔融“償寃”和陶潜诗句。它们是本轮实际读到的清人补注引文链，不冒充已经逐一核过每部原书。《广注》提要还说明旧本载图及图说问题，并说此次只录注、图从删；不能凭当前数字转录假装看过古代精卫图。\n\n这里核到的是补注中确有这些转引，尚未逐读所有被引原书；不能据“償怨”“償寃”确定《山海经》原始正文的填海动机。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "jing-guangzhu",
          "locator": "KR3l0091_003.txt；叶26a–26b；行461–472",
          "note": "支持所读补注内确有相关转引，不能证明被引书的全文与原版本"
        },
        {
          "sourceId": "guang-preface",
          "locator": "KR3l0091_000.txt；叶1b–2a；行22–28",
          "note": "支持四库提要说明载图与删图；本例不据此提供假原图"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-variant",
      "heading": "塞／寒差异仍待核原页",
      "markdown": "同一精卫条的郭注，在KR3l0090_003.txt叶14b数字转录为“堙塞也，音因”；在KR3l0091_003.txt叶26a为“郭曰堙寒也，音因”。两份正文都保留“以堙于東海”，不同的是注文中的一个字。本例保存双方字样和定位，没有静默改掉“寒”。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "jing-original",
          "locator": "KR3l0090_003.txt；叶14b；行255",
          "note": "支持本数字转录作塞"
        },
        {
          "sourceId": "jing-guangzhu",
          "locator": "KR3l0091_003.txt；叶26a；行460",
          "note": "支持本数字转录作寒；只证明电子见证的字样"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-variant-limit",
      "heading": "",
      "markdown": "尚未实际目验两本对应影印页，不能判断“寒”是原页如此、录入误字或其他环节问题，也不能把这一个数字差异称作古本异文定论。白话暂按已读郭注“塞”的读法译为填塞，并明确是本次采用的读法。最小补证是核对WYG《山海经》卷三14b与《广注》卷三26a原页，或可信校勘记录；拿不到时停止寒／塞的版本断言。",
      "basisKind": "unknown",
      "sourceRefs": [
        {
          "sourceId": "jing-original",
          "locator": "叶14b行255",
          "note": "提供当前暂译依据"
        },
        {
          "sourceId": "jing-guangzhu",
          "locator": "叶26a行460",
          "note": "提供必须保留的冲突见证"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "case-image",
      "heading": "文本定位示意",
      "markdown": "![自制文本定位示意：精卫条的四个证据层次，非古籍影印页](attachment:att_8ee49b3313b6145a1871109dcb346bdcfd87c2ff)\n\n本机已有Pillow绘制，实际打开核对。只展示必要古文片段与本次分析标签；不证明古籍原页字形、版式、真实鸟类外貌或作者意图。",
      "basisKind": "demo",
      "sourceRefs": [
        {
          "sourceId": "text-locator",
          "locator": "整图及顶部、底部标识",
          "note": "支持这张图是实际生成和查看的本次示意附件"
        },
        {
          "sourceId": "jing-original",
          "locator": "卷三叶14b",
          "note": "图卡1文本来源"
        },
        {
          "sourceId": "jing-guangzhu",
          "locator": "卷三叶26a–26b",
          "note": "图卡2文本来源"
        },
        {
          "sourceId": "tao-poem",
          "locator": "卷四叶20a",
          "note": "图卡3文本来源"
        },
        {
          "sourceId": "li-poem",
          "locator": "卷十一叶10b",
          "note": "图卡4文本来源"
        }
      ],
      "attachmentIds": [
        "att_8ee49b3313b6145a1871109dcb346bdcfd87c2ff"
      ]
    },
    {
      "paragraphId": "case-scope",
      "heading": "方法与读取记录",
      "markdown": "原研究最初在隔离库完成，后来获小陌明确授权导入正式收藏。本次只调整阅读顺序并补白话解释，沿用已有证据，没有新增外部研究。以下保留最初的研究范围说明。\n\n本例是公开文本真实研究的隔离验收，关注点由执行者设定，不是小陌的原话。问题：精卫条实际写了哪些动作和形象，正文、注释、后世诗歌各怎样加入意思？本轮只读六份WYG数字转录的目标段及上下文，不做神话全史。停止条件：原文可定位；注释层分开；核实一处会影响释义的差异及一个单一主题的反例；未核原页和作者意图停在未知。\n\n这里说的“核实差异”，指已比对两份电子转录中的字样；对应原页字形仍未核对。",
      "basisKind": "demo",
      "sourceRefs": [],
      "attachmentIds": []
    }
  ],
  "sources": [
    {
      "sourceId": "jing-original",
      "kind": "external",
      "title": "KR3l0090_003.txt",
      "locator": "KR3l0090_WYG_003-14b；本次保存摘录行 251–259（UTF-8文件1起算）",
      "accessedAt": "2026-10-01T15:57:38.372923+00:00",
      "verificationScope": "实际读取公开数字转录及标记；未目验对应古籍原页；非OCR质量认证",
      "licenseStatus": "古代原文公有领域；本例只存必要摘录，不声称仓库整体许可或全本再利用许可",
      "uri": "https://raw.githubusercontent.com/kanripo/KR3l0090/master/KR3l0090_003.txt"
    },
    {
      "sourceId": "jing-guangzhu",
      "kind": "external",
      "title": "KR3l0091_003.txt",
      "locator": "KR3l0091_WYG_003-26a；本次保存摘录行 453–475（UTF-8文件1起算）",
      "accessedAt": "2026-10-01T15:57:38.372923+00:00",
      "verificationScope": "实际读取公开数字转录及标记；未目验对应古籍原页；非OCR质量认证",
      "licenseStatus": "古代原文公有领域；本例只存必要摘录，不声称仓库整体许可或全本再利用许可",
      "uri": "https://raw.githubusercontent.com/kanripo/KR3l0091/master/KR3l0091_003.txt"
    },
    {
      "sourceId": "jing-preface",
      "kind": "external",
      "title": "KR3l0090_000.txt",
      "locator": "KR3l0090_WYG_000-1a；本次保存摘录行 11–49（UTF-8文件1起算）",
      "accessedAt": "2026-10-01T15:57:38.372923+00:00",
      "verificationScope": "实际读取公开数字转录及标记；未目验对应古籍原页；非OCR质量认证",
      "licenseStatus": "古代原文公有领域；本例只存必要摘录，不声称仓库整体许可或全本再利用许可",
      "uri": "https://raw.githubusercontent.com/kanripo/KR3l0090/master/KR3l0090_000.txt"
    },
    {
      "sourceId": "guang-preface",
      "kind": "external",
      "title": "KR3l0091_000.txt",
      "locator": "KR3l0091_WYG_000-1a；本次保存摘录行 11–31（UTF-8文件1起算）",
      "accessedAt": "2026-10-01T15:57:38.372923+00:00",
      "verificationScope": "实际读取公开数字转录及标记；未目验对应古籍原页；非OCR质量认证",
      "licenseStatus": "古代原文公有领域；本例只存必要摘录，不声称仓库整体许可或全本再利用许可",
      "uri": "https://raw.githubusercontent.com/kanripo/KR3l0091/master/KR3l0091_000.txt"
    },
    {
      "sourceId": "tao-poem",
      "kind": "external",
      "title": "KR4b0008_004.txt",
      "locator": "KR4b0008_WYG_004-20a；本次保存摘录行 350–364（UTF-8文件1起算）",
      "accessedAt": "2026-10-01T15:57:38.372923+00:00",
      "verificationScope": "实际读取公开数字转录及标记；未目验对应古籍原页；非OCR质量认证",
      "licenseStatus": "古代原文公有领域；本例只存必要摘录，不声称仓库整体许可或全本再利用许可",
      "uri": "https://raw.githubusercontent.com/kanripo/KR4b0008/master/KR4b0008_004.txt"
    },
    {
      "sourceId": "li-poem",
      "kind": "external",
      "title": "KR4c0012_011.txt",
      "locator": "KR4c0012_WYG_011-10b；本次保存摘录行 181–186（UTF-8文件1起算）",
      "accessedAt": "2026-10-01T15:57:38.372923+00:00",
      "verificationScope": "实际读取公开数字转录及标记；未目验对应古籍原页；非OCR质量认证",
      "licenseStatus": "古代原文公有领域；本例只存必要摘录，不声称仓库整体许可或全本再利用许可",
      "uri": "https://raw.githubusercontent.com/kanripo/KR4c0012/master/KR4c0012_011.txt"
    },
    {
      "sourceId": "text-locator",
      "kind": "attachment",
      "title": "精卫文本定位示意·非古籍原页",
      "locator": "整张图的四个文本层次卡片及底部说明",
      "accessedAt": "2026-10-01T15:57:38.372923+00:00",
      "verificationScope": "使用本机已有Pillow绘制，并实际打开图像核对文字、标识与定位；不是古籍扫描",
      "licenseStatus": "自制文本定位示意；随本例使用时保留非原页标识及古文来源",
      "attachmentId": "att_8ee49b3313b6145a1871109dcb346bdcfd87c2ff"
    }
  ],
  "researchStatus": "stage_complete",
  "materialVersions": [
    {
      "materialId": "mat_5759b519-f594-428d-943c-b4fa1a9045df",
      "revision": 1
    }
  ],
  "author": "ai"
}
~~~~


## 记录 6：stage_36e6829c-fb61-42ce-97df-96d1be923dc1

- `id`：stage_36e6829c-fb61-42ce-97df-96d1be923dc1
- `topic_id`：topic_45f964ee-7fbb-4734-b1e2-e1fb44659570
- `topic_revision`：4
- `created_at`：2026-10-02T02:15:49.751Z

### 原字段 `body_json`

~~~~json
{
  "focus": "阅读整理：收藏预览与自足内容概要分开，以连续文章串起Sintel预告中已读静帧及形式分析；仍未审听、未连续合看、保持暂停。只重组已有证据，无新研究。",
  "confirmed": [
    "实际取得并哈希公开Sintel预告；实际读静帧与本地切点/ASR输出。",
    "13.875至13.916667相邻原帧人物切换可查。",
    "没有实际听音或连续声画审看；不能宣称完整声画拆解。"
  ],
  "candidates": [
    "可进一步检验亮暗锚点与人物尺度变化怎样引导注意。",
    "由可听/可连续读的执行者复核13.5至22秒原音及动作后再讨论声画交接。"
  ],
  "parked": [
    "未读全片上下文，暂不推人物身份、动机或作者意图。",
    "本轮不为补能力调用额外云端模型或下载模型。"
  ],
  "unknown": [
    "原音中的对白准确起止、语气、环境、音乐及声画同步。",
    "镜内运动、完整动作过程和其余自动边界是否是真切换。",
    "W3C MP4与Blender官网原始发布文件的字节/版本关系。"
  ],
  "nextStep": "若继续声画关系研究，先在具备实际听音与连续读视频的能力下核对原片13.5至22秒；沿用本素材ID、文件哈希与已保存帧，不重问收藏动机。",
  "limitations": [
    "真实影片局部画面研究与真实本地技术调用；不是完整声画专业分析验证。",
    "当前对话明确不支持音频输入，未听、未合看。",
    "模型视觉读取是16＋20张联系表静帧（有重复），不是连续视频输入。",
    "ASR宽时间窗和自动切点不作已人工核实语义。",
    "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
    "登记的ASR附件为去本机路径副本；未复听，未认证准确对白或声画关系。"
  ],
  "paragraphs": [
    {
      "paragraphId": "para_av_card_preview",
      "heading": "收藏预览",
      "markdown": "《Sintel》约52秒动画预告的局部画面：人物近景、雪地与街巷；声音和连续观看待核。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_av_video",
          "locator": "ffprobe视频时长52.208333秒；原文件及此前登记的读取范围",
          "note": "支持视频性质、时长与未连续看听的边界。"
        },
        {
          "sourceId": "src_av_overview",
          "locator": "PTS0,2,...30秒的已读静帧",
          "note": "支持已读静帧中出现雪地、人物面部、街巷等可见场景。"
        },
        {
          "sourceId": "src_av_frame333",
          "locator": "PTS13.875",
          "note": "支持胡须人物面部。"
        },
        {
          "sourceId": "src_av_frame334",
          "locator": "PTS13.916667",
          "note": "支持红发人物面部。"
        },
        {
          "sourceId": "src_av_frame408",
          "locator": "PTS17",
          "note": "支持雪地两个人物、抬高的长物。"
        },
        {
          "sourceId": "src_av_frame480",
          "locator": "PTS20",
          "note": "支持狭长街巷及其中的较小人物。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_av_reading_intro",
      "heading": "内容概要",
      "markdown": "这份收藏是《Sintel》的一段约52秒动画预告。已查看的局部静帧里，有雪山雪地、人物面部和狭长街巷：有的画面看得清脸，有的给出人物全身，有的把人放在街巷的纵深处。声音未审听、未连续合看，当前可介绍的是这些画面，尚不能复述整部影片剧情。\n\n约13.9秒的相邻两帧，先是胡须人物面部，再换成红发人物面部。两人的脸和上身都占较大面积，暖色亮部集中在面部附近，背景较暗。这里看得清五官和朝向，人物之间的完整关系与对白语气尚未确认。\n\n到16.5秒的截图，可见较大面积的雪地与一个人物全身。17秒的截图里，近处人物的背部占据中间，另一人物在左侧，手臂和所持长物抬高。20秒则换到狭长街巷，两侧墙面、屋檐和地面线条伸向纵深，较小的人物位于通道中。\n\n这些截图给出了本次可读的局部内容：从脸部细节，转到雪地里的人物位置，再转到街巷中的人与环境。抬手之后发生了什么、人物是否在追逐或逃离，以及完整动作和节奏，目前仍待核。\n\n实际观察的是前30秒16张静帧与13.5至22秒20张聚焦静帧，两组有重复；选取的截图不能替代整段连续观看。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_av_video",
          "locator": "ffprobe视频时长52.208333秒；原文件及此前登记的读取范围",
          "note": "支持视频性质、时长与未连续看听的边界。"
        },
        {
          "sourceId": "src_av_overview",
          "locator": "PTS0,2,...30秒的已读静帧",
          "note": "支持已读静帧中出现雪地、人物面部、街巷等可见场景。"
        },
        {
          "sourceId": "src_av_frame333",
          "locator": "PTS13.875",
          "note": "支持胡须人物面部。"
        },
        {
          "sourceId": "src_av_frame334",
          "locator": "PTS13.916667",
          "note": "支持红发人物面部。"
        },
        {
          "sourceId": "src_av_frame408",
          "locator": "PTS17",
          "note": "支持雪地两个人物、抬高的长物。"
        },
        {
          "sourceId": "src_av_frame480",
          "locator": "PTS20",
          "note": "支持狭长街巷及其中的较小人物。"
        },
        {
          "sourceId": "src_av_frame396",
          "locator": "零基396；PTS16.5",
          "note": "人物尺度和雪地空间。"
        },
        {
          "sourceId": "src_av_frame408",
          "locator": "零基408；PTS17",
          "note": "两个可见人物及长物位置。"
        },
        {
          "sourceId": "src_av_frame480",
          "locator": "零基480；PTS20",
          "note": "支持街巷构图、亮暗与人物占比。"
        },
        {
          "sourceId": "src_av_frame334",
          "locator": "零基334；PTS13.916667",
          "note": "支持与人物近景的占比比较。"
        },
        {
          "sourceId": "src_av_overview",
          "locator": "PTS0,2,...30秒",
          "note": "支持离散画面种类与顺序。"
        },
        {
          "sourceId": "src_av_focus",
          "locator": "PTS13.5至22秒的20帧",
          "note": "支持局部构图及边界邻帧。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_av_cut",
      "heading": "人物、雪地与街巷",
      "markdown": "从13.875秒和13.916667秒这两张相邻原帧读起。它们记录了从一张脸切到另一张脸的画面变化。时间标签里，PTS表示这一帧在原视频中的实际时间位置；零基帧从0开始编号。\n\n![原片零基帧333；PTS13.875秒；未改画面](attachment:att_a30faf0ac2a80d0f868a35ceb6a504e76d7050bd)\n\n这一帧可见胡须人物的面部和上身，脸部占较大面积，背景较暗。\n\n![原片零基帧334；PTS13.916667秒；未改画面](attachment:att_551494f107a32d58e49cc7579cb6317be697a81b)\n\n相邻原帧从胡须人物面部切到红发人物面部；两者都以脸部和上身占较大画面面积，背景较暗，可见重复线条图案与竖向物体。暖色亮部集中在面部附近，暗背景中的五官仍可分辨。这里可确认相邻帧发生直接画面切换，不能由此确认两人关系、台词语气或完整空间轴线。",
      "basisKind": "direct_observation",
      "sourceRefs": [
        {
          "sourceId": "src_av_frame333",
          "locator": "零基333；PTS13.875",
          "note": "切换前人物与面部光色。"
        },
        {
          "sourceId": "src_av_frame334",
          "locator": "零基334；PTS13.916667",
          "note": "相邻切换后人物与面部光色。"
        }
      ],
      "attachmentIds": [
        "att_a30faf0ac2a80d0f868a35ceb6a504e76d7050bd",
        "att_551494f107a32d58e49cc7579cb6317be697a81b"
      ]
    },
    {
      "paragraphId": "para_av_snow_fact",
      "heading": "",
      "markdown": "接着看16.5秒与17秒的雪地截图：人物全身和彼此的位置出现在画面中。\n\n![原片零基帧396；PTS16.5秒](attachment:att_f6df39f2f6a1ee564765d7d610409983ecbe6426)\n\n16.5秒这张帧里，雪地面积较大，人物以全身出现在画面中。\n\n![原片零基帧408；PTS17秒](attachment:att_32bda614670723b899edd7154bdf2b6d38321bbf)\n\n16.5秒帧里可见较大雪地面积和一个人物全身；17秒帧里近处人物背部占画面中部，另一人物位于左侧，手臂及所持长物抬高，背景仍是灰白雪地/山石。它们支持观察取景尺度与人物位置的变化；仅凭这两个离散帧，不把完整挥击、闪躲或运动轨迹记成已观看事实。",
      "basisKind": "direct_observation",
      "sourceRefs": [
        {
          "sourceId": "src_av_frame396",
          "locator": "零基396；PTS16.5",
          "note": "人物尺度和雪地空间。"
        },
        {
          "sourceId": "src_av_frame408",
          "locator": "零基408；PTS17",
          "note": "两个可见人物及长物位置。"
        }
      ],
      "attachmentIds": [
        "att_f6df39f2f6a1ee564765d7d610409983ecbe6426",
        "att_32bda614670723b899edd7154bdf2b6d38321bbf"
      ]
    },
    {
      "paragraphId": "para_av_alley_fact",
      "heading": "",
      "markdown": "20秒这张截图把人物放进了街巷，可以同时看人和通道的形状。\n\n![原片零基帧480；PTS20秒；未改画面](attachment:att_c3f92ac19140b89ddebecfa4cecc0fbc8e275f14)\n\n20秒帧里两侧墙面/屋檐围成狭长通道，地面和建筑线条向画面纵深延伸。一个较小的人物形体位于通道中，右侧墙面的亮区和左侧较暗墙面有明显差别。这个画面比13.916667秒的人物近景给了更多环境面积，脸部细节相应减少。",
      "basisKind": "direct_observation",
      "sourceRefs": [
        {
          "sourceId": "src_av_frame480",
          "locator": "零基480；PTS20",
          "note": "支持街巷构图、亮暗与人物占比。"
        },
        {
          "sourceId": "src_av_frame334",
          "locator": "零基334；PTS13.916667",
          "note": "支持与人物近景的占比比较。"
        }
      ],
      "attachmentIds": [
        "att_c3f92ac19140b89ddebecfa4cecc0fbc8e275f14"
      ]
    },
    {
      "paragraphId": "para_av_map",
      "heading": "截图在预告中的位置",
      "markdown": "联系表把不同时间的画面排在一起，方便找位置；它保留的是离散画面，帧间过程仍需连续观看核实。\n\n![0至30秒原帧联系表；每2秒一帧；仅标签与缩放](attachment:att_99e3401e863bca41f57a050940a86623ab709880)\n\n![13.5至22秒原帧联系表；相邻边界帧及局部；仅标签与缩放](attachment:att_d2de5501491edbda7291cefe1e2eab41dc0598eb)\n\n0至30秒这些帧可见雪山/雪地、文字卡、暖色人物面部、街巷和飞行物等不同画面。联系表只让它们的位置和差异可查；帧间发生的完整动作、运动速度及声音尚不能由表格证明。图像署名：© copyright Blender Foundation | www.sintel.org，CC BY3.0；改动为截帧、缩放与时间标签。",
      "basisKind": "direct_observation",
      "sourceRefs": [
        {
          "sourceId": "src_av_overview",
          "locator": "PTS0,2,...30秒",
          "note": "支持离散画面种类与顺序。"
        },
        {
          "sourceId": "src_av_focus",
          "locator": "PTS13.5至22秒的20帧",
          "note": "支持局部构图及边界邻帧。"
        }
      ],
      "attachmentIds": [
        "att_99e3401e863bca41f57a050940a86623ab709880",
        "att_d2de5501491edbda7291cefe1e2eab41dc0598eb"
      ]
    },
    {
      "paragraphId": "para_av_portrait_analysis",
      "heading": "面部明暗与人物尺度",
      "markdown": "以下是基于静帧的形式分析，提出画面可能怎样组织注意；它不确认作者意图或人物心理。\n\n两帧的对象改变了，但“较大的面部占比＋暖亮面部/暗背景”仍相近。这个保留项可能让注意继续落在另一张脸上，而不是先重新搜寻环境。与把人物切成远景相比，它更保留面部细节的可读性。这里只提出形式作用：未经连续声画核对，不称之为已确认对话反应镜头，不推断红发人物的恐惧、决心或导演意图。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "src_av_frame333",
          "locator": "零基333",
          "note": "分析的观察前提：面部较大、暗背景。"
        },
        {
          "sourceId": "src_av_frame334",
          "locator": "零基334",
          "note": "分析的比较前提：另一个人物、相似亮暗组织。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_av_scale_analysis",
      "heading": "",
      "markdown": "把两张脸与后面的雪地、街巷截图放在一起，可以继续比较信息尺度的变化。\n\n在已观察的帧之间，人物面部近景提供五官与朝向；雪地帧让人物全身与他人位置更可读；街巷帧让通道、纵深和人物的相对尺度更突出。两侧近景墙面与向纵深延伸的线条，可能把注意引向通道中的人物。可讨论这种“改变信息尺度”的形式线索，但不能用静帧确定人物是否被困、追逐是否紧张、镜头是否升降，或这组完整节奏是快是慢。街巷图也可能服务于单纯交代位置，需要前后连续证据区分。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "src_av_frame334",
          "locator": "PTS13.916667",
          "note": "面部细节的比较基准。"
        },
        {
          "sourceId": "src_av_frame396",
          "locator": "PTS16.5",
          "note": "人物全身与环境比例。"
        },
        {
          "sourceId": "src_av_frame408",
          "locator": "PTS17",
          "note": "人物间位置关系。"
        },
        {
          "sourceId": "src_av_frame480",
          "locator": "PTS20",
          "note": "街巷纵深与人物尺度。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_av_association",
      "heading": "可带去创作的形式线索",
      "markdown": "可带走的候选形式线索是：保持某个亮暗/色彩注意锚点，再改变人物在画面里的尺度；从脸部细节转向空间关系时，给观众足够可读的空间线条。它们只来自本次局部画面对照，不证明适用于任何题材，不是已采用方案，也不写成剧本或完整分镜。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "src_av_frame333",
          "locator": "PTS13.875",
          "note": "亮暗注意锚点的局部依据。"
        },
        {
          "sourceId": "src_av_frame334",
          "locator": "PTS13.916667",
          "note": "人物切换时保留的亮暗组织。"
        },
        {
          "sourceId": "src_av_frame480",
          "locator": "PTS20",
          "note": "空间线条与尺度变化的局部依据。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_av_unknown",
      "heading": "声音与连续动作仍待核",
      "markdown": "8至11秒原片音频已本地抽取，尝试向当前对话提供音频，当前环境明确不支持音频输入。因此本例不判断声音种类、音色、音量体验、对白表演、音乐节拍、音画同步或完整节奏。没有连续视频输入，也不把抽帧当连续运动审看。作者意图、两人完整关系、镜内摄影机运动和其余候选切点保持未知。没有申请或调用额外云端模型，不安装/下载新模型来填这些空缺。",
      "basisKind": "unknown",
      "sourceRefs": [],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_av_detector",
      "heading": "方法与读取记录",
      "markdown": "以下保存工具输出、视频版本和实际读取记录，作为查验用；不能替代画面与原音观察。\n\nPySceneDetect0.7.1 detect-adaptive真实扫描1253帧，输出9个边界、10个区间。第一个自动区间0至13.917秒，但0至12秒所抽帧已经出现雪山/雪地、文字卡与胡须人物等不同画面，说明它没有给出这部分完整的语义镜头划分。13.917秒这个候选与零基333/334相邻画面变化一致；其余暗场/渐暗/渐亮处仍待连续回看。不能把10个区间宣布为全片只有10镜，也不把它们的平均时长当情绪节奏结论。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_av_cuts",
          "locator": "scene1：0至13.917；scene2开始13.917；共10区间",
          "note": "真实自动输出与算法读取范围。"
        },
        {
          "sourceId": "src_av_overview",
          "locator": "PTS0,2,4,6,8,10,12",
          "note": "提供自动首区间内不同画面的反证。"
        },
        {
          "sourceId": "src_av_focus",
          "locator": "零基333/334及暗场邻帧",
          "note": "只核对了局部画面边界，保留其他候选未审看。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_av_asr",
      "heading": "",
      "markdown": "转录同样只提供待核线索，不能替代听原音。\n\n既有faster-whisper1.2.1使用本机base.en缓存、CPU int8、local_files_only=True与offline环境完成一次真实转录，约1.97秒。\n\n输出四个宽窗；第一条0至15秒草稿为“What brings you to the land of the gatekeepers?”，第二条15至23秒为“I'm searching for someone.”。\n\n这些是模型输出，不是我已听见的台词，宽窗也不支持判定台词在哪一帧开始或是否跨切。\n\n未用它判断音乐、环境声、声线或表演。\n\n上面只示例4个宽窗中的前2个：0至15秒草稿的中文大意是“你为什么来到守门人的地方？”，15至23秒草稿的中文大意是“我在找一个人。”这些只是对模型文字的翻译，未审听原音，也没有分配给任何人物。\n\n约1.97秒来自这次工具记录的elapsed_seconds，是程序调用耗时，不能当作台词时长；0至15秒和15至23秒才是模型给这两条草稿的宽时间窗。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_av_asr",
          "locator": "actual_call/version/model/local_files_only；segments0/1",
          "note": "支持真实本地ASR调用及草稿原文；不支持原音语义已经复听。"
        },
        {
          "sourceId": "src_av_asr",
          "locator": "actual_call=true；elapsed_seconds=1.9689999999973224；segments[0..1]的text/start/end；info.duration=51.9253125",
          "note": "支持程序调用耗时与音频范围是不同字段，并支持所示前2条模型草稿的原文和宽窗；不支持已经审听或分配给人物。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_av_rights",
      "heading": "视频版本与使用说明",
      "markdown": "本例公开源为W3C官方HTML video演示镜像。\n\nCommons对应Sintel预告页的Summary/Licensing/Metadata载明作者Durian Open Movie project、© copyright Blender Foundation | www.sintel.org、Creative Commons Attribution 3.0；Blender官方Sharing/About的搜索索引也声明CC BY3.0。\n\n当前未获得官网目录原文件，未逐字节比较W3C MP4与Commons OGV，不把二者当同一字节版本。\n\n研究图来源于本次已哈希的W3C MP4；单帧未改画面，联系表仅截帧、缩放和时间标签。\n\n需保留署名、https://creativecommons.org/licenses/by/3.0/ 和改动说明；本例不声明商标或标志另有授权。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_av_w3c",
          "locator": "Example video/source",
          "note": "W3C公开镜像的官方出处。"
        },
        {
          "sourceId": "src_av_license",
          "locator": "Summary/Licensing/Metadata",
          "note": "影片来源、署名、许可与版本读取限制。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_av_scope",
      "heading": "实际读取范围",
      "markdown": "本例为Sintel预告的局部形式研究，不是自制短片。\n\nW3C官方video示例使用同一公开视频链接。\n\n已下载原MP4（4,372,373字节，SHA256 b670602fa00934ca27c4351bb0efe7ea7a07fae57284e44226025eeed7c51254），FFprobe实测H.264 854×480、24fps、1253帧，视频时长52.208333秒，AAC双声道48kHz。\n\n视觉只看了0至30秒16张静帧与13.5至22秒20张聚焦静帧；工具解码完整不等于模型连续观看。\n\n当前对话不支持音频输入，因此声音与合看未完成。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_av_video",
          "locator": "ffprobe.json format/streams；frame-pts.json1253条",
          "note": "支持媒体技术事实，不支持影片语义。"
        },
        {
          "sourceId": "src_av_w3c",
          "locator": "Example video/source",
          "note": "核对合法公开镜像来源。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_av_focus",
      "heading": "研究问题的由来",
      "markdown": "验收设定的关注点：13.5至22秒从人物面部近景转到雪地动作空间，再转入狭长街巷；怎样用画面占比、明暗与空间关系改变注意位置？这不是小陌的收藏动机，不覆盖用户原话。先做可由静帧支持的画面层判断，保留运动、声音与完整节奏未知。",
      "basisKind": "demo",
      "sourceRefs": [],
      "attachmentIds": []
    }
  ],
  "sources": [
    {
      "sourceId": "src_av_video",
      "kind": "attachment",
      "title": "Sintel Trailer：W3C公开镜像原文件",
      "locator": "SHA256 b670602fa00934ca27c4351bb0efe7ea7a07fae57284e44226025eeed7c51254；ffprobe format/streams；PTS0至52.208333秒",
      "accessedAt": "2026-10-01",
      "verificationScope": "已实际下载与FFprobe读取；工具解码和PTS清单完整1253帧。当前Codex只观察所列静帧，未连续看视频、未听原音轨。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_e3117b2ce8acecf71fa72c6161ef1afac70a4221"
    },
    {
      "sourceId": "src_av_overview",
      "kind": "attachment",
      "title": "Sintel：0至30秒原帧联系表",
      "locator": "零基帧0,48,...720；PTS0,2,...30秒",
      "accessedAt": "2026-10-01",
      "verificationScope": "当前Codex用view_image实际看了16张缩放静帧；是离散帧观察，不是连续看片。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_99e3401e863bca41f57a050940a86623ab709880"
    },
    {
      "sourceId": "src_av_focus",
      "kind": "attachment",
      "title": "Sintel：13.5至22秒原帧联系表",
      "locator": "零基帧324,333,334,336,372,384,395,396,408,419,420,432,435,436,456,480,504,525,526,528；PTS13.5至22秒",
      "accessedAt": "2026-10-01",
      "verificationScope": "当前Codex用view_image实际看了20张缩放静帧，包括关键候选的相邻帧；未连续播放该段。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_d2de5501491edbda7291cefe1e2eab41dc0598eb"
    },
    {
      "sourceId": "src_av_frame333",
      "kind": "attachment",
      "title": "胡须人物关键帧",
      "locator": "零基帧333；PTS00:00:13.875",
      "accessedAt": "2026-10-01",
      "verificationScope": "已在联系表实际观察该原帧；人物位置与脸部亮暗可核，未听对应对白。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_a30faf0ac2a80d0f868a35ceb6a504e76d7050bd"
    },
    {
      "sourceId": "src_av_frame334",
      "kind": "attachment",
      "title": "红发人物关键帧",
      "locator": "零基帧334；原PTS00:00:13.916667（显示13.917）",
      "accessedAt": "2026-10-01",
      "verificationScope": "已在联系表实际观察该原帧；人物位置与脸部亮暗可核，未听对应对白。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_551494f107a32d58e49cc7579cb6317be697a81b"
    },
    {
      "sourceId": "src_av_frame396",
      "kind": "attachment",
      "title": "雪地较大空间关键帧",
      "locator": "零基帧396；PTS00:00:16.500",
      "accessedAt": "2026-10-01",
      "verificationScope": "已在联系表实际观察该原帧；可见雪地与人物全身，动作过程未连续读。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_f6df39f2f6a1ee564765d7d610409983ecbe6426"
    },
    {
      "sourceId": "src_av_frame408",
      "kind": "attachment",
      "title": "雪地人物关系关键帧",
      "locator": "零基帧408；PTS00:00:17.000",
      "accessedAt": "2026-10-01",
      "verificationScope": "已在联系表实际观察该原帧；可见两个人物与举起物，动作含义保持待核。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_32bda614670723b899edd7154bdf2b6d38321bbf"
    },
    {
      "sourceId": "src_av_frame480",
      "kind": "attachment",
      "title": "狭长街巷关键帧",
      "locator": "零基帧480；PTS00:00:20.000",
      "accessedAt": "2026-10-01",
      "verificationScope": "已在联系表实际观察该原帧；可见纵深、明暗与人物尺度，未读该段完整动作。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_c3f92ac19140b89ddebecfa4cecc0fbc8e275f14"
    },
    {
      "sourceId": "src_av_asr",
      "kind": "attachment",
      "title": "本地faster-whisper base.en实际转录草稿（去本机路径副本）",
      "locator": "segments[0..3]；对应原片0至51.9253125秒音频代理；起止是模型宽窗;本副本SHA256 693d5dd65f037279d68cf696f3f26dc8dedc4d3913eee2df999b44fc4f5ef38c",
      "accessedAt": "2026-10-01",
      "verificationScope": "faster-whisper1.2.1读取既有base.en本地缓存；CPU int8、local_files_only=True、HF_HUB_OFFLINE/TRANSFORMERS_OFFLINE；真实调用完成。只核工具输出，不把文字当已听台词。 附件是原工具输出的去本机路径衍生副本，仅移除model_path字段；四段文字及宽窗未改。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_200e684eab6c5e4aa95611bbba18926795bb603b"
    },
    {
      "sourceId": "src_av_cuts",
      "kind": "attachment",
      "title": "PySceneDetect0.7.1 detect-adaptive候选",
      "locator": "CSV scenes1至10；扫描原文件1253帧；原视频24fps；CLI场景号一基",
      "accessedAt": "2026-10-01",
      "verificationScope": "实际本地算法扫描完整文件并输出9候选边界/10区间。仅13.875/13.916667相邻画面变化经模型静帧核对；不称全部切点已人工确认。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "attachmentId": "att_4cb6875ac64cf0732df03826cd38f4a59be49c78"
    },
    {
      "sourceId": "src_av_w3c",
      "kind": "external",
      "title": "W3C HTML Wiki：video元素官方演示",
      "locator": "Example：video/source src=http://media.w3.org/2010/05/sintel/trailer.mp4",
      "accessedAt": "2026-10-01",
      "verificationScope": "实际查阅官方示例页，核对相同公开视频链接；不是影片分析来源。",
      "licenseStatus": "说明页自身版权范围与影片许可分开；本例影片许可见Commons对应文件及Blender说明。",
      "uri": "https://www.w3.org/html/wiki/Elements/video.html"
    },
    {
      "sourceId": "src_av_license",
      "kind": "external",
      "title": "Sintel Trailer来源与许可记录",
      "locator": "Summary、Licensing、Metadata；作者Durian Open Movie project；CC BY3.0；© Blender Foundation",
      "accessedAt": "2026-10-01",
      "verificationScope": "实际读取Commons对应预告来源/许可正文及文件元数据，52秒及标题/作者/版权与W3C MP4一致；未逐字节比对OGV和MP4或取得Blender官网原文件。Blender官方Sharing/About仅能读搜索索引，目录403后未绕过。",
      "licenseStatus": "CC BY 3.0；© copyright Blender Foundation | www.sintel.org。本例取W3C公开演示镜像；关键帧为原片截取，联系表缩放并加PTS标签。署名、许可链接及改动说明须随成果保存。",
      "uri": "https://commons.wikimedia.org/wiki/File:Sintel_trailer-1080p.ogv"
    }
  ],
  "researchStatus": "paused",
  "materialVersions": [
    {
      "materialId": "mat_3f263ab2-db5a-4afc-9736-1ac20f8719e3",
      "revision": 1
    }
  ],
  "author": "ai"
}
~~~~


## 记录 7：stage_74251649-5ebf-4f07-94df-76d986d84d6c

- `id`：stage_74251649-5ebf-4f07-94df-76d986d84d6c
- `topic_id`：topic_cf59a04b-6909-4e3e-b683-3035ae49ea8e
- `topic_revision`：2
- `created_at`：2026-10-02T04:59:45.181Z

### 原字段 `body_json`

~~~~json
{
  "focus": "第一章完整读后形成自足概要、必要英文选段与本执行者自译，区分本章停点和全书未知。",
  "confirmed": [
    "实际完整读PG11第一章，未把下一章或全书内容写入。",
    "怀表触发追逐；花园小门、变小与桌面钥匙形成连续阻碍。",
    "章末仅写吃完蛋糕，变化结果不在本章。",
    "中文引句是本执行者新译，原始个人感受留空。"
  ],
  "candidates": [
    "空间与道具关系变化可作为创作形式候选，未采用。"
  ],
  "parked": [
    "全书故事、纸本校勘、原版插图与其他译本比较。"
  ],
  "unknown": [
    "吃完蛋糕后的变化在所选第一章中未写；本轮不概述下一章。",
    "未核纸本原页与原版插图许可。"
  ],
  "nextStep": "若用户要接续，先选择继续读第二章或校订一处自译；否则本章阶段停在吃完蛋糕。",
  "limitations": [
    "AI测试示范，非小陌原话、阅读经历或学习成果。",
    "只已读第一章；仅自译必要引句，非全书或全章完整译本。",
    "只核电子文本与目录，未核纸本原页；PG公版标记范围是美国。"
  ],
  "paragraphs": [
    {
      "paragraphId": "para_alice_preview",
      "heading": "收藏预览",
      "markdown": "爱丽丝追着一只掏出怀表的兔子掉进地底，找到通向花园的小门，却在身体大小与钥匙位置之间接连碰壁；这里只读《爱丽丝梦游仙境》第一章。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_alice_text",
          "locator": "A04 / alice-pg11.txt L74–84；A06 / alice-pg11.txt L89–92",
          "note": "兔子的怀表触发追逐，兔子洞转为深井。"
        },
        {
          "sourceId": "src_alice_text",
          "locator": "A14 / alice-pg11.txt L165–172；A15 / alice-pg11.txt L174–184；A20 / alice-pg11.txt L221–229；A21 / alice-pg11.txt L231–238",
          "note": "小门、身体与钥匙构成第一章已写明的阻碍。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_alice_overview",
      "heading": "内容概要",
      "markdown": "这份书例来自 Lewis Carroll 的《Alice’s Adventures in Wonderland》（《爱丽丝梦游仙境》），范围是第一章 Down the Rabbit-Hole，章名在这里自译为“掉进兔子洞”。\n\n爱丽丝和姐姐坐在河岸上，天气热，她无聊又犯困；一只白兔从身旁跑过。兔子自言自语说要迟到，她当时还觉得自然，直到它从背心口袋掏出怀表，她才追上去，跟着钻进兔子洞，没想怎样出来。洞穴突然转成深井，她一路下落，却有空看书架和地图，拿起一个空果酱罐，又担心砸到下面的人而把罐子放回柜子。她还说起课堂里的地理词语、家里的猫 Dinah，半睡半醒时落在枯枝干叶上，没有受伤。\n\n继续追兔子后，她来到一间四周门都锁着的大厅，找到玻璃桌上的金钥匙；钥匙只配一扇藏在帘后的小门。门后是她想去的花园，但门太小，连头也过不去。她发现标着“DRINK ME”（喝我）的瓶子，先检查是否写着“poison”（毒药），尝过后喝完，身体缩到十英寸高。这回身体合适了，她却把钥匙留在高高的桌面，既够不到，也爬不上光滑的桌腿，只能坐下哭，又劝自己别哭。\n\n接着她找到写着“EAT ME”（吃我）的蛋糕：长大便可以够钥匙，变小便可以从门下钻过，她觉得两种变化都能帮忙。咬了一点后她没有变大或变小，反而惊讶事情这么寻常，于是把蛋糕吃完。第一章就在这里结束，没有交代吃完整块蛋糕的效果，也还没有写她进入花园；本例不概述第二章或全书结局。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_alice_text",
          "locator": "A01 / alice-pg11.txt L58–59",
          "note": "章名和范围。"
        },
        {
          "sourceId": "src_alice_text",
          "locator": "A02 / alice-pg11.txt L62–66；A03 / alice-pg11.txt L68–72；A04 / alice-pg11.txt L74–84；A05 / alice-pg11.txt L86–87；A06 / alice-pg11.txt L89–92；A07 / alice-pg11.txt L94–104；A09 / alice-pg11.txt L111–121；A10 / alice-pg11.txt L123–132；A11 / alice-pg11.txt L134–148；A12 / alice-pg11.txt L150–158",
          "note": "开场、追逐、下落与落地；未补全书框架。"
        },
        {
          "sourceId": "src_alice_text",
          "locator": "A13 / alice-pg11.txt L160–163；A14 / alice-pg11.txt L165–172；A15 / alice-pg11.txt L174–184；A16 / alice-pg11.txt L186–192；A17 / alice-pg11.txt L194–204；A18 / alice-pg11.txt L206–209；A19 / alice-pg11.txt L218–219；A20 / alice-pg11.txt L221–229；A21 / alice-pg11.txt L231–238；A22 / alice-pg11.txt L240–249",
          "note": "大厅、小门、瓶子、缩小及够不到钥匙。"
        },
        {
          "sourceId": "src_alice_text",
          "locator": "A23 / alice-pg11.txt L251–256；A24 / alice-pg11.txt L258–264；A25 / alice-pg11.txt L266–266",
          "note": "蛋糕的两种打算、第一口无变化与本章收尾。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_alice_trigger",
      "heading": "从一块怀表追进兔子洞",
      "markdown": "让她行动的细节，是兔子从背心口袋里掏出怀表。原文先写她听见兔子说话仍觉得自然，再写这件随身物品使她突然站起、追赶。她跟进洞时并没有计划退路。\n\n> In another moment down went Alice after it, never once considering how in the world she was to get out again.\n\n**本执行者自译：**转眼间，爱丽丝也跟着下了洞，一次也没想过自己究竟怎样才能再出来。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_alice_text",
          "locator": "A04 / alice-pg11.txt L74–84；A05 / alice-pg11.txt L86–87",
          "note": "原文的注意与行动先后；引句A05自译。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_alice_fall",
      "heading": "漫长下落里的日常念头",
      "markdown": "下落没有很快结束。井壁上有柜子、书架、地图和图片；她甚至有时间拿罐子，再安置它。她谈起地理知识，正文却提醒她并不懂经纬度，只觉得这些词说出来很气派。随后猫吃蝙蝠、蝙蝠吃猫的念头在困意里倒来倒去，她落到枯枝和干叶上。\n\n> She took down a jar from one of the shelves as she passed; it was labelled “ORANGE MARMALADE”, but to her great disappointment it was empty: she did not like to drop the jar for fear of killing somebody underneath, so managed to put it into one of the cupboards as she fell past it.\n\n**本执行者自译：**她经过一个架子时取下一个罐子，上面写着“橘子果酱”，可让她很失望的是，罐子是空的。她怕把罐子扔下去会砸死下面的人，便在继续往下落时，设法把它放进一个柜子里。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_alice_text",
          "locator": "A06 / alice-pg11.txt L89–92；A07 / alice-pg11.txt L94–104；A09 / alice-pg11.txt L111–121；A10 / alice-pg11.txt L123–132；A11 / alice-pg11.txt L134–148；A12 / alice-pg11.txt L150–158",
          "note": "物件、地理词语、猫与蝙蝠、落地；原文A07空罐句自译。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_alice_door",
      "heading": "看得见的花园，过不去的小门",
      "markdown": "落地后她仍追着兔子跑，转过弯却看不见它了。大厅中的门都锁着，金钥匙终于打开帘后约十五英寸高的小门。她能看到花和喷泉，却连头都伸不过去；有钥匙，仍不等于能通过门。她开始希望自己能像可收拢的望远镜一样变小。\n\n> Oh, how I wish I could shut up like a telescope! I think I could, if I only knew how to begin.\n\n**本执行者自译：**啊，我多希望能像望远镜那样收拢起来！我想我能做到，只要知道该怎么开始。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_alice_text",
          "locator": "A12 / alice-pg11.txt L150–158；A13 / alice-pg11.txt L160–163；A14 / alice-pg11.txt L165–172；A15 / alice-pg11.txt L174–184",
          "note": "追丢兔子、大厅、小门与望远镜愿望；原文A15自译。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_alice_key",
      "heading": "变小解决一件事，又制造另一件事",
      "markdown": "她回到桌边，发现带“喝我”标签的瓶子。她先看有没有毒药标记，再尝味道；喝完后真的缩到十英寸高。她等了一会儿，确认没有继续缩小，才再去小门，可钥匙还在桌上。\n\n> “What a curious feeling!” said Alice; “I must be shutting up like a telescope.”\n\n**本执行者自译：**“这感觉真奇怪！”爱丽丝说，“我一定是在像望远镜那样收拢起来。”\n\n正文紧接着写：她看得见桌面上的钥匙，却够不到；玻璃桌腿又滑，试着往上爬也没有成功。她坐下哭，又用严厉的口气劝自己。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_alice_text",
          "locator": "A16 / alice-pg11.txt L186–192；A17 / alice-pg11.txt L194–204；A18 / alice-pg11.txt L206–209；A19 / alice-pg11.txt L218–219；A20 / alice-pg11.txt L221–229；A21 / alice-pg11.txt L231–238；A22 / alice-pg11.txt L240–249",
          "note": "瓶子、检查、缩小、自译句、钥匙与自我劝说。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_alice_cake",
      "heading": "蛋糕把结果留在章外",
      "markdown": "> Soon her eye fell on a little glass box that was lying under the table: she opened it, and found in it a very small cake, on which the words “EAT ME” were beautifully marked in currants. “Well, I’ll eat it,” said Alice, “and if it makes me grow larger, I can reach the key; and if it makes me grow smaller, I can creep under the door; so either way I’ll get into the garden, and I don’t care which happens!”\n\n**本执行者自译：**很快，她看见桌子下面放着一个小玻璃盒。打开一看，里面是一块很小的蛋糕，上面用葡萄干漂亮地拼着“吃我”两个字。“好吧，我就吃它，”爱丽丝说，“如果它让我长大，我就能够到钥匙；如果让我变小，我就能从门下面钻过去。所以不管哪一种，我都能进花园，我不在乎会发生哪一种！”\n\n她先吃一点，手放在头顶检查大小，却没有变化。通常吃蛋糕本就如此，但此时她已经习惯期待奇怪的事，反倒觉得照常发展乏味。章末只有一句：\n\n> So she set to work, and very soon finished off the cake.\n\n**本执行者自译：**于是她动手吃起来，很快就把蛋糕全吃完了。\n\n本章没有交代吃完后的结果，本次停在这里。这里保留这个停点，不把全书熟悉的情节提前塞回第一章。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_alice_text",
          "locator": "A23 / alice-pg11.txt L251–256；A24 / alice-pg11.txt L258–264；A25 / alice-pg11.txt L266–266",
          "note": "蛋糕选择、第一口不变与吃完收尾；A23和A25自译。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_alice_analysis",
      "heading": "研究解释：目标没变，障碍不断换位置",
      "markdown": "这一章的花园目标比较稳定，阻碍却接连转移：找不到出口→找到了门却身体过大→身体适合却够不到钥匙。作为本执行者的形式分析，这让“变小”既是一次成功，又是下一次失败的条件。它可以解释为什么几个普通物件能持续推动动作，但不能据此断言作者写作时的心理或唯一寓意。\n\n另一条可读线索是她带着日常判断进入不寻常环境：怕罐子砸到人、检查瓶子、计算两种身体变化的用处。这些判断并没有让她完全控制局面。把她简单说成“没有思考就乱来”，会漏掉原文实际写出的犹豫与推算。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "src_alice_text",
          "locator": "A07 / alice-pg11.txt L94–104；A14 / alice-pg11.txt L165–172；A15 / alice-pg11.txt L174–184；A17 / alice-pg11.txt L194–204；A20 / alice-pg11.txt L221–229；A21 / alice-pg11.txt L231–238；A23 / alice-pg11.txt L251–256",
          "note": "当前解释依据是物件关系和已写出的判断，不等于作者自述。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_alice_creation",
      "heading": "创作联想（候选）：让同一物件改变用途",
      "markdown": "可借用的是一种小范围场景结构：先固定一个想去的地方，再让身体、门与钥匙之间的关系变化。钥匙先是希望，之后成了看得见却拿不到的东西；并不需要增加很多地点，行动条件已能发生变化。\n\n这只是 AI 提出的形式候选，适合检验空间与道具如何制造阻碍，尚未采用，也不是小陌的个人兴趣或创作决定。若以后要做改编，仍须另定具体版本、画面方案与使用范围。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "src_alice_text",
          "locator": "A14 / alice-pg11.txt L165–172；A15 / alice-pg11.txt L174–184；A20 / alice-pg11.txt L221–229；A21 / alice-pg11.txt L231–238；A23 / alice-pg11.txt L251–256",
          "note": "候选只来自本章门、身体、钥匙的关系；未生成剧本或采用决定。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_alice_version",
      "heading": "这次读的是哪份文字",
      "markdown": "本次读的是 Project Gutenberg 编号11的英文电子文本，署名 Lewis Carroll，页面标 THE MILLENNIUM FULCRUM EDITION 3.0。网页与下载文本均可定位第一章；本次没有查纸本原页或其他译本，也没有采用网页封面去冒充原版插图。\n\n目录将这部电子书标为美国公版（Public domain in the USA）；电子书头部另提示美国以外使用须核当地法律。中文引句译文由本执行者依据这些英文选段新译，不是某一现有中文译本。这里不据公版英文状态替现代译本、影视改编或不明插图声明许可。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_alice_html",
          "locator": "正文前署名与 THE MILLENNIUM FULCRUM EDITION 3.0；CHAPTER I. / Down the Rabbit-Hole",
          "note": "支持英文页面版本署名与第一章身份。"
        },
        {
          "sourceId": "src_alice_catalog",
          "locator": "About this eBook: Author / Title / Copyright",
          "note": "支持作者、作品、美国公版标记；未采用自动摘要作历史论据。"
        },
        {
          "sourceId": "src_alice_html",
          "locator": "电子书开头使用说明，紧接 The Project Gutenberg eBook 标题",
          "note": "支持PG对非美国使用的当地法律提示。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_alice_method",
      "heading": "方法与读取记录",
      "markdown": "这是经授权制作的 AI 测试示范，不是小陌原话、个人兴趣、真实阅读经历或已采用创作计划。\n\n本执行者于2026-10-02下载 PG11 HTML、UTF-8文本和目录，实际逐段完整阅读第一章，范围为 alice-pg11.txt L58–276（章标题至第二章标题之前）；正文首句“Alice was beginning…”至“So she set to work, and very soon finished off the cake.”。原书其他章节虽在验证下载文件中，未作为本案例已读范围，也不导入素材库。\n\n待导入附件只含这一章英文，换行统一LF、保留原文下划线强调和星号分隔；英文下载原件SHA256为01b38ea4c710a84bc18d0bd41271a5a1a92b94e97b2812f4dece97d4a694725e，单章附件SHA256为25f4343a0369c3eb47cbd7027fe4226daf493ae0391e7ca442aab8ce615db242。正文只取必要引句逐段自译，不宣称已译完整章或完整书。没有调用OCR、ASR或外部模型；未核纸本与原版插图。\n\n若接续，先明确是继续读第二章、校订某一自译句，还是只讨论本章道具结构；本轮不自动扩展到全书。",
      "basisKind": "demo",
      "sourceRefs": [
        {
          "sourceId": "src_alice_text",
          "locator": "A01 / alice-pg11.txt L58–59；A02 / alice-pg11.txt L62–66；A25 / alice-pg11.txt L266–266",
          "note": "实际读取的起点与终点。"
        },
        {
          "sourceId": "src_alice_snapshot",
          "locator": "单章英文附件全部；下载原文 L58–276",
          "note": "保存已读文本范围供核查，不包含其他章节。"
        }
      ],
      "attachmentIds": [
        "att_8aaadf5c4ef7453e8904b6ccdae2353a88dd630e"
      ]
    }
  ],
  "sources": [
    {
      "sourceId": "src_alice_text",
      "kind": "external",
      "title": "Lewis Carroll：Alice’s Adventures in Wonderland，第一章英文",
      "locator": "PG11 / CHAPTER I. Down the Rabbit-Hole / UTF-8快照 L58–276",
      "accessedAt": "2026-10-02T02:29:54.738141+00:00",
      "verificationScope": "实际完整读第一章，正文A02–A25；下一章L277起排除。下载SHA256 01b38ea4c710a84bc18d0bd41271a5a1a92b94e97b2812f4dece97d4a694725e。",
      "licenseStatus": "PG目录标Public domain in the USA；本轮必要英文引句与本执行者自译，不含现代中文译本。",
      "uri": "https://www.gutenberg.org/cache/epub/11/pg11.txt"
    },
    {
      "sourceId": "src_alice_html",
      "kind": "external",
      "title": "PG11 HTML：所读版本标题、署名与使用说明",
      "locator": "正文前署名/版本；CHAPTER I；电子书头部使用说明",
      "accessedAt": "2026-10-02T02:29:54.738141+00:00",
      "verificationScope": "实际读署名、版本标题、使用说明与第一章；未据自动摘要确证历史或插图身份。",
      "licenseStatus": "PG电子书使用条款；美国以外按页头提示核当地法律。",
      "uri": "https://www.gutenberg.org/cache/epub/11/pg11-images.html"
    },
    {
      "sourceId": "src_alice_catalog",
      "kind": "external",
      "title": "PG11目录：作者、书名与版权状态",
      "locator": "About this eBook / Author / Title / Copyright",
      "accessedAt": "2026-10-02T02:29:54.738141+00:00",
      "verificationScope": "实际核目录结构化元数据；未使用自动生成摘要作为原书事实。",
      "licenseStatus": "目录标Public domain in the USA；现代目录只少量转述元数据。",
      "uri": "https://www.gutenberg.org/ebooks/11"
    },
    {
      "sourceId": "src_alice_snapshot",
      "kind": "attachment",
      "title": "第一章英文范围快照",
      "locator": "Alice-第一章-公版英文原文.txt 全部",
      "accessedAt": "2026-10-02T02:29:54.738141+00:00",
      "verificationScope": "只含PG11第一章，下载文本L58–276；控制导入前显式asset slot待根替换。",
      "licenseStatus": "PG11美国公版英文单章；不含现代译文或未核许可图。",
      "attachmentId": "att_8aaadf5c4ef7453e8904b6ccdae2353a88dd630e"
    }
  ],
  "researchStatus": "stage_complete",
  "materialVersions": [
    {
      "materialId": "mat_4b195358-b0d9-4dcf-a4ee-5396edc65379",
      "revision": 1
    }
  ],
  "author": "ai"
}
~~~~


## 记录 8：stage_8e8bdf0e-80eb-4d23-bc59-9b84ba47b3aa

- `id`：stage_8e8bdf0e-80eb-4d23-bc59-9b84ba47b3aa
- `topic_id`：topic_de84a67c-2fc8-413d-b594-60dadeea6a04
- `topic_revision`：2
- `created_at`：2026-10-02T04:59:45.244Z

### 原字段 `body_json`

~~~~json
{
  "focus": "完整读一篇民间故事英译后，交代结伴、两次强盗误认和留居结局，配必要原文与本执行者自译。",
  "confirmed": [
    "完整读PG5314第27篇B01–B20，采用正文明确含Bremen的Margaret Hunt英译。",
    "狗、猫、公鸡受威胁原因不同，未把公鸡也说成年老。",
    "四只动物以自己的叫声合声并闯窗吓退强盗，半夜来人又误认动物。",
    "结尾留在强盗屋，没有写抵达不来梅获聘或登台。"
  ],
  "candidates": [
    "实际动作与被惊吓者报告的两套叙述，可作为形式候选，未采用。"
  ],
  "parked": [
    "德文原件、格林版本演变、民间传播史与原版插图。"
  ],
  "unknown": [
    "未核英译与德文原件之间的措辞差异。",
    "未核宗教话语对应的历史习俗或作者唯一寓意。"
  ],
  "nextStep": "若接续，先选择校订一处自译或讨论动物动作和强盗报告的对应；否则本篇阶段停在四动物留居屋中。",
  "limitations": [
    "AI测试示范，非小陌原话、阅读经历或学习成果。",
    "已完整读本篇英文；中文只自译必要选段，并非完整中文译本。",
    "未核德文、格林各版与传播史；PG公版标记范围是美国。"
  ],
  "paragraphs": [
    {
      "paragraphId": "para_bremen_preview",
      "heading": "收藏预览",
      "markdown": "驴、狗、猫和公鸡结伴去不来梅做乐手，途中用合声吓跑强盗，最终在那座房子安顿下来；这是已完整读过的格林短篇英译本。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_bremen_text",
          "locator": "B01 / bremen-pg5314.txt L4328–4336；B03 / bremen-pg5314.txt L4342–4344；B07 / bremen-pg5314.txt L4358–4359；B10 / bremen-pg5314.txt L4373–4376",
          "note": "同伴与不来梅目标。"
        },
        {
          "sourceId": "src_bremen_text",
          "locator": "B14 / bremen-pg5314.txt L4401–4405；B15 / bremen-pg5314.txt L4407–4414；B20 / bremen-pg5314.txt L4446–4449",
          "note": "驱走强盗与留在屋中的结局。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_bremen_overview",
      "heading": "内容概要",
      "markdown": "《不来梅的城市乐手》在这里指格林署名故事集 Household Tales 的第27篇 The Bremen Town-Musicians，读的是 Margaret Hunt 英译，整篇已经读到结尾。\n\n一头多年背谷物去磨坊的驴年老力衰，主人想省下养它的费用；它看出处境不妙，离开家，打算去不来梅当城市乐手。路上它邀三位同伴同行：老猎狗再也不能打猎，主人想杀它；老猫牙齿磨坏、不愿再捉鼠，女主人想淹死它；公鸡则将被宰来给客人煮汤。驴用一起做音乐的前景劝它们离开，四只动物结伴走了一天，晚上还没到不来梅，只好进森林过夜。\n\n公鸡在树顶看见远处灯光，它们循光找到一座强盗的房子，窗内的桌上满是食物。为赶走强盗，它们商量叠在一起：驴前脚搭窗沿，狗站上驴背，猫站在狗上，公鸡飞到猫头上。驴叫、狗吠、猫叫、鸡啼同时响起，它们又冲破窗玻璃闯进去，强盗以为鬼来了，逃进森林。四只动物吃完桌上的食物，熄灯睡下：驴睡院里的草堆，狗在门后，猫靠炉灰，公鸡在屋梁上。\n\n半夜，强盗头领派一人回来查看；来人把猫发亮的眼睛当作炭火，凑过去点火柴，被猫抓了脸。他逃向后门被狗咬腿，跑过院子又被驴踢，惊醒的公鸡从梁上打鸣。他回去却把这些经历说成女巫、持刀的人、拿棍的黑怪物，还有喊着捉坏人的法官。强盗此后不敢再回来，四只动物觉得房子合适，也不愿再走。故事没有写它们抵达不来梅或得到城市乐手的职位；标题中的目的地，最后没有成为它们的落脚处。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_bremen_html",
          "locator": "正文前 Translated by Margaret Hunt；第27篇标题 27 The Bremen Town-Musicians",
          "note": "支持读的英文版本与短篇身份；不是德文原件。"
        },
        {
          "sourceId": "src_bremen_text",
          "locator": "B01 / bremen-pg5314.txt L4328–4336；B02 / bremen-pg5314.txt L4338–4340；B03 / bremen-pg5314.txt L4342–4344；B06 / bremen-pg5314.txt L4352–4356；B07 / bremen-pg5314.txt L4358–4359；B09 / bremen-pg5314.txt L4366–4371；B10 / bremen-pg5314.txt L4373–4376；B11 / bremen-pg5314.txt L4378–4388",
          "note": "四动物受威胁原因、邀请与未到不来梅。"
        },
        {
          "sourceId": "src_bremen_text",
          "locator": "B12 / bremen-pg5314.txt L4390–4393；B13 / bremen-pg5314.txt L4395–4399；B14 / bremen-pg5314.txt L4401–4405；B15 / bremen-pg5314.txt L4407–4414；B16 / bremen-pg5314.txt L4416–4421",
          "note": "强盗屋、共同计划、合声闯窗与睡处。"
        },
        {
          "sourceId": "src_bremen_text",
          "locator": "B17 / bremen-pg5314.txt L4423–4426；B18 / bremen-pg5314.txt L4428–4436；B19 / bremen-pg5314.txt L4438–4444；B20 / bremen-pg5314.txt L4446–4449",
          "note": "强盗返回、动物反应、误认与故事结局。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_bremen_departure",
      "heading": "离开各自的危险，先一起上路",
      "markdown": "驴的出走先开始：它多年替主人把谷物运到磨坊，力气渐弱，察觉主人开始盘算养它的开支。它不再等着被处置，先走上去不来梅的路。后遇到的狗和猫都因为年老失去原来的用处；公鸡面对的是被做成汤的危险，正文没有说它年老。\n\n> “Ah,” replied the hound, “as I am old, and daily grow weaker, and no longer can hunt, my master wanted to kill me, so I took to flight; but now how am I to earn my bread?”\n\n**本执行者自译：**“唉，”猎狗回答，“我老了，一天比一天虚弱，再也不能打猎，主人想杀掉我，所以我逃了出来。可现在，我该怎样挣口饭吃呢？”\n\n驴把“去做乐手”说成一条可以结伴尝试的出路。它向狗提议自己弹琉特琴（一种拨弦乐器）、狗敲定音鼓；对猫则说它懂夜间音乐；见到公鸡时，还劝它离开。此后真正赶走强盗的是动物各自的叫声，并没有写它们拿到乐器演奏。\n\n> you can find something better than death everywhere\n\n**本执行者自译：**到哪儿都能找到比死更好的事。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_bremen_text",
          "locator": "B01 / bremen-pg5314.txt L4328–4336；B02 / bremen-pg5314.txt L4338–4340；B03 / bremen-pg5314.txt L4342–4344；B06 / bremen-pg5314.txt L4352–4356；B07 / bremen-pg5314.txt L4358–4359；B09 / bremen-pg5314.txt L4366–4371；B10 / bremen-pg5314.txt L4373–4376；B15 / bremen-pg5314.txt L4407–4414",
          "note": "出走、危险差异、乐器只在提议中、实际叫声；B02与B10原句自译。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_bremen_window",
      "heading": "灯光引出一座房子",
      "markdown": "它们一天走不到不来梅，就在森林里找地方睡。公鸡待在树顶，看见远处一点灯光；驴觉得原处遮蔽不好，狗想到带肉的骨头，于是四只动物一起循光前去。\n\n屋里是强盗和一桌吃喝。四只动物并不是先受邀进去，而是在窗外商量怎样把强盗赶走。叠起来的顺序在正文中写得很具体：\n\n> Then the animals took counsel together how they should manage to drive away the robbers, and at last they thought of a plan. The donkey was to place himself with his fore-feet upon the window-ledge, the hound was to jump on the donkey’s back, the cat was to climb upon the dog, and lastly the cock was to fly up and perch upon the head of the cat.\n\n**本执行者自译：**动物们一起商量怎样赶走强盗，终于想出一个办法。驴把前脚搭在窗沿上，猎狗跳到驴背上，猫爬上狗身，最后公鸡飞起来，停在猫的头上。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_bremen_text",
          "locator": "B11 / bremen-pg5314.txt L4378–4388；B12 / bremen-pg5314.txt L4390–4393；B13 / bremen-pg5314.txt L4395–4399；B14 / bremen-pg5314.txt L4401–4405",
          "note": "循光原因、强盗与窗外叠放计划；B14全文自译。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_bremen_noise",
      "heading": "四种叫声被听成“鬼来了”",
      "markdown": "> When this was done, at a given signal, they began to perform their music together: the donkey brayed, the hound barked, the cat mewed, and the cock crowed; then they burst through the window into the room, so that the glass clattered! At this horrible din, the robbers sprang up, thinking no otherwise than that a ghost had come in, and fled in a great fright out into the forest.\n\n**本执行者自译：**一切就位后，听到约定的信号，它们便一起演奏起自己的音乐：驴嘶叫，猎狗吠，猫喵叫，公鸡啼鸣；随后它们撞穿窗子闯进屋内，玻璃哗啦作响！强盗被这可怕的喧闹吓得跳起来，只以为有鬼闯了进来，惊恐地逃到森林中。\n\n强盗眼中的“鬼”，与读者知道的四只动物是两回事。正文没有让鬼真正出现。动物吃下桌上剩的食物，然后熄灯，各找适合自己的位置睡觉：驴在院中草堆，狗在门后，猫在暖炉灰旁，公鸡在屋梁。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_bremen_text",
          "locator": "B15 / bremen-pg5314.txt L4407–4414；B16 / bremen-pg5314.txt L4416–4421",
          "note": "合声、闯窗、强盗误认、进食与睡处；B15必要两句自译。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_bremen_return",
      "heading": "半夜回来的人，只看懂了自己的恐惧",
      "markdown": "过了午夜，强盗头领发现房子已经熄灯安静下来，让一人回去探查。这一回四只动物正在睡觉；正文没有写它们预先商量了第二次埋伏。\n\n> The messenger finding all still, went into the kitchen to light a candle, and, taking the glistening fiery eyes of the cat for live coals, he held a lucifer-match to them to light it. But the cat did not understand the joke, and flew in his face, spitting and scratching. He was dreadfully frightened, and ran to the back-door, but the dog, who lay there sprang up and bit his leg; and as he ran across the yard by the straw-heap, the donkey gave him a smart kick with its hind foot. The cock, too, who had been awakened by the noise, and had become lively, cried down from the beam, “Cock-a-doodle-doo!”\n\n**本执行者自译：**来探查的人见四下安静，就进厨房想点一支蜡烛。他把猫闪着亮光的眼睛当成还燃着的炭，拿火柴凑过去点。猫可不懂这玩笑，扑到他脸上，又吐气又抓挠。他吓坏了，跑向后门，躺在那里的狗跳起来咬住他的腿；等他跑过院子里的草堆，驴又用后蹄狠狠踢了他一下。公鸡也被吵醒，来了精神，在梁上朝下叫：“喔喔喔！”\n\n叙述让读者看清每个动作的实际来源，随后才听来人的另一套说法：",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_bremen_text",
          "locator": "B16 / bremen-pg5314.txt L4416–4421；B17 / bremen-pg5314.txt L4423–4426；B18 / bremen-pg5314.txt L4428–4436",
          "note": "睡处、被派回来、猫眼误认和连串动物反应；B18全文自译。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_bremen_ending",
      "heading": "没到目的地，却有了能留下的地方",
      "markdown": "> “Ah, there is a horrible witch sitting in the house, who spat on me and scratched my face with her long claws; and by the door stands a man with a knife, who stabbed me in the leg; and in the yard there lies a black monster, who beat me with a wooden club; and above, upon the roof, sits the judge, who called out, ‘Bring the rogue here to me!’ so I got away as well as I could.”\n\n**本执行者自译：**“啊，屋里坐着个可怕的女巫，她朝我吐唾沫，还用长爪子抓我的脸；门边站着个拿刀的人，刺了我的腿；院子里卧着个黑怪物，用木棍打我；上面屋顶还坐着法官，喊着：‘把那坏家伙带到我这里来！’所以我拼命逃出来了。”\n\n女巫对应猫，持刀的人对应狗，拿棍的黑怪物对应驴，法官的命令对应公鸡的啼叫。这些是强盗向同伴讲述时的误认，不能照字面当成真实人物新增进故事。此后强盗再也不敢回屋，四只动物也不愿离开。\n\n> After this the robbers did not trust themselves in the house again; but it suited the four musicians of Bremen so well that they did not care to leave it any more. And the mouth of him who last told this story is still warm.\n\n**本执行者自译：**从此，强盗们再也不敢进那座房子；而这地方太合四位不来梅乐手的心意，他们不愿再离开了。最后一个讲这故事的人，嘴还热着呢。\n\n最后一句是讲述者的收尾说法，故事里的行动已经停在动物留居屋中。它们去不来梅的打算促成结伴，结尾却没有写到那里获聘或登台。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_bremen_text",
          "locator": "B18 / bremen-pg5314.txt L4428–4436；B19 / bremen-pg5314.txt L4438–4444；B20 / bremen-pg5314.txt L4446–4449",
          "note": "实际动物、误认版本和完整收尾；B19话语与B20全文自译。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_bremen_analysis",
      "heading": "研究解释：读者知道的，比强盗看见的多",
      "markdown": "作为本执行者的形式分析，短篇两次利用同一个差距：读者知道在场的是动物，强盗却把混合叫声当成鬼，把夜里的抓、咬、踢、啼解释为女巫、刀手、怪物和法官。第二次没有换成更强大的敌人，而是换了来人的观察条件与讲述。\n\n“乐手”也有两层：上路时是它们对未来工作的想象；赶走强盗时，各自的叫声被叙述称作音乐，却使对方害怕。可以据此讨论它们如何把原有声音组合起来，不能断言它们获得了专业演奏能力，也不把故事当作作者已阐明的某一种社会寓意。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "src_bremen_text",
          "locator": "B03 / bremen-pg5314.txt L4342–4344；B07 / bremen-pg5314.txt L4358–4359；B10 / bremen-pg5314.txt L4373–4376；B14 / bremen-pg5314.txt L4401–4405；B15 / bremen-pg5314.txt L4407–4414；B18 / bremen-pg5314.txt L4428–4436；B19 / bremen-pg5314.txt L4438–4444",
          "note": "形式解释依据邀请、组合叫声和两次误认；不等于格林或译者的自述。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_bremen_creation",
      "heading": "创作联想（候选）：同一动作，两套叙述",
      "markdown": "一个可能可用的结构，是先让读者清楚看见真实动作，再听受到惊吓的人如何报告它。抓脸、咬腿、踢一下和公鸡叫，不必增加超自然角色，就能形成第二套夸张叙述。使用时要让对应关系仍可辨认，否则误认只剩随机怪话。\n\n另一个候选是让出发目标与最终安顿地不同：去不来梅的共同打算使它们同行，但屋子满足了当下的食物和住处需要。这里只登记可讨论的结构，不替小陌确定寓意、兴趣、改编方向或作品方案。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "src_bremen_text",
          "locator": "B01 / bremen-pg5314.txt L4328–4336；B10 / bremen-pg5314.txt L4373–4376；B11 / bremen-pg5314.txt L4378–4388；B15 / bremen-pg5314.txt L4407–4414；B16 / bremen-pg5314.txt L4416–4421；B18 / bremen-pg5314.txt L4428–4436；B19 / bremen-pg5314.txt L4438–4444；B20 / bremen-pg5314.txt L4446–4449",
          "note": "候选依据动物动作与强盗报告，以及目的地和收尾的差别。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_bremen_version",
      "heading": "所读版本与自译边界",
      "markdown": "来源是 Project Gutenberg 编号5314的 Household Tales by Brothers Grimm。正文前署 Jacob Grimm、Wilhelm Grimm，并写“Translated by Margaret Hunt”；目录中的译者以 Mrs. Alfred William Hunt 的形式登记。本文只处理这份英语译文里的第27篇，未读取德文原件、格林各版或其他民间讲述来对比。\n\n网页目录和本篇标题直接出现 Bremen，所以这里采用《不来梅的城市乐手》作为中文辨认名。中文引句全部由本执行者根据本次所读英文自译，不摘用既有中文译本。英语中的玩笑、宗教话语和旧式措辞仅按所读文本定位，不据它们补充未查的历史习俗。\n\nPG目录将此电子书标为美国公版（Public domain in the USA），电子书头部另有美国以外使用须核当地法律的提示。这个标记不自动覆盖现代中文译本、插图、音乐或改编作品；本次附件只包含这篇英文。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_bremen_html",
          "locator": "署名及 Translated by Margaret Hunt；目录链接 #chap27；正文 27 The Bremen Town-Musicians",
          "note": "支持格林署名、Margaret Hunt与含Bremen的本篇身份。"
        },
        {
          "sourceId": "src_bremen_catalog",
          "locator": "About this eBook / Authors / Translator / Title / Copyright",
          "note": "支持目录译者登记形式与美国公版标记；不使用自动摘要补历史。"
        },
        {
          "sourceId": "src_bremen_text",
          "locator": "bremen-pg5314.txt L1–40，电子书头部及署名；L4326–4452，本篇",
          "note": "支持实际所读英文版本和非美国使用提示；宗教话语B09只作为文本出现记录。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_bremen_method",
      "heading": "方法与读取记录",
      "markdown": "这是经授权制作的 AI 测试示范，不是小陌原话、个人兴趣、真实阅读经历或已采用创作计划。\n\n本执行者于2026-10-02下载 PG5314 HTML、UTF-8文本和目录，实际逐段完整读第27篇。范围为 bremen-pg5314.txt L4326–4452，正文从“A certain man had a donkey…”到“And the mouth of him who last told this story is still warm.”；第28篇 The Singing Bone 从L4453起，排除。\n\n待导入附件只含本短篇英文，换行统一LF。原书完整下载文件仅作验证来源，不导入素材库；英文下载原件SHA256为8b8706e4f2fa5558a76252105366bb119b7ef5da942dd36ced88638c64289d99，单篇附件SHA256为d24e6ecd97664bfc73569bb0527ad25ee8175046b019f8ee47e86f887c92f91f。正文只自译必要选句，并非完整中文译本；没有OCR、ASR或外部模型调用，未核德文或原版插图。\n\n若接续，优先选择校订某一英文自译句，或讨论“实际动物动作/强盗报告”的对应；需要版本史或习俗背景时须另行明确范围，不能从这个阶段自动推成已核。",
      "basisKind": "demo",
      "sourceRefs": [
        {
          "sourceId": "src_bremen_text",
          "locator": "B01 / bremen-pg5314.txt L4328–4336；B20 / bremen-pg5314.txt L4446–4449",
          "note": "完整本篇起点与收尾。"
        },
        {
          "sourceId": "src_bremen_snapshot",
          "locator": "Bremen-第27篇-公版英文全文.txt 全部；源下载L4326–4452",
          "note": "只保存完整短篇的实际已读范围。"
        }
      ],
      "attachmentIds": [
        "att_93b5a68ef6f5b87eb68e7d8bdf3901147915ef54"
      ]
    }
  ],
  "sources": [
    {
      "sourceId": "src_bremen_text",
      "kind": "external",
      "title": "格林署名，Margaret Hunt英译：The Bremen Town-Musicians",
      "locator": "PG5314 / 第27篇 / UTF-8快照 L4326–4452",
      "accessedAt": "2026-10-02T02:29:59.198759+00:00",
      "verificationScope": "实际完整读本短篇B01–B20，下一篇L4453起排除；头部署名实际读。下载SHA256 8b8706e4f2fa5558a76252105366bb119b7ef5da942dd36ced88638c64289d99。",
      "licenseStatus": "PG目录标Public domain in the USA；本轮英文单篇和必要自译，不含现有中文译本。",
      "uri": "https://www.gutenberg.org/cache/epub/5314/pg5314.txt"
    },
    {
      "sourceId": "src_bremen_html",
      "kind": "external",
      "title": "PG5314 HTML：译者、目录与本篇正文",
      "locator": "署名与 Translated by Margaret Hunt；#chap27 第27篇",
      "accessedAt": "2026-10-02T02:29:59.198759+00:00",
      "verificationScope": "实际读署名、目录、第27篇全部；未据自动摘要确认版本史或历史习俗。",
      "licenseStatus": "PG电子书条款；美国以外使用提示核当地法律。",
      "uri": "https://www.gutenberg.org/files/5314/5314-h/5314-h.htm#chap27"
    },
    {
      "sourceId": "src_bremen_catalog",
      "kind": "external",
      "title": "PG5314目录：作者、译者与版权状态",
      "locator": "About this eBook / Author / Translator / Title / Copyright",
      "accessedAt": "2026-10-02T02:29:59.198759+00:00",
      "verificationScope": "实际核结构化目录元数据；不把自动摘要作史料。",
      "licenseStatus": "目录标Public domain in the USA；仅少量转述目录元数据。",
      "uri": "https://www.gutenberg.org/ebooks/5314"
    },
    {
      "sourceId": "src_bremen_snapshot",
      "kind": "attachment",
      "title": "第27篇完整英文范围快照",
      "locator": "Bremen-第27篇-公版英文全文.txt 全部",
      "accessedAt": "2026-10-02T02:29:59.198759+00:00",
      "verificationScope": "只含PG5314第27篇，下载文本L4326–4452；控制导入前显式asset slot待根替换。",
      "licenseStatus": "PG5314美国公版英文单篇；不含现代译文或未核许可图。",
      "attachmentId": "att_93b5a68ef6f5b87eb68e7d8bdf3901147915ef54"
    }
  ],
  "researchStatus": "stage_complete",
  "materialVersions": [
    {
      "materialId": "mat_f1aed704-7af5-489e-b07b-3bd1814e6a00",
      "revision": 1
    }
  ],
  "author": "ai"
}
~~~~


## 记录 9：stage_af952b95-6597-4b4c-8025-e26cb42a0fed

- `id`：stage_af952b95-6597-4b4c-8025-e26cb42a0fed
- `topic_id`：topic_9fa4f47b-5773-455b-8c35-ea99329f9164
- `topic_revision`：2
- `created_at`：2026-10-02T04:59:45.603Z

### 原字段 `body_json`

~~~~json
{
  "focus": "视觉图像阅读示范：先说明画面是什么，再读原图、媒材与馆方构图解释，最后区分本轮分析及未采用的形式候选。",
  "confirmed": [
    "对象固定为Met馆藏JP1847／45434，而非所有《神奈川冲浪里》印本。",
    "实际查看一张3859×2594的官方图；可见大浪、三只长船与远处小山形。",
    "馆方断代约1830–1832年，媒材为纸本木版印刷、墨与色；对象API为isPublicDomain=true，开放图政策为CC0。"
  ],
  "candidates": [
    "巨浪弧线、浪尖细碎形态与远处小三角的尺度对照，可作为画面形式候选；未采用。"
  ],
  "parked": [
    "不同印次的色差、收藏史及影响史不纳入本轮。"
  ],
  "unknown": [
    "图中具体航行任务、人物身份及最终结果，本轮材料没有核实。",
    "不能从此数字图恢复原纸在真实光照下的精确色泽。"
  ],
  "nextStep": "如小陌想继续，先选构图、蓝色层次或不同印本之一；否则保留这份可独立阅读的图像示范。",
  "limitations": [
    "只看一个馆藏印本的数字正面全图，不穷尽不同印次、纸张、色泽或版画技法。",
    "没有读听音频导览，不核影响史与人物命运。",
    "知名作品的选择依据是馆方说明与广泛辨识度，本例没有实时热度排名。"
  ],
  "paragraphs": [
    {
      "paragraphId": "wave_preview",
      "heading": "收藏预览",
      "markdown": "葛饰北斋的海浪木版画：大浪下的三只长船，与远处小小的富士山同处一幅画面。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "wave_object",
          "locator": "对象45434：标题与作品说明",
          "note": "支持作品名、作者和富士山身份"
        },
        {
          "sourceId": "wave_image",
          "locator": "正面全图：大浪、三船与远山",
          "note": "支持可见对象关系"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "wave_overview",
      "heading": "内容概要",
      "markdown": "《神奈川冲浪里》是葛饰北斋《富岳三十六景》系列中的一幅木版画。本次看的这张印本收藏在大都会艺术博物馆，馆方断代为约1830至1832年。\n\n画面左上方的大浪高高卷起，白色浪尖向下分叉，下面和右侧有三只细长的船，船上人物的身体贴低。远处的富士山很小，像一个白顶的三角形，落在大浪下方的空隙里。深浅不同的蓝色连着浪、海面与远山，天空则留下大块浅色空间。\n\n这幅画把一处海面上的浪、船和山同时呈现出来。当前图像能支持它们的位置与大小关系；人物在做什么具体任务、这一刻之后如何，不属于本轮已核内容。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "wave_object",
          "locator": "Artwork Details；说明段关于透视与富士山",
          "note": "支持系列、作者、断代、馆藏与远山身份"
        },
        {
          "sourceId": "wave_image",
          "locator": "全图：左上浪头、下半部三船、中央偏右远山、天空",
          "note": "支持对已目验图像的白话说明"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "wave_look",
      "heading": "看原图：浪、船与山的位置",
      "markdown": "![葛饰北斋《神奈川冲浪里》，Met藏JP1847，官方开放全图DP130155；CC0](attachment:att_c5f615cdcd7844937010f0f663506ce66ce27784)\n\n先看左上方卷起的浪，再沿下半部找到三只细长船：左侧一只、最前方一只、右侧向中间延伸的一只。船上可见成排的小人物。富士山位于中央偏右、深色海面上方，白色山顶在浪下留出的空隙中。\n\n这是作品全图的数字照片，保留纸色和表面痕迹；不是本轮重画、修复或生成的示意。出处：The Metropolitan Museum of Art，JP1847／45434，DP130155；图像按馆方Open Access政策使用。",
      "basisKind": "direct_observation",
      "sourceRefs": [
        {
          "sourceId": "wave_image",
          "locator": "全图及左上浪头、下方三船、中央偏右远山",
          "note": "实际view_image目验整张开放图，不据缩略搜索图代替"
        },
        {
          "sourceId": "wave_license",
          "locator": "Open Access页面：公开领域作品图像与数据CC0",
          "note": "支持本次原图使用依据"
        }
      ],
      "attachmentIds": [
        "att_c5f615cdcd7844937010f0f663506ce66ce27784"
      ]
    },
    {
      "paragraphId": "wave_context",
      "heading": "馆藏说明与白话：山为什么显得小",
      "markdown": "馆方列出的媒材是纸上的木版印刷，使用墨与色；这张印本约25.7×37.9厘米。它有明确馆藏号JP1847，不能把另一馆或另一印本的尺寸直接套来。\n\n馆方说明中有一段：\n\n> make Japan’s grandest mountain appear as a small triangular mound\n\n白话：通过透视安排，富士山在画中看起来成为一个很小的三角形山丘。这里说的是画面的观看关系：远山很小，近处的浪占据了更大面积。馆方将此归为作者的透视处理；这不是关于船上人物命运的说明。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "wave_object",
          "locator": "说明首段；Artwork Details：Medium、Dimensions、Object Number",
          "note": "支持短摘录、自译白话、尺寸、媒材和馆藏对象"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "wave_analysis",
      "heading": "形式细看：大弧线与细碎浪尖",
      "markdown": "本轮分析：浪的外缘是一条很大的弧线，浪尖却分裂成许多小弯钩；下方海面又重复较小的白色波峰。大轮廓和细小重复同时出现，视线容易沿弧线走向浪头，再回到船与远山。\n\n大浪占据近景，富士山只占小块面积，形成明显的尺度对照。将这种对照读成压迫、危险或自然力量，是观看解释；本轮没有把这些感受登记为小陌原话，也不据此断言作者只有这一种意图。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "wave_image",
          "locator": "左上大弧线、浪尖与下半部重复波峰；远山相对面积",
          "note": "给出本轮形式分析的可见依据，分析不升级为作者意图"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "wave_candidate",
      "heading": "创作可用性｜候选",
      "markdown": "若以后需要表现一个小物体置身于大环境，可借用“巨大弧线包围较小形体”的关系；若想让静态画面有节奏，可观察大轮廓与许多小弯曲形态如何并置。这里只提供形式候选，尚未替小陌选定创作题目，也没有制作作品。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "wave_image",
          "locator": "巨浪与船山大小关系；浪尖重复形态",
          "note": "支持候选的形式出发点，不证明创作效果"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "wave_method",
      "heading": "方法与读取记录",
      "markdown": "本例是2026-10-02用户授权的AI测试示范，原始感受为空。已读Met作品页面的说明与Artwork Details、官方对象API，以及Open Access政策；已打开并目验DP130155全图。页面含音频入口，但本轮未审听。常规网页从本机下载遇到安全检查，作品说明通过网页读取工具完整读取；对象API与图像下载实际成功。未安装依赖、未改变模型或调用额外视觉分析服务。",
      "basisKind": "demo",
      "sourceRefs": [],
      "attachmentIds": []
    }
  ],
  "sources": [
    {
      "sourceId": "wave_object",
      "kind": "external",
      "title": "The Met｜神奈川冲浪里，JP1847／对象45434",
      "locator": "说明首段与Artwork Details；对象API /public/collection/v1/objects/45434",
      "accessedAt": "2026-10-02T02:30:44.914Z",
      "verificationScope": "实际读官方完整作品说明段、作品细节与对象API；未读音频、馆藏所列全部参考文献或影响史",
      "licenseStatus": "作品原作公版；本轮仅取必要短摘录与自行中文概述，馆方说明整体许可不作扩张",
      "uri": "https://www.metmuseum.org/art/collection/search/45434"
    },
    {
      "sourceId": "wave_image",
      "kind": "attachment",
      "title": "Met官方开放图DP130155｜神奈川冲浪里",
      "locator": "全图；3859×2594；正面图DP130155",
      "accessedAt": "2026-10-02T02:30:44.914Z",
      "verificationScope": "实际下载官方API给出的原图并用view_image目验整幅；未比较其他印本",
      "licenseStatus": "CC0；对象页Public Domain、官方API isPublicDomain=true、Met Open Access政策",
      "attachmentId": "att_c5f615cdcd7844937010f0f663506ce66ce27784"
    },
    {
      "sourceId": "wave_license",
      "kind": "external",
      "title": "The Met Open Access政策",
      "locator": "Open Access说明首段：public-domain artworks及CC0；API资源说明",
      "accessedAt": "2026-10-02T02:30:44.914Z",
      "verificationScope": "实际读取官方开放图像政策与API说明，核本件对象为公开领域图像",
      "licenseStatus": "官方政策说明CC0；只以其证明图像及基础数据使用依据",
      "uri": "https://www.metmuseum.org/hubs/open-access"
    }
  ],
  "researchStatus": "stage_complete",
  "materialVersions": [
    {
      "materialId": "mat_9e382464-bd6b-4cb8-b0e1-bbebb30ecad7",
      "revision": 1
    }
  ],
  "author": "ai"
}
~~~~


## 记录 10：stage_d6eb88b8-bfeb-434c-b280-c5405c05aa3d

- `id`：stage_d6eb88b8-bfeb-434c-b280-c5405c05aa3d
- `topic_id`：topic_812641bc-736c-48d2-806d-b978a5f05a0b
- `topic_revision`：2
- `created_at`：2026-10-02T04:59:45.803Z

### 原字段 `body_json`

~~~~json
{
  "focus": "器物阅读示范：从材料色泽、白菜形制和馆方所述陈设用途进入，图区分现陈列与历史用途，避免套用故事起因结局。",
  "confirmed": [
    "对象为故玉002103N000000000，避免与同名故玉002662混淆。",
    "馆方断代清，列尺寸长18.7、宽9.1、厚5.07厘米。",
    "官方说明将绿白色、裂痕杂质与菜叶菜梗的造型处理联系起来，称叶端有蝈蝈与蝗虫。",
    "官方Description记述原为宫殿陈设盆景；本轮图可见木质外观座架，两者不混同。",
    "实际目验450×600官方展示图；官方展示尺寸许可为CC0。"
  ],
  "candidates": [
    "顺着原材色差形成形象、将表面缺陷纳入纹理，可作材料设计候选；未采用。"
  ],
  "parked": [
    "嫁妆、清白与多子寓意的解释史不纳入此次单页对象说明测试。"
  ],
  "unknown": [
    "作者与具体制作年份本轮未核。",
    "原配珐琅盆景的完整形制、现木座年代及是否原配，未核。",
    "单张照片不能确定背面细节、触感、内部裂痕或现代化学成分。"
  ],
  "nextStep": "如小陌想继续，先选择玉色与质感、草虫细节或原陈设之一，再只补与该点有关的实物图与馆方证据。",
  "limitations": [
    "只读官方单页对象说明、目验一张展示图；不是器物全史研究或实物鉴定。",
    "当前座架与馆方记述原珐琅盆景分别保留，不据单张照片虚构原配关系。",
    "不把AI测试关注或观看解释登记为用户个人兴趣。"
  ],
  "paragraphs": [
    {
      "paragraphId": "cabbage_preview",
      "heading": "收藏预览",
      "markdown": "故宫翠玉白菜：工匠用玉料的绿白色雕出菜叶和菜梗，叶端还有草虫；原作宫廷陈设。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "cabbage_object",
          "locator": "Description：绿白玉色、草虫与原宫殿陈设盆景",
          "note": "支持这件器物的材料、形象与用途"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "cabbage_overview",
      "heading": "内容概要",
      "markdown": "翠玉白菜是一件用翡翠雕成白菜形状的玉器，收藏在台北国立故宫博物院。本次对象的馆藏号是故玉002103N000000000；馆方断代为清，列出的长度约18.7厘米。\n\n工匠顺着玉料原本的绿白色分布安排造型：绿色成为层层包覆的菜叶，白色成为菜梗。馆方说明指出，白色部分的裂痕与杂质被纳入造型，使菜梗呈现接近新鲜白菜的样子；叶端还雕有蝈蝈与蝗虫。\n\n它原来作宫殿中的陈设盆景，以类似栽种的方式立在珐琅盆景上。本轮照片中则可见木质外观的座架；当前展示图和馆方记述的原陈设应分别理解。本轮读到的是材料、形制和用途，尚未核作者、具体制作年或原配盆景的完整样貌。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "cabbage_object",
          "locator": "Object Number、Dynasty、Dimensions、Description完整段",
          "note": "支持对象身份、断代、尺寸、用色、草虫和原陈设"
        },
        {
          "sourceId": "cabbage_image",
          "locator": "全图：菜叶、菜梗与照片下部座架",
          "note": "支持对所见现展示照片的描述，不证明座架年代"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "cabbage_look",
      "heading": "看器物：颜色、叶脉与座架",
      "markdown": "![翠玉白菜，国立故宫博物院，故玉002103N000000000；官方展示照片PAB，450×600，CC0](attachment:att_c36462f3b0034858cced6b901dbbbf9245f3f153)\n\n这张照片里，上部叶片深浅绿色交错，下部菜梗较浅，纵向细线表现叶脉与梗的结构。叶端附近可见细长的虫形构件和足部；蝈蝈、蝗虫的名称由馆方说明提供，本轮不凭这张小图另做昆虫鉴定。\n\n下部和右侧可见带卷曲轮廓的座架。照片能说明这次拍摄的陈列关系，不能单凭它确认座架材质、年代或原配情况。图为馆方实物摄影，非本轮生成或复原；出处：国立故宫博物院，故玉002103N000000000，PAB展示尺寸图，CC0。",
      "basisKind": "direct_observation",
      "sourceRefs": [
        {
          "sourceId": "cabbage_image",
          "locator": "全图：上部叶片、下部浅色菜梗、叶端虫形及下部座架",
          "note": "实际用view_image打开450×600展示图目验"
        },
        {
          "sourceId": "cabbage_object",
          "locator": "Description及Download/User Guide许可区",
          "note": "支持馆方草虫名称及展示尺寸图CC0依据"
        }
      ],
      "attachmentIds": [
        "att_c36462f3b0034858cced6b901dbbbf9245f3f153"
      ]
    },
    {
      "paragraphId": "cabbage_context",
      "heading": "馆藏说明与白话：怎样陈设",
      "markdown": "馆方说明中有一句：\n\n> 以栽種的形式立在琺瑯盆景上。\n\n白话：这件玉白菜原来像一株栽着的植物，放进一组珐琅盆景陈设。这里的“盆景”帮助理解用途：它是宫殿空间中的摆设。\n\n官方给出的断代范围是清代1644至1911年；本轮没有把这一区间收窄成某一个年份。尺寸照录为长18.7、宽9.1、厚5.07厘米，指这件馆藏对象，不能由照片中座架的大小另行推算。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "cabbage_object",
          "locator": "Description末句；Dynasty与Dimensions",
          "note": "支持必要原文、自译白话、用途、断代与尺寸"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "cabbage_analysis",
      "heading": "材料细看：色差参与造型",
      "markdown": "本轮分析：这一对象的理解入口，是原材如何成为形象。绿色聚集在叶片，浅色顺着菜梗延伸，色差帮助观者辨认“叶”和“梗”；雕刻的纵向线条又把材料表面带向植物结构。\n\n馆方将裂痕、杂质的安排解释为造型处理，本轮可据此讨论“利用材料条件”，但照片无法让我们触摸实物，也无法逐一核实内部裂痕。它如何给人新鲜感或亲切感属于观看解释，不是小陌的已记录感受。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "cabbage_image",
          "locator": "全图：绿叶与浅色菜梗的分区及纵向线条",
          "note": "支持本轮形式分析的图像出发点"
        },
        {
          "sourceId": "cabbage_object",
          "locator": "Description：天然色泽及白色部分裂痕、杂质的安排",
          "note": "说明馆方的材料解释来源，不提升为本轮物理检测"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "cabbage_candidate",
      "heading": "创作可用性｜候选",
      "markdown": "可以暂留两个材料设计方向：顺着原材色差决定形象的不同部分；把可见瑕疵纳入纹理，而非先抹平所有材料特征。是否适合小陌的作品，需要结合实际材料与目的再判断。这些只是AI提出的候选，本轮没有做玉器复原或替小陌确定作品。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "cabbage_object",
          "locator": "Description：天然色泽、裂痕杂质与造型",
          "note": "支持材料设计联想的来源出发点，不证明迁移效果"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "cabbage_method",
      "heading": "方法与读取记录",
      "markdown": "本例是2026-10-02用户授权的AI测试示范，原始感受为空。实际读官方Open Data条目3的Description、馆藏号、断代、尺寸和图像许可区；用view_image查看PAB展示照片。页面列出的其他角度照片与参考书未逐一读取，下载范围只含本张展示图。没有读取藏品实物、未做矿物鉴定，也未把常见嫁妆说或吉祥寓意补成已核事实。未安装依赖、未改变模型。",
      "basisKind": "demo",
      "sourceRefs": [],
      "attachmentIds": []
    }
  ],
  "sources": [
    {
      "sourceId": "cabbage_object",
      "kind": "external",
      "title": "国立故宫博物院｜翠玉白菜Open Data对象3",
      "locator": "故玉002103N000000000；Description完整段、Dimensions、Dynasty与Download/User Guide",
      "accessedAt": "2026-10-02T02:30:44.914Z",
      "verificationScope": "实际读官方馆藏说明完整Description与身份尺寸断代、展示尺寸图CC0许可区；其他参考书、藏品保养记录及所有角度未读",
      "licenseStatus": "本轮引用一条必要短句并自行概述；官方低/展示尺寸图为CC0，高分辨率为CC BY4.0，未下载高分辨率",
      "uri": "https://digitalarchive.npm.gov.tw/opendata/Pub/DetailEng/3?dep=U&mode=full"
    },
    {
      "sourceId": "cabbage_image",
      "kind": "attachment",
      "title": "故宫官方展示照片｜翠玉白菜PAB",
      "locator": "图像380196；K1C002103N000000000PAB；整张450×600展示图",
      "accessedAt": "2026-10-02T02:30:44.914Z",
      "verificationScope": "实际下载官网页面公开展示尺寸照片并用view_image目验全图；未看背面或所有图像",
      "licenseStatus": "CC0；官方Download/User Guide明确Lower / Presentation Size Image (CC0)；保留机构与馆藏号",
      "attachmentId": "att_c36462f3b0034858cced6b901dbbbf9245f3f153"
    }
  ],
  "researchStatus": "stage_complete",
  "materialVersions": [
    {
      "materialId": "mat_144933f8-dce4-4994-9b52-36edb0cf8faf",
      "revision": 1
    }
  ],
  "author": "ai"
}
~~~~


## 记录 11：stage_b87ca607-1353-484e-bcdf-5df385b8b737

- `id`：stage_b87ca607-1353-484e-bcdf-5df385b8b737
- `topic_id`：topic_7210e742-4920-40be-8eda-d094ff712d68
- `topic_revision`：2
- `created_at`：2026-10-02T04:59:46.210Z

### 原字段 `body_json`

~~~~json
{
  "focus": "本轮多类型测试：读懂官方故事设定，再用两张预告图观察尺度；不做正片声画结论",
  "confirmed": [
    "官方简介交代巨兔受到三只小动物骚扰，转为准备滑稽报复。",
    "正文两张图已实际查看并定位14.000/30.000秒。",
    "作品许可和原始内容范围已核，未连续观看、未审听的边界保持可见。"
  ],
  "candidates": [
    "角色整体图与关键细节近景的介绍方式，可在另一个具体作品中小范围试验。"
  ],
  "parked": [
    "完整正片的反击经过、结局与声画分析不属于本轮范围。"
  ],
  "unknown": [
    "预告完整连续节奏、声音作用及正片结局尚未核实。"
  ],
  "nextStep": "如小陌选择继续此例，再明确想看哪段连续内容及实际可用的观看/审听方式；不由本轮测试自动开始全片研究。",
  "limitations": [
    "只读发布方文字并实际查看8个离散时点，正文仅选2帧；没有连续观看预告或正片。",
    "没有直接审听原音；未用ASR替代审听。",
    "官方简介未讲具体反击过程与结局，不以其他材料补写本轮未读正片。",
    "本案是AI测试示范，原始用户感受空；没有真实学习、创作方向采用或观众效果证据。"
  ],
  "paragraphs": [
    {
      "paragraphId": "para_bbb_preview",
      "heading": "收藏预览",
      "markdown": "《Big Buck Bunny》的官方预告与故事设定：温和的巨兔受到三只小动物骚扰，准备一场滑稽反击。本次读官方简介，另观察预告局部画面。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_bbb_description",
          "locator": "JSON description",
          "note": "支持巨兔、三个啮齿类动物与喜剧报复的官方设定"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_bbb_overview",
      "heading": "内容概要",
      "markdown": "《Big Buck Bunny》是Blender Foundation的2008年开放动画短片。这份收藏以官方约33秒预告为画面对象；故事内容来自发布方的文字简介，不能把它当成此次已经看完正片。\n\n简介讲一只体型巨大、心地温和的兔子。一个晴天，三只啮齿类小动物无礼地骚扰它。兔子的忍耐耗尽，转而准备一场卡通喜剧式的报复。这样，故事从一个大个子受到小个子欺负，转向它主动反击。\n\n官方简介到这里为止，没有讲反击用了哪些办法，也没有交代最后谁赢。本轮没有读正片，具体经过和结局仍未核。下文的两张预告图只帮助看人物体量、画面距离和细部，不用它们补写完整故事；原音未审听，预告未连续合看。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_bbb_description",
          "locator": "JSON description",
          "note": "支持人物、晴天受骚扰、转为准备滑稽报复；简介未给具体反击与结局"
        },
        {
          "sourceId": "src_bbb_project",
          "locator": "bunny-about.txt第31–46行；第18–19行版权署名年份",
          "note": "支持2008年Peach开放动画项目身份"
        },
        {
          "sourceId": "src_bbb_trailer",
          "locator": "官方MOV ffprobe容器32.995秒；原片14/30秒",
          "note": "支持画面对象为约33秒官方预告，不能证明正片或连续声画已读"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_bbb_text",
      "heading": "官方文字：温和与反击",
      "markdown": "官方简介先把兔子形容为：\n\n> a giant rabbit with a heart bigger than himself\n\n本次自译：一只巨大的兔子，心地比它的身材还宽厚。这里是在介绍角色原本的性格，不是仅凭某一帧表情判断它善良。\n\n后来简介说：\n\n> he prepares the nasty rodents a comical revenge.\n\n本次自译：它为那些可恶的小动物准备了一场滑稽的报复。前面的骚扰是转折的起因；“准备”并没有等于“已经实施并取得胜利”。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_bbb_description",
          "locator": "JSON description首句与最后一句",
          "note": "对应两段英文短引文与本次自译，限定为发布方故事说明"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_bbb_frames",
      "heading": "两张预告图：全身与特写",
      "markdown": "![原片定位帧｜Big Buck Bunny官方预告14.000秒；完整画幅，无裁切](attachment:att_dfdd2cf464ed94f2aabf295ace98df7e129ffe75)\n\n14.000秒：浅色巨兔站在有阳光的草地上，长耳、头、躯干和两侧手臂都能看清，后面还有草地、远山和粉橙色天空。画面给出的首先是整体体量与环境，不能仅凭这一帧断定它正在害怕谁或准备什么动作。\n\n![原片定位帧｜Big Buck Bunny官方预告30.000秒；完整画幅，无裁切](attachment:att_7b5430703c52e5260e3ebc3fc58b1ffed82d151f)\n\n30.000秒：棕橙色小动物的面部占据左侧大面积，眼睛、牙齿与毛发清楚；右侧是较大的紫色蝴蝶翅膀。小动物的脸与翅膀在画面中紧邻，观察尺度比前图更近。单帧不能说明它接下来如何对待蝴蝶，更不能证明完整反击过程。\n\n两图来源：(c) copyright 2008, Blender Foundation / www.bigbuckbunny.org；CC BY 3.0。仅定位抽帧，未裁切、未调色；页面可能按容器等比显示。",
      "basisKind": "direct_observation",
      "sourceRefs": [
        {
          "sourceId": "src_bbb_trailer",
          "locator": "无损重封装视频PTS 268800/19200=14.000秒、576000/19200=30.000秒",
          "note": "实际查看相应定位帧，只支持此处可见对象与构图，不支持连续动作"
        }
      ],
      "attachmentIds": [
        "att_dfdd2cf464ed94f2aabf295ace98df7e129ffe75",
        "att_7b5430703c52e5260e3ebc3fc58b1ffed82d151f"
      ]
    },
    {
      "paragraphId": "para_bbb_analysis",
      "heading": "分析解释：看整体和看细部分别给什么",
      "markdown": "这两张图可以作为一个距离变化的局部示范：全身图让人先辨认巨兔的轮廓、体量与所处环境；特写把注意集中到面部和翅膀细节。在故事说明已经给出“巨兔与小动物冲突”的前提下，这种尺度差异有助于分别介绍双方的视觉特征。\n\n这是对两张图的分析，不是已核的镜头衔接或导演意图。两帧之间有未审看的画面，不能由它们计算剪辑节奏或认定人物的心理转折。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "src_bbb_trailer",
          "locator": "正文14.000与30.000秒两帧",
          "note": "局部构图与观察尺度是分析依据"
        },
        {
          "sourceId": "src_bbb_description",
          "locator": "JSON description",
          "note": "故事前提来自官方文字，而非静帧推理"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_bbb_candidate",
      "heading": "创作联想·候选",
      "markdown": "可试用的形式线索，是在介绍角色时先给能辨认整体的画面，再给承载一个关键细节的近景。用于新的作品时，仍要检查近景里的细节与当前冲突是否有关，以及观众是否能从连续画面读出关系；这里没有替小陌选定创作方向。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "src_bbb_trailer",
          "locator": "14.000与30.000秒局部图证",
          "note": "为候选提供视觉例子，不证明可直接迁用或必有相同效果"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_bbb_unknown",
      "heading": "仍未验证的故事与声画",
      "markdown": "本轮没有读取正片的完整动作、反击过程与结局；没有审听预告音轨，也没有连续合看预告。不能进一步断言某个声音怎样强化笑点、某帧表情代表什么心理，或该预告的完整节奏怎样成立。\n\n本案是AI制作的多类型测试示范，用户原始感受留空，未推定小陌喜欢这部片或已经采用其中的创作方法。",
      "basisKind": "unknown",
      "sourceRefs": [],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_bbb_method",
      "heading": "方法与读取记录",
      "markdown": "本轮实际读取Blender官方视频API的故事简介、Peach官方项目说明及预告页，并保存带SHA-256的原文快照。下载约33秒官方预告作取帧依据；已有FFmpeg只做MOV→MP4无损重封装与定位抽帧，没有安装依赖、运行ASR、下载模型或改变模型设置。原MOV容器32.995秒，无损重封装容器33.002667秒；画面轨时长不因这一容器差异变成新增内容。\n\n实际查看8个离散时间点，正文选14.000与30.000秒；提取清单的extracted_not_semantically_verified状态保持原样，实际图像查看另有观察记录。原视频只留在本轮验证目录，正式收藏只导入两张必要帧，不保存正片或把网页可播放当作已经研究完。\n\n影片与网站内容依官方about的CC BY 3.0使用并署名；商标、网站logo及DVD封面不在该许可内。本案未导入这些图。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_bbb_description",
          "locator": "实际API读取收据与description",
          "note": "支持官方文字读取范围"
        },
        {
          "sourceId": "src_bbb_project",
          "locator": "bunny-about.txt第10–23行",
          "note": "支持CC BY 3.0、署名与例外范围"
        },
        {
          "sourceId": "src_bbb_trailer",
          "locator": "原MOV属性、重封装属性与两份取帧manifest",
          "note": "支持工具读取范围，不声明连续观看或审听"
        }
      ],
      "attachmentIds": []
    }
  ],
  "sources": [
    {
      "sourceId": "src_bbb_description",
      "kind": "external",
      "title": "Blender官方视频元数据｜故事简介",
      "locator": "JSON description；name；publishedAt",
      "accessedAt": "2026-10-02T02:34:24.002273+00:00",
      "verificationScope": "实际读取官方API的完整description和作品身份；2018-10-27是该上传项发布日期，非影片首次发表日期。未观看596秒正片。",
      "licenseStatus": "官方Peach项目about明确CC BY 3.0；网站标识和商标除外",
      "uri": "https://video.blender.org/api/v1/videos/pAQiVCgv2CsLg79KKXUoMw"
    },
    {
      "sourceId": "src_bbb_project",
      "kind": "external",
      "title": "Blender官方项目说明｜身份与使用许可",
      "locator": "保存文本bunny-about.txt第10–23、31–46行",
      "accessedAt": "2026-10-02T02:34:24.002273+00:00",
      "verificationScope": "实际读取许可条款与项目背景，不将早期制作材料作为终版剧情证据。",
      "licenseStatus": "CC BY 3.0 https://creativecommons.org/licenses/by/3.0/；部分影片引用需署名，商标、网站logo、DVD封面除外",
      "uri": "https://peach.blender.org/about/"
    },
    {
      "sourceId": "src_bbb_trailer",
      "kind": "external",
      "title": "Big Buck Bunny官方预告｜实际定位帧",
      "locator": "官方480p MOV；正文14.000与30.000秒定位帧；原件与无损重封装SHA见本轮读取记录",
      "accessedAt": "2026-10-02T02:34:24.002273+00:00",
      "verificationScope": "已下载官方约33秒预告并检查元数据，实际查看3、8、14、18、19、20、27、30秒8个离散时点；正文仅保留14/30秒两帧。未连续观看，未直接审听原音。",
      "licenseStatus": "CC BY 3.0；(c) copyright 2008, Blender Foundation / www.bigbuckbunny.org；图像为定位抽帧，未裁切未调色",
      "uri": "https://download.blender.org/peach/trailer/trailer_480p.mov"
    }
  ],
  "researchStatus": "stage_complete",
  "materialVersions": [
    {
      "materialId": "mat_f56e0171-517f-4961-8f6e-e67b5f9dda9b",
      "revision": 1
    }
  ],
  "author": "ai"
}
~~~~


## 记录 12：stage_50fe4d1f-7a8d-40b4-8bf2-731c8149d13e

- `id`：stage_50fe4d1f-7a8d-40b4-8bf2-731c8149d13e
- `topic_id`：topic_200b024e-2206-458b-b245-150d0b43469e
- `topic_revision`：2
- `created_at`：2026-10-02T04:59:46.974Z

### 原字段 `body_json`

~~~~json
{
  "focus": "本轮多类型测试：读懂日食科普模拟，再将官方科学说明与三帧观察对应",
  "confirmed": [
    "已读官方完整说明并明确图像为模拟、红紫黄图例与本影/半影含义。",
    "实际文件49.000秒且无音轨，三张定位帧已查看。",
    "1小时40分属于本影跨陆地行程，不属于视频时长或单一地点全食时长。"
  ],
  "candidates": [
    "同一现象的整体原理图与局部位置图，用一致颜色连接。"
  ],
  "parked": [
    "连续动画的相机运动与节奏评价，以及旁白版本的审听不在本轮范围。"
  ],
  "unknown": [
    "没有连续审看，完整运动与观看效果待核。"
  ],
  "nextStep": "如小陌选择继续，再连续查看无声动画并检查相机视图变化能否让读者连接原理与地图；本轮不自动读取旁白或开展新采集。",
  "limitations": [
    "实际读取完整官方科学说明、属性与8/24/40秒三张定位图；没有连续审看。",
    "本次49秒版本没有音轨；没有读取或导入另一个含第三方音乐的旁白版本。",
    "图像是模拟，不是2024年日食现场实拍；文本整理是AI成果，非NASA审阅。",
    "本案是多类型AI测试示范，用户感受空，没有真实学习或方向采用记录。"
  ],
  "paragraphs": [
    {
      "paragraphId": "para_nasa_preview",
      "heading": "收藏预览",
      "markdown": "49秒NASA无声科普动画：用地球、月球与影锥模型解释2024年北美日全食，红色路线与紫色轮廓帮助区分全食和偏食区域。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_nasa_text",
          "locator": "nasa-eclipse.txt第32–37行",
          "note": "支持日食原理、三维模型与颜色说明"
        },
        {
          "sourceId": "src_nasa_movie",
          "locator": "FFprobe format.duration=49.000000；streams仅video",
          "note": "支持49秒无声版本"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_nasa_overview",
      "heading": "内容概要",
      "markdown": "这是一段NASA科学可视化工作室制作的49秒无声动画，用模型说明2024年4月8日北美日全食。条目发布于2023年11月13日，因此图像是对天象的模拟，不是当日从太空拍下的现场录像。\n\n月球走到太阳与地球之间，影锥便可能落到地球表面。位于中央较窄的“本影”区的人，会看到月球完全遮住太阳，即日全食；位于外围较宽的“半影”区的人，只看到太阳的一部分被遮住。图中红色带标出全食经过的路线，紫色轮廓标半影，黄色线标出半影扫过区域的南北边界。\n\n官方条目说明了动画的进程：虚拟相机从地球和月球的夜侧绕到日侧，把三维遮挡关系与地表路径联系起来。本影沿地表移动，在陆地上的行程约1小时40分，之后进入北大西洋并离开地球边缘。这个时间是本影跨陆地的实际行程，不是某一地点全食持续时间，也不是49秒视频的实时速度。\n\n本轮已读完整官方说明、核对文件无音轨，并实际查看8、24、40秒三张定位帧；没有连续审看动画。下文分开呈现条目中的科学说明与实际可见图像，内容梳理由AI整理，未获NASA审阅或背书。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_nasa_text",
          "locator": "nasa-eclipse.txt第9、32–37行",
          "note": "支持发布日期、模拟身份、影锥原理、图例与行程；不支持已连续审看"
        },
        {
          "sourceId": "src_nasa_movie",
          "locator": "FFprobe元数据及8/24/40秒取帧manifest",
          "note": "支持本次版本时长、无音轨和实际提取范围"
        },
        {
          "sourceId": "src_nasa_usage",
          "locator": "媒体指引关于AI产物与不得暗示背书的段落",
          "note": "说明整理主体与来源机构的区别"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_nasa_legend",
      "heading": "先分清影子和颜色",
      "markdown": "本影和半影是两个不同的遮挡区域，不能把画面里所有深色部分都当作日全食范围。中央本影很窄；半影外围的地区只看到太阳的一部分被遮住。\n\n这份模型用红色带标全食经过路线，紫色轮廓围出半影，黄色线标它扫过区域的南北边界。地球本来处于夜晚的部分也较暗，但它和月影是两件事。官方还说明，虚拟相机使用长焦视图，会让远近物体在画面上显得更接近；画面给人的距离感不能直接当作真实天体间距。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_nasa_text",
          "locator": "nasa-eclipse.txt第32–35行",
          "note": "支持本影/半影区分、图例与长焦压缩距离说明"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_nasa_frames",
      "heading": "从球体关系到地表位置：三张定位图",
      "markdown": "![原片定位帧｜NASA SVS日食无声动画8.000秒；完整画幅](attachment:att_6e6df95308c8a774241234f25762dbe734ff71ef)\n\n8.000秒：地球以完整球体出现在画面中间偏右，左侧较暗、右侧较亮；深色锥形区域从画面左侧横过，红色带与细线落在地表上。这里只描述可见关系，颜色的含义要结合上一节的官方图例读。\n\n![原片定位帧｜NASA SVS日食无声动画24.000秒；完整画幅](attachment:att_5ce7777a9b51094667a50d265518347345406ef9)\n\n24.000秒：画面更近地显示北美大陆，一条红色带斜穿陆地，一个黑色圆点位于红带上的墨西哥附近；紫色弧线、黄色细线仍可见。球体关系已经能与地理位置对照，但截图本身没有给出每个城市的具体时刻。\n\n![原片定位帧｜NASA SVS日食无声动画40.000秒；完整画幅](attachment:att_6031f653d5fbdac17c01ddbdf9ab5a4ad18ba1ac)\n\n40.000秒：仍能辨认同一条红色带，黑色圆点已出现在大陆东北一侧；地球表面和紫色弧线的构图也与24秒不同。两张静帧能确认这些时点的位置差别，不能独自证明中间运动的完整轨迹或播放速度。\n\n图像来源：NASA’s Scientific Visualization Studio。仅从官方无旁白版定位抽帧，完整画幅，无裁切、无调色；不是AI生成图，也不是实际日食现场照片。",
      "basisKind": "direct_observation",
      "sourceRefs": [
        {
          "sourceId": "src_nasa_movie",
          "locator": "PTS 240/30=8.000、720/30=24.000、1200/30=40.000秒",
          "note": "实际查看三张对应原帧，支持对象、图形与位置差别，不支持连续运动判断"
        }
      ],
      "attachmentIds": [
        "att_6e6df95308c8a774241234f25762dbe734ff71ef",
        "att_5ce7777a9b51094667a50d265518347345406ef9",
        "att_6031f653d5fbdac17c01ddbdf9ab5a4ad18ba1ac"
      ]
    },
    {
      "paragraphId": "para_nasa_analysis",
      "heading": "分析解释：同一现象的两个观看尺度",
      "markdown": "这组三维图像和地理图像，能作为科普信息层次的局部例子。球体视图帮助辨认“影子怎样落到地球上”，较近的地表视图则让红色路线对应到陆地位置；颜色符号持续出现，给两种尺度留下了共同线索。\n\n这是对已见三帧与文字说明的分析。它不证明连续动画的相机运动是否流畅、缩放是否恰好够观众理解，也不等于已验证观看效果；这些问题需要实际连续审看和读者反馈。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "src_nasa_movie",
          "locator": "8/24/40秒三帧",
          "note": "支持视野尺度和重复颜色符号"
        },
        {
          "sourceId": "src_nasa_text",
          "locator": "nasa-eclipse.txt第33–35行",
          "note": "提供模型与路径的明确解释"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_nasa_candidate",
      "heading": "创作联想·候选",
      "markdown": "在科普表达里，可以把“整体原理示意”和“局部位置图”放在同一条阅读线上，用一致颜色连接两者。若将来用于自己的作品，需要说明模拟与实拍身份、实际时间与展示时间，并检查图例在手机上是否仍可辨认。这是测试提出的候选，未被记为小陌已采用。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "src_nasa_movie",
          "locator": "三张定位图中的红色带和紫色轮廓",
          "note": "示例来源，不保证迁用效果"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_nasa_unknown",
      "heading": "本轮没有验证的连续观看效果",
      "markdown": "本次没有连续观看49秒动画，不能对相机运动、停留时间、切点或整体观看节奏下结论。此版本已核没有音轨；另一个带旁白的版本及其中音乐没有读取或导入。\n\n用户原始感受保持为空，案例选择和这些分析是AI测试示范，不是小陌对该视频的评价。",
      "basisKind": "unknown",
      "sourceRefs": [],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_nasa_method",
      "heading": "方法与读取记录",
      "markdown": "本轮保存官方SVS条目的HTML/文本及NASA媒体指引快照，核对署名、颜色图例、模拟身份和时间说明。取官方无旁白MP4检查属性：49.000秒、1920×1080、30fps，只有视频流。已有FFmpeg提取8/24/40秒三个定位帧，再实际查看；提取成功不被算成连续审看。\n\n原视频留在本轮验证目录，正式收藏只导入三张必要图。未取得或导入带Universal Production Music音乐的旁白版；NASA对第三方音乐的使用不自动转移他人的使用权。\n\n图像用于本地个人教育/信息示范并署名NASA’s Scientific Visualization Studio。文字是AI整理，NASA未审阅或认可本案；没有安装依赖、下载模型、运行额外转录或改变模型设置。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_nasa_text",
          "locator": "nasa-eclipse.txt第16、30、63–76行",
          "note": "支持另一版本含第三方音乐及图像署名"
        },
        {
          "sourceId": "src_nasa_movie",
          "locator": "ffprobe与三帧manifest",
          "note": "支持属性与本轮实际提取范围"
        },
        {
          "sourceId": "src_nasa_usage",
          "locator": "nasa-media-policy.txt第359–369、387–394行",
          "note": "支持信息用途、第三方权利与不得暗示背书的区分"
        }
      ],
      "attachmentIds": []
    }
  ],
  "sources": [
    {
      "sourceId": "src_nasa_text",
      "kind": "external",
      "title": "NASA SVS官方条目｜日食模拟说明",
      "locator": "nasa-eclipse.txt第8–16、32–37、63–76行",
      "accessedAt": "2026-10-02T02:34:24.002273+00:00",
      "verificationScope": "实际阅读条目身份、完整科学说明和署名；页面2023-11-13发布，动画呈现2024-04-08日全食。未凭文本声称实际连续看完影片。",
      "licenseStatus": "NASA媒体指引允许有署名的教育/信息用途；第三方内容另需权利。本案不用带第三方音乐的旁白版本。",
      "uri": "https://svs.gsfc.nasa.gov/5186/"
    },
    {
      "sourceId": "src_nasa_movie",
      "kind": "external",
      "title": "日食动画无旁白版本｜属性与实际定位帧",
      "locator": "无旁白1080p30 MP4；8.000/24.000/40.000秒实际定位帧",
      "accessedAt": "2026-10-02T02:34:24.002273+00:00",
      "verificationScope": "实际取得官方MP4、检查FFprobe：49.000秒，1920×1080，30fps，只有视频流无音轨；实际查看三帧，未连续观看。",
      "licenseStatus": "NASA SVS；本轮局部截图用于个人教育/信息示范，非NASA审核或背书；无第三方音轨导入。",
      "uri": "https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005186/eclipse24_flyaround_1080p30.mp4"
    },
    {
      "sourceId": "src_nasa_usage",
      "kind": "external",
      "title": "NASA媒体使用指引",
      "locator": "nasa-media-policy.txt第359–369、387–394行",
      "accessedAt": "2026-10-02T02:34:24.002273+00:00",
      "verificationScope": "实际读取一般教育/信息用途、署名、第三方素材与不得暗示背书的限制；本案文字是AI整理，不是NASA出具的说明或验证结论。",
      "licenseStatus": "官方媒体指引；第三方版权不随NASA使用权限转移，不暗示NASA审核/认可本案。",
      "uri": "https://www.nasa.gov/nasa-brand-center/images-and-media/"
    }
  ],
  "researchStatus": "stage_complete",
  "materialVersions": [
    {
      "materialId": "mat_324d11e0-f160-4d21-8e59-6839aa37f4f5",
      "revision": 1
    }
  ],
  "author": "ai"
}
~~~~


## 记录 13：stage_b7075376-4748-4075-834c-3a22c6134d82

- `id`：stage_b7075376-4748-4075-834c-3a22c6134d82
- `topic_id`：topic_ecf5858c-d3db-42c2-9ed7-56854e7f93fa
- `topic_revision`：2
- `created_at`：2026-10-02T18:07:35.038Z

### 原字段 `body_json`

~~~~json
{
  "focus": "测试假设（AI设定，非小陌原话）：何家村这枚小银香囊怎样把“可以活动的器物”与“细密的花鸟纹”放在一起？先核具体实物，再提可观察的短片候选。",
  "confirmed": [
    "馆方公开金银器目录第634行把七一127、唐镂空飞鸟葡萄纹银熏球与原名葡萄花鸟纹银香囊对应；当前官网记直径4.5cm、链长7.5cm、重36g。",
    "实际查看馆方外观原图和中国矿大2021年转载的打开状态照片；物件的运动未实际观察。",
    "馆方现代说明与旧官网转载说明支持持平结构；不能据此认证这件古物在任意颠簸下均绝对安全。"
  ],
  "candidates": [
    "以外壳缓转与内盂保持朝上的相对运动构成形式对照，先做可控复原或模型运动核验。",
    "用侧光、近景和开合动作表现羽毛刻线、空隙及内外金银色差，不把现代摄影色调当古代原貌。"
  ],
  "parked": [
    "杨贵妃爱情信物的具体归属、汉代发明者及通往现代陀螺仪的直系传播链：缺乏足以落实此件实物的证据，本轮不采用。",
    "不扩写端午民俗、香料百科或完整剧本。"
  ],
  "unknown": [
    "具体制作年份、作坊、主人与窖藏埋藏原因未定。",
    "这件器物曾用何种香料、燃料、香品形态和操作步骤未核；未查残留分析或燃烧测试。",
    "葡萄纹的原始寓意、花形的精确植物种属与鸟的物种没有本轮直接证据。",
    "4.5cm与旧介绍/研究图注4.6cm的测量口径差异未解释。",
    "内部小盂的成分与局部鎏金范围未实测；不能凭金色照片确定纯金。"
  ],
  "nextStep": "本轮可收束于具体身份、形制与静态图证。若采用外动内稳的创作候选，先用明确标注的复原模型或馆方运动演示核查相对运动，再决定画面；如要叙述古代燃香操作，先补具体香料/燃料与使用史证据。",
  "limitations": [
    "素材关注点由AI为真实流程实测设定，不是小陌个人感受，也不算个人学习进展。",
    "未接触、拆解或动态观看古物；照片不证明运动性能和温度安全。",
    "未直接读《一切经音义》《旧唐书》《西京杂记》的古籍原页；研究论文转引只按作者解释使用。",
    "2024论文实际阅读对象是何家村例图注、唐代器物/工艺段、名称与文献证据争议段及结论；其全部脚注所列原书未逐件查阅。",
    "官方照片与旧官网转载图片未见开放复用许可；本地研究参考不等于可用于公开号、商业短片或素材分发。"
  ],
  "paragraphs": [
    {
      "paragraphId": "para_object_20261002_preview",
      "heading": "收藏预览",
      "markdown": "一枚直径约4.5厘米的唐代银香囊：镂空球壳织入鸟与枝叶，内部持平结构让盛香小盂保持朝上。研究对象是何家村出土、现藏陕西历史博物馆的具体一件。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_object_catalogue",
          "locator": "sheet1 第634行 A–J列",
          "note": "支持名称对应、唐代与尺寸"
        },
        {
          "sourceId": "src_object_hoard_link",
          "locator": "正文“来自何家村窖藏”段",
          "note": "支持具体出土来源"
        },
        {
          "sourceId": "src_object_mechanism",
          "locator": "正文第二段关于球囊与机环",
          "note": "支持馆方所述持平功能"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_object_20261002_overview",
      "heading": "内容概要",
      "markdown": "这件“葡萄花鸟纹银香囊”是一件金属熏香器，虽叫“囊”，外层却是能打开的球壳。它在1970年发现的西安何家村唐代窖藏中出土，现由陕西历史博物馆收藏。馆方公开目录的文物编号是“七一127”：现名“唐镂空飞鸟葡萄纹银熏球”，原名即“葡萄花鸟纹银香囊”，这里的两个名称指向同一条馆藏记录。\n\n按当前官网，它直径4.5厘米，链长7.5厘米，重36克。银球由两半扣合，链与挂钩提供悬挂条件；内部设环架和小香盂。现代说明指出，环架允许外壳转动时香盂仍保持朝上，使香料不易倾洒。这样的解释可以帮助理解结构，但本轮只看了静态照片，没有亲眼验证古物运动。\n\n它可看的重点有两处：花鸟纹既是表面装饰，也是穿透球壳的空隙；内部小盂与外部球壳可以有不同的运动姿态。谁使用过这一枚、焚烧过什么香料、为何埋藏，都还没有落实。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_object_catalogue",
          "locator": "sheet1 第634行 A–J列",
          "note": "支持编号、两个名称、年代和测量值"
        },
        {
          "sourceId": "src_object_hoard_link",
          "locator": "正文“来自何家村窖藏”段",
          "note": "支持器物的何家村来源"
        },
        {
          "sourceId": "src_object_hoard",
          "locator": "展览简介首段",
          "note": "支持1970年10月发掘背景"
        },
        {
          "sourceId": "src_object_cumt",
          "locator": "图解首段",
          "note": "支持银壳两半、环架及香盂形制；此为旧官网转载"
        },
        {
          "sourceId": "src_object_mechanism",
          "locator": "正文第二段",
          "note": "支持馆方现代持平说明"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_object_20261002_exterior",
      "heading": "先看这件实物：花纹、接缝与挂链",
      "markdown": "![馆方实物原图：葡萄花鸟纹银香囊外观，保留原水印](attachment:att_052120bc91bc179d9ac8756c07015436061dc919)\n\n图：陕西历史博物馆当前馆藏页原图，未裁切、未调色；保留馆方水印。图片展示这件实物的一个外观角度，开放复用许可未核。\n\n在上半球正中，鸟纹横向展开，羽部由成排刻线表现；鸟下方有花叶形块面，曲枝穿行其间。中部两道实边相接，留下清楚的水平接缝；左前侧可见扣合部件。链条由顶部向右侧垂下，末端有较大的挂钩。透过镂空处能看见金色内层。\n\n照片中的银壳呈棕灰色，刻线边缘受光较亮。这里记录的是摄影下的现状色感；没有色卡、成分报告或清理记录，不能据此还原刚制成时的银色，也不能把所有暗色都确定为某一种氧化物。",
      "basisKind": "direct_observation",
      "sourceRefs": [
        {
          "sourceId": "src_object_photo",
          "locator": "完整1912×1280图；上半球中鸟、中央接缝、右侧链钩与镂空处",
          "note": "仅支持这张照片可见的外观和色感"
        }
      ],
      "attachmentIds": [
        "att_052120bc91bc179d9ac8756c07015436061dc919"
      ]
    },
    {
      "paragraphId": "para_object_20261002_inside",
      "heading": "打开后的图证：看得见的环架与香盂",
      "markdown": "![实物打开状态照片：中国矿大2021年转载的旧官网图片](attachment:att_099fd1ab578131652e8a479c01c785e2e994955e)\n\n图：中国矿业大学中华优秀传统文化传承基地2021年页面的打开状态图片；该页面署来源“陕西历史博物馆官方网站”。未改图。原始摄影许可与最初发布日期未核，不能写成新拍的官方图。\n\n左边半球内可以看见金色的小盂及包围它的环架；右边半球是翻开的球壳，链条放在一旁。这比闭合外观更直接地说明：小盂与外壳之间留有活动空间。照片没有标出每一个铆钉、轴线与转动范围，所以“双轴相连、内外环连接次序”仍须依据文字说明，不能说全部从此图独立验证。",
      "basisKind": "direct_observation",
      "sourceRefs": [
        {
          "sourceId": "src_object_interior",
          "locator": "693×462打开状态图；左侧小盂与环架、右侧球盖",
          "note": "支持静态内景与读取边界"
        }
      ],
      "attachmentIds": [
        "att_099fd1ab578131652e8a479c01c785e2e994955e"
      ]
    },
    {
      "paragraphId": "para_object_20261002_construction",
      "heading": "馆藏说明：材料、开合和持平结构",
      "markdown": "中国矿大保存的旧官网介绍记载：外壳为银质，两半球可开合；下半球中有两层银质机环，内置半球形香盂，部件之间通过银铆钉连接。材料表述需分层看：当前官网仅分类为“金银器”；旧馆文转载称内部为“金香盂”；Fang同件图2–3的整体材质图注则是“银，局部鎏金”。整体图注未逐一交代每个部件，以上不能由本轮合并成“内盂经检测为纯金”。因此观察段只称金色小盂，旧文材质描述按来源保留；成分与鎏金范围未实测。\n\n可以按“壳—外环—内环—盂”理解连接关系：壳偏转，环架给小盂留下转动自由；在重力作用下，较低的重心趋向下方，使盂口保持朝上。馆方2022年现代说明亦介绍这一效果。它依赖活动结构与重力，不能仅因为外形近似就说器物里有高速旋转的现代陀螺。\n\n结构适合携带或悬挂这一判断，有链钩与盛香盂作依据；把此件具体安排在衣袖、车帐、被褥还是某种仪式里，则缺少直接使用记录。尤其不能把“减少倾洒”升级为“任何晃动都不会漏火、不会烫伤”。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_object_cumt",
          "locator": "图解首段，从“香囊外壁用银制”至“香盂始终保持重心向下”",
          "note": "支持材料、部件与重力说明；是校方转载旧馆文，不是实物检测"
        },
        {
          "sourceId": "src_object_mechanism",
          "locator": "正文第二段，钩链/活轴及香料不洒说明",
          "note": "支持当前馆方对持平效果的现代介绍"
        },
        {
          "sourceId": "src_object_collection",
          "locator": "时期/尺寸/材质字段",
          "note": "支持现官网金银器分类"
        },
        {
          "sourceId": "src_object_fang",
          "locator": "Figures 2–3图注：Silver, partially gilded",
          "note": "支持研究图注对同件整体材质的描述，未交代各部件成分"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_object_20261002_craft",
      "heading": "工艺依据及能说到哪里",
      "markdown": "Flavia Xi Fang在2024年研究中把这类唐代香囊的制作概括为锤揲银片成形、用錾具镂空；何家村例列在图2–3。本轮按研究者的工艺归纳使用，未对这件实物检测工具痕、焊口或鎏金层。",
      "basisKind": "author_interpretation",
      "sourceRefs": [
        {
          "sourceId": "src_object_fang",
          "locator": "Tang Incense Spheres and Their Sites of Discovery；Figures 2–3；“All the Tang spherical censers ... beaten silver”段",
          "note": "支持工艺通类归纳；不能替代此件的工序检测"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_object_20261002_beauty",
      "heading": "研究解释：两个可继续看的点",
      "markdown": "**外面活动，里面安定。** 这件器物的趣味并不止于“机关复杂”：环架把外壳的姿态和盛香盂的姿态分开了。若后续运动证据与文字一致，观看时就能同时看见外部变化与内部保持。这是一种由结构造成的形式关系；“人在动荡中守住中心”是我们可以借用的表达，并非已核的唐代器物寓意。\n\n**线条既描画，也留出空隙。** 鸟的轮廓、叶片块面、细枝曲线与孔洞交替出现。静态近景可以让视线从鸟羽进入枝条，再穿到金色内盂；换一个受光角度，线条明暗也会改变。银壳不是单纯给小盂套上花纹，它把内外两层同时交给观看者。不过拍光是否产生清楚纹样投影、烟是否沿特定孔洞流动，都需要实拍或物理模拟，不能从这张照片编出来。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "src_object_photo",
          "locator": "上半球鸟纹及枝叶镂空局部",
          "note": "分析依据是实际观察的线面与孔洞"
        },
        {
          "sourceId": "src_object_mechanism",
          "locator": "持平说明段",
          "note": "相对运动判断依据为馆方文字，运动本身未核"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_object_20261002_symbol",
      "heading": "解释差异：花鸟纹没有唯一答案",
      "markdown": "Fang把何家村飞鸟、葡萄与花纹作为波斯及地中海艺术联系的线索；这是比较研究解释，不能直接指定每个纹样的原始寓意。",
      "basisKind": "author_interpretation",
      "sourceRefs": [
        {
          "sourceId": "src_object_fang",
          "locator": "Tang Incense Spheres and Their Sites of Discovery；Hejiacun段的装饰描述",
          "note": "支持作者的艺术联系解释，不支持唯一传播路线或唯一象征"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_object_20261002_symbol_unknown",
      "heading": "“多子多福”与“爱情信物”的边界",
      "markdown": "“多子多福”“富贵”“忠贞爱情”可以成为今天的观看联想，但本轮没有读到这件器物的唐代题记或原主解释，不能把这些词写成它的确定原意。葡萄纹名称证明识别题材，不等于已经证明古人的祝愿。\n\n杨贵妃身边出现“香囊”的文献故事，也不能把此件何家村器物认领给她：地点与物件身份并没有被同一证据链连接。研究论文还提醒，“香囊”可以指织物袋或金属器，不能只凭香囊保存完好便确定材质。本轮未直接核《旧唐书》原页，因而不重讲该故事，更不从它反推此件的主人。",
      "basisKind": "unknown",
      "sourceRefs": [
        {
          "sourceId": "src_object_fang",
          "locator": "名称讨论中Lady Yang’s scented sachet段；织物袋/金属器的识别问题",
          "note": "支持作者提出的名物识别争议；原始古籍本轮未读"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_object_20261002_dating",
      "heading": "年代与尺寸：保留能够改变判断的差异",
      "markdown": "当前官网和公开目录均给“唐”，本轮不把它缩成某一年。1970年10月是现代发掘时间；2021年校方转载、2022年馆方介绍和2024年论文是现代资料时间，都不是制造年代。器物制作、后来使用与最后埋入窖藏也不是同一时点。\n\n当前馆方两处数据一致为直径4.5厘米；2021年旧官网转载记高、宽4.6厘米，2024年论文图注也记直径4.6厘米。差别很小，但没有测量说明，不能宣布谁量错或擅自统一。本次采用当前馆方4.5厘米作识别值，保留4.6厘米这一资料差异；制作精密复原时仍须向馆方核尺寸与轴件细节。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_object_catalogue",
          "locator": "sheet1 第634行 D/G/I/J列",
          "note": "支持唐代与4.5/7.5/36g数据"
        },
        {
          "sourceId": "src_object_collection",
          "locator": "时期与尺寸字段",
          "note": "支持当前官网数据"
        },
        {
          "sourceId": "src_object_cumt",
          "locator": "规格及发布日期",
          "note": "支持2021年转述的4.6厘米"
        },
        {
          "sourceId": "src_object_fang",
          "locator": "Figures 2–3图注",
          "note": "支持研究图注的4.6厘米"
        },
        {
          "sourceId": "src_object_hoard",
          "locator": "简介首段",
          "note": "支持发掘时间"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_object_20261002_origin",
      "heading": "暂不讲一条确定的发明史",
      "markdown": "“汉代丁缓造炉，一路发展成现代陀螺仪”需要连续的文本、实物与传播证据。Fang指出这条直系联系及唐代器物的确切来源尚未坐实。本轮没有补核其所引古籍，因此只保留争议，不断言汉代实物已被发现、此件发明于唐朝，或它直接启发了航天设备。",
      "basisKind": "unknown",
      "sourceRefs": [
        {
          "sourceId": "src_object_fang",
          "locator": "Ding Huan/Xijing zaji争议段；结论末段",
          "note": "支持研究者对谱系和来源的不确定判断"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_object_20261002_creative",
      "heading": "创作联想·候选：先留动作与条件",
      "markdown": "**候选一：缓转与朝上。** 在明确标注的复原模型上，外壳缓慢倾转，镜头贴近环架与盂口，观察两者是否产生可读的相对运动。可表达外界变化中保留一处安定，也可纯粹拍“一个精巧结构怎样工作”。成立条件是模型结构正确、运动清楚；不需要把它安给真实唐代人物或预写爱情情节。\n\n**候选二：从鸟羽到内部的金色。** 先给外壳侧光近景，让羽毛与叶脉刻线出现；再由接缝打开到内盂，把观看从表面纹样引到使用结构。可以观察手怎样握球、链钩怎样悬挂、盖体怎样打开，但姿势必须由复原件验证；动作不等于唐代使用礼仪。声音可以从复原件采集细小链响与开合声，不能宣称古物本身有某种固定音色。\n\n若需要烟，先决定是有出处的燃香复原还是明确的艺术效果；本轮没有香料配方、燃烧状态或烟量证据。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "src_object_photo",
          "locator": "外壳刻线、接缝、链钩及透见内盂局部",
          "note": "支持可取近景细节"
        },
        {
          "sourceId": "src_object_interior",
          "locator": "打开状态图",
          "note": "支持表面与内部的视觉转换"
        },
        {
          "sourceId": "src_object_mechanism",
          "locator": "持平说明段",
          "note": "提供待动态核验的动作假设"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_object_20261002_method",
      "heading": "方法与读取记录",
      "markdown": "本阶段由AI设定焦点，未记录小陌个人感受。实际查阅当前馆藏页、馆方金银器目录对应行、何家村展览说明与器物官方现代介绍；下载并目验1912×1280馆方外观图，及693×462校方转载旧官网内景图。目录下载的原件为XLSX，未执行其中内容；仅解析工作表XML核对字段。\n\n2024年论文实际读了与何家村对象、工艺、名称争议、起源及结论有关的正文，未逐一打开全部脚注原书。CBETA页面仅能读取导航外壳，未取得目标古籍正文；MDPI论文访问受限，未作为已读论据。未做古籍OCR、金属成分检测、残留分析、动态演示审看或燃烧试验。\n\n外观图保留原水印，内景图保留转载现状，无裁切、调色与生成示意。馆站声明版权所有，转载图的原始许可亦不明；仅作本地研究参考，公开发布或商业复用前需核对授权。图像登记与正式阶段保存由总控通过现有受控API完成；本稿生成不代表已经写库。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "src_object_collection",
          "locator": "当前页面及页尾版权",
          "note": "登记读取方式与版权边界"
        },
        {
          "sourceId": "src_object_catalogue",
          "locator": "sheet1 第634行；文件哈希见原件meta",
          "note": "登记目录解析边界"
        },
        {
          "sourceId": "src_object_interior",
          "locator": "打开状态图及其来源页面",
          "note": "登记图片读取与转载关系"
        },
        {
          "sourceId": "src_object_fang",
          "locator": "实际所读对象段、命名争议段及结论",
          "note": "登记有限章节范围"
        }
      ],
      "attachmentIds": []
    }
  ],
  "sources": [
    {
      "sourceId": "src_object_collection",
      "kind": "external",
      "title": "陕西历史博物馆：葡萄花鸟纹银香囊",
      "locator": "时期/尺寸/材质字段及页尾版权",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际完整读取对象字段；“藏品介绍”当前无正文；未核动态展出状态",
      "licenseStatus": "unknown；未见允许公开/商业复用的开放许可",
      "uri": "https://www.sxhm.com/collections/detail/9948.html"
    },
    {
      "sourceId": "src_object_catalogue",
      "kind": "external",
      "title": "陕西历史博物馆公开藏品目录：金银器类",
      "locator": "XLSX xl/worksheets/sheet1.xml，第634行 A–J列",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际下载XLSX原件、解析sharedStrings与sheet1；核第634行及列标题，未全面研究其他器物",
      "licenseStatus": "unknown；未见允许公开/商业复用的开放许可",
      "uri": "https://www.sxhm.com/down/news/502.html"
    },
    {
      "sourceId": "src_object_hoard",
      "kind": "external",
      "title": "陕西历史博物馆：何家村窖藏出土文物展",
      "locator": "展览简介首段",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际读取展览说明；不把宏观展览介绍当此件使用履历",
      "licenseStatus": "unknown；未见允许公开/商业复用的开放许可",
      "uri": "https://www.sxhm.com/Hejia_village.html?_isa=1"
    },
    {
      "sourceId": "src_object_hoard_link",
      "kind": "external",
      "title": "陕西历史博物馆：黄河流域文明故事系列短片介绍",
      "locator": "正文“来自何家村窖藏”段",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际读网页说明，未点击/审看手绘动画，不从动画提物证",
      "licenseStatus": "unknown；未见允许公开/商业复用的开放许可",
      "uri": "https://www.sxhm.com/info/news/detail/16055.html"
    },
    {
      "sourceId": "src_object_mechanism",
      "kind": "external",
      "title": "陕西历史博物馆：花鸟添香数字文创的原型与结构说明",
      "locator": "正文第二段",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际读馆方现代文字说明；原型器物与二次创作动画分开，未观看动画",
      "licenseStatus": "unknown；未见允许公开/商业复用的开放许可",
      "uri": "https://www.sxhm.com/info/news/detail/1334.html"
    },
    {
      "sourceId": "src_object_cumt",
      "kind": "external",
      "title": "中国矿业大学：陕西历史博物馆馆藏（2021年旧官网转载）",
      "locator": "规格/图解首段/“资料来源：陕西历史博物馆官方网站”",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际读页面及两图；明确是校方转载旧馆文，并非独立物证；图解后段古籍转引未核原书",
      "licenseStatus": "unknown；未见允许公开/商业复用的开放许可",
      "uri": "https://ilovehsiangbao.cumt.edu.cn/info/1053/1226.htm"
    },
    {
      "sourceId": "src_object_photo",
      "kind": "external",
      "title": "陕西历史博物馆实物原图：外观",
      "locator": "完整1912×1280图；上半球鸟、接缝、链钩",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际下载并目验完整图，未裁切调色；仅一个静态外观角度",
      "licenseStatus": "馆方水印与官网版权所有；仅本地研究参考，公开/商业复用许可未核",
      "uri": "https://www.sxhm.com/Uploads/Picture/2023/03/03/s64019e0a01903.JPG"
    },
    {
      "sourceId": "src_object_interior",
      "kind": "external",
      "title": "中国矿大转载旧馆图：香囊打开状态",
      "locator": "完整693×462图；左半球香盂与环架",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际下载并目验；转载页署来源陕西历史博物馆官方网站，原始摄影页面/日期未核",
      "licenseStatus": "unknown；原始摄影和转载授权未核，仅本地研究参考",
      "uri": "https://ilovehsiangbao.cumt.edu.cn/__local/9/ED/6F/30291D06A96B0810C3015136CA8_B27A7C9A_8211.png"
    },
    {
      "sourceId": "src_object_fang",
      "kind": "external",
      "title": "Flavia Xi Fang（2024）：Scent, Art and Astronomy",
      "locator": "Figures 2–3；Tang Incense Spheres and Their Sites of Discovery；Ding Huan与香囊命名争议段；结论",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际读取何家村例图注、工艺段、命名与文献争议段、结论；不等于逐件核了所引古籍或全部参考书",
      "licenseStatus": "开放阅读；图像另有原书出处，未据开放访问推断图像可自由复用",
      "uri": "https://journals.sagepub.com/doi/10.1177/09719458231226000"
    }
  ],
  "researchStatus": "stage_complete",
  "materialVersions": [
    {
      "materialId": "mat_df70761e-8a7d-4421-90d0-231f90d0f15a",
      "revision": 1
    }
  ],
  "author": "ai"
}
~~~~


## 记录 14：stage_7bf3acab-f8e3-42a9-a0eb-4ed6812e836f

- `id`：stage_7bf3acab-f8e3-42a9-a0eb-4ed6812e836f
- `topic_id`：topic_13617e30-a4f2-4e1e-b693-def92a386ef9
- `topic_revision`：2
- `created_at`：2026-10-02T18:07:35.181Z

### 原字段 `body_json`

~~~~json
{
  "focus": "AI实测假设：完整理解宋定伯条，研究轻重/渡水声的身份试探及问禁忌—唾羊—售卖照应；不记成小陌感受。",
  "confirmed": [
    "完整读今本《搜神记》宋定伯条，目验四库影印对应三页；扫描具体阁本未核。",
    "正文写夜行、佯称鬼、互背、禁忌、渡水、强背入市、化羊及得钱离去；未明写鬼先害人。",
    "两处类书所读完整转引均归《列异传》，不等于读到独立早期原本。",
    "今本末句含石崇；所读类书条末未提石崇，不据此确定人物年代。"
  ],
  "candidates": [
    "以承重差异和一有一无的渡水声表现身份试探。",
    "保留落地成羊与售卖落点，观察同行关系转为控制。"
  ],
  "parked": [
    "全面重建今本辑佚与诞生史。",
    "普遍唾鬼习俗断言。",
    "服饰、市场、钱币、时辰、配乐与完整剧本。"
  ],
  "unknown": [
    "故事形成过程、最初讲述者及发生年代未知。",
    "鬼的意图、定伯预谋、羊与买主后续未交代。",
    "水声句第二字、宗/宋和扫描阁本待补证。"
  ],
  "nextStep": "本轮两项形式问题已可定位回答。若转创作，先由小陌选身份试探或关系转为交易的感觉，再核最少必要时代视觉资料；当前不继续扩写。",
  "limitations": [
    "AI实测焦点非用户原话、感受、学习经历或采用方向。",
    "完整读本条并目验四库影印三页；扫描具体阁本待核；类书仅核数字条文，未核原页；未通读三书。",
    "题署与今本来历存疑分开；未完成早期《列异传》、辑佚史或起源考证。",
    "水声字形与宗/宋差异待精校，未改原文或宣布古本异文。",
    "未补编鬼意图、定伯预谋与后续。页图公开复用许可未核。",
    "未生成短片或获用户/真人观众评价；视觉复原与普遍民俗未研究。"
  ],
  "paragraphs": [
    {
      "paragraphId": "para_song_preview_20261002",
      "heading": "收藏预览",
      "markdown": "宋定伯夜行遇鬼，假装自己也是鬼。一路互背、渡水后，他把鬼带到宛市；鬼化成羊，被他唾后卖掉。这是《搜神记》卷十六的一则短篇。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_song_sgj",
          "locator": "卷十六8b末—9b前；KR3l0099_016.txt L149—163",
          "note": "完整条支持相遇、同行与售羊结局。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_song_overview_20261002",
      "heading": "内容概要",
      "markdown": "南阳人宋定伯年少时，在夜路上碰见一个自称是鬼的同行者。对方反问他是谁，他骗说自己也是鬼。两人都说要去宛市——故事里双方想去的集市——便一起走了几里。鬼嫌步行太慢，提议轮流背对方，定伯答应了。\n\n鬼先背定伯，发现他很重，怀疑他不是鬼。定伯解释说自己刚成为鬼，所以身体还重；换他背鬼时，鬼几乎没有重量。这样轮换几次，定伯又借“我才成为鬼，不懂禁忌”问鬼怕什么，得到“不喜欢人唾”的回答。遇到水，他让鬼先过，听不到水声；自己过水却发出声响。鬼再次追问，他仍用新死、还不习惯渡水来解释。\n\n将到宛市时，定伯把鬼背在肩上，抓紧它，不理会它大叫着要求下来。到了集市，他把鬼放到地上，鬼变成一只羊。定伯卖它，又怕它再变化，向它吐唾，最后得到一千五百钱离开。本条还附一句石崇谈论“定伯卖鬼得钱”的说法。\n\n这就是本轮完整读到的故事。它没有说明定伯为何夜行、鬼为何去集市，也没有明确写鬼要伤害他；买主、羊后来怎样、鬼是否报复均未交代。条末石崇说法属于所读文本的记载，不能单凭它确定事情发生年代。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_song_sgj",
          "locator": "8b末—9a前半；L149—155",
          "note": "支持人物、相遇、目的地与轮换背负。"
        },
        {
          "sourceId": "src_song_sgj",
          "locator": "9a后半—9b前；L156—163",
          "note": "支持问禁忌、渡水、入市、化羊、唾及结尾；从完整条确认未交代部分。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_song_encounter_20261002",
      "heading": "原文与白话·夜路相遇",
      "markdown": "以下原文采用已下载的Kanripo WYG（文渊阁四库本标签）数字转录；本执行者为阅读加了标点，原字未依照通行译文改写。白话为本执行者自译。\n\n> 南陽宋定伯年少時，夜行逢鬼，問之。鬼言：“我是鬼。”鬼問：“汝復誰？”定伯誑之，言：“我亦鬼。”鬼問：“欲至何所？”答曰：“欲至宛市。”\n\n**白话：**南阳的宋定伯年轻时，夜里赶路，碰到了鬼，便询问它。鬼说：“我是鬼。”鬼反问：“你又是谁？”定伯骗它，说：“我也是鬼。”鬼问：“你要去哪里？”他答：“我要去宛市。”\n\n![古籍影印原页：四库影印卷十六第八叶背，故事起句在左侧末两列](attachment:att_8976cb5178e5cf1948e402f4b05834da4dfb0054)\n\n**图证说明：**Internet Archive数字件06050852.cn，元数据记浙江大学图书馆贡献、CADAL资助，PDF第117页=原书卷十六第八叶背。本条从图左侧末两列“南陽宋定伯”开始，续到下一叶正面；图中其余条目不是本案正文。此图是古籍影印页，由原PDF渲染、未重绘文字，不是现代插画或复原图。扫描件只明确四库影印，具体阁本身份尚未核定，不能仅因文字相近就称已核Kanripo的WYG底本。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_song_sgj",
          "locator": "8b末—9a首；L149—152",
          "note": "起句与目的地。"
        },
        {
          "sourceId": "src_song_scan",
          "locator": "PDF117=卷十六8b，左侧末两列",
          "note": "实际目验故事起句与原页位置。"
        },
        {
          "sourceId": "src_song_metadata",
          "locator": "metadata.contributor/scanningcenter/sponsor/description",
          "note": "图书馆贡献、CADAL及四库影印说明；未明确具体阁本。"
        }
      ],
      "attachmentIds": [
        "att_8976cb5178e5cf1948e402f4b05834da4dfb0054"
      ]
    },
    {
      "paragraphId": "para_song_journey_20261002",
      "heading": "原文与白话·轮换背负，渡水露出差别",
      "markdown": "> 鬼言：“我亦欲至宛市。”遂行數里。鬼言：“步行太遲，可共遞相擔，何如？”定伯曰：“大善。”鬼便先擔定伯數里。鬼言：“卿太重，將非鬼也。”定伯言：“我新鬼，故身重耳。”定伯因復擔鬼，鬼畧無重。如是再三。定伯復言：“我新鬼，不知有何所畏忌。”鬼答言：“惟不喜人唾。”於是共行。道遇水，定伯令鬼先渡，聼之，了然無聲音。定伯自渡，漕漼作聲。鬼復言：“何以有聲？”定伯曰：“新死，不習渡水，故耳。勿怪吾也。”\n\n**白话：**鬼说它也要去宛市，双方一起走了几里。鬼提议：“走路太慢，我们轮流背对方，好不好？”定伯说：“很好。”鬼先背他走了几里，发觉他很重，怀疑他不是鬼。他说：“我才成为鬼，所以身体还重。”换定伯背鬼时，鬼几乎没有重量。如此轮换几次，他又问：“我才成为鬼，不知道有什么害怕或忌讳的事。”鬼回答：“只是不喜欢人向我吐唾。”两人接着走。路上碰到水，定伯让鬼先渡，听不到声响；他自己过水却发出水声。鬼追问缘故，他回答：“我刚死，还不习惯渡水，所以才这样。别觉得我奇怪。”\n\n“遞相擔”在这里是轮流背负，不是抬轿；“如是再三”译反复轮换，未硬定为三次。“新鬼”是定伯说出来的假身份，不是叙述者确认他真的死了。\n\n![古籍影印原页：四库影印卷十六第九叶正，互背、问禁忌及渡水在本页](attachment:att_4c3183ce84c7afe58eb1fe42274cc54ab8adbf2e)\n\n**图证说明：**PDF第118页=卷十六第九叶正，本页连续含互背、问禁忌、无声渡水、有声渡水及将至宛市，未重绘。Kanripo转录“漕漼”第二字与所看影印字形仍待精校；由于具体阁本同一性也未核，暂留字形问题，不宣布古本异文。白话只取前后文明确的“发出水声”，不依赖定字。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_song_sgj",
          "locator": "9a；L152—159",
          "note": "轮换、轻重、假身份、禁忌与渡水声音。"
        },
        {
          "sourceId": "src_song_scan",
          "locator": "PDF118=卷十六9a，全页；水声句在左侧第二列",
          "note": "已目验对应文本；保留字形与具体阁本未核。"
        }
      ],
      "attachmentIds": [
        "att_4c3183ce84c7afe58eb1fe42274cc54ab8adbf2e"
      ]
    },
    {
      "paragraphId": "para_song_market_20261002",
      "heading": "原文与白话·从同行者到待售的羊",
      "markdown": "> 行欲至宛市，定伯便擔鬼著肩上，急執之。鬼大呼，聲咋咋然，索下。不復聽之，徑至宛市中，下著地，化為一羊，便賣之。恐其變化，唾之，得錢千五百，乃去。當時石崇有言：“定伯賣鬼，得錢千五。”\n\n**白话：**快到宛市时，定伯把鬼背到肩上，紧紧抓住。鬼高声叫喊，要求下来；定伯不再听它，直接走进集市，放它到地上，它化成一只羊。定伯便卖这只羊，怕它再变化，又向它吐唾，得到一千五百钱后离开。所读本还说，当时石崇有“定伯卖鬼，得钱一千五百”这句话。\n\n本条没有交代鬼为什么化羊，也没有说羊后来被宰。吐唾的目的由“恐其變化”交代；这不等于文字说唾液把鬼消灭了，或它从此永远不能变化。交易、唾和收钱是文本连续叙述的动作，具体交割瞬间没有细写。\n\n![古籍影印原页：四库影印卷十六第九叶背，强背、化羊、唾与得钱在右侧前三列](attachment:att_9e0fdcad71918210f9ceda182be289a5d619362d)\n\n**图证说明：**PDF第119页=卷十六第九叶背，本条只占右侧前三列，“吴王夫差女”以下已经进入另一则。不能拿下一则的恋爱、死因或时代补入宋定伯条。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_song_sgj",
          "locator": "9a末—9b前；L159—164",
          "note": "结尾、石崇附句及下一条边界。"
        },
        {
          "sourceId": "src_song_scan",
          "locator": "PDF119=卷十六9b，右侧前三列与后续起句",
          "note": "已目验结尾和文本边界。"
        }
      ],
      "attachmentIds": [
        "att_9e0fdcad71918210f9ceda182be289a5d619362d"
      ]
    },
    {
      "paragraphId": "para_song_identity_analysis_20261002",
      "heading": "研究解释·一个假身份怎样连续补住破绽",
      "markdown": "本轮测试焦点之一是：这篇短文为什么无需交代鬼的外貌，仍能让人感觉双方不一样。答案首先在可以感受的小差别里：鬼背人觉得沉，人背鬼却几乎无重；鬼渡水无声，人渡水有声。重量属于身体触觉，水声属于听觉，两次都让鬼追问身份。\n\n定伯反复沿用“新鬼／新死”：第一次解释身体为什么重，中途以不熟禁忌换取信息，第二次解释为什么渡水出声。同一套身份说辞承担三个动作，使问禁忌嵌在结伴行路里；后面的唾又使用了先前得到的信息。这是由段落先后关系得到的叙述结构解释。\n\n**反证与边界：**正文没有写鬼已完全信任他，也没有写定伯从相遇时就计划卖鬼。“新死”说辞的反复可看作应变，也可在改编中表现成逐步试探；两种心理读法都要由作品另行选择，不能倒写成古文事实。这里也不把“鬼略无重”扩展为所有古代鬼都无重量的知识。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "src_song_sgj",
          "locator": "9a L154—158；9b L162",
          "note": "轻重、身份追问、问禁忌和末尾唾的对应，是本执行者分析依据。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_song_market_analysis_20261002",
      "heading": "研究解释·奇事落到集市，关系也变了",
      "markdown": "第二个可深挖的点是观察现有结尾怎样改变关系。初遇时鬼会说话、提议同行和互背；将至宛市，定伯从轮换背负变成紧抓不放，不再理会鬼的要求；落地后鬼化为羊，接着成为可出售的对象。叙述把“交谈者—背负物—待售的羊”连续放在一起，最后只留下收到钱和离去。\n\n这使超常事件拥有很具体的日常落点：故事没有展开一场法术决斗，而是把说话的鬼带进交易。前面问“不喜人唾”，结尾用唾防变化，也把信息变成了动作。本执行者因此认为，短片可以关注身份和关系的改变，以及结尾的干脆。\n\n**另一种读法必须留着：**从鬼的遭遇看，开头它如实自报身份、提议互背，后面却被抓走售卖。原文未明写它先害人，所以“定伯战胜恶鬼、为民除害”不能直接当事实概要；同样，没写害人不足以证明鬼一定善良。喜剧、诡异或带一点不安，都是可能语气，尚无读者反馈能确定哪一种更有效。这里只是本执行者的研究解释，不是在断言古代人普遍怎样理解鬼或买卖。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "src_song_sgj",
          "locator": "8b L149—150；9a L152—159；9b L161—163",
          "note": "自报身份、互背、强抓、索下、化羊与售卖支持关系变化分析；道德判断另行限定。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_song_creative_20261002",
      "heading": "创作联想·两个可观察的候选",
      "markdown": "**候选一：让身体和声音先于解释被感到。**同一段路上，背人的一方需要承重，换背鬼的一方却几乎不用承重；浅水处先过的脚步听不到水声，后过的脚步有清楚水声。肩膀下沉、呼吸是否费力、脚入水的声响可以成为可表演、可听见的细节。原文只支持轻重和涉水声的差异，具体呼吸、身形与动作幅度是改编假设，须以后用表演/声画样段判断。\n\n**候选二：保留落地成羊的简洁。**围绕肩上求下的声音、紧抓的手、落地后的羊及卖得钱这几个正文已有动作，寻找奇事突然落入普通交易的感觉。羊是否继续用人声、变形是否可见、买主是否察觉、市场是什么时辰，古文没有规定；每加一项，都应标为改编选择。\n\n两项可以任选其一，也可组合。当前没有生成影片、没有人类观众评价，没有把候选记成小陌已采用方向；这里给的是进入创作前可验证的细节，不是完整剧本或分镜。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "src_song_sgj",
          "locator": "卷十六9a—9b；L153—163",
          "note": "候选依据承重、涉水、抓持、化羊与售卖；其余声画细节明确为改编。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_song_time_20261002",
      "heading": "时间与底本·题署晋人，不等于已读东晋原稿",
      "markdown": "本轮固定对象是二十卷今本中的宋定伯条。主文本读Kanripo标为WYG（文渊阁四库全书）的数字转录；图证读图书馆贡献的四库影印三页，具体阁本身份待核。应把四层时间分开：\n\n- **故事设定时间：**本条只写南阳、年少、夜行及宛市，未给年号或可确定的年份。石崇附句是文本记载，不能独自承担定年。\n- **作品作者与成书层：**所读提要称“旧本题曰晋干宝撰”，并记他在晋元帝时任官。这是作者题署与传记层，不是这份见证写成于东晋的证据，更不是本篇首次诞生日期。\n- **当前见证：**转录平台标文渊阁本；提要署乾隆四十三年三月（1778）。所读影印、现代扫描、PDF处理与数字转录是不同保存层次。本轮未读到早期干宝原本，扫描件也未独立核具体阁本。\n- **本次读取：**2026年10月2日固定下载内容、提交号、页码与哈希。这只是可重找的研究时点，不是故事形成日期。\n\n我们读到的是今本保存的一则故事，不能把“东晋作者题署”直接写成“故事在东晋首次诞生”。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_song_sgj",
          "locator": "完整条L149—163",
          "note": "本条未给年号，含石崇附句。"
        },
        {
          "sourceId": "src_song_preface",
          "locator": "提要000-1a—2a；L11—15、L30—31",
          "note": "旧本题署、元帝时任官及提要1778日期。"
        },
        {
          "sourceId": "src_song_metadata",
          "locator": "metadata.description/contributor/publicdate/ocr；PDF文件信息",
          "note": "四库影印与现代数字处理层；不把上传/处理日期当故事年代。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_song_preface_20261002",
      "heading": "馆臣解释·今本来历本来就留着疑问",
      "markdown": "所读清代提要已经提醒，不能直接把二十卷今本等同于干宝旧书。它先转引胡震亨的怀疑，认为书中存在后人附益；又由馆臣提出《搜神总记》与后人分卷的解释，最后明说“疑以傳疑，今姑仍舊題著之於録焉”。\n\n这里保留的是**清代馆臣的存疑和解释**。胡震亨跋、馆臣拿来比较的其他书，本轮没有逐一读原件；也未完成现代版本研究。因此，不把提要里的假说写成已经证实的完整重辑经过，不自行断言某位在何年重建了今本。这足以提示底本边界，尚不足以证明本篇的诞生过程。",
      "basisKind": "author_interpretation",
      "sourceRefs": [
        {
          "sourceId": "src_song_preface",
          "locator": "提要000-1b—2a；L17—30",
          "note": "清代馆臣的转引与存疑；不冒称已读胡跋原件。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_song_comparison_20261002",
      "heading": "版本对读·类书指向《列异传》，仍不能宣布起源",
      "markdown": "本轮另外完整读取了两份类书转引。\n\n**《太平广记》卷三百二十一“鬼六”宋定伯条**保存同一情节，条末作“當時有言定伯賣鬼得錢千五”，随后注明“出列異傳”。本轮所读数字正文没有“石崇”。\n\n**《太平御览》卷八百八十四所读四部丛刊转录**起首作“列異傳曰南陽宗定伯”，也写互背、问人唾、涉水、化羊及售卖，结尾作“于時名宗定伯賣鬼得錢千五百”。这里人名作“宗”，主文本和《太平广记》作“宋”。御览原页未核，暂记电子转录差异，不定哪一姓是原字。\n\n两处引书说明支持“所读类书把这则故事归到《列异传》”。但本轮没有实际读到早期《列异传》独立原本，也未辨明同名书作者；不能据此证明某位作者亲写、故事起源于某一朝代，或哪份是唯一原版。两部类书还可能依赖共同文本，不是两起历史事件的独立目击证词。\n\n对读改变了本轮判断：今本末句提到石崇，不再被拿来填主人公年代；“出《列异传》”保留为可查的传承线索。至于故事最初怎样诞生，仍不能确定。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_song_tpgj",
          "locator": "卷321-9a—9b；KR3l0118_321.txt L153—168",
          "note": "完整条、无石崇末句及出列异传。"
        },
        {
          "sourceId": "src_song_tpyl",
          "locator": "卷884-2a末—2b；KR3k0012_884.txt L48—59",
          "note": "完整转引、宗定伯、引书与末句。"
        },
        {
          "sourceId": "src_song_sgj",
          "locator": "卷十六9b；L163",
          "note": "主文本石崇附句对照。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_song_unknown_20261002",
      "heading": "尚未解决·哪些问题值得另开一小步",
      "markdown": "故事内容和本轮两项形式焦点已经能回答，但界限仍在：确切发生年代、口传形成过程、最初编者和独立早期底本未确定；鬼的意图、定伯的预谋、羊与买主后续未写。水声句第二字与“宗／宋”还需原页、更清楚版本精校；它们目前不改变“水声暴露身份差异”与完整结尾的基本理解。\n\n若要更严格考据，最小补证是先核《太平御览》这一叶原页和可靠校注，而非继续堆转载。若做时代具象化创作，先定改编设定，再独立查服饰、集市、钱币与使用动作；当前研究不足以认证某套视觉复原。",
      "basisKind": "unknown",
      "sourceRefs": [
        {
          "sourceId": "src_song_sgj",
          "locator": "完整条L149—163",
          "note": "已知与未写情节边界。"
        },
        {
          "sourceId": "src_song_tpyl",
          "locator": "卷884-2a末—2b；L48—59",
          "note": "宗定伯转录尚未核原页。"
        },
        {
          "sourceId": "src_song_scan",
          "locator": "PDF118水声句",
          "note": "已看原页仍留字形与阁本精校缺口。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_song_method_20261002",
      "heading": "方法与读取记录",
      "markdown": "本次为AI实测自设焦点，不是小陌的收藏感受、阅读经历或学习成果。按项目内传统溯源规程，实际读完整宋定伯条、提要与原序，完整读两处类书转引；邻接条目只核边界，未通读三书。Kanripo与影印均为相应底本的现代数字见证，未访问古代原件。\n\nKanripo《搜神记》固定commit 9959e70d799062d8dc3872225ce9a5b429ec5cac，卷16下载SHA-256 5337e1c7a22cc7850a659a9592da1f70a6228f7cca9260facdcb3b1cd69061e9；比较书固定提交与哈希见验证目录comparison-manifest.json。文本严格UTF-8读取，原条L149—163完整。三张页图用既有PyMuPDF从PDF渲染，实际目验117—119页，另看册首四库题页；OCR乱码未用于释义。整册只留验证目录，正式原件仅必要三页和[完整条行号摘录](attachment:att_db9516270888bcac31b9cee7a34167ab211d0c90)。\n\n主文本与扫描的情节和多数文字对应；扫描元数据及题页没有独立确认文渊阁身份，故只能说已核四库影印这三页，不能声明两者必是同一底本。页码、图证身份和限制均保留。\n\n访问失败包括Kanripo站点正文403、CText页403、维基文库API403；未绕过。实际可读取的GitHub公开源及图书馆贡献数字件用于研究，无新依赖、付费、模型下载或第三方私人附件上传。\n\n**复用边界：**古代正文用于必要引用，白话为本执行者自译。数字件元数据未给明确页图公开复用许可；三页用于本项目必要研究对读，不把附件登记许可字段当出版授权。对外发布页图或采用他人现代译文时，仍需核供应方条件。没有生成古籍页或历史复原图。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_song_sgj",
          "locator": "固定文件L149—163，commit及SHA-256",
          "note": "完整条与可重找的内容身份。"
        },
        {
          "sourceId": "src_song_preface",
          "locator": "提要L11—33，原序L36至末",
          "note": "实际读取范围。"
        },
        {
          "sourceId": "src_song_tpgj",
          "locator": "完整宋定伯条L153—168",
          "note": "完整转引读取范围。"
        },
        {
          "sourceId": "src_song_tpyl",
          "locator": "完整宗定伯条L48—59",
          "note": "完整转引读取范围。"
        },
        {
          "sourceId": "src_song_scan",
          "locator": "PDF117—119；整册SHA-256见来源信息",
          "note": "目验与派生页图范围，不依靠乱码OCR。"
        },
        {
          "sourceId": "src_song_metadata",
          "locator": "metadata及files；未见明确图像许可字段",
          "note": "来源身份与复用边界。"
        },
        {
          "sourceId": "src_song_excerpt",
          "locator": "完整条L149—163定位摘录全部",
          "note": "须受控登记并回读后换真实ID。"
        }
      ],
      "attachmentIds": [
        "att_db9516270888bcac31b9cee7a34167ab211d0c90"
      ]
    }
  ],
  "sources": [
    {
      "sourceId": "src_song_sgj",
      "kind": "external",
      "title": "《搜神记》WYG卷十六：宋定伯条固定数字转录",
      "locator": "卷十六8b末—9b前；L149—163",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际完整读本条，核前后边界；固定commit9959e70d799062d8dc3872225ce9a5b429ec5cac。17319字节SHA256 5337e1c7a22cc7850a659a9592da1f70a6228f7cca9260facdcb3b1cd69061e9；另目验四库影印三页，扫描具体阁本未核。",
      "licenseStatus": "古代正文必要引用；保留数字出处。中文白话为本执行者自译，未用他人现代译本。",
      "uri": "https://github.com/kanripo/KR3l0099/blob/9959e70d799062d8dc3872225ce9a5b429ec5cac/KR3l0099_016.txt#L149-L163"
    },
    {
      "sourceId": "src_song_preface",
      "kind": "external",
      "title": "《搜神记》WYG提要与原序：题署与今本存疑",
      "locator": "提要000-1a—2a；原序000-3a—3b",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际读完整数字提要与原序；未核该文件原页、未逐一读其转引书。2722字节SHA256 53f2c622c8f46796a61752b555404d21383a3152196243edf60ef1e8138baa5b。",
      "licenseStatus": "古代文本少量必要引用，不复制现代校注。",
      "uri": "https://github.com/kanripo/KR3l0099/blob/9959e70d799062d8dc3872225ce9a5b429ec5cac/KR3l0099_000.txt"
    },
    {
      "sourceId": "src_song_tpgj",
      "kind": "external",
      "title": "《太平广记》WYG卷321鬼六：宋定伯，出《列异传》",
      "locator": "卷321-9a—9b；完整条L153—168",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际读完整该条数字正文及尾注；固定commit7990feeb9c302e37942661d1b29abc22818cc204。下载哈希留comparison-manifest.json，未核本书原页。",
      "licenseStatus": "古代正文必要引用，保留数字出处。",
      "uri": "https://github.com/kanripo/KR3l0118/blob/7990feeb9c302e37942661d1b29abc22818cc204/KR3l0118_321.txt#L153-L168"
    },
    {
      "sourceId": "src_song_tpyl",
      "kind": "external",
      "title": "《太平御览》SBCK卷884：列异传曰南阳宗定伯",
      "locator": "卷884-2a末—2b；完整条L48—59",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际读完整条数字正文；固定commit42ba052ab54c733387ba30b62dcd4eacb34139b6。下载哈希留comparison-manifest.json；未核本书原页，宗/宋只暂记转录差异。",
      "licenseStatus": "古代正文必要引用，保留数字出处。",
      "uri": "https://github.com/kanripo/KR3k0012/blob/42ba052ab54c733387ba30b62dcd4eacb34139b6/KR3k0012_884.txt#L48-L59"
    },
    {
      "sourceId": "src_song_scan",
      "kind": "external",
      "title": "浙江大学图书馆贡献《搜神记·卷十一～卷二十》四库影印（具体阁本待核）",
      "locator": "PDF117、118、119页=卷十六8b、9a、9b；在线索引n116、n117、n118",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际下载6087363字节PDF，SHA256 c6baae55f8f9d4ebfc71a8aa8fda4e990bc05b18598833ac5185e2019b2202a8。定位并目验完整故事三页及册首四库题页，未通读207页。原页由PDF渲染、未重绘；元数据与题页未独立确认具体阁本。",
      "licenseStatus": "元数据未给明确页图公开复用授权；本项目必要三页研究对读，对外复用待核。",
      "uri": "https://archive.org/details/06050852.cn/page/n116/mode/1up"
    },
    {
      "sourceId": "src_song_metadata",
      "kind": "external",
      "title": "Internet Archive/CADAL数字件06050852.cn元数据",
      "locator": "metadata.description/contributor/scanningcenter/sponsor/publicdate/ocr及files",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际读JSON元数据及文件信息；四库影印、浙江大学图书馆贡献与CADAL资助据此记录。不用元数据证明精确印行年代、文渊阁身份或图像授权。",
      "licenseStatus": "少量事实元数据转述；图像许可未明确。",
      "uri": "https://archive.org/metadata/06050852.cn"
    },
    {
      "sourceId": "src_song_excerpt",
      "kind": "attachment",
      "title": "宋定伯完整条：固定原文行号定位摘录",
      "locator": "主文本L149—163，含pb叶码，全文",
      "accessedAt": "2026-10-02",
      "verificationScope": "从已下载固定commit文件摘录完整本条，保留行号与pb；须父执行者受控导入回读后替换真实ID。",
      "licenseStatus": "古代正文必要完整短条摘录；不含他人现代译文。",
      "attachmentId": "att_db9516270888bcac31b9cee7a34167ab211d0c90"
    }
  ],
  "researchStatus": "stage_complete",
  "materialVersions": [
    {
      "materialId": "mat_c5afa305-85dc-4bdd-8652-e7778fc89104",
      "revision": 1
    }
  ],
  "author": "ai"
}
~~~~


## 记录 15：stage_bbc6e50e-20f2-4f3c-a14b-d5d3b9106eac

- `id`：stage_bbc6e50e-20f2-4f3c-a14b-d5d3b9106eac
- `topic_id`：topic_ecf5858c-d3db-42c2-9ed7-56854e7f93fa
- `topic_revision`：3
- `created_at`：2026-10-02T18:17:40.243Z

### 原字段 `body_json`

~~~~json
{
  "focus": "测试假设（AI设定，非小陌原话）：何家村这枚小银香囊怎样把“可以活动的器物”与“细密的花鸟纹”放在一起？先核具体实物，再提可观察的短片候选。",
  "confirmed": [
    "馆方公开金银器目录第634行把七一127、唐镂空飞鸟葡萄纹银熏球与原名葡萄花鸟纹银香囊对应；当前官网记直径4.5cm、链长7.5cm、重36g。",
    "实际查看馆方外观原图和中国矿大2021年转载的打开状态照片；物件的运动未实际观察。",
    "馆方现代说明与旧官网转载说明支持持平结构；不能据此认证这件古物在任意颠簸下均绝对安全。"
  ],
  "candidates": [
    "以外壳缓转与内盂保持朝上的相对运动构成形式对照，先做可控复原或模型运动核验。",
    "用侧光、近景和开合动作表现羽毛刻线、空隙及内外金银色差，不把现代摄影色调当古代原貌。"
  ],
  "parked": [
    "杨贵妃爱情信物的具体归属、汉代发明者及通往现代陀螺仪的直系传播链：缺乏足以落实此件实物的证据，本轮不采用。",
    "不扩写端午民俗、香料百科或完整剧本。"
  ],
  "unknown": [
    "具体制作年份、作坊、主人与窖藏埋藏原因未定。",
    "这件器物曾用何种香料、燃料、香品形态和操作步骤未核；未查残留分析或燃烧测试。",
    "葡萄纹的原始寓意、花形的精确植物种属与鸟的物种没有本轮直接证据。",
    "4.5cm与旧介绍/研究图注4.6cm的测量口径差异未解释。",
    "内部小盂的成分与局部鎏金范围未实测；不能凭金色照片确定纯金。"
  ],
  "nextStep": "本轮可收束于具体身份、形制与静态图证。若采用外动内稳的创作候选，先用明确标注的复原模型或馆方运动演示核查相对运动，再决定画面；如要叙述古代燃香操作，先补具体香料/燃料与使用史证据。",
  "limitations": [
    "素材关注点由AI为真实流程实测设定，不是小陌个人感受，也不算个人学习进展。",
    "未接触、拆解或动态观看古物；照片不证明运动性能和温度安全。",
    "未直接读《一切经音义》《旧唐书》《西京杂记》的古籍原页；研究论文转引只按作者解释使用。",
    "2024论文实际阅读对象是何家村例图注、唐代器物/工艺段、名称与文献证据争议段及结论；其全部脚注所列原书未逐件查阅。",
    "官方照片与旧官网转载图片未见开放复用许可；本地研究参考不等于可用于公开号、商业短片或素材分发。"
  ],
  "paragraphs": [
    {
      "paragraphId": "para_object_20261002_preview",
      "heading": "收藏预览",
      "markdown": "一枚直径约4.5厘米的唐代银香囊：镂空球壳织入鸟与枝叶，馆方说明其内部持平结构可让盛香小盂保持朝上。研究对象是何家村出土、现藏陕西历史博物馆的具体一件。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_object_catalogue",
          "locator": "sheet1 第634行 A–J列",
          "note": "支持名称对应、唐代与尺寸"
        },
        {
          "sourceId": "src_object_hoard_link",
          "locator": "正文“来自何家村窖藏”段",
          "note": "支持具体出土来源"
        },
        {
          "sourceId": "src_object_mechanism",
          "locator": "正文第二段关于球囊与机环",
          "note": "支持馆方所述持平功能"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_object_20261002_overview",
      "heading": "内容概要",
      "markdown": "这件“葡萄花鸟纹银香囊”是一件金属熏香器，虽叫“囊”，外层却是能打开的球壳。它在1970年发现的西安何家村唐代窖藏中出土，现由陕西历史博物馆收藏。馆方公开目录的文物编号是“七一127”：现名“唐镂空飞鸟葡萄纹银熏球”，原名即“葡萄花鸟纹银香囊”，这里的两个名称指向同一条馆藏记录。\n\n按当前官网，它直径4.5厘米，链长7.5厘米，重36克。银球由两半扣合，链与挂钩提供悬挂条件；内部设环架和小香盂。现代说明指出，环架允许外壳转动时香盂仍保持朝上，使香料不易倾洒。这样的解释可以帮助理解结构，但本轮只看了静态照片，没有亲眼验证古物运动。\n\n它可看的重点有两处：花鸟纹既是表面装饰，也是穿透球壳的空隙；内部小盂与外部球壳可以有不同的运动姿态。谁使用过这一枚、焚烧过什么香料、为何埋藏，都还没有落实。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_object_catalogue",
          "locator": "sheet1 第634行 A–J列",
          "note": "支持编号、两个名称、年代和测量值"
        },
        {
          "sourceId": "src_object_hoard_link",
          "locator": "正文“来自何家村窖藏”段",
          "note": "支持器物的何家村来源"
        },
        {
          "sourceId": "src_object_hoard",
          "locator": "展览简介首段",
          "note": "支持1970年10月发掘背景"
        },
        {
          "sourceId": "src_object_cumt",
          "locator": "图解首段",
          "note": "支持银壳两半、环架及香盂形制；此为旧官网转载"
        },
        {
          "sourceId": "src_object_mechanism",
          "locator": "正文第二段",
          "note": "支持馆方现代持平说明"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_object_20261002_exterior",
      "heading": "先看这件实物：花纹、接缝与挂链",
      "markdown": "![馆方实物原图：葡萄花鸟纹银香囊外观，保留原水印](attachment:att_052120bc91bc179d9ac8756c07015436061dc919)\n\n图：陕西历史博物馆当前馆藏页原图，未裁切、未调色；保留馆方水印。图片展示这件实物的一个外观角度，开放复用许可未核。\n\n[查看馆藏原页](https://www.sxhm.com/collections/detail/9948.html) · [打开馆方原图](https://www.sxhm.com/Uploads/Picture/2023/03/03/s64019e0a01903.JPG)\n\n在上半球正中，鸟纹横向展开，羽部由成排刻线表现；鸟下方有花叶形块面，曲枝穿行其间。中部两道实边相接，留下清楚的水平接缝；左前侧可见扣合部件。链条由顶部向右侧垂下，末端有较大的挂钩。透过镂空处能看见金色内层。\n\n照片中的银壳呈棕灰色，刻线边缘受光较亮。这里记录的是摄影下的现状色感；没有色卡、成分报告或清理记录，不能据此还原刚制成时的银色，也不能把所有暗色都确定为某一种氧化物。",
      "basisKind": "direct_observation",
      "sourceRefs": [
        {
          "sourceId": "src_object_photo",
          "locator": "完整2048×1371图；上半球中鸟、中央接缝、右侧链钩与镂空处",
          "note": "仅支持这张照片可见的外观和色感"
        }
      ],
      "attachmentIds": [
        "att_052120bc91bc179d9ac8756c07015436061dc919"
      ]
    },
    {
      "paragraphId": "para_object_20261002_inside",
      "heading": "打开后的图证：看得见的环架与香盂",
      "markdown": "![实物打开状态照片：中国矿大2021年转载的旧官网图片](attachment:att_099fd1ab578131652e8a479c01c785e2e994955e)\n\n图：中国矿业大学中华优秀传统文化传承基地2021年页面的打开状态图片；该页面署来源“陕西历史博物馆官方网站”。未改图。原始摄影许可与最初发布日期未核，不能写成新拍的官方图。\n\n[查看2021年转载页及图](https://ilovehsiangbao.cumt.edu.cn/info/1053/1226.htm)\n\n左边半球内可以看见金色的小盂及包围它的环架；右边半球是翻开的球壳，链条放在一旁。这比闭合外观更直接地说明：小盂与外壳之间留有活动空间。照片没有标出每一个铆钉、轴线与转动范围，所以“双轴相连、内外环连接次序”仍须依据文字说明，不能说全部从此图独立验证。",
      "basisKind": "direct_observation",
      "sourceRefs": [
        {
          "sourceId": "src_object_interior",
          "locator": "693×465打开状态图；左侧小盂与环架、右侧球盖",
          "note": "支持静态内景与读取边界"
        }
      ],
      "attachmentIds": [
        "att_099fd1ab578131652e8a479c01c785e2e994955e"
      ]
    },
    {
      "paragraphId": "para_object_20261002_construction",
      "heading": "馆藏说明：材料、开合和持平结构",
      "markdown": "中国矿大保存的旧官网介绍记载：外壳为银质，两半球可开合；下半球中有两层银质机环，内置半球形香盂，部件之间通过银铆钉连接。材料表述需分层看：当前官网仅分类为“金银器”；旧馆文转载称内部为“金香盂”；Fang同件图2–3的整体材质图注则是“银，局部鎏金”。整体图注未逐一交代每个部件，以上不能由本轮合并成“内盂经检测为纯金”。因此观察段只称金色小盂，旧文材质描述按来源保留；成分与鎏金范围未实测。\n\n可以按“壳—外环—内环—盂”理解连接关系：壳偏转，环架给小盂留下转动自由；在重力作用下，较低的重心趋向下方，使盂口保持朝上。馆方2022年现代说明亦介绍这一效果。它依赖活动结构与重力，不能仅因为外形近似就说器物里有高速旋转的现代陀螺。\n\n结构适合携带或悬挂这一判断，有链钩与盛香盂作依据；把此件具体安排在衣袖、车帐、被褥还是某种仪式里，则缺少直接使用记录。尤其不能把“减少倾洒”升级为“任何晃动都不会漏火、不会烫伤”。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_object_cumt",
          "locator": "图解首段，从“香囊外壁用银制”至“香盂始终保持重心向下”",
          "note": "支持材料、部件与重力说明；是校方转载旧馆文，不是实物检测"
        },
        {
          "sourceId": "src_object_mechanism",
          "locator": "正文第二段，钩链/活轴及香料不洒说明",
          "note": "支持当前馆方对持平效果的现代介绍"
        },
        {
          "sourceId": "src_object_collection",
          "locator": "时期/尺寸/材质字段",
          "note": "支持现官网金银器分类"
        },
        {
          "sourceId": "src_object_fang",
          "locator": "Figures 2–3图注：Silver, partially gilded",
          "note": "支持研究图注对同件整体材质的描述，未交代各部件成分"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_object_20261002_craft",
      "heading": "工艺依据及能说到哪里",
      "markdown": "Flavia Xi Fang在2024年研究中把这类唐代香囊的制作概括为锤揲银片成形、用錾具镂空；何家村例列在图2–3。本轮按研究者的工艺归纳使用，未对这件实物检测工具痕、焊口或鎏金层。",
      "basisKind": "author_interpretation",
      "sourceRefs": [
        {
          "sourceId": "src_object_fang",
          "locator": "Tang Incense Spheres and Their Sites of Discovery；Figures 2–3；“All the Tang spherical censers ... beaten silver”段",
          "note": "支持工艺通类归纳；不能替代此件的工序检测"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_object_20261002_beauty",
      "heading": "研究解释：两个可继续看的点",
      "markdown": "**外面活动，里面安定。** 这件器物的趣味并不止于“机关复杂”：环架把外壳的姿态和盛香盂的姿态分开了。若后续运动证据与文字一致，观看时就能同时看见外部变化与内部保持。这是一种由结构造成的形式关系；“人在动荡中守住中心”是我们可以借用的表达，并非已核的唐代器物寓意。\n\n**线条既描画，也留出空隙。** 鸟的轮廓、叶片块面、细枝曲线与孔洞交替出现。静态近景可以让视线从鸟羽进入枝条，再穿到金色内盂；换一个受光角度，线条明暗也会改变。银壳不是单纯给小盂套上花纹，它把内外两层同时交给观看者。不过拍光是否产生清楚纹样投影、烟是否沿特定孔洞流动，都需要实拍或物理模拟，不能从这张照片编出来。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "src_object_photo",
          "locator": "上半球鸟纹及枝叶镂空局部",
          "note": "分析依据是实际观察的线面与孔洞"
        },
        {
          "sourceId": "src_object_mechanism",
          "locator": "持平说明段",
          "note": "相对运动判断依据为馆方文字，运动本身未核"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_object_20261002_symbol",
      "heading": "解释差异：花鸟纹没有唯一答案",
      "markdown": "Fang把何家村飞鸟、葡萄与花纹作为波斯及地中海艺术联系的线索；这是比较研究解释，不能直接指定每个纹样的原始寓意。",
      "basisKind": "author_interpretation",
      "sourceRefs": [
        {
          "sourceId": "src_object_fang",
          "locator": "Tang Incense Spheres and Their Sites of Discovery；Hejiacun段的装饰描述",
          "note": "支持作者的艺术联系解释，不支持唯一传播路线或唯一象征"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_object_20261002_symbol_unknown",
      "heading": "“多子多福”与“爱情信物”的边界",
      "markdown": "“多子多福”“富贵”“忠贞爱情”可以成为今天的观看联想，但本轮没有读到这件器物的唐代题记或原主解释，不能把这些词写成它的确定原意。葡萄纹名称证明识别题材，不等于已经证明古人的祝愿。\n\n杨贵妃身边出现“香囊”的文献故事，也不能把此件何家村器物认领给她：地点与物件身份并没有被同一证据链连接。研究论文还提醒，“香囊”可以指织物袋或金属器，不能只凭香囊保存完好便确定材质。本轮未直接核《旧唐书》原页，因而不重讲该故事，更不从它反推此件的主人。",
      "basisKind": "unknown",
      "sourceRefs": [
        {
          "sourceId": "src_object_fang",
          "locator": "名称讨论中Lady Yang’s scented sachet段；织物袋/金属器的识别问题",
          "note": "支持作者提出的名物识别争议；原始古籍本轮未读"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_object_20261002_dating",
      "heading": "年代与尺寸：保留能够改变判断的差异",
      "markdown": "当前官网和公开目录均给“唐”，本轮不把它缩成某一年。1970年10月是现代发掘时间；2021年校方转载、2022年馆方介绍和2024年论文是现代资料时间，都不是制造年代。器物制作、后来使用与最后埋入窖藏也不是同一时点。\n\n当前馆方两处数据一致为直径4.5厘米；2021年旧官网转载记高、宽4.6厘米，2024年论文图注也记直径4.6厘米。差别很小，但没有测量说明，不能宣布谁量错或擅自统一。本次采用当前馆方4.5厘米作识别值，保留4.6厘米这一资料差异；制作精密复原时仍须向馆方核尺寸与轴件细节。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_object_catalogue",
          "locator": "sheet1 第634行 D/G/I/J列",
          "note": "支持唐代与4.5/7.5/36g数据"
        },
        {
          "sourceId": "src_object_collection",
          "locator": "时期与尺寸字段",
          "note": "支持当前官网数据"
        },
        {
          "sourceId": "src_object_cumt",
          "locator": "规格及发布日期",
          "note": "支持2021年转述的4.6厘米"
        },
        {
          "sourceId": "src_object_fang",
          "locator": "Figures 2–3图注",
          "note": "支持研究图注的4.6厘米"
        },
        {
          "sourceId": "src_object_hoard",
          "locator": "简介首段",
          "note": "支持发掘时间"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_object_20261002_origin",
      "heading": "暂不讲一条确定的发明史",
      "markdown": "“汉代丁缓造炉，一路发展成现代陀螺仪”需要连续的文本、实物与传播证据。Fang指出这条直系联系及唐代器物的确切来源尚未坐实。本轮没有补核其所引古籍，因此只保留争议，不断言汉代实物已被发现、此件发明于唐朝，或它直接启发了航天设备。",
      "basisKind": "unknown",
      "sourceRefs": [
        {
          "sourceId": "src_object_fang",
          "locator": "Ding Huan/Xijing zaji争议段；结论末段",
          "note": "支持研究者对谱系和来源的不确定判断"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_object_20261002_creative",
      "heading": "创作联想·候选：先留动作与条件",
      "markdown": "**候选一：缓转与朝上。** 在明确标注的复原模型上，外壳缓慢倾转，镜头贴近环架与盂口，观察两者是否产生可读的相对运动。可表达外界变化中保留一处安定，也可纯粹拍“一个精巧结构怎样工作”。成立条件是模型结构正确、运动清楚；不需要把它安给真实唐代人物或预写爱情情节。\n\n**候选二：从鸟羽到内部的金色。** 先给外壳侧光近景，让羽毛与叶脉刻线出现；再由接缝打开到内盂，把观看从表面纹样引到使用结构。可以观察手怎样握球、链钩怎样悬挂、盖体怎样打开，但姿势必须由复原件验证；动作不等于唐代使用礼仪。声音可以从复原件采集细小链响与开合声，不能宣称古物本身有某种固定音色。\n\n若需要烟，先决定是有出处的燃香复原还是明确的艺术效果；本轮没有香料配方、燃烧状态或烟量证据。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "src_object_photo",
          "locator": "外壳刻线、接缝、链钩及透见内盂局部",
          "note": "支持可取近景细节"
        },
        {
          "sourceId": "src_object_interior",
          "locator": "打开状态图",
          "note": "支持表面与内部的视觉转换"
        },
        {
          "sourceId": "src_object_mechanism",
          "locator": "持平说明段",
          "note": "提供待动态核验的动作假设"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_object_20261002_method",
      "heading": "方法与读取记录",
      "markdown": "本阶段由AI设定焦点，未记录小陌个人感受。实际查阅当前馆藏页、馆方金银器目录对应行、何家村展览说明与器物官方现代介绍；下载并目验2048×1371馆方外观图，及693×465校方转载旧官网内景图。目录下载的原件为XLSX，未执行其中内容；仅解析工作表XML核对字段。\n\n2024年论文实际读了与何家村对象、工艺、名称争议、起源及结论有关的正文，未逐一打开全部脚注原书。CBETA页面仅能读取导航外壳，未取得目标古籍正文；MDPI论文访问受限，未作为已读论据。未做古籍OCR、金属成分检测、残留分析、动态演示审看或燃烧试验。\n\n外观图保留原水印，内景图保留转载现状，无裁切、调色与生成示意。馆站声明版权所有，转载图的原始许可亦不明；仅作本地研究参考，公开发布或商业复用前需核对授权。两张图像已通过现有受控API登记，并核验格式、原件哈希和持久收据。内景图的来源路径后缀为PNG，但原字节是JPEG；仅以正确的.jpg扩展名登记同一字节，未转换图像。本文第一版已保存于同一专题，当前修正版依据实际交接版本追加；持久化以提交收据及回读为准。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "src_object_collection",
          "locator": "当前页面及页尾版权",
          "note": "登记读取方式与版权边界"
        },
        {
          "sourceId": "src_object_catalogue",
          "locator": "sheet1 第634行；文件哈希见原件meta",
          "note": "登记目录解析边界"
        },
        {
          "sourceId": "src_object_interior",
          "locator": "打开状态图及其来源页面",
          "note": "登记图片读取与转载关系"
        },
        {
          "sourceId": "src_object_fang",
          "locator": "实际所读对象段、命名争议段及结论",
          "note": "登记有限章节范围"
        }
      ],
      "attachmentIds": []
    }
  ],
  "sources": [
    {
      "sourceId": "src_object_collection",
      "kind": "external",
      "title": "陕西历史博物馆：葡萄花鸟纹银香囊",
      "locator": "时期/尺寸/材质字段及页尾版权",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际完整读取对象字段；“藏品介绍”当前无正文；未核动态展出状态",
      "licenseStatus": "unknown；未见允许公开/商业复用的开放许可",
      "uri": "https://www.sxhm.com/collections/detail/9948.html"
    },
    {
      "sourceId": "src_object_catalogue",
      "kind": "external",
      "title": "陕西历史博物馆公开藏品目录：金银器类",
      "locator": "XLSX xl/worksheets/sheet1.xml，第634行 A–J列",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际下载XLSX原件、解析sharedStrings与sheet1；核第634行及列标题，未全面研究其他器物",
      "licenseStatus": "unknown；未见允许公开/商业复用的开放许可",
      "uri": "https://www.sxhm.com/down/news/502.html"
    },
    {
      "sourceId": "src_object_hoard",
      "kind": "external",
      "title": "陕西历史博物馆：何家村窖藏出土文物展",
      "locator": "展览简介首段",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际读取展览说明；不把宏观展览介绍当此件使用履历",
      "licenseStatus": "unknown；未见允许公开/商业复用的开放许可",
      "uri": "https://www.sxhm.com/Hejia_village.html?_isa=1"
    },
    {
      "sourceId": "src_object_hoard_link",
      "kind": "external",
      "title": "陕西历史博物馆：黄河流域文明故事系列短片介绍",
      "locator": "正文“来自何家村窖藏”段",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际读网页说明，未点击/审看手绘动画，不从动画提物证",
      "licenseStatus": "unknown；未见允许公开/商业复用的开放许可",
      "uri": "https://www.sxhm.com/info/news/detail/16055.html"
    },
    {
      "sourceId": "src_object_mechanism",
      "kind": "external",
      "title": "陕西历史博物馆：花鸟添香数字文创的原型与结构说明",
      "locator": "正文第二段",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际读馆方现代文字说明；原型器物与二次创作动画分开，未观看动画",
      "licenseStatus": "unknown；未见允许公开/商业复用的开放许可",
      "uri": "https://www.sxhm.com/info/news/detail/1334.html"
    },
    {
      "sourceId": "src_object_cumt",
      "kind": "external",
      "title": "中国矿业大学：陕西历史博物馆馆藏（2021年旧官网转载）",
      "locator": "规格/图解首段/“资料来源：陕西历史博物馆官方网站”",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际读页面及两图；明确是校方转载旧馆文，并非独立物证；图解后段古籍转引未核原书",
      "licenseStatus": "unknown；未见允许公开/商业复用的开放许可",
      "uri": "https://ilovehsiangbao.cumt.edu.cn/info/1053/1226.htm"
    },
    {
      "sourceId": "src_object_photo",
      "kind": "external",
      "title": "陕西历史博物馆实物原图：外观",
      "locator": "完整2048×1371图；上半球鸟、接缝、链钩",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际下载并目验完整图，未裁切调色；仅一个静态外观角度",
      "licenseStatus": "馆方水印与官网版权所有；仅本地研究参考，公开/商业复用许可未核",
      "uri": "https://www.sxhm.com/Uploads/Picture/2023/03/03/s64019e0a01903.JPG"
    },
    {
      "sourceId": "src_object_interior",
      "kind": "external",
      "title": "中国矿大转载旧馆图：香囊打开状态",
      "locator": "完整693×465图；左半球香盂与环架",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际下载并目验；转载页署来源陕西历史博物馆官方网站，原始摄影页面/日期未核",
      "licenseStatus": "unknown；原始摄影和转载授权未核，仅本地研究参考",
      "uri": "https://ilovehsiangbao.cumt.edu.cn/__local/9/ED/6F/30291D06A96B0810C3015136CA8_B27A7C9A_8211.png"
    },
    {
      "sourceId": "src_object_fang",
      "kind": "external",
      "title": "Flavia Xi Fang（2024）：Scent, Art and Astronomy",
      "locator": "Figures 2–3；Tang Incense Spheres and Their Sites of Discovery；Ding Huan与香囊命名争议段；结论",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际读取何家村例图注、工艺段、命名与文献争议段、结论；不等于逐件核了所引古籍或全部参考书",
      "licenseStatus": "开放阅读；图像另有原书出处，未据开放访问推断图像可自由复用",
      "uri": "https://journals.sagepub.com/doi/10.1177/09719458231226000"
    }
  ],
  "researchStatus": "stage_complete",
  "materialVersions": [
    {
      "materialId": "mat_df70761e-8a7d-4421-90d0-231f90d0f15a",
      "revision": 1
    }
  ],
  "author": "ai"
}
~~~~


## 记录 16：stage_428987fb-ef52-49b4-af66-d9d407280a08

- `id`：stage_428987fb-ef52-49b4-af66-d9d407280a08
- `topic_id`：topic_13617e30-a4f2-4e1e-b693-def92a386ef9
- `topic_revision`：3
- `created_at`：2026-10-02T18:17:41.773Z

### 原字段 `body_json`

~~~~json
{
  "focus": "AI实测假设：完整理解宋定伯条，研究轻重/渡水声的身份试探及问禁忌—唾羊—售卖照应；不记成小陌感受。",
  "confirmed": [
    "完整读今本《搜神记》宋定伯条，目验四库影印对应三页；扫描具体阁本未核。",
    "正文写夜行、佯称鬼、互背、禁忌、渡水、强背入市、化羊及得钱离去；未明写鬼先害人。",
    "两处类书所读完整转引均归《列异传》，不等于读到独立早期原本。",
    "今本末句含石崇；所读类书条末未提石崇，不据此确定人物年代。"
  ],
  "candidates": [
    "以承重差异和一有一无的渡水声表现身份试探。",
    "保留落地成羊与售卖落点，观察同行关系转为控制。"
  ],
  "parked": [
    "全面重建今本辑佚与诞生史。",
    "普遍唾鬼习俗断言。",
    "服饰、市场、钱币、时辰、配乐与完整剧本。"
  ],
  "unknown": [
    "故事形成过程、最初讲述者及发生年代未知。",
    "鬼的意图、定伯预谋、羊与买主后续未交代。",
    "水声句第二字、宗/宋和扫描阁本待补证。"
  ],
  "nextStep": "本轮两项形式问题已可定位回答。若转创作，先由小陌选身份试探或关系转为交易的感觉，再核最少必要时代视觉资料；当前不继续扩写。",
  "limitations": [
    "AI实测焦点非用户原话、感受、学习经历或采用方向。",
    "完整读本条并目验四库影印三页；扫描具体阁本待核；类书仅核数字条文，未核原页；未通读三书。",
    "题署与今本来历存疑分开；未完成早期《列异传》、辑佚史或起源考证。",
    "水声字形与宗/宋差异待精校，未改原文或宣布古本异文。",
    "未补编鬼意图、定伯预谋与后续。页图公开复用许可未核。",
    "未生成短片或获用户/真人观众评价；视觉复原与普遍民俗未研究。"
  ],
  "paragraphs": [
    {
      "paragraphId": "para_song_preview_20261002",
      "heading": "收藏预览",
      "markdown": "宋定伯夜行遇鬼，假装自己也是鬼。一路互背、渡水后，他把鬼带到宛市；鬼化成羊，定伯卖它、向它吐唾，最后收钱离开。这是《搜神记》卷十六的一则短篇。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_song_sgj",
          "locator": "卷十六8b末—9b前；KR3l0099_016.txt L149—163",
          "note": "完整条支持相遇、同行与售羊结局。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_song_overview_20261002",
      "heading": "内容概要",
      "markdown": "南阳人宋定伯年少时，在夜路上碰见一个自称是鬼的同行者。对方反问他是谁，他骗说自己也是鬼。两人都说要去宛市——故事里双方想去的集市——便一起走了几里。鬼嫌步行太慢，提议轮流背对方，定伯答应了。\n\n鬼先背定伯，发现他很重，怀疑他不是鬼。定伯解释说自己刚成为鬼，所以身体还重；换他背鬼时，鬼几乎没有重量。这样轮换几次，定伯又借“我才成为鬼，不懂禁忌”问鬼怕什么，得到“不喜欢人唾”的回答。遇到水，他让鬼先过，听不到水声；自己过水却发出声响。鬼再次追问，他仍用新死、还不习惯渡水来解释。\n\n将到宛市时，定伯把鬼背在肩上，抓紧它，不理会它大叫着要求下来。到了集市，他把鬼放到地上，鬼变成一只羊。定伯卖它，又怕它再变化，向它吐唾，最后得到一千五百钱离开。本条还附一句石崇谈论“定伯卖鬼得钱”的说法。\n\n这就是本轮完整读到的故事。它没有说明定伯为何夜行、鬼为何去集市，也没有明确写鬼要伤害他；买主、羊后来怎样、鬼是否报复均未交代。条末石崇说法属于所读文本的记载，不能单凭它确定事情发生年代。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_song_sgj",
          "locator": "8b末—9a前半；L149—155",
          "note": "支持人物、相遇、目的地与轮换背负。"
        },
        {
          "sourceId": "src_song_sgj",
          "locator": "9a后半—9b前；L156—163",
          "note": "支持问禁忌、渡水、入市、化羊、唾及结尾；从完整条确认未交代部分。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_song_encounter_20261002",
      "heading": "原文与白话·夜路相遇",
      "markdown": "以下原文采用已下载的Kanripo WYG（文渊阁四库本标签）数字转录；本执行者为阅读加了标点，原字未依照通行译文改写。白话为本执行者自译。\n\n> 南陽宋定伯年少時，夜行逢鬼，問之。鬼言：“我是鬼。”鬼問：“汝復誰？”定伯誑之，言：“我亦鬼。”鬼問：“欲至何所？”答曰：“欲至宛市。”\n\n**白话：**南阳的宋定伯年轻时，夜里赶路，碰到了鬼，便询问它。鬼说：“我是鬼。”鬼反问：“你又是谁？”定伯骗它，说：“我也是鬼。”鬼问：“你要去哪里？”他答：“我要去宛市。”\n\n![古籍影印原页：四库影印卷十六第八叶背，故事起句在左侧末两列](attachment:att_8976cb5178e5cf1948e402f4b05834da4dfb0054)\n\n**图证说明：**Internet Archive数字件06050852.cn，元数据记浙江大学图书馆贡献、CADAL资助，PDF第117页=原书卷十六第八叶背。本条从图左侧末两列“南陽宋定伯”开始，续到下一叶正面；图中其余条目不是本案正文。此图是古籍影印页，由原PDF渲染、未重绘文字，不是现代插画或复原图。扫描件只明确四库影印，具体阁本身份尚未核定，不能仅因文字相近就称已核Kanripo的WYG底本。\n\n[打开原PDF第117页](https://archive.org/download/06050852.cn/06050852.cn.pdf#page=117) · [查看固定转录对应行](https://github.com/kanripo/KR3l0099/blob/9959e70d799062d8dc3872225ce9a5b429ec5cac/KR3l0099_016.txt#L149-L152)",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_song_sgj",
          "locator": "8b末—9a首；L149—152",
          "note": "起句与目的地。"
        },
        {
          "sourceId": "src_song_scan",
          "locator": "PDF117=卷十六8b，左侧末两列",
          "note": "实际目验故事起句与原页位置。"
        },
        {
          "sourceId": "src_song_metadata",
          "locator": "metadata.contributor/scanningcenter/sponsor/description",
          "note": "图书馆贡献、CADAL及四库影印说明；未明确具体阁本。"
        }
      ],
      "attachmentIds": [
        "att_8976cb5178e5cf1948e402f4b05834da4dfb0054"
      ]
    },
    {
      "paragraphId": "para_song_journey_20261002",
      "heading": "原文与白话·轮换背负，渡水露出差别",
      "markdown": "> 鬼言：“我亦欲至宛市。”遂行數里。鬼言：“步行太遲，可共遞相擔，何如？”定伯曰：“大善。”鬼便先擔定伯數里。鬼言：“卿太重，將非鬼也。”定伯言：“我新鬼，故身重耳。”定伯因復擔鬼，鬼畧無重。如是再三。定伯復言：“我新鬼，不知有何所畏忌。”鬼答言：“惟不喜人唾。”於是共行。道遇水，定伯令鬼先渡，聼之，了然無聲音。定伯自渡，漕漼作聲。鬼復言：“何以有聲？”定伯曰：“新死，不習渡水，故耳。勿怪吾也。”\n\n**白话：**鬼说它也要去宛市，双方一起走了几里。鬼提议：“走路太慢，我们轮流背对方，好不好？”定伯说：“很好。”鬼先背他走了几里，发觉他很重，怀疑他不是鬼。他说：“我才成为鬼，所以身体还重。”换定伯背鬼时，鬼几乎没有重量。如此轮换几次，他又问：“我才成为鬼，不知道有什么害怕或忌讳的事。”鬼回答：“只是不喜欢人向我吐唾。”两人接着走。路上碰到水，定伯让鬼先渡，听不到声响；他自己过水却发出水声。鬼追问缘故，他回答：“我刚死，还不习惯渡水，所以才这样。别觉得我奇怪。”\n\n“遞相擔”在这里是轮流背负，不是抬轿；“如是再三”译反复轮换，未硬定为三次。“新鬼”是定伯说出来的假身份，不是叙述者确认他真的死了。\n\n![古籍影印原页：四库影印卷十六第九叶正，互背、问禁忌及渡水在本页](attachment:att_4c3183ce84c7afe58eb1fe42274cc54ab8adbf2e)\n\n**图证说明：**PDF第118页=卷十六第九叶正，本页连续含互背、问禁忌、无声渡水、有声渡水及将至宛市，未重绘。Kanripo转录“漕漼”第二字与所看影印字形仍待精校；由于具体阁本同一性也未核，暂留字形问题，不宣布古本异文。白话只取前后文明确的“发出水声”，不依赖定字。\n\n[打开原PDF第118页](https://archive.org/download/06050852.cn/06050852.cn.pdf#page=118) · [查看固定转录对应行](https://github.com/kanripo/KR3l0099/blob/9959e70d799062d8dc3872225ce9a5b429ec5cac/KR3l0099_016.txt#L152-L159)",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_song_sgj",
          "locator": "9a；L152—159",
          "note": "轮换、轻重、假身份、禁忌与渡水声音。"
        },
        {
          "sourceId": "src_song_scan",
          "locator": "PDF118=卷十六9a，全页；水声句在左侧第二列",
          "note": "已目验对应文本；保留字形与具体阁本未核。"
        }
      ],
      "attachmentIds": [
        "att_4c3183ce84c7afe58eb1fe42274cc54ab8adbf2e"
      ]
    },
    {
      "paragraphId": "para_song_market_20261002",
      "heading": "原文与白话·从同行者到待售的羊",
      "markdown": "> 行欲至宛市，定伯便擔鬼著肩上，急執之。鬼大呼，聲咋咋然，索下。不復聽之，徑至宛市中，下著地，化為一羊，便賣之。恐其變化，唾之，得錢千五百，乃去。當時石崇有言：“定伯賣鬼，得錢千五。”\n\n**白话：**快到宛市时，定伯把鬼背到肩上，紧紧抓住。鬼高声叫喊，要求下来；定伯不再听它，直接走进集市，放它到地上，它化成一只羊。定伯便卖这只羊，怕它再变化，又向它吐唾，得到一千五百钱后离开。所读本还说，当时石崇有“定伯卖鬼，得钱一千五百”这句话。\n\n本条没有交代鬼为什么化羊，也没有说羊后来被宰。吐唾的目的由“恐其變化”交代；这不等于文字说唾液把鬼消灭了，或它从此永远不能变化。交易、唾和收钱是文本连续叙述的动作，具体交割瞬间没有细写。\n\n![古籍影印原页：四库影印卷十六第九叶背，强背、化羊、唾与得钱在右侧前三列](attachment:att_9e0fdcad71918210f9ceda182be289a5d619362d)\n\n**图证说明：**PDF第119页=卷十六第九叶背，本条只占右侧前三列，“吴王夫差女”以下已经进入另一则。不能拿下一则的恋爱、死因或时代补入宋定伯条。\n\n[打开原PDF第119页](https://archive.org/download/06050852.cn/06050852.cn.pdf#page=119) · [查看固定转录对应行](https://github.com/kanripo/KR3l0099/blob/9959e70d799062d8dc3872225ce9a5b429ec5cac/KR3l0099_016.txt#L159-L163)",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_song_sgj",
          "locator": "9a末—9b前；L159—164",
          "note": "结尾、石崇附句及下一条边界。"
        },
        {
          "sourceId": "src_song_scan",
          "locator": "PDF119=卷十六9b，右侧前三列与后续起句",
          "note": "已目验结尾和文本边界。"
        }
      ],
      "attachmentIds": [
        "att_9e0fdcad71918210f9ceda182be289a5d619362d"
      ]
    },
    {
      "paragraphId": "para_song_identity_analysis_20261002",
      "heading": "研究解释·一个假身份怎样连续补住破绽",
      "markdown": "本轮测试焦点之一是：这篇短文为什么无需交代鬼的外貌，仍能让人感觉双方不一样。答案首先在可以感受的小差别里：鬼背人觉得沉，人背鬼却几乎无重；鬼渡水无声，人渡水有声。重量属于身体触觉，水声属于听觉，两次都让鬼追问身份。\n\n定伯反复沿用“新鬼／新死”：第一次解释身体为什么重，中途以不熟禁忌换取信息，第二次解释为什么渡水出声。同一套身份说辞承担三个动作，使问禁忌嵌在结伴行路里；后面的唾又使用了先前得到的信息。这是由段落先后关系得到的叙述结构解释。\n\n**反证与边界：**正文没有写鬼已完全信任他，也没有写定伯从相遇时就计划卖鬼。“新死”说辞的反复可看作应变，也可在改编中表现成逐步试探；两种心理读法都要由作品另行选择，不能倒写成古文事实。这里也不把“鬼略无重”扩展为所有古代鬼都无重量的知识。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "src_song_sgj",
          "locator": "9a L154—158；9b L162",
          "note": "轻重、身份追问、问禁忌和末尾唾的对应，是本执行者分析依据。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_song_market_analysis_20261002",
      "heading": "研究解释·奇事落到集市，关系也变了",
      "markdown": "第二个可深挖的点是观察现有结尾怎样改变关系。初遇时鬼会说话、提议同行和互背；将至宛市，定伯从轮换背负变成紧抓不放，不再理会鬼的要求；落地后鬼化为羊，接着成为可出售的对象。叙述把“交谈者—背负物—待售的羊”连续放在一起，最后只留下收到钱和离去。\n\n这使超常事件拥有很具体的日常落点：故事没有展开一场法术决斗，而是把说话的鬼带进交易。前面问“不喜人唾”，结尾用唾防变化，也把信息变成了动作。本执行者因此认为，短片可以关注身份和关系的改变，以及结尾的干脆。\n\n**另一种读法必须留着：**从鬼的遭遇看，开头它如实自报身份、提议互背，后面却被抓走售卖。原文未明写它先害人，所以“定伯战胜恶鬼、为民除害”不能直接当事实概要；同样，没写害人不足以证明鬼一定善良。喜剧、诡异或带一点不安，都是可能语气，尚无读者反馈能确定哪一种更有效。这里只是本执行者的研究解释，不是在断言古代人普遍怎样理解鬼或买卖。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "src_song_sgj",
          "locator": "8b L149—150；9a L152—159；9b L161—163",
          "note": "自报身份、互背、强抓、索下、化羊与售卖支持关系变化分析；道德判断另行限定。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_song_creative_20261002",
      "heading": "创作联想·两个可观察的候选",
      "markdown": "**候选一：让身体和声音先于解释被感到。**同一段路上，背人的一方需要承重，换背鬼的一方却几乎不用承重；浅水处先过的脚步听不到水声，后过的脚步有清楚水声。肩膀下沉、呼吸是否费力、脚入水的声响可以成为可表演、可听见的细节。原文只支持轻重和涉水声的差异，具体呼吸、身形与动作幅度是改编假设，须以后用表演/声画样段判断。\n\n**候选二：保留落地成羊的简洁。**围绕肩上求下的声音、紧抓的手、落地后的羊及卖得钱这几个正文已有动作，寻找奇事突然落入普通交易的感觉。羊是否继续用人声、变形是否可见、买主是否察觉、市场是什么时辰，古文没有规定；每加一项，都应标为改编选择。\n\n两项可以任选其一，也可组合。当前没有生成影片、没有人类观众评价，没有把候选记成小陌已采用方向；这里给的是进入创作前可验证的细节，不是完整剧本或分镜。",
      "basisKind": "ai_hypothesis",
      "sourceRefs": [
        {
          "sourceId": "src_song_sgj",
          "locator": "卷十六9a—9b；L153—163",
          "note": "候选依据承重、涉水、抓持、化羊与售卖；其余声画细节明确为改编。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_song_time_20261002",
      "heading": "时间与底本·题署晋人，不等于已读东晋原稿",
      "markdown": "本轮固定对象是二十卷今本中的宋定伯条。主文本读Kanripo标为WYG（文渊阁四库全书）的数字转录；图证读图书馆贡献的四库影印三页，具体阁本身份待核。应把四层时间分开：\n\n- **故事设定时间：**本条只写南阳、年少、夜行及宛市，未给年号或可确定的年份。石崇附句是文本记载，不能独自承担定年。\n- **作品作者与成书层：**所读提要称“旧本题曰晋干宝撰”，并记他在晋元帝时任官。这是作者题署与传记层，不是这份见证写成于东晋的证据，更不是本篇首次诞生日期。\n- **当前见证：**转录平台标文渊阁本；提要署乾隆四十三年三月（1778）。所读影印、现代扫描、PDF处理与数字转录是不同保存层次。本轮未读到早期干宝原本，扫描件也未独立核具体阁本。\n- **本次读取：**2026年10月2日固定下载内容、提交号、页码与哈希。这只是可重找的研究时点，不是故事形成日期。\n\n我们读到的是今本保存的一则故事，不能把“东晋作者题署”直接写成“故事在东晋首次诞生”。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_song_sgj",
          "locator": "完整条L149—163",
          "note": "本条未给年号，含石崇附句。"
        },
        {
          "sourceId": "src_song_preface",
          "locator": "提要000-1a—2a；L11—15、L30—31",
          "note": "旧本题署、元帝时任官及提要1778日期。"
        },
        {
          "sourceId": "src_song_metadata",
          "locator": "metadata.description/contributor/publicdate/ocr；PDF文件信息",
          "note": "四库影印与现代数字处理层；不把上传/处理日期当故事年代。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_song_preface_20261002",
      "heading": "馆臣解释·今本来历本来就留着疑问",
      "markdown": "所读清代提要已经提醒，不能直接把二十卷今本等同于干宝旧书。它先转引胡震亨的怀疑，认为书中存在后人附益；又由馆臣提出《搜神总记》与后人分卷的解释，最后明说“疑以傳疑，今姑仍舊題著之於録焉”。\n\n这里保留的是**清代馆臣的存疑和解释**。胡震亨跋、馆臣拿来比较的其他书，本轮没有逐一读原件；也未完成现代版本研究。因此，不把提要里的假说写成已经证实的完整重辑经过，不自行断言某位在何年重建了今本。这足以提示底本边界，尚不足以证明本篇的诞生过程。",
      "basisKind": "author_interpretation",
      "sourceRefs": [
        {
          "sourceId": "src_song_preface",
          "locator": "提要000-1b—2a；L17—30",
          "note": "清代馆臣的转引与存疑；不冒称已读胡跋原件。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_song_comparison_20261002",
      "heading": "版本对读·类书指向《列异传》，仍不能宣布起源",
      "markdown": "本轮另外完整读取了两份类书转引。\n\n**《太平广记》卷三百二十一“鬼六”宋定伯条**保存同一情节，条末作“當時有言定伯賣鬼得錢千五”，随后注明“出列異傳”。本轮所读数字正文没有“石崇”。\n\n**《太平御览》卷八百八十四所读四部丛刊转录**起首作“列異傳曰南陽宗定伯”，也写互背、问人唾、涉水、化羊及售卖，结尾作“于時名宗定伯賣鬼得錢千五百”。这里人名作“宗”，主文本和《太平广记》作“宋”。御览原页未核，暂记电子转录差异，不定哪一姓是原字。\n\n两处引书说明支持“所读类书把这则故事归到《列异传》”。但本轮没有实际读到早期《列异传》独立原本，也未辨明同名书作者；不能据此证明某位作者亲写、故事起源于某一朝代，或哪份是唯一原版。两部类书还可能依赖共同文本，不是两起历史事件的独立目击证词。\n\n对读改变了本轮判断：今本末句提到石崇，不再被拿来填主人公年代；“出《列异传》”保留为可查的传承线索。至于故事最初怎样诞生，仍不能确定。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_song_tpgj",
          "locator": "卷321-9a—9b；KR3l0118_321.txt L153—168",
          "note": "完整条、无石崇末句及出列异传。"
        },
        {
          "sourceId": "src_song_tpyl",
          "locator": "卷884-2a末—2b；KR3k0012_884.txt L48—59",
          "note": "完整转引、宗定伯、引书与末句。"
        },
        {
          "sourceId": "src_song_sgj",
          "locator": "卷十六9b；L163",
          "note": "主文本石崇附句对照。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_song_unknown_20261002",
      "heading": "尚未解决·哪些问题值得另开一小步",
      "markdown": "故事内容和本轮两项形式焦点已经能回答，但界限仍在：确切发生年代、口传形成过程、最初编者和独立早期底本未确定；鬼的意图、定伯的预谋、羊与买主后续未写。水声句第二字与“宗／宋”还需原页、更清楚版本精校；它们目前不改变“水声暴露身份差异”与完整结尾的基本理解。\n\n若要更严格考据，最小补证是先核《太平御览》这一叶原页和可靠校注，而非继续堆转载。若做时代具象化创作，先定改编设定，再独立查服饰、集市、钱币与使用动作；当前研究不足以认证某套视觉复原。",
      "basisKind": "unknown",
      "sourceRefs": [
        {
          "sourceId": "src_song_sgj",
          "locator": "完整条L149—163",
          "note": "已知与未写情节边界。"
        },
        {
          "sourceId": "src_song_tpyl",
          "locator": "卷884-2a末—2b；L48—59",
          "note": "宗定伯转录尚未核原页。"
        },
        {
          "sourceId": "src_song_scan",
          "locator": "PDF118水声句",
          "note": "已看原页仍留字形与阁本精校缺口。"
        }
      ],
      "attachmentIds": []
    },
    {
      "paragraphId": "para_song_method_20261002",
      "heading": "方法与读取记录",
      "markdown": "本次为AI实测自设焦点，不是小陌的收藏感受、阅读经历或学习成果。按项目内传统溯源规程，实际读完整宋定伯条、提要与原序，完整读两处类书转引；邻接条目只核边界，未通读三书。Kanripo与影印均为相应底本的现代数字见证，未访问古代原件。\n\nKanripo《搜神记》固定commit 9959e70d799062d8dc3872225ce9a5b429ec5cac，卷16下载SHA-256 5337e1c7a22cc7850a659a9592da1f70a6228f7cca9260facdcb3b1cd69061e9；比较书固定提交与哈希见验证目录comparison-manifest.json。文本严格UTF-8读取，原条L149—163完整。三张页图用既有PyMuPDF从PDF渲染，实际目验117—119页，另看册首四库题页；OCR乱码未用于释义。整册只留验证目录，正式原件仅必要三页和完整条行号摘录。完整条行号摘录见本段下方附件卡，可直接下载 TXT 原件。\n\n主文本与扫描的情节和多数文字对应；扫描元数据及题页没有独立确认文渊阁身份，故只能说已核四库影印这三页，不能声明两者必是同一底本。页码、图证身份和限制均保留。\n\n访问失败包括Kanripo站点正文403、CText页403、维基文库API403；未绕过。实际可读取的GitHub公开源及图书馆贡献数字件用于研究，无新依赖、付费、模型下载或第三方私人附件上传。\n\n**复用边界：**古代正文用于必要引用，白话为本执行者自译。数字件元数据未给明确页图公开复用许可；三页用于本项目必要研究对读，不把附件登记许可字段当出版授权。对外发布页图或采用他人现代译文时，仍需核供应方条件。没有生成古籍页或历史复原图。\n\n轻量素材保存的是GitHub master链接；本研究为可重找固定了同一文件的commit与行号。这里明确将素材v1关联到这次实际读取范围，原始链接、短识别、感受栏均保留。固定版本证据不保证master日后内容不变。",
      "basisKind": "source_fact",
      "sourceRefs": [
        {
          "sourceId": "src_song_sgj",
          "locator": "固定文件L149—163，commit及SHA-256",
          "note": "完整条与可重找的内容身份。"
        },
        {
          "sourceId": "src_song_preface",
          "locator": "提要L11—33，原序L36至末",
          "note": "实际读取范围。"
        },
        {
          "sourceId": "src_song_tpgj",
          "locator": "完整宋定伯条L153—168",
          "note": "完整转引读取范围。"
        },
        {
          "sourceId": "src_song_tpyl",
          "locator": "完整宗定伯条L48—59",
          "note": "完整转引读取范围。"
        },
        {
          "sourceId": "src_song_scan",
          "locator": "PDF117—119；整册SHA-256见来源信息",
          "note": "目验与派生页图范围，不依靠乱码OCR。"
        },
        {
          "sourceId": "src_song_metadata",
          "locator": "metadata及files；未见明确图像许可字段",
          "note": "来源身份与复用边界。"
        },
        {
          "sourceId": "src_song_excerpt",
          "locator": "完整条L149—163定位摘录全部",
          "note": "支持完整条行号摘录；实际受控附件ID及原件哈希已核。"
        },
        {
          "sourceId": "src_song_material_mapping",
          "locator": "素材v1 original.text/url；同一KR3l0099_016卷十六宋定伯条L149—163",
          "note": "对应已实际读取的保存素材与固定原文，不把动态URL等同未来版本。"
        }
      ],
      "attachmentIds": [
        "att_db9516270888bcac31b9cee7a34167ab211d0c90"
      ]
    }
  ],
  "sources": [
    {
      "sourceId": "src_song_sgj",
      "kind": "external",
      "title": "《搜神记》WYG卷十六：宋定伯条固定数字转录",
      "locator": "卷十六8b末—9b前；L149—163",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际完整读本条，核前后边界；固定commit9959e70d799062d8dc3872225ce9a5b429ec5cac。17319字节SHA256 5337e1c7a22cc7850a659a9592da1f70a6228f7cca9260facdcb3b1cd69061e9；另目验四库影印三页，扫描具体阁本未核。",
      "licenseStatus": "古代正文必要引用；保留数字出处。中文白话为本执行者自译，未用他人现代译本。",
      "uri": "https://github.com/kanripo/KR3l0099/blob/9959e70d799062d8dc3872225ce9a5b429ec5cac/KR3l0099_016.txt#L149-L163"
    },
    {
      "sourceId": "src_song_preface",
      "kind": "external",
      "title": "《搜神记》WYG提要与原序：题署与今本存疑",
      "locator": "提要000-1a—2a；原序000-3a—3b",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际读完整数字提要与原序；未核该文件原页、未逐一读其转引书。2722字节SHA256 53f2c622c8f46796a61752b555404d21383a3152196243edf60ef1e8138baa5b。",
      "licenseStatus": "古代文本少量必要引用，不复制现代校注。",
      "uri": "https://github.com/kanripo/KR3l0099/blob/9959e70d799062d8dc3872225ce9a5b429ec5cac/KR3l0099_000.txt"
    },
    {
      "sourceId": "src_song_tpgj",
      "kind": "external",
      "title": "《太平广记》WYG卷321鬼六：宋定伯，出《列异传》",
      "locator": "卷321-9a—9b；完整条L153—168",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际读完整该条数字正文及尾注；固定commit7990feeb9c302e37942661d1b29abc22818cc204。下载哈希留comparison-manifest.json，未核本书原页。",
      "licenseStatus": "古代正文必要引用，保留数字出处。",
      "uri": "https://github.com/kanripo/KR3l0118/blob/7990feeb9c302e37942661d1b29abc22818cc204/KR3l0118_321.txt#L153-L168"
    },
    {
      "sourceId": "src_song_tpyl",
      "kind": "external",
      "title": "《太平御览》SBCK卷884：列异传曰南阳宗定伯",
      "locator": "卷884-2a末—2b；完整条L48—59",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际读完整条数字正文；固定commit42ba052ab54c733387ba30b62dcd4eacb34139b6。下载哈希留comparison-manifest.json；未核本书原页，宗/宋只暂记转录差异。",
      "licenseStatus": "古代正文必要引用，保留数字出处。",
      "uri": "https://github.com/kanripo/KR3k0012/blob/42ba052ab54c733387ba30b62dcd4eacb34139b6/KR3k0012_884.txt#L48-L59"
    },
    {
      "sourceId": "src_song_scan",
      "kind": "external",
      "title": "浙江大学图书馆贡献《搜神记·卷十一～卷二十》四库影印（具体阁本待核）",
      "locator": "PDF117、118、119页=卷十六8b、9a、9b；在线索引n116、n117、n118",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际下载6087363字节PDF，SHA256 c6baae55f8f9d4ebfc71a8aa8fda4e990bc05b18598833ac5185e2019b2202a8。定位并目验完整故事三页及册首四库题页，未通读207页。原页由PDF渲染、未重绘；元数据与题页未独立确认具体阁本。",
      "licenseStatus": "元数据未给明确页图公开复用授权；本项目必要三页研究对读，对外复用待核。",
      "uri": "https://archive.org/details/06050852.cn/page/n116/mode/1up"
    },
    {
      "sourceId": "src_song_metadata",
      "kind": "external",
      "title": "Internet Archive/CADAL数字件06050852.cn元数据",
      "locator": "metadata.description/contributor/scanningcenter/sponsor/publicdate/ocr及files",
      "accessedAt": "2026-10-02",
      "verificationScope": "实际读JSON元数据及文件信息；四库影印、浙江大学图书馆贡献与CADAL资助据此记录。不用元数据证明精确印行年代、文渊阁身份或图像授权。",
      "licenseStatus": "少量事实元数据转述；图像许可未明确。",
      "uri": "https://archive.org/metadata/06050852.cn"
    },
    {
      "sourceId": "src_song_excerpt",
      "kind": "attachment",
      "title": "宋定伯完整条：固定原文行号定位摘录",
      "locator": "主文本L149—163，含pb叶码，全文",
      "accessedAt": "2026-10-02",
      "verificationScope": "完整本条从已下载固定commit文件摘录，保留原行号和pb叶码；已通过受控导入登记并回读，原字节哈希核对一致。",
      "licenseStatus": "古代正文必要完整短条摘录；不含他人现代译文。",
      "attachmentId": "att_db9516270888bcac31b9cee7a34167ab211d0c90"
    },
    {
      "sourceId": "src_song_material_mapping",
      "kind": "material",
      "title": "轻量素材v1与固定原典的实际读取关联",
      "locator": "素材v1 original.text/url；同一KR3l0099_016卷十六宋定伯条L149—163",
      "accessedAt": "2026-10-02",
      "verificationScope": "已读取这条素材v1的短识别、保存原链接与来源位置；沿同一卷十六宋定伯条实际完整读固定commit9959e70d799062d8dc3872225ce9a5b429ec5cac转录L149—163并目验三页四库影印。固定文件的逐句依据仍见src_song_sgj；不保证master动态链接日后内容仍相同，不称已通读卷16或整书。",
      "licenseStatus": "保留收藏源与固定版本对应；古代正文必要引用，页图对外复用许可未核。",
      "materialId": "mat_c5afa305-85dc-4bdd-8652-e7778fc89104"
    }
  ],
  "researchStatus": "stage_complete",
  "materialVersions": [
    {
      "materialId": "mat_c5afa305-85dc-4bdd-8652-e7778fc89104",
      "revision": 1
    }
  ],
  "author": "ai"
}
~~~~


