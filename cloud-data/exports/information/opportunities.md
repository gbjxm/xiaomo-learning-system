# opportunities

源快照：`cloud-data/snapshots/信息收集/data/opportunities.sqlite3`；记录数：46。

这是字段原样目录，不是新研究结论。原话、个人笔记、来源、AI 分析和候选仍按原字段分开；完整字段见同名 JSON。

## 记录 1：c67dc9fa57e4d56782e5056b

- `id`：c67dc9fa57e4d56782e5056b
- `source_id`：libtv
- `version`：4
- `edition`：2026 / 活动62

### 原字段 `document`

~~~~json
{
  "assessment": {
    "ai_policy": "allowed",
    "personal_eligibility": "not_checked",
    "reason": "原已核条款要求获奖著作权转让，并有广泛排他可转授权；按比赛技能硬性版权门，未接受前不建议，金额不抵消限制。",
    "role": "not_recommended"
  },
  "edition": "2026 / 活动62",
  "eligibility": [
    "王者 IP 新创作作品；具体主体资格待核"
  ],
  "entry_url": "https://www.liblib.tv/activity/62",
  "evidence": [
    {
      "excerpt": "前序任务人工核验移交；未提供精确核验时刻。与本次抓取分开。",
      "note": "部分字段已核；缺失字段仍待核验。",
      "observed_at": null,
      "origin": "manual_handoff",
      "url": "https://www.liblib.tv/activity/62"
    },
    {
      "excerpt": "本次核读LibTV官方清单中的公开规则正文，补充封面、首发及双端话题要求。正式授权条款外链未在本次完整重核，保留前序版权限制证据。",
      "observed_at": "2026-09-30T02:51:32+00:00",
      "origin": "manual_review",
      "url": "https://www.liblib.tv/activity/62"
    }
  ],
  "fit_rules": {
    "duration_min_seconds": {
      "evidence": {
        "official": true,
        "scope": "2026 / 活动62",
        "url": "https://www.liblib.tv/activity/62",
        "verified_at": "2026-09-30T02:51:32+00:00"
      },
      "value": 120
    }
  },
  "id": "c67dc9fa57e4d56782e5056b",
  "kind": "competition",
  "official_url": "https://www.liblib.tv/activity/62",
  "organizer": "LibTV × 王者荣耀 / 腾讯",
  "origin": "manual_review",
  "platform": "LibTV / 抖音",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": null,
  "rewards": [
    {
      "amount": 1500000,
      "currency": "CNY",
      "label": "税前现金总奖池",
      "scope": "总奖池",
      "type": "cash",
      "validity": null
    },
    {
      "amount": 500000,
      "currency": "CNY",
      "label": "一等奖",
      "scope": "单奖（总奖池内）",
      "type": "cash",
      "validity": null
    },
    {
      "amount": 3000000,
      "label": "奖励积分",
      "scope": "奖励池",
      "type": "credits",
      "unit": "积分",
      "validity": "3个月"
    },
    {
      "amount": 7000000,
      "label": "启动算力池",
      "scope": "独立扶持池",
      "type": "compute",
      "unit": "算力池（口径待核）",
      "validity": null
    }
  ],
  "risks": [
    {
      "detail": "腾讯广泛排他、可转授权；使用范围须审阅官方全文。",
      "level": "high",
      "type": "exclusive"
    },
    {
      "detail": "获奖作品著作权转让是发奖前提；是否接受应在投稿前判断。",
      "level": "high",
      "type": "transfer"
    },
    {
      "detail": "作品须为此次大赛全新制作并首发活动平台；音乐须原创或有合法授权。",
      "level": "high",
      "type": "first_release"
    }
  ],
  "source_id": "libtv",
  "steps": [
    "LibTV与抖音双端同步投稿，内容一致，任一端缺失视为未完成",
    "抖音必须带 #王者无界剧场；不得带除LibTV外其他AI创作工具相关tag",
    "截止前可更新画布和成片；截止后更新画布 / 社媒链接将使投稿无效"
  ],
  "summary": "王者 IP AI 影像征集。现金、奖励积分和启动算力分开；获奖作品版权转让及排他授权需重点审阅。",
  "tags": [
    "AI",
    "影视",
    "王者IP",
    "短片"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": true,
    "deadline": "2026-11-22T23:59:59",
    "evidence": "移交核验：2026-09-21 15:00 至 2026-11-22 23:59:59；原文未注明时区。",
    "mechanism": "fixed",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "start": "2026-09-21T15:00:00",
    "timezone": null
  },
  "title": "王者无界剧场计划",
  "verification": "partial",
  "verified_at": "2026-09-30T02:51:32+00:00",
  "work_requirements": [
    "时长至少2分钟",
    "16:9 横版，至少720p",
    "王者IP新作",
    "投稿需横版16:9封面，分辨率不低于1920×1080；有片名 / 标题",
    "画面无黑边、无水印，有配乐或配音；不得使用第三方版权英雄与联名皮肤素材"
  ]
}
~~~~


## 记录 2：1f5dcee0aef1a6eb2b021be0

- `id`：1f5dcee0aef1a6eb2b021be0
- `source_id`：aishorts
- `version`：2
- `edition`：2026 / AiShorts

### 原字段 `document`

~~~~json
{
  "edition": "2026 / AiShorts",
  "eligibility": [],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "前序任务人工核验移交；未提供精确核验时刻。与本次抓取分开。",
      "note": "部分字段已核；缺失字段仍待核验。",
      "observed_at": null,
      "origin": "manual_handoff",
      "url": "https://www.bilibili.com/blackboard/era/DjrNk7LG6agRh9Lu.html"
    }
  ],
  "fit_rules": {
    "duration_max_seconds": {
      "evidence": {
        "official": true,
        "scope": "2026 / AiShorts",
        "url": "https://www.bilibili.com/blackboard/era/DjrNk7LG6agRh9Lu.html",
        "verified_at": null
      },
      "value": 1800
    },
    "duration_min_seconds": {
      "evidence": {
        "official": true,
        "scope": "2026 / AiShorts",
        "url": "https://www.bilibili.com/blackboard/era/DjrNk7LG6agRh9Lu.html",
        "verified_at": null
      },
      "value": 120
    }
  },
  "id": "1f5dcee0aef1a6eb2b021be0",
  "kind": "competition",
  "official_url": "https://www.bilibili.com/blackboard/era/DjrNk7LG6agRh9Lu.html",
  "organizer": "HiShorts! × updream",
  "origin": "manual_review",
  "platform": "updream / B站",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": null,
  "rewards": [
    {
      "label": "积分奖励，数量待核",
      "type": "credits"
    },
    {
      "label": "推广支持，细则待核",
      "type": "promotion"
    },
    {
      "label": "展映机会，细则待核",
      "type": "screening"
    }
  ],
  "risks": [
    {
      "detail": "版权、独家和首发条件待核；尚未读到完整图片规则。",
      "level": "unknown",
      "type": "unknown"
    }
  ],
  "source_id": "aishorts",
  "steps": [],
  "summary": "AI 短片征集，官方图片规则需要人工核读。截止日期未核，不能采用第三方冲突日期。",
  "tags": [
    "AI",
    "短片",
    "影视"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": false,
    "deadline": null,
    "evidence": null,
    "mechanism": "unspecified",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "start": null,
    "timezone": null
  },
  "title": "HiShorts! × updream AI 短片大赛",
  "verification": "partial",
  "verified_at": null,
  "work_requirements": [
    "2–30分钟",
    "2026-03-20后创作",
    "1080p横版 MOV / MP4"
  ]
}
~~~~


## 记录 3：e7f5fb4e93105b2546f1c285

- `id`：e7f5fb4e93105b2546f1c285
- `source_id`：updream
- `version`：1
- `edition`：轮次未核

### 原字段 `document`

~~~~json
{
  "edition": "轮次未核",
  "eligibility": [],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "前序任务人工核验移交；未提供精确核验时刻。与本次抓取分开。",
      "note": "部分字段已核；缺失字段仍待核验。",
      "observed_at": null,
      "origin": "manual_handoff",
      "url": "https://www.updream.cn/"
    }
  ],
  "id": "e7f5fb4e93105b2546f1c285",
  "kind": "creator_program",
  "official_url": "https://www.updream.cn/",
  "organizer": null,
  "origin": "manual_handoff",
  "platform": "updream / B站",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": "提交作品链接；入口与完整资格待核",
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": null,
  "rewards": [
    {
      "label": "提交作品链接可获积分，数量及有效期待核",
      "type": "credits"
    }
  ],
  "risks": [],
  "source_id": "updream",
  "steps": [],
  "summary": "仅核到提交作品链接可获积分；长期开放与加入、收益、结算、退出条件未核。",
  "tags": [
    "AI",
    "导演",
    "创作者",
    "积分"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": false,
    "deadline": null,
    "evidence": null,
    "mechanism": "unspecified",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "start": null,
    "timezone": null
  },
  "title": "updream 特约导演计划",
  "verification": "partial",
  "verified_at": null,
  "work_requirements": []
}
~~~~


## 记录 4：f767f5b9b5af2414f5a08ad8

- `id`：f767f5b9b5af2414f5a08ad8
- `source_id`：bili_white
- `version`：1
- `edition`：2026 / 08-17轮

### 原字段 `document`

~~~~json
{
  "edition": "2026 / 08-17轮",
  "eligibility": [],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "前序任务人工核验移交；未提供精确核验时刻。与本次抓取分开。",
      "note": "部分字段已核；缺失字段仍待核验。",
      "observed_at": null,
      "origin": "manual_handoff",
      "url": "https://www.bilibili.com/opus/1237442539704811557"
    }
  ],
  "id": "f767f5b9b5af2414f5a08ad8",
  "kind": "competition",
  "official_url": "https://www.bilibili.com/opus/1237442539704811557",
  "organizer": null,
  "origin": "manual_handoff",
  "platform": "B站 / updream",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": null,
  "rewards": [
    {
      "label": "积分奖励，数量待核",
      "type": "credits"
    },
    {
      "label": "投流支持，细则待核",
      "type": "traffic"
    }
  ],
  "risks": [],
  "source_id": "bili_white",
  "steps": [],
  "summary": "历史公告用于核对归档与奖励分类。已核报名结束；积分和投流不作为现金。",
  "tags": [
    "AI",
    "视频",
    "积分"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": true,
    "deadline": "2026-09-15",
    "evidence": "前序人工核验报名期：08-17至09-15，原文时区未注明。",
    "mechanism": "fixed",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "start": "2026-08-17",
    "timezone": null
  },
  "title": "updream 白模创作赛（历史）",
  "verification": "partial",
  "verified_at": null,
  "work_requirements": []
}
~~~~


## 记录 5：dd18da1f436d633bb62d2538

- `id`：dd18da1f436d633bb62d2538
- `source_id`：bili_remix
- `version`：1
- `edition`：2026 / 03-03轮

### 原字段 `document`

~~~~json
{
  "edition": "2026 / 03-03轮",
  "eligibility": [],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "前序任务人工核验移交；未提供精确核验时刻。与本次抓取分开。",
      "note": "部分字段已核；缺失字段仍待核验。",
      "observed_at": null,
      "origin": "manual_handoff",
      "url": "https://www.bilibili.com/opus/1175154222470004785"
    }
  ],
  "id": "dd18da1f436d633bb62d2538",
  "kind": "competition",
  "official_url": "https://www.bilibili.com/opus/1175154222470004785",
  "organizer": null,
  "origin": "manual_handoff",
  "platform": "B站",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": "花火 / 贝壳结算；具体兑换、税费条件待核"
  },
  "publication_at": null,
  "rewards": [
    {
      "amount": 50000,
      "currency": "CNY",
      "label": "奖金总池",
      "scope": "总奖池",
      "type": "cash"
    }
  ],
  "risks": [],
  "source_id": "bili_remix",
  "steps": [],
  "summary": "已核历史报名期，5万元奖金池；花火 / 贝壳为结算信息，不能重复计入奖金。",
  "tags": [
    "二创",
    "视频",
    "现金"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": true,
    "deadline": "2026-03-31",
    "evidence": "前序人工核验报名期：03-03至03-31，时区未注明。",
    "mechanism": "fixed",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "start": "2026-03-03",
    "timezone": null
  },
  "title": "B站二创赛（历史）",
  "verification": "partial",
  "verified_at": null,
  "work_requirements": []
}
~~~~


## 记录 6：a79579464f63cd8aef7cadfb

- `id`：a79579464f63cd8aef7cadfb
- `source_id`：douyin_selected
- `version`：1
- `edition`：长期倡议 / 2026核验

### 原字段 `document`

~~~~json
{
  "edition": "长期倡议 / 2026核验",
  "eligibility": [],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "研究移交：官方定义为长期优质创作倡议，2026-05-19仍列长期在线；核验仅提供日期。",
      "note": "部分字段已核；缺失字段仍待核验。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://www.xingtu.cn/help-center/demander/114908"
    }
  ],
  "id": "a79579464f63cd8aef7cadfb",
  "kind": "creator_program",
  "official_url": "https://www.xingtu.cn/help-center/demander/114908",
  "organizer": "抖音",
  "origin": "manual_handoff",
  "platform": "抖音",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": "优质内容创作倡议；具体持续达标门槛未核",
    "revenue": null,
    "settlement": null
  },
  "publication_at": null,
  "rewards": [
    {
      "label": "内容精选与扶持，非已核现金分成",
      "type": "promotion"
    }
  ],
  "risks": [
    {
      "detail": "AI内容准入、版权与独家条款未核。",
      "level": "unknown",
      "type": "unknown"
    }
  ],
  "source_id": "douyin_selected",
  "steps": [],
  "summary": "官方长期优质创作倡议，2026-05-19仍列长期在线。属于内容精选与扶持，现金分成尚未核到。",
  "tags": [
    "创作者",
    "视频",
    "内容精选",
    "扶持"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": false,
    "deadline": null,
    "evidence": null,
    "mechanism": "unspecified",
    "policy_duration": "官方长期在线倡议；不等于已核全年可加入",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "start": null,
    "timezone": null
  },
  "title": "抖音精选计划",
  "verification": "partial",
  "verified_at": "2026-09-30",
  "work_requirements": []
}
~~~~


## 记录 7：190bfc71efb7cd2eb8ca66d1

- `id`：190bfc71efb7cd2eb8ca66d1
- `source_id`：douyin_selected
- `version`：2
- `edition`：2026 / 截止03-31子活动

### 原字段 `document`

~~~~json
{
  "edition": "2026 / 截止03-31子活动",
  "eligibility": [],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "研究移交：精选达人团限时流量激励计划截至2026-03-31。",
      "note": "部分字段已核；缺失字段仍待核验。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://www.xingtu.cn/help-center/demander/114908"
    }
  ],
  "id": "190bfc71efb7cd2eb8ca66d1",
  "kind": "limited_benefit",
  "official_url": "https://www.xingtu.cn/help-center/demander/114908",
  "organizer": "抖音",
  "origin": "manual_handoff",
  "platform": "抖音",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": null,
  "relations": [
    {
      "note": "历史限时子活动不改变长期精选倡议；2026-03-31子活动已截止。",
      "target_id": "a79579464f63cd8aef7cadfb",
      "type": "under_program"
    }
  ],
  "rewards": [
    {
      "label": "限时流量激励，细则待核",
      "type": "traffic"
    }
  ],
  "risks": [],
  "source_id": "douyin_selected",
  "steps": [],
  "summary": "精选计划的独立限时子活动，已核2026-03-31结束；不影响父计划的长期属性。",
  "tags": [
    "流量",
    "创作者"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": true,
    "deadline": "2026-03-31",
    "evidence": "官方限时子活动截止2026-03-31，开始时间未核。",
    "mechanism": "fixed",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "start": null,
    "timezone": null
  },
  "title": "精选达人团 · 限时流量激励计划（历史子活动）",
  "verification": "partial",
  "verified_at": "2026-09-30",
  "work_requirements": []
}
~~~~


## 记录 8：d2a151c2d148a5858cdecc7c

- `id`：d2a151c2d148a5858cdecc7c
- `source_id`：douyin_partner_rules
- `version`：1
- `edition`：官方规则 / 修订日期未核

### 原字段 `document`

~~~~json
{
  "edition": "官方规则 / 修订日期未核",
  "eligibility": [],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "研究移交：官方六张规则长图，图片需OCR / 人工核验；现行修订日期未注明。",
      "note": "部分字段已核；缺失字段仍待核验。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://i.snssdk.com/magic/eco/runtime/release/661ceef7d4f467070808af60?appType=ixigua&magic_page_no=1&magic_source=mu_jhgz_v3a1"
    },
    {
      "excerpt": "官方升级说明确认中视频升级为创作者伙伴计划。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://www.xingtu.cn/help-center/author/141762"
    }
  ],
  "id": "d2a151c2d148a5858cdecc7c",
  "kind": "creator_program",
  "official_url": "https://i.snssdk.com/magic/eco/runtime/release/661ceef7d4f467070808af60?appType=ixigua&magic_page_no=1&magic_source=mu_jhgz_v3a1",
  "organizer": "抖音 / 西瓜视频",
  "origin": "manual_handoff",
  "platform": "抖音 / 西瓜",
  "program": {
    "effective_version": null,
    "exit": "存在退出 / 清退机制；具体触发与申诉条件待核",
    "join": "以账号实际页面、公告或站内信为准；统一当前门槛未核",
    "ongoing_requirements": "官方存在持续评估；具体达标标准待核",
    "revenue": "原创内容现金激励、抖西分成；现行计算细则待核",
    "settlement": null
  },
  "publication_at": null,
  "rewards": [
    {
      "amount": null,
      "label": "原创内容现金激励与抖西分成（非固定金额）",
      "scope": "以官方现行账号规则为准",
      "type": "cash"
    }
  ],
  "risks": [
    {
      "detail": "六张长图已由前序研究阅读，但有内测且无修订日期；AI准入与当前统一门槛未核。",
      "level": "unknown",
      "type": "unknown"
    }
  ],
  "source_id": "douyin_partner_rules",
  "steps": [],
  "summary": "中视频升级后的原创内容现金激励与抖西分成；官方不定期开放，加入时间以账号页面、公告或站内信为准。",
  "tags": [
    "原创",
    "创作者",
    "视频",
    "现金"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [
      "账号定向 / 分批，以作者实际页面、公告或站内信为准"
    ],
    "confirmed": true,
    "deadline": null,
    "evidence": "官方明示不定期开放；本账号本期起止未核。",
    "mechanism": "batches",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "start": null,
    "timezone": null
  },
  "title": "创作者伙伴计划",
  "verification": "partial",
  "verified_at": "2026-09-30",
  "work_requirements": []
}
~~~~


## 记录 9：77077a3206e6e83dc54510cd

- `id`：77077a3206e6e83dc54510cd
- `source_id`：bili_incentive
- `version`：1
- `edition`：官方客服2026-05-05 / 2026核验

### 原字段 `document`

~~~~json
{
  "edition": "官方客服2026-05-05 / 2026核验",
  "eligibility": [
    "权益等级≥3",
    "信用分≥80",
    "非封禁账号、企业蓝V、纪念账号",
    "四条机制的专属AI内容资格均未核到"
  ],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "研究移交：2026-05-05官方客服说明的公开申请资格、收益组合与贝壳结算。",
      "note": "部分字段已核；缺失字段仍待核验。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://www.bilibili.com/opus/1198858284376784900"
    }
  ],
  "id": "77077a3206e6e83dc54510cd",
  "kind": "creator_program",
  "official_url": "https://www.bilibili.com/opus/1198858284376784900",
  "organizer": "哔哩哔哩",
  "origin": "manual_handoff",
  "platform": "B站",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": "按官方申请入口及当前账号状态操作；具体入口待核",
    "ongoing_requirements": null,
    "revenue": "基础激励 + 框下 / 暂停广告分成不可拆分；详细稿件与计算条款待核",
    "settlement": "贝壳结算；周期、税费与提现条件待核"
  },
  "publication_at": "2026-05-05",
  "rewards": [
    {
      "amount": null,
      "label": "创作激励 + 广告分成（不可拆分；贝壳结算）",
      "scope": "收益随稿件与规则变化，非固定补贴",
      "type": "cash"
    }
  ],
  "risks": [
    {
      "detail": "AI作品资格、稿件版权与当前持续达标 / 退出条件待核；不沿用2023旧门槛。",
      "level": "unknown",
      "type": "unknown"
    }
  ],
  "source_id": "bili_incentive",
  "steps": [],
  "summary": "官方长期扶持机制。基础激励与框下 / 暂停广告分成不可拆分，贝壳结算；AI作品准入仍待核。",
  "tags": [
    "创作者",
    "视频",
    "现金",
    "激励"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": false,
    "deadline": null,
    "evidence": null,
    "mechanism": "unspecified",
    "policy_duration": "官方说明为长期扶持；未据此推断全年开放申请",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "start": null,
    "timezone": null
  },
  "title": "B站视频创作激励",
  "verification": "partial",
  "verified_at": "2026-09-30",
  "work_requirements": []
}
~~~~


## 记录 10：d60c099035869e212b5cd251

- `id`：d60c099035869e212b5cd251
- `source_id`：bili_huahuo
- `version`：1
- `edition`：商业合作机制 / 2026核验

### 原字段 `document`

~~~~json
{
  "edition": "商业合作机制 / 2026核验",
  "eligibility": [],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "研究移交：官方花火平台定义为商业合作撮合。",
      "note": "部分字段已核；缺失字段仍待核验。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://e.bilibili.com/observe/observe_1.html"
    }
  ],
  "id": "d60c099035869e212b5cd251",
  "kind": "creator_program",
  "official_url": "https://e.bilibili.com/observe/observe_1.html",
  "organizer": "哔哩哔哩",
  "origin": "manual_handoff",
  "platform": "B站",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": "商业合作订单收入，以实际合同与订单为准",
    "settlement": "选择贝壳自提的个人订单：完成T+1转贝壳（2025-10-01改动）；其余模式待核"
  },
  "publication_at": null,
  "rewards": [
    {
      "label": "商业合作撮合与订单收入（无保底承诺）",
      "type": "other"
    }
  ],
  "risks": [
    {
      "detail": "订单授权、品牌独家、合同义务需逐单审阅；AI作品准入未核。",
      "level": "review",
      "type": "unknown"
    }
  ],
  "source_id": "bili_huahuo",
  "steps": [],
  "summary": "品牌与UP主商业合作撮合机制。收入依实际订单，不是保底补贴或播放分成，当前准入门槛未核。",
  "tags": [
    "创作者",
    "商业合作",
    "视频"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": false,
    "deadline": null,
    "evidence": null,
    "mechanism": "unspecified",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "start": null,
    "timezone": null
  },
  "title": "B站花火商业合作平台",
  "verification": "partial",
  "verified_at": "2026-09-30",
  "work_requirements": []
}
~~~~


## 记录 11：6e39f9755ad765fbec7a3c24

- `id`：6e39f9755ad765fbec7a3c24
- `source_id`：bili_huahuo_rules
- `version`：2
- `edition`：2025-10-01生效结算改动

### 原字段 `document`

~~~~json
{
  "edition": "2025-10-01生效结算改动",
  "eligibility": [],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "研究移交：官方2025-10-01结算改动；当前未知的其他模式保持空。",
      "note": "部分字段已核；缺失字段仍待核验。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://www.bilibili.com/blackboard/activity-EHM5wokgqh.html"
    }
  ],
  "id": "6e39f9755ad765fbec7a3c24",
  "kind": "rule_update",
  "official_url": "https://www.bilibili.com/blackboard/activity-EHM5wokgqh.html",
  "organizer": "哔哩哔哩",
  "origin": "manual_handoff",
  "platform": "B站",
  "program": {
    "effective_version": "2025-10-01结算改动",
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": "选择贝壳自提的个人订单，完成T+1转贝壳"
  },
  "publication_at": null,
  "relations": [
    {
      "note": "贝壳结算规则的生效时间独立于花火加入与订单周期。",
      "target_id": "d60c099035869e212b5cd251",
      "type": "rule_for"
    }
  ],
  "rewards": [],
  "risks": [],
  "source_id": "bili_huahuo_rules",
  "steps": [],
  "summary": "选择贝壳自提的个人订单，订单完成T+1转贝壳；不推断其他结算模式。",
  "tags": [
    "结算",
    "创作者",
    "规则"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": true,
    "deadline": null,
    "evidence": "官方结算改动生效日期2025-10-01；终止日期未说明。",
    "mechanism": "unspecified",
    "policy_effective": "2025-10-01",
    "policy_end": null,
    "policy_version": "2025-10-01结算改动",
    "start": null,
    "timezone": null
  },
  "title": "花火个人订单 · 贝壳自提结算规则更新",
  "verification": "partial",
  "verified_at": "2026-09-30",
  "work_requirements": []
}
~~~~


## 记录 12：d03461862e34bf2ca91fa698

- `id`：d03461862e34bf2ca91fa698
- `source_id`：libtv
- `version`：3
- `edition`：2026 / 活动61

### 原字段 `document`

~~~~json
{
  "edition": "2026 / 活动61",
  "eligibility": [],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "官方公开活动清单内嵌数据与规则正文；非实时登录态。",
      "external_rules": [
        "https://liblibai-online.liblib.cloud/web/e8a6028962b2445b9667f9c00f039daa/1521b832-35af-44a6-9691-193dfe000870.jpg",
        "https://liblibai-online.liblib.cloud/web/e8a6028962b2445b9667f9c00f039daa/b063b31c-93cd-41b1-85c0-b9b65b8a3d40.jpg",
        "https://liblibai-online.liblib.cloud/web/e8a6028962b2445b9667f9c00f039daa/ee201a06-6e33-4f42-a811-715b7628085e.jpg"
      ],
      "image_refs": [
        "https://liblibai-online.liblib.cloud/web/e8a6028962b2445b9667f9c00f039daa/1521b832-35af-44a6-9691-193dfe000870.jpg",
        "https://liblibai-online.liblib.cloud/web/e8a6028962b2445b9667f9c00f039daa/ee201a06-6e33-4f42-a811-715b7628085e.jpg",
        "https://liblibai-online.liblib.cloud/web/e8a6028962b2445b9667f9c00f039daa/b063b31c-93cd-41b1-85c0-b9b65b8a3d40.jpg"
      ],
      "note": "正文未完整覆盖的字段保持空；图片需人工阅读。",
      "observed_at": "2026-10-01T16:55:39+00:00",
      "origin": "live_fetch",
      "url": "https://www.liblib.tv/activity/61"
    }
  ],
  "id": "d03461862e34bf2ca91fa698",
  "kind": "competition",
  "official_url": "https://www.liblib.tv/activity/61",
  "organizer": null,
  "origin": "live_fetch",
  "platform": "LibTV",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": null,
  "rewards": [
    {
      "amount": null,
      "label": "现金奖励（数量及口径待核）",
      "scope": "官方奖励段落已提及；具体数量与结算口径需复核",
      "source_excerpt": "🎬大咖云集，500,000+现金奖池等你来拿！",
      "type": "cash"
    }
  ],
  "risks": [],
  "source_id": "libtv",
  "steps": [],
  "summary": "🎬大咖云集，500,000+现金奖池等你来拿！",
  "tags": [
    "AI",
    "短片"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": false,
    "deadline": null,
    "evidence": null,
    "mechanism": "unspecified",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "source_window": {
      "end": "2026-09-30T15:59:59+00:00",
      "note": "官方结构化活动周期，不自动等同于完整报名规则",
      "start": "2026-09-27T16:00:00+00:00"
    },
    "start": null,
    "timezone": null
  },
  "title": "LibTV·「X小时之后」AI短片黑客松正式开启！",
  "verification": "partial",
  "verified_at": null,
  "work_requirements": []
}
~~~~


## 记录 13：68ee18a0abd8124021470c0a

- `id`：68ee18a0abd8124021470c0a
- `source_id`：libtv
- `version`：4
- `edition`：2026 / 活动60

### 原字段 `document`

~~~~json
{
  "edition": "2026 / 活动60",
  "eligibility": [],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "官方公开活动清单内嵌数据与规则正文；非实时登录态。",
      "external_rules": [
        "https://liblibai-online.liblib.cloud/web/474dd6d63f8847f19a43c104a0919985/a2e440c1-3bd1-42bc-8599-9d1299e31dbb.jpg",
        "https://liblibai-online.liblib.cloud/web/5d2bf9704b8442cf9550a0c344f68cb9/0c7ce3c4-29d1-4ad2-a952-4d82837a1202.jpg",
        "https://resonate.feishu.cn/wiki/PYkDwGEaciRb76kFQm3cKrTVntd"
      ],
      "image_refs": [
        "https://liblibai-online.liblib.cloud/web/474dd6d63f8847f19a43c104a0919985/a2e440c1-3bd1-42bc-8599-9d1299e31dbb.jpg",
        "https://liblibai-online.liblib.cloud/web/5d2bf9704b8442cf9550a0c344f68cb9/0c7ce3c4-29d1-4ad2-a952-4d82837a1202.jpg"
      ],
      "note": "正文未完整覆盖的字段保持空；图片需人工阅读。",
      "observed_at": "2026-10-01T16:55:39+00:00",
      "origin": "live_fetch",
      "url": "https://www.liblib.tv/activity/60"
    }
  ],
  "id": "68ee18a0abd8124021470c0a",
  "kind": "competition",
  "official_url": "https://www.liblib.tv/activity/60",
  "organizer": null,
  "origin": "live_fetch",
  "platform": "LibTV",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": null,
  "rewards": [
    {
      "amount": null,
      "label": "积分奖励（数量及口径待核）",
      "scope": "官方奖励段落已提及；具体数量与结算口径需复核",
      "source_excerpt": "> 前100名合规投稿的作者｜每人回馈1000积分",
      "type": "credits"
    },
    {
      "amount": null,
      "label": "算力奖励（数量及口径待核）",
      "scope": "官方奖励段落已提及；具体数量与结算口径需复核",
      "source_excerpt": "> 活动期间所有投稿中，每位作者仅返还一次；可重复投稿，但不返还算力；该投稿算力活动结束后将统一发放至个人账户",
      "type": "compute"
    }
  ],
  "risks": [
    {
      "detail": "## 📕小红书｜首发短片专属扶持📕\n> 参与【LibTVx北京电影学院｜一场戏的诞生】，活动期间将投稿作品在小红书首发，并同时带上  **#AI全能艺术家计划 ➕ #小红书短电影**，通过审核即可解锁额外流量扶持💥让更多人看见你的作品\n* 🍠 红薯首发 + 指定Tag x2",
      "level": "review",
      "type": "first_release"
    }
  ],
  "source_id": "libtv",
  "steps": [],
  "summary": "💡灯光就位，好戏开场 ｜8万+奖池等你挑战",
  "tags": [
    "AI",
    "短片",
    "动画",
    "创作者",
    "算力",
    "激励"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": false,
    "deadline": null,
    "evidence": null,
    "mechanism": "unspecified",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "source_window": {
      "end": "2026-09-22T15:59:59+00:00",
      "note": "官方结构化活动周期，不自动等同于完整报名规则",
      "start": "2026-08-24T16:00:00+00:00"
    },
    "start": null,
    "timezone": null
  },
  "title": "LibTV x 北京电影学院文学系｜「一场戏的诞生」",
  "verification": "partial",
  "verified_at": null,
  "work_requirements": []
}
~~~~


## 记录 14：3ca65e2d63ffd543dc5c8f81

- `id`：3ca65e2d63ffd543dc5c8f81
- `source_id`：libtv
- `version`：3
- `edition`：2026 / 活动59

### 原字段 `document`

~~~~json
{
  "edition": "2026 / 活动59",
  "eligibility": [],
  "entry_url": "https://www.liblib.tv/activity/59",
  "evidence": [
    {
      "excerpt": "官方公开活动清单内嵌数据与规则正文；非实时登录态。",
      "external_rules": [
        "https://liblibai-online.liblib.cloud/web/ae93620a110f4bebbf8932e6a045ec4d/181825a2-a726-486d-9c5e-078fe4879031.jpeg",
        "https://resonate.feishu.cn/wiki/F9XIwzvcQiIqpTkNRpbcqkntnJe"
      ],
      "image_refs": [
        "https://liblibai-online.liblib.cloud/web/ae93620a110f4bebbf8932e6a045ec4d/181825a2-a726-486d-9c5e-078fe4879031.jpeg"
      ],
      "note": "正文未完整覆盖的字段保持空；图片需人工阅读。",
      "observed_at": "2026-10-01T16:55:39+00:00",
      "origin": "live_fetch",
      "url": "https://www.liblib.tv/activity/59"
    }
  ],
  "id": "3ca65e2d63ffd543dc5c8f81",
  "kind": "competition",
  "official_url": "https://www.liblib.tv/activity/59",
  "organizer": null,
  "origin": "live_fetch",
  "platform": "LibTV",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": null,
  "rewards": [
    {
      "amount": null,
      "label": "现金奖励（数量及口径待核）",
      "scope": "官方奖励段落已提及；具体数量与结算口径需复核",
      "source_excerpt": "> 🏆全场特等奖：1名｜10,000元现金\n> 📣影响力专项：2名｜每人2,000元现金 + 100,000积分\n> 🎨美学专项：2名｜每人2,000元现金 + 100,000积分",
      "type": "cash"
    },
    {
      "amount": null,
      "label": "积分奖励（数量及口径待核）",
      "scope": "官方奖励段落已提及；具体数量与结算口径需复核",
      "source_excerpt": "> 📣影响力专项：2名｜每人2,000元现金 + 100,000积分\n> 🎨美学专项：2名｜每人2,000元现金 + 100,000积分\n> ✨优秀入围：10名｜每条10,000积分",
      "type": "credits"
    }
  ],
  "risks": [],
  "source_id": "libtv",
  "steps": [
    "## 🎥如何参赛",
    "1️⃣ 在 LibTV 画布内完成视频创作，成片分辨率不低于720P，并配有音乐或配音",
    "2️⃣ 图片与视频环节须有50%及以上流程在 LibTV 画布中生成，后期剪辑可使用其他产品辅助",
    "3️⃣ 将成片发布至抖音、快手、B站、小红书、视频号等至少一个社媒平台，并带话题 **#AI重制那头牛大赛**",
    "4️⃣ 在画布右上角点击「分享」，上传视频、封面及社媒链接，选择本次活动并勾选「公开画布」",
    "5️⃣ 点击「发布投稿」，材料完整且通过审核后，即视为正式参赛",
    "> 💡参赛作品须为本次活动原创新作，不得抄袭、使用竞品 AI 内容或同步参加其他 AI 平台赛事",
    ">",
    "> 活动截止前可更新画布与成片，截止后发生更新的投稿将视为无效"
  ],
  "summary": "🤪 越抽象，越有戏｜5 万+奖池等你来整活",
  "tags": [
    "AI",
    "短片",
    "导演",
    "视频",
    "激励"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": false,
    "deadline": null,
    "evidence": null,
    "mechanism": "unspecified",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "source_window": {
      "end": "2026-08-26T10:00:00+00:00",
      "note": "官方结构化活动周期，不自动等同于完整报名规则",
      "start": "2026-08-18T16:00:00+00:00"
    },
    "start": null,
    "timezone": null
  },
  "title": "LibTV「AI重制那头牛」大赛",
  "verification": "partial",
  "verified_at": null,
  "work_requirements": []
}
~~~~


## 记录 15：a09b6cf6a295e5a9d5fd6de0

- `id`：a09b6cf6a295e5a9d5fd6de0
- `source_id`：libtv
- `version`：4
- `edition`：2026 / 活动56

### 原字段 `document`

~~~~json
{
  "edition": "2026 / 活动56",
  "eligibility": [],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "官方公开活动清单内嵌数据与规则正文；非实时登录态。",
      "external_rules": [
        "https://liblibai-online.liblib.cloud/web/5d2bf9704b8442cf9550a0c344f68cb9/0c7ce3c4-29d1-4ad2-a952-4d82837a1202.jpg",
        "https://liblibai-online.liblib.cloud/web/5d2bf9704b8442cf9550a0c344f68cb9/9cb98afc-0af7-47be-a1c4-bc781d5656e3.png",
        "https://resonate.feishu.cn/wiki/YrfPw8EWfiETOakBalOcJuoUn1c?from=from_copylink",
        "https://yka.qq.com/bounty/new/detail?activityId=YKA-T30-26072916110001&task_type=1"
      ],
      "image_refs": [
        "https://liblibai-online.liblib.cloud/web/5d2bf9704b8442cf9550a0c344f68cb9/9cb98afc-0af7-47be-a1c4-bc781d5656e3.png",
        "https://liblibai-online.liblib.cloud/web/5d2bf9704b8442cf9550a0c344f68cb9/0c7ce3c4-29d1-4ad2-a952-4d82837a1202.jpg"
      ],
      "note": "正文未完整覆盖的字段保持空；图片需人工阅读。",
      "observed_at": "2026-10-01T16:55:39+00:00",
      "origin": "live_fetch",
      "url": "https://www.liblib.tv/activity/56"
    }
  ],
  "id": "a09b6cf6a295e5a9d5fd6de0",
  "kind": "competition",
  "official_url": "https://www.liblib.tv/activity/56",
  "organizer": null,
  "origin": "live_fetch",
  "platform": "LibTV",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": null,
  "rewards": [
    {
      "amount": null,
      "label": "现金奖励（数量及口径待核）",
      "scope": "官方奖励段落已提及；具体数量与结算口径需复核",
      "source_excerpt": "🚀 多重福利加码｜积分、现金、官方周边、赛事门票\n## 🎉活动奖励「3W现金+20W积分算力+惊喜官方福利」\n### 💰【现金奖池】3W奖金加码\n除现金奖池与积分算力扶持外，本次活动还将加码送出无畏契约惊喜礼品及官方赛事门票！",
      "type": "cash"
    },
    {
      "amount": null,
      "label": "积分奖励（数量及口径待核）",
      "scope": "官方奖励段落已提及；具体数量与结算口径需复核",
      "source_excerpt": "🚀 多重福利加码｜积分、现金、官方周边、赛事门票\n## 🎉活动奖励「3W现金+20W积分算力+惊喜官方福利」\n### ⚡️ 【积分扶持】20W积分算力\n提交您的个人社媒主页及过往AI作品链接报名，我们将根据创作资历与作品质量进行审核，并给予首笔「制片启动积分」\n> level3：4500积分⚡️    ｜\n>level2：1500积分⚡️    ｜\n> level1：500积分⚡️｜\n除现金奖池与积分算力扶持外，本次活动还将加码送出无畏契约惊喜礼品及官方赛事门票！",
      "type": "credits"
    },
    {
      "amount": null,
      "label": "算力奖励（数量及口径待核）",
      "scope": "官方奖励段落已提及；具体数量与结算口径需复核",
      "source_excerpt": "## 🎉活动奖励「3W现金+20W积分算力+惊喜官方福利」\n### ⚡️ 【积分扶持】20W积分算力\n除现金奖池与积分算力扶持外，本次活动还将加码送出无畏契约惊喜礼品及官方赛事门票！",
      "type": "compute"
    }
  ],
  "risks": [],
  "source_id": "libtv",
  "steps": [],
  "summary": "🚀 多重福利加码｜积分、现金、官方周边、赛事门票",
  "tags": [
    "AI",
    "动画",
    "创作者",
    "算力"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": false,
    "deadline": null,
    "evidence": null,
    "mechanism": "unspecified",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "source_window": {
      "end": "2026-08-31T15:59:59+00:00",
      "note": "官方结构化活动周期，不自动等同于完整报名规则",
      "start": "2026-07-31T16:00:00+00:00"
    },
    "start": null,
    "timezone": null
  },
  "title": "LibTV x 游可爱｜瓦漫节·无畏契约觉醒计划",
  "verification": "partial",
  "verified_at": null,
  "work_requirements": []
}
~~~~


## 记录 16：63e146860feed31b7a6652ba

- `id`：63e146860feed31b7a6652ba
- `source_id`：libtv
- `version`：4
- `edition`：2026 / 活动55

### 原字段 `document`

~~~~json
{
  "edition": "2026 / 活动55",
  "eligibility": [],
  "entry_url": "https://www.liblib.tv/activity/55",
  "evidence": [
    {
      "excerpt": "官方公开活动清单内嵌数据与规则正文；非实时登录态。",
      "external_rules": [
        "https://liblibai-online.liblib.cloud/web/ae93620a110f4bebbf8932e6a045ec4d/864389c4-8d24-4927-a0c4-61b4b649d549.jpeg",
        "https://liblibai-online.liblib.cloud/web/ae93620a110f4bebbf8932e6a045ec4d/fdedc8c6-454d-489d-b188-8c4fa62b9dba.png",
        "https://resonate.feishu.cn/share/base/form/shrcnmay0rCpj6WcYxIpeQErmyd",
        "https://resonate.feishu.cn/wiki/NwLewhhQvikE4fknubhc3GK6nAe",
        "https://www.liblib.tv"
      ],
      "image_refs": [
        "https://liblibai-online.liblib.cloud/web/ae93620a110f4bebbf8932e6a045ec4d/864389c4-8d24-4927-a0c4-61b4b649d549.jpeg",
        "https://liblibai-online.liblib.cloud/web/ae93620a110f4bebbf8932e6a045ec4d/fdedc8c6-454d-489d-b188-8c4fa62b9dba.png"
      ],
      "note": "正文未完整覆盖的字段保持空；图片需人工阅读。",
      "observed_at": "2026-10-01T16:55:39+00:00",
      "origin": "live_fetch",
      "url": "https://www.liblib.tv/activity/55"
    }
  ],
  "id": "63e146860feed31b7a6652ba",
  "kind": "competition",
  "official_url": "https://www.liblib.tv/activity/55",
  "organizer": null,
  "origin": "live_fetch",
  "platform": "LibTV",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": null,
  "rewards": [
    {
      "amount": null,
      "label": "现金奖励（数量及口径待核）",
      "scope": "官方奖励段落已提及；具体数量与结算口径需复核",
      "source_excerpt": "🥇 13万现金＋70万积分，等你的 Skill 一战封神\n> 👑票房之王：1名｜20,000元现金\n> 💰金算盘奖：1名｜10,000元现金\n> 🔓大师公开课奖：1名｜10,000元现金\n> 🔥爆款片场：3名｜每人10,000元现金 + 100,000通用积分\n> 🛠️效率片场：3名｜每人10,000元现金 + 100,000通用积分\n> 🎨大师片场：1名｜10,000元现金 + 100,000通用积分\n> ✨优秀入围：40条｜每条500元现金",
      "type": "cash"
    },
    {
      "amount": null,
      "label": "积分奖励（数量及口径待核）",
      "scope": "官方奖励段落已提及；具体数量与结算口径需复核",
      "source_excerpt": "🥇 13万现金＋70万积分，等你的 Skill 一战封神\n> 🔥爆款片场：3名｜每人10,000元现金 + 100,000通用积分\n> 🛠️效率片场：3名｜每人10,000元现金 + 100,000通用积分\n> 🎨大师片场：1名｜10,000元现金 + 100,000通用积分",
      "type": "credits"
    }
  ],
  "risks": [],
  "source_id": "libtv",
  "steps": [
    "## 🎥如何参赛",
    "1️⃣ 登录 LibTV，完成 Skill 配置并公开发布：https://www.liblib.tv",
    "2️⃣ 填写参赛登记表，绑定参赛 Skill 并选择所属片场：",
    "https://resonate.feishu.cn/share/base/form/shrcnmay0rCpj6WcYxIpeQErmyd",
    "3️⃣ 提交不少于2条完全由该 Skill 产出的 Show Case",
    "4️⃣ 附上使用说明，包括适用场景、输入要求及预期输出",
    "5️⃣ 通过官方验收，即视为正式参赛",
    "> 💡Skill 需在平台公开发布，但无需公开 Skill 本体内容；比赛期间可随时追加新的参赛 Skill，多投多得"
  ],
  "summary": "🥇 13万现金＋70万积分，等你的 Skill 一战封神",
  "tags": [
    "AI",
    "导演",
    "激励"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": false,
    "deadline": null,
    "evidence": null,
    "mechanism": "unspecified",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "source_window": {
      "end": "2026-08-13T15:59:59+00:00",
      "note": "官方结构化活动周期，不自动等同于完整报名规则",
      "start": "2026-07-23T10:00:00+00:00"
    },
    "start": null,
    "timezone": null
  },
  "title": "LibTV Skill 导演大师赛",
  "verification": "partial",
  "verified_at": null,
  "work_requirements": []
}
~~~~


## 记录 17：68a13fce2c0e1cc364af0a9a

- `id`：68a13fce2c0e1cc364af0a9a
- `source_id`：libtv
- `version`：4
- `edition`：2026 / 活动53

### 原字段 `document`

~~~~json
{
  "edition": "2026 / 活动53",
  "eligibility": [],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "官方公开活动清单内嵌数据与规则正文；非实时登录态。",
      "external_rules": [
        "https://liblibai-online.liblib.cloud/web/5d2bf9704b8442cf9550a0c344f68cb9/0c7ce3c4-29d1-4ad2-a952-4d82837a1202.jpg",
        "https://liblibai-online.liblib.cloud/web/5d2bf9704b8442cf9550a0c344f68cb9/4f3b2ace-a3f5-4657-b43e-e75847f6ade6.png",
        "https://resonate.feishu.cn/wiki/Z67cwHtjvi9DmEknCc2cbONPnve?from=from_copylink"
      ],
      "image_refs": [
        "https://liblibai-online.liblib.cloud/web/5d2bf9704b8442cf9550a0c344f68cb9/4f3b2ace-a3f5-4657-b43e-e75847f6ade6.png",
        "https://liblibai-online.liblib.cloud/web/5d2bf9704b8442cf9550a0c344f68cb9/0c7ce3c4-29d1-4ad2-a952-4d82837a1202.jpg"
      ],
      "note": "正文未完整覆盖的字段保持空；图片需人工阅读。",
      "observed_at": "2026-10-01T16:55:39+00:00",
      "origin": "live_fetch",
      "url": "https://www.liblib.tv/activity/53"
    }
  ],
  "id": "68a13fce2c0e1cc364af0a9a",
  "kind": "competition",
  "official_url": "https://www.liblib.tv/activity/53",
  "organizer": null,
  "origin": "live_fetch",
  "platform": "LibTV",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": null,
  "rewards": [
    {
      "amount": null,
      "label": "积分奖励（数量及口径待核）",
      "scope": "官方奖励段落已提及；具体数量与结算口径需复核",
      "source_excerpt": "> 一城一味 ：2人｜每人10000元 + 20000通用积分\n> 街角温度：5人｜每人4000元 + 10000通用积分\n> 最佳名片 ：2人｜每人10000元 + 20000通用积分\n> 城市探索：5人｜每人4000元 + 10000通用积分\n> 入围奖：10人｜每人2000元 + 5000通用积分\n‼️**前150名**投稿的合规作品将额外加赠高额算力包：**1000单月·通用积分/篇**‼️",
      "type": "credits"
    },
    {
      "amount": null,
      "label": "算力奖励（数量及口径待核）",
      "scope": "官方奖励段落已提及；具体数量与结算口径需复核",
      "source_excerpt": "‼️**前150名**投稿的合规作品将额外加赠高额算力包：**1000单月·通用积分/篇**‼️\n*活动期间所有投稿中，每位作者仅返还一次；可多次投稿，但不返还算力；\n该投稿算力活动结束后将统一发放至个人账户；返还算力有效期均为1个月*",
      "type": "compute"
    }
  ],
  "risks": [],
  "source_id": "libtv",
  "steps": [],
  "summary": "🏆15万丰厚奖池｜高德扫街榜活动来袭！",
  "tags": [
    "AI",
    "短片",
    "算力"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": false,
    "deadline": null,
    "evidence": null,
    "mechanism": "unspecified",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "source_window": {
      "end": "2026-08-15T15:59:59+00:00",
      "note": "官方结构化活动周期，不自动等同于完整报名规则",
      "start": "2026-07-15T03:00:00+00:00"
    },
    "start": null,
    "timezone": null
  },
  "title": "高德 x LibTV x 阿里云｜走，我们扫街去",
  "verification": "partial",
  "verified_at": null,
  "work_requirements": []
}
~~~~


## 记录 18：e9bc02e1bba25f0aeea64d6a

- `id`：e9bc02e1bba25f0aeea64d6a
- `source_id`：libtv
- `version`：3
- `edition`：2026 / 活动52

### 原字段 `document`

~~~~json
{
  "edition": "2026 / 活动52",
  "eligibility": [],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "官方公开活动清单内嵌数据与规则正文；非实时登录态。",
      "external_rules": [
        "https://liblibai-online.liblib.cloud/web/5d2bf9704b8442cf9550a0c344f68cb9/0c7ce3c4-29d1-4ad2-a952-4d82837a1202.jpg",
        "https://liblibai-online.liblib.cloud/web/5d2bf9704b8442cf9550a0c344f68cb9/7cd2b65c-712c-4d75-ad16-96880588b139.png",
        "https://resonate.feishu.cn/wiki/KMfUwlr9TiQIWHkKZ4XcaMHDnGb?from=from_copylink",
        "https://resonate.feishu.cn/wiki/UGi1wFL88i1EmikxmhTcb62jnDh?from=from_copylink"
      ],
      "image_refs": [
        "https://liblibai-online.liblib.cloud/web/5d2bf9704b8442cf9550a0c344f68cb9/7cd2b65c-712c-4d75-ad16-96880588b139.png",
        "https://liblibai-online.liblib.cloud/web/5d2bf9704b8442cf9550a0c344f68cb9/0c7ce3c4-29d1-4ad2-a952-4d82837a1202.jpg"
      ],
      "note": "正文未完整覆盖的字段保持空；图片需人工阅读。",
      "observed_at": "2026-10-01T16:55:39+00:00",
      "origin": "live_fetch",
      "url": "https://www.liblib.tv/activity/52"
    }
  ],
  "id": "e9bc02e1bba25f0aeea64d6a",
  "kind": "competition",
  "official_url": "https://www.liblib.tv/activity/52",
  "organizer": null,
  "origin": "live_fetch",
  "platform": "LibTV",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": null,
  "rewards": [
    {
      "amount": null,
      "label": "积分奖励（数量及口径待核）",
      "scope": "官方奖励段落已提及；具体数量与结算口径需复核",
      "source_excerpt": "> 最强创意冲击 & 最动人故事：4人｜每人7000元 + 15000通用积分\n> 提名奖：10人｜每人2000元 + 5000通用积分\n>最佳文化表达：5人｜ 每人3000元 + 20000通用积分\n‼️**前100名**投稿的合规作品将额外加赠高额算力包：**1000单月·通用积分/篇**‼️",
      "type": "credits"
    },
    {
      "amount": null,
      "label": "算力奖励（数量及口径待核）",
      "scope": "官方奖励段落已提及；具体数量与结算口径需复核",
      "source_excerpt": "‼️**前100名**投稿的合规作品将额外加赠高额算力包：**1000单月·通用积分/篇**‼️\n*活动期间所有投稿中，每位作者仅返还一次；可多次投稿，但不返还算力；\n该投稿算力活动结束后将统一发放至个人账户；返还算力有效期均为1个月*",
      "type": "compute"
    }
  ],
  "risks": [],
  "source_id": "libtv",
  "steps": [],
  "summary": "🎬价值10万+奖池已就位，只等你的Action",
  "tags": [
    "AI",
    "短片",
    "导演",
    "算力"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": false,
    "deadline": null,
    "evidence": null,
    "mechanism": "unspecified",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "source_window": {
      "end": "2026-07-08T15:59:59+00:00",
      "note": "官方结构化活动周期，不自动等同于完整报名规则",
      "start": "2026-06-10T12:00:00+00:00"
    },
    "start": null,
    "timezone": null
  },
  "title": "LibTVC｜广告“导演”请就位！",
  "verification": "partial",
  "verified_at": null,
  "work_requirements": []
}
~~~~


## 记录 19：4c9fa85e9ccc56971e48ed9b

- `id`：4c9fa85e9ccc56971e48ed9b
- `source_id`：libtv
- `version`：4
- `edition`：2026 / 活动51

### 原字段 `document`

~~~~json
{
  "edition": "2026 / 活动51",
  "eligibility": [],
  "entry_url": "https://www.liblib.tv/activity/51",
  "evidence": [
    {
      "excerpt": "官方公开活动清单内嵌数据与规则正文；非实时登录态。",
      "external_rules": [
        "https://liblibai-online.liblib.cloud/web/5d2bf9704b8442cf9550a0c344f68cb9/cd1df282-7cf2-471e-ba9f-4a0bfd3980a5.png",
        "https://liblibai-online.liblib.cloud/web/5d2bf9704b8442cf9550a0c344f68cb9/d9eff4c0-f251-4fb5-9700-df78175cf8a4.jpg",
        "https://resonate.feishu.cn/share/base/form/shrcn6HjYDrbUpAiigluxAQC8ld",
        "https://resonate.feishu.cn/wiki/IJuBw6ZSuidor1kCXY2cTmX3nId?from=auth_notice&hash=f567aa2ce3aa6b9f0a24148f7905f4b0]("
      ],
      "image_refs": [
        "https://liblibai-online.liblib.cloud/web/5d2bf9704b8442cf9550a0c344f68cb9/d9eff4c0-f251-4fb5-9700-df78175cf8a4.jpg",
        "https://liblibai-online.liblib.cloud/web/5d2bf9704b8442cf9550a0c344f68cb9/cd1df282-7cf2-471e-ba9f-4a0bfd3980a5.png"
      ],
      "note": "正文未完整覆盖的字段保持空；图片需人工阅读。",
      "observed_at": "2026-10-01T16:55:39+00:00",
      "origin": "live_fetch",
      "url": "https://www.liblib.tv/activity/51"
    }
  ],
  "id": "4c9fa85e9ccc56971e48ed9b",
  "kind": "competition",
  "official_url": "https://www.liblib.tv/activity/51",
  "organizer": null,
  "origin": "live_fetch",
  "platform": "LibTV",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": null,
  "rewards": [
    {
      "amount": null,
      "label": "现金奖励（数量及口径待核）",
      "scope": "官方奖励段落已提及；具体数量与结算口径需复核",
      "source_excerpt": "千万算力+百万现金激励+非遗认证｜奖池拉满🔥\n`【优酷发行资源扶持】优秀横屏短漫剧项目有机会进入优酷发行评估，S+项目最高可获200万保底+分账现金激励，并获得优酷站内漫剧垂类S+资源位扶持",
      "type": "cash"
    },
    {
      "amount": null,
      "label": "积分奖励（数量及口径待核）",
      "scope": "官方奖励段落已提及；具体数量与结算口径需复核",
      "source_excerpt": "`【LibTV算力与产品扶持】A档3-10万积分，S档10-30万积分，S+档50-100万积分，并有机会获得Agent、资产管理、工作流共建、模板/主体库共创、产品深度共创等支持\nLibTV专项激励同步开放：非遗专项激励、传播潜力专项激励、LibTV短剧漫剧最佳实践，各3个项目，每个项目10万团队版积分及定向流量扶持",
      "type": "credits"
    },
    {
      "amount": null,
      "label": "算力奖励（数量及口径待核）",
      "scope": "官方奖励段落已提及；具体数量与结算口径需复核",
      "source_excerpt": "千万算力+百万现金激励+非遗认证｜奖池拉满🔥\n> LibTV算力与产品支持、优酷发行资源扶持、北京民艺非遗研究院专项背书同步开启\n`【LibTV算力与产品扶持】A档3-10万积分，S档10-30万积分，S+档50-100万积分，并有机会获得Agent、资产管理、工作流共建、模板/主体库共创、产品深度共创等支持",
      "type": "compute"
    },
    {
      "amount": null,
      "label": "流量奖励（数量及口径待核）",
      "scope": "官方奖励段落已提及；具体数量与结算口径需复核",
      "source_excerpt": "LibTV专项激励同步开放：非遗专项激励、传播潜力专项激励、LibTV短剧漫剧最佳实践，各3个项目，每个项目10万团队版积分及定向流量扶持",
      "type": "traffic"
    },
    {
      "amount": null,
      "label": "展映奖励（数量及口径待核）",
      "scope": "官方奖励段落已提及；具体数量与结算口径需复核",
      "source_excerpt": "`【国风非遗专项背书】符合条件的国风非遗项目，有机会获得北京民艺非遗研究院专项评审、官方认证、数字内容库入库、线下展映推荐及文化传播资源加持",
      "type": "screening"
    }
  ],
  "risks": [],
  "source_id": "libtv",
  "steps": [
    "### 📮 发布与提交",
    "> 完成作品后，请将PV/预告片发布至LibTV站内及至少一个社媒平台，并带上活动话题 #AI漫剧精卫计划",
    "* 社媒平台包括但不限于：抖音、小红书、B站、快手、微博、视频号",
    "* 所有成功提交至 LibTV｜AI漫剧精卫计划 的作品，方视为正式参赛作品",
    ">‼️活动详情‼️ [https://resonate.feishu.cn/wiki/IJuBw6ZSuidor1kCXY2cTmX3nId?from=auth_notice&hash=f567aa2ce3aa6b9f0a24148f7905f4b0]()",
    "> 下方为「🕊️精卫计划」专属活动社群，仅用于解答本次活动相关问题，欢迎加入交流👇",
    "![](https://liblibai-online.liblib.cloud/web/5d2bf9704b8442cf9550a0c344f68cb9/cd1df282-7cf2-471e-ba9f-4a0bfd3980a5.png)"
  ],
  "summary": "千万算力+百万现金激励+非遗认证｜奖池拉满🔥",
  "tags": [
    "AI",
    "动画",
    "创作者",
    "视频",
    "算力",
    "激励"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": false,
    "deadline": null,
    "evidence": null,
    "mechanism": "unspecified",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "source_window": {
      "end": "2026-06-30T15:59:59+00:00",
      "note": "官方结构化活动周期，不自动等同于完整报名规则",
      "start": "2026-05-26T10:06:40+00:00"
    },
    "start": null,
    "timezone": null
  },
  "title": "LibTV x 优酷 AI 漫剧「精卫计划」",
  "verification": "partial",
  "verified_at": null,
  "work_requirements": [
    "### ⚠️ 投稿要求",
    "> 参赛项目需为原创IP，需保留LibTV工作流与制作过程，LibTV至少参与作品60%的制作环节，否则将视为无效投稿",
    "‼️投稿请务必提交‼️：",
    "* 1分钟以上 PV / 预告片 / 概念片 / 高燃混剪",
    "* 3分钟以上首集Demo",
    "* 项目简介、世界观梗概、前5集规划、核心角色设定、项目核心看点",
    "备注：如报名国风非遗专项，需补充说明文化母题来源、非遗/民俗/神话/地方文化元素及原创化表达思路"
  ]
}
~~~~


## 记录 20：d282b56b9955d4b29bcc04c9

- `id`：d282b56b9955d4b29bcc04c9
- `source_id`：libtv
- `version`：3
- `edition`：2026 / 活动50

### 原字段 `document`

~~~~json
{
  "edition": "2026 / 活动50",
  "eligibility": [],
  "entry_url": "https://www.liblib.tv/activity/50",
  "evidence": [
    {
      "excerpt": "官方公开活动清单内嵌数据与规则正文；非实时登录态。",
      "external_rules": [
        "https://liblibai-online.liblib.cloud/web/5d2bf9704b8442cf9550a0c344f68cb9/dbebf551-3dd9-4a6b-afdb-800ef324493a.png"
      ],
      "image_refs": [
        "https://liblibai-online.liblib.cloud/web/5d2bf9704b8442cf9550a0c344f68cb9/dbebf551-3dd9-4a6b-afdb-800ef324493a.png"
      ],
      "note": "正文未完整覆盖的字段保持空；图片需人工阅读。",
      "observed_at": "2026-10-01T16:55:39+00:00",
      "origin": "live_fetch",
      "url": "https://www.liblib.tv/activity/50"
    }
  ],
  "id": "d282b56b9955d4b29bcc04c9",
  "kind": "competition",
  "official_url": "https://www.liblib.tv/activity/50",
  "organizer": null,
  "origin": "live_fetch",
  "platform": "LibTV",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": null,
  "rewards": [
    {
      "amount": null,
      "label": "积分奖励（数量及口径待核）",
      "scope": "官方奖励段落已提及；具体数量与结算口径需复核",
      "source_excerpt": "‼️**前200名**投稿的合规作品将额外加赠高额算力包：**1000单月·通用积分/篇**‼️\n`最佳剧情（5位）`：每人获得20000永久·通用积分\n`最佳脑洞（5位）`：每人获得20000永久·通用积分\n`最佳画风（5位）`：每人获得20000永久·通用积分",
      "type": "credits"
    },
    {
      "amount": null,
      "label": "算力奖励（数量及口径待核）",
      "scope": "官方奖励段落已提及；具体数量与结算口径需复核",
      "source_excerpt": "这一轮用AI释放脑洞🧠，解锁丰厚算力\n‼️**前200名**投稿的合规作品将额外加赠高额算力包：**1000单月·通用积分/篇**‼️\n> ‼️左侧二维码为活动专属交流群‼️获奖公示后，如有任何相关疑问可扫描右侧二维码添加运营同学反馈，我们将针对该投稿作品进行二次审核确认；另外，以下所有获奖作品，将于6/15发放奖励算力⚡️请各位耐心等待",
      "type": "compute"
    },
    {
      "amount": null,
      "label": "流量奖励（数量及口径待核）",
      "scope": "官方奖励段落已提及；具体数量与结算口径需复核",
      "source_excerpt": "### 流量扶持\n->>优秀作品同步将获得300～2000元不等的流量券加持",
      "type": "traffic"
    }
  ],
  "risks": [],
  "source_id": "libtv",
  "steps": [
    "### 3️⃣发布要求",
    "->>将作品成片发布到 **抖音🎵** 或 **小红书🍠**，带话题 **#AI影像狂飙季  #libtv大乱斗**",
    "->>在 LibTV画布右上角点击「分享」按钮，在投稿页面粘贴社媒链接 + 上传视频&封面 + 选择活动 + 勾选公开画布，点击发布投稿"
  ],
  "summary": "这一轮用AI释放脑洞🧠，解锁丰厚算力",
  "tags": [
    "AI",
    "短片",
    "动画",
    "创作者",
    "视频",
    "算力"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": false,
    "deadline": null,
    "evidence": null,
    "mechanism": "unspecified",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "source_window": {
      "end": "2026-06-01T15:00:00+00:00",
      "note": "官方结构化活动周期，不自动等同于完整报名规则",
      "start": "2026-05-18T04:03:20+00:00"
    },
    "start": null,
    "timezone": null
  },
  "title": "LibTV大乱斗｜vol.2《AI，想象和尖叫》",
  "verification": "partial",
  "verified_at": null,
  "work_requirements": [
    "## ⚠️投稿要求",
    "### 1️⃣ 作品要求",
    "创作方向：**剧情短片**（精简短小、有反转、有脑洞)",
    "题材：**科幻**、**奇幻**、**恐怖**、**喜剧**（爱死机式短片，可四选一，更欢迎混搭）",
    "画风：从超写实的**3D CGI**，到独特的**2D手绘/动画**，亦或是**CG与动画混合**风格均可",
    "时长：**90秒及以上**（不建议超过5分钟）",
    "像素：≥1080p（如使用sd2.0可≥720p），有配乐或配音（对话需字幕）",
    "### 2️⃣ 画布要求",
    "->>提交时必须公开工作流画布",
    "->>发布时，图片和视频环节必须有70%及以上的流程在 LibTV画布上生成（非liblib）包括但不限于角色设定、画面背景、经典元素等",
    "1.不得复制、照搬、直接上传其他竞品AI来源的素材",
    "2.不得提交过往已参赛过的旧内容、竞品AI的内容",
    "3.投稿作品不得同步参与其他竞品AI的投稿活动",
    "### 3️⃣发布要求",
    "->>将作品成片发布到 **抖音🎵** 或 **小红书🍠**，带话题 **#AI影像狂飙季  #libtv大乱斗**",
    "->>在 LibTV画布右上角点击「分享」按钮，在投稿页面粘贴社媒链接 + 上传视频&封面 + 选择活动 + 勾选公开画布，点击发布投稿"
  ]
}
~~~~


## 记录 21：dd7c3d721a6bea07b506abb1

- `id`：dd7c3d721a6bea07b506abb1
- `source_id`：libtv
- `version`：4
- `edition`：2026 / 活动49

### 原字段 `document`

~~~~json
{
  "edition": "2026 / 活动49",
  "eligibility": [],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "官方公开活动清单内嵌数据与规则正文；非实时登录态。",
      "external_rules": [
        "https://liblibai-online.liblib.cloud/web/5d2bf9704b8442cf9550a0c344f68cb9/0c7ce3c4-29d1-4ad2-a952-4d82837a1202.jpg",
        "https://liblibai-online.liblib.cloud/web/5d2bf9704b8442cf9550a0c344f68cb9/fab2432e-693d-4434-9494-d0908e1796dc.png",
        "https://resonate.feishu.cn/wiki/PZHSwt1fCisTYKkyrWaczlTdnPd?from=from_copylink]("
      ],
      "image_refs": [
        "https://liblibai-online.liblib.cloud/web/5d2bf9704b8442cf9550a0c344f68cb9/fab2432e-693d-4434-9494-d0908e1796dc.png",
        "https://liblibai-online.liblib.cloud/web/5d2bf9704b8442cf9550a0c344f68cb9/0c7ce3c4-29d1-4ad2-a952-4d82837a1202.jpg"
      ],
      "note": "正文未完整覆盖的字段保持空；图片需人工阅读。",
      "observed_at": "2026-10-01T16:55:39+00:00",
      "origin": "live_fetch",
      "url": "https://www.liblib.tv/activity/49"
    }
  ],
  "id": "dd7c3d721a6bea07b506abb1",
  "kind": "competition",
  "official_url": "https://www.liblib.tv/activity/49",
  "organizer": null,
  "origin": "live_fetch",
  "platform": "LibTV",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": null,
  "rewards": [
    {
      "amount": null,
      "label": "现金奖励（数量及口径待核）",
      "scope": "官方奖励段落已提及；具体数量与结算口径需复核",
      "source_excerpt": "`最佳画布（1位）`：每人20000元现金奖励➕年度尊享版会员➕2000元等额曝光扶持\n`最佳显形（3位）`：每人15000元现金奖励➕年度大师版会员➕1000元等额曝光扶持\n`最创意显形（3位）`：每人5000元现金奖励➕月度尊享版会员➕500元等额曝光扶持",
      "type": "cash"
    },
    {
      "amount": null,
      "label": "积分奖励（数量及口径待核）",
      "scope": "官方奖励段落已提及；具体数量与结算口径需复核",
      "source_excerpt": "> 三大赛道集结，总奖池超 10w+，会员、积分、曝光，层层加码，更有前 100 名抢先投稿激励等你来拿！\n`最终入围奖（10位）`：每人5000永久积分➕月度大师版会员➕300元等额曝光扶持\n`⚡️抢先投稿激励：前100名合规投稿作者每人返还1000积分（具体返还规则见文档）",
      "type": "credits"
    }
  ],
  "risks": [],
  "source_id": "libtv",
  "steps": [],
  "summary": "👀 别藏了——丰厚奖池等你显形",
  "tags": [
    "AI",
    "视频",
    "激励"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": false,
    "deadline": null,
    "evidence": null,
    "mechanism": "unspecified",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "source_window": {
      "end": "2026-05-21T15:56:40+00:00",
      "note": "官方结构化活动周期，不自动等同于完整报名规则",
      "start": "2026-04-24T08:23:20+00:00"
    },
    "start": null,
    "timezone": null
  },
  "title": "LibTV大乱斗｜vol.1 显形记",
  "verification": "partial",
  "verified_at": null,
  "work_requirements": []
}
~~~~


## 记录 22：6de6e3383d94b68a3a6c9994

- `id`：6de6e3383d94b68a3a6c9994
- `source_id`：libtv
- `version`：4
- `edition`：年度未核 / 活动7

### 原字段 `document`

~~~~json
{
  "edition": "年度未核 / 活动7",
  "eligibility": [],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "官方公开活动清单内嵌数据与规则正文；非实时登录态。",
      "external_rules": [
        "https://liblibai-online.liblib.cloud/web/5d2bf9704b8442cf9550a0c344f68cb9/28d0269f-05bc-47c5-99de-4248c0c3f5e6.png",
        "https://resonate.feishu.cn/wiki/FwBwwZeSwiNsOkkSIbzcutSUnhP?from=from_copylink]("
      ],
      "image_refs": [
        "https://liblibai-online.liblib.cloud/web/5d2bf9704b8442cf9550a0c344f68cb9/28d0269f-05bc-47c5-99de-4248c0c3f5e6.png\n"
      ],
      "note": "正文未完整覆盖的字段保持空；图片需人工阅读。",
      "observed_at": "2026-10-01T16:55:39+00:00",
      "origin": "live_fetch",
      "url": "https://www.liblib.tv/activity/7"
    }
  ],
  "id": "6de6e3383d94b68a3a6c9994",
  "kind": "competition",
  "official_url": "https://www.liblib.tv/activity/7",
  "organizer": null,
  "origin": "live_fetch",
  "platform": "LibTV",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": null,
  "rewards": [
    {
      "amount": null,
      "label": "现金奖励（数量及口径待核）",
      "scope": "官方奖励段落已提及；具体数量与结算口径需复核",
      "source_excerpt": "百万级奖池🏆｜现金积分马力全开⚡️",
      "type": "cash"
    },
    {
      "amount": null,
      "label": "积分奖励（数量及口径待核）",
      "scope": "官方奖励段落已提及；具体数量与结算口径需复核",
      "source_excerpt": "百万级奖池🏆｜现金积分马力全开⚡️",
      "type": "credits"
    }
  ],
  "risks": [
    {
      "detail": "***全方位展示你的独家创意、技术、叙事及影响力🎬***",
      "level": "high",
      "type": "exclusive"
    }
  ],
  "source_id": "libtv",
  "steps": [],
  "summary": "百万级奖池🏆｜现金积分马力全开⚡️",
  "tags": [
    "AI",
    "短片",
    "创作者",
    "视频",
    "算力"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": false,
    "deadline": null,
    "evidence": null,
    "mechanism": "unspecified",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "source_window": {
      "end": null,
      "note": "官方结构化活动周期，不自动等同于完整报名规则",
      "start": null
    },
    "start": null,
    "timezone": null
  },
  "title": "Lib TV x Seedance 2.0｜百万AI影像狂飙季",
  "verification": "partial",
  "verified_at": null,
  "work_requirements": []
}
~~~~


## 记录 23：673357c2eced5f0fab289a8d

- `id`：673357c2eced5f0fab289a8d
- `source_id`：jingrui_2026
- `version`：2
- `edition`：2026

### 原字段 `document`

~~~~json
{
  "assessment": {
    "ai_policy": "allowed",
    "personal_eligibility": "not_checked",
    "reason": "已核公开公告；具体作品、账号与完整授权尚未逐项核验，保留候选。",
    "role": "candidate"
  },
  "edition": "2026",
  "eligibility": [
    "个人或团队，不限专业；本人或团队代表须有效中国居民身份证及+86手机号。"
  ],
  "entry_url": "https://jingrui-ai-competition.youku.com/",
  "evidence": [
    {
      "excerpt": "影视集团主办；税前1000万元现金总池，单奖最高200万元。完整原创故事至少10分钟，作品首发与独家传播限制须先核对。",
      "note": "父线程2026-09-30官方原文研究移交；人工条款不会由自动刷新覆盖。未公开字段留空。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://jingrui-ai-competition.youku.com/?view=rules"
    }
  ],
  "fit_rules": {
    "duration_min_seconds": {
      "evidence": {
        "official": true,
        "scope": "2026",
        "url": "https://jingrui-ai-competition.youku.com/?view=rules",
        "verified_at": "2026-09-30"
      },
      "value": 600
    },
    "published_allowed": {
      "evidence": {
        "official": true,
        "scope": "2026",
        "url": "https://jingrui-ai-competition.youku.com/?view=rules",
        "verified_at": "2026-09-30"
      },
      "value": false
    }
  },
  "id": "673357c2eced5f0fab289a8d",
  "importance": {
    "basis": "主办影视集团与优酷官方站；明确高额现金奖，但规则与作品匹配同样重要。"
  },
  "kind": "competition",
  "official_url": "https://jingrui-ai-competition.youku.com/?view=rules",
  "organizer": "虎鲸文娱集团；优酷独家视频展映，大麦娱乐线下支持",
  "origin": "manual_review",
  "platform": "优酷 / 虎鲸文娱",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": "2026-09-17",
  "rewards": [
    {
      "amount": 10000000,
      "currency": "CNY",
      "label": "税前现金总奖池",
      "scope": "全部265名获奖者总池，非个人收益",
      "type": "cash",
      "unit": "元",
      "validity": null
    },
    {
      "amount": 2000000,
      "currency": "CNY",
      "label": "单项最高奖",
      "scope": "总池内最高奖1名；不与总池相加",
      "type": "cash",
      "unit": "元",
      "validity": null
    }
  ],
  "risks": [
    {
      "detail": "作品须赛事首发，不能提前或同步在他处公开。",
      "level": "high",
      "type": "first_release"
    },
    {
      "detail": "投稿即授永久、不可撤销、全球、无偿、非独家赛事宣传及成果用途许可；不是无条件保留所有传播自由。",
      "level": "review",
      "type": "licence"
    },
    {
      "detail": "所有获奖作品授独家信息网络传播权，获奖公示起至赛事结束后6个月；期间本人也不得自行或授权在公开平台发布。",
      "level": "high",
      "type": "exclusive"
    },
    {
      "detail": "最高与专业单奖另有三年优先洽谈合作权；具体合作另签协议。",
      "level": "review",
      "type": "licence"
    }
  ],
  "source_id": "jingrui_2026",
  "steps": [
    "在赛事官网准备身份及作品材料后投稿；本库不执行报名。",
    "提交后不能修改或撤回；奖金发放另需合规税票与收款材料。"
  ],
  "summary": "影视集团主办；税前1000万元现金总池，单奖最高200万元。完整原创故事至少10分钟，作品首发与独家传播限制须先核对。",
  "tags": [
    "AI",
    "影视创作"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": true,
    "deadline": "2026-11-22T23:59:00+08:00",
    "deadline_raw": "2026-11-22T23:59:00+08:00",
    "deadline_tentative": false,
    "evidence": "规则明确2026-09-17 10:00至11-22 23:59，北京时间。",
    "mechanism": "fixed",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "start": "2026-09-17T10:00:00+08:00",
    "timezone": "+08:00"
  },
  "title": "鲸锐AI创作大赛",
  "verification": "partial",
  "verified_at": "2026-09-30",
  "work_requirements": [
    "不限AI工具和画面占比；完整原创故事≥10分钟，不得直接采用现有IP。",
    "16:9、≥1080p、MP4/MOV，无AI工具水印；故事阐述≥1000字，简介≤200字。"
  ]
}
~~~~


## 记录 24：13f7c62d86d7da63fca3057b

- `id`：13f7c62d86d7da63fca3057b
- `source_id`：jinji_ai_2026
- `version`：2
- `edition`：2026

### 原字段 `document`

~~~~json
{
  "assessment": {
    "ai_policy": "allowed",
    "personal_eligibility": "not_checked",
    "reason": "已核公开公告；具体作品、账号与完整授权尚未逐项核验，保留候选。",
    "role": "candidate"
  },
  "edition": "2026",
  "eligibility": [
    "全球个人、团队、高校、影视机构、游戏企业、科研及文旅单位。"
  ],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "国家级电影节平台的AI影展征集；10月5日24时截止，免费。七项荣誉、证书与展映，未承诺现金。",
      "note": "父线程2026-09-30官方原文研究移交；人工条款不会由自动刷新覆盖。未公开字段留空。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://www.xmwenlian.com/home/article/detail/id/7928.html"
    },
    {
      "artifact": "output/enhancement/attachments/jinji-ai-20260930.html",
      "bytes": 35575,
      "excerpt": "截止原文为2026年10月5日24时、未明时区；成片须10月5日前完成，AI画面≥50%。申报表PDF需企业盖章/个人手签、注册后下载；提交即接受全部征集规则。入围作品有非商业公益展映/宣传许可，期限未明；七项荣誉未承诺现金。二维码图片本机HTTP403后停止。",
      "extract": "申报截止时间：2026年10月5日24时",
      "locator": "制作与技术规格、申报材料、申报方式、注意事项",
      "method": "web.open厦门市文联正式公告，文末来源为中国金鸡百花电影节；urllib另存HTTP200公开HTML",
      "note": "2026-09-30定向公开规则补核；只更新有出处的字段。个人/账号资格、未明许可、金额及时间精度不据此升级。",
      "observed_at": "2026-09-30T07:10:25Z",
      "origin": "manual_review",
      "sha256": "7515f577daadddf69a386b3ac5ee1212a42ed6778a61e67e076c4f5f6694491c",
      "url": "https://www.xmwenlian.com/home/article/detail/id/7928.html"
    }
  ],
  "fees": [
    {
      "amount": 0,
      "currency": "CNY",
      "scope": "公告明示免费；其他制作与出行成本不据此免除",
      "type": "报名费"
    }
  ],
  "fit_rules": {
    "ai_min_percent": {
      "evidence": {
        "official": true,
        "scope": "2026",
        "url": "https://www.xmwenlian.com/home/article/detail/id/7928.html",
        "verified_at": "2026-09-30T07:10:25Z"
      },
      "value": 50
    },
    "ai_required": {
      "evidence": {
        "official": true,
        "scope": "2026",
        "url": "https://www.xmwenlian.com/home/article/detail/id/7928.html",
        "verified_at": "2026-09-30T07:10:25Z"
      },
      "value": true
    },
    "alternatives": {
      "note": "短片≤20分钟／长片≥60分钟；赛道尚未选择，不能用短片上限排除长片。"
    }
  },
  "id": "13f7c62d86d7da63fca3057b",
  "importance": {
    "basis": "电影节来源由厦门市文联发布；主流展映价值和临近截止，不能只按奖金排序。"
  },
  "kind": "competition",
  "official_url": "https://www.xmwenlian.com/home/article/detail/id/7928.html",
  "organizer": "2026金鸡AI影展组委会；中国金鸡百花电影节官方平台",
  "origin": "manual_review",
  "platform": "金鸡百花电影节",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "public_review": {
    "at": "2026-09-30T07:10:25Z",
    "conflicts": [],
    "fields_verified": [
      "10月5日24时原文与无时区精度",
      "成片完成日期及50%AI画面",
      "申报表格式和签名要求",
      "提交即接受规则",
      "入围作品非商业使用许可",
      "费用与非现金荣誉"
    ],
    "limitations": [
      {
        "method": "web点击官方图片链接67；本机urllib读取",
        "result": "本机HTTP403，停止；未下载、未view_image、未解码二维码，不声称报名表已核。",
        "url": "https://www.xmwenlian.com/Uploads/Editor/images/2026-09-14/6aa7548dcdb2f.png"
      }
    ],
    "method": "2026-09-30本轮官方公开页及公开DOCX定向核验；详见逐条evidence与source_attachments。未登录或提交。",
    "overall": "部分字段已核，整体仍有缺口",
    "remaining": [
      "二维码具体申报入口及申报表协议",
      "本人作品版权与AI过程证据",
      "时区与未披露首映条款",
      "20分钟以上且60分钟以下作品归类"
    ],
    "research_file": "output/enhancement/research-rules.json",
    "unknown_fields": {
      "absolute_deadline": null,
      "entry_url": null,
      "licence_duration": null,
      "licence_region": null,
      "premiere_requirement": null,
      "timezone": null
    }
  },
  "public_review_history": [
    {
      "at": "2026-09-30",
      "evidence": [
        {
          "excerpt": "国家级电影节平台的AI影展征集；10月5日24时截止，免费。七项荣誉、证书与展映，未承诺现金。",
          "note": "父线程2026-09-30官方原文研究移交；人工条款不会由自动刷新覆盖。未公开字段留空。",
          "observed_at": "2026-09-30",
          "origin": "manual_handoff",
          "url": "https://www.xmwenlian.com/home/article/detail/id/7928.html"
        }
      ],
      "fields_before": {
        "assessment": {
          "ai_policy": "allowed",
          "personal_eligibility": "not_checked",
          "reason": "已核公开公告；具体作品、账号与完整授权尚未逐项核验，保留候选。",
          "role": "candidate"
        },
        "eligibility": [
          "全球个人、团队、高校、影视机构、游戏企业、科研及文旅单位。"
        ],
        "fees": [
          {
            "amount": 0,
            "currency": "CNY",
            "scope": "公告明示免费；其他制作与出行成本不据此免除",
            "type": "报名费"
          }
        ],
        "program": {
          "effective_version": null,
          "exit": null,
          "join": null,
          "ongoing_requirements": null,
          "revenue": null,
          "settlement": null
        },
        "publication_at": "2026-09-14T09:58:00",
        "rewards": [
          {
            "amount": null,
            "label": "七项年度荣誉与入围证书",
            "scope": "非金鸡奖主竞赛奖；没有已公布现金",
            "type": "other",
            "validity": null
          },
          {
            "amount": null,
            "label": "入围展映、论坛及宣传",
            "scope": "按主办方入围安排",
            "type": "screening",
            "validity": null
          }
        ],
        "risks": [
          {
            "detail": "完整版权归创作方；入围作允许主办方非商业公益展映、线上宣传及行业论坛放映。",
            "level": "review",
            "type": "licence"
          },
          {
            "detail": "第三方IP、配乐、人声和实拍素材须完整合法授权。",
            "level": "review",
            "type": "licence"
          }
        ],
        "steps": [
          "公告二维码申报入口及表格须人工核验；不要使用页面导航中的一般会员注册入口。",
          "电子材料按单元+作品+主创命名；科影融合发zgkpzx@kpcswa.org.cn，影游联动发AI@bigscreen1950.com。本库仅记录，不发信。"
        ],
        "summary": "国家级电影节平台的AI影展征集；10月5日24时截止，免费。七项荣誉、证书与展映，未承诺现金。",
        "time": {
          "absolute_deadline": null,
          "absolute_start": null,
          "batches": [],
          "confirmed": true,
          "deadline": "2026-10-06T00:00:00",
          "deadline_raw": "2026-10-05 24:00",
          "deadline_tentative": false,
          "evidence": "公告发布日起开放；原文截止2026年10月5日24时（等于次日零时）；时区未注明。",
          "mechanism": "fixed",
          "policy_effective": null,
          "policy_end": null,
          "policy_version": null,
          "start": "2026-09-14",
          "timezone": null
        },
        "verification": "partial",
        "verified_at": "2026-09-30",
        "work_requirements": [
          "科影融合或影游联动两单元；短片≤20分钟、长片≥60分钟；2026-10-05前成片。",
          "AI生成画面≥50%；片头标注含AI生成画面，保留工程、提示词与素材。",
          "16:9、≥1080p、MP4/MOV、无水印；横竖海报、3–5剧照、≤300字梗概、AI说明及第三方授权包。"
        ]
      },
      "method": "pre_enhancement_record_snapshot_from_primary_mode_ro",
      "note": "原始证据与被更新字段的历史快照；其中‘DOCX未读’等旧描述已由当前补核替代，不是当前状态。",
      "overall": "partial",
      "public_review": null
    }
  ],
  "publication_at": "2026-09-14T09:58:00",
  "rewards": [
    {
      "amount": null,
      "label": "七项年度荣誉与入围证书",
      "scope": "非金鸡奖主竞赛奖；没有已公布现金",
      "type": "other",
      "validity": null
    },
    {
      "amount": null,
      "label": "入围展映、论坛及宣传",
      "scope": "按主办方入围安排",
      "type": "screening",
      "validity": null
    }
  ],
  "risks": [
    {
      "detail": "完整版权归创作方；入围作允许主办方非商业公益展映、线上宣传及行业论坛放映。许可期限、地域及撤销机制未明，首映条款未披露。",
      "level": "review",
      "type": "licence"
    },
    {
      "detail": "第三方IP、配乐、人声和实拍素材须完整合法授权。",
      "level": "review",
      "type": "licence"
    },
    {
      "detail": "提交申报材料即代表接受全部征集规则；注册后申报表及可能附加协议未核，不根据当前公告推断无附加授权。",
      "level": "review",
      "type": "submission"
    }
  ],
  "source_attachments": [
    {
      "bytes": 35575,
      "format": "html",
      "label": "金鸡AI影展正式公告（公开HTML存档）",
      "local_path": "output/enhancement/attachments/jinji-ai-20260930.html",
      "method": "web.open厦门市文联正式公告，文末来源为中国金鸡百花电影节；urllib另存HTTP200公开HTML",
      "sha256": "7515f577daadddf69a386b3ac5ee1212a42ed6778a61e67e076c4f5f6694491c",
      "url": "https://www.xmwenlian.com/home/article/detail/id/7928.html",
      "verified_at": "2026-09-30T07:10:25Z"
    }
  ],
  "source_id": "jinji_ai_2026",
  "steps": [
    "公告称注册后下载申报表；二维码图片本机返回HTTP403后停止，具体入口及表格协议仍未核。不要使用页面导航中的一般会员注册入口。",
    "电子材料按单元+作品+主创命名；科影融合发zgkpzx@kpcswa.org.cn，影游联动发AI@bigscreen1950.com。本库仅记录，不发信。"
  ],
  "summary": "国家级电影节平台的AI影展征集；10月5日24时截止，免费。七项荣誉、证书与展映，未承诺现金。",
  "tags": [
    "AI",
    "影视创作"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": true,
    "deadline": "2026-10-06T00:00:00",
    "deadline_raw": "2026-10-05 24:00",
    "deadline_tentative": false,
    "evidence": "公告发布日起开放；原文截止2026年10月5日24时（等于次日零时）；时区未注明。",
    "mechanism": "fixed",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "start": "2026-09-14",
    "timezone": null
  },
  "title": "2026金鸡AI影展（暨AIGC未来影像）",
  "verification": "partial",
  "verified_at": "2026-09-30T07:10:25Z",
  "work_requirements": [
    "科影融合或影游联动两单元；短片≤20分钟、长片≥60分钟；2026-10-05前成片。",
    "AI生成画面≥50%；片头标注含AI生成画面，保留工程、提示词与素材。",
    "16:9、≥1080p、MP4/MOV、无水印；横竖海报、3–5剧照、≤300字梗概、AI说明及第三方授权包。",
    "申报表PDF：企业申报加盖公章、个人申报手写签名；公告称注册后可下载，表格全文未核。"
  ]
}
~~~~


## 记录 25：a9fc87f318602759f8f83ba1

- `id`：a9fc87f318602759f8f83ba1
- `source_id`：cuc_aigc_2026
- `version`：2
- `edition`：2026

### 原字段 `document`

~~~~json
{
  "assessment": {
    "ai_policy": "allowed",
    "personal_eligibility": "not_checked",
    "reason": "已核公开公告；具体作品、账号与完整授权尚未逐项核验，保留候选。",
    "role": "candidate"
  },
  "edition": "2026",
  "eligibility": [
    "机构组；个人组含大学生组、成人组，分组评审。本人学生、年龄及会员身份仍待确认。",
    "个人组第一作者须为作品实际创作者、中国新闻技术工作者联合会个人会员，报名前已完成入会程序。",
    "不接受中小学生或未成年人；合作作品由合作者商定署名次序，第一作者电子签名。",
    "机构组须为主要出品方、已完成入会的联合会单位会员，报名表加盖单位或部门公章。"
  ],
  "entry_url": "https://aigc.capt.cn/",
  "evidence": [
    {
      "excerpt": "个人含大学生/成人组及机构组，六赛道包括AIGC视频。免费，证书及纪念品，未承诺现金。",
      "note": "父线程2026-09-30官方原文研究移交；人工条款不会由自动刷新覆盖。未公开字段留空。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://www.cuc.edu.cn/2026/0811/c10001a273225/page.htm"
    },
    {
      "excerpt": "学院官方通知与章程附件入口。",
      "note": "附件本次未核全文。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://ccs.cuc.edu.cn/2026/0801/c5526a273086/page.htm"
    },
    {
      "excerpt": "网页明示发布2026-08-08；线上报名及初赛作品提交8月1日至10月11日，11月决赛；未明时区，不按URL路径推发布时间。",
      "extract": "8月1日—10月11日：线上报名与初赛作品提交",
      "locator": "赛制安排、报名及咨询方式",
      "method": "web.open官方公开通知",
      "note": "2026-09-30定向公开规则补核；只更新有出处的字段。个人/账号资格、未明许可、金额及时间精度不据此升级。",
      "observed_at": "2026-09-30T07:10:25Z",
      "origin": "manual_review",
      "url": "https://www.cuc.edu.cn/2026/0811/c10001a273225/page.htm"
    },
    {
      "artifact": "output/enhancement/attachments/cuc-aigc-2026-rules.docx",
      "bytes": 22597,
      "excerpt": "章程第10条要求个人第一作者为实际创作者且报名前完成联合会会员入会，拒绝未成年人；个人每赛道≤2件、机构≤3件，允许已公开刊播作品。第18条复赛作品公示。第3条无赛事费用。未披露完整主办方使用许可。",
      "extract": "第一作者须为中国新闻技术工作者联合会个人会员",
      "extraction_file": "output/enhancement/attachments/cuc-aigc-2026-rules.txt",
      "locator": "第3、10、16、18、22条",
      "method": "官方通知链接47；web不支持DOCX，随后urllib直接下载HTTP200，zipfile+ElementTree读取word/document.xml全部段落；页脚仅页码，无额外条款",
      "note": "2026-09-30定向公开规则补核；只更新有出处的字段。个人/账号资格、未明许可、金额及时间精度不据此升级。",
      "observed_at": "2026-09-30T07:09:35.556790Z",
      "origin": "manual_review",
      "sha256": "4b6662875d431578fe5f9bda1b61a3271871a4641c0e7f137ae671057b4b0b82",
      "url": "https://ccs.cuc.edu.cn/_upload/article/files/2f/0f/090a559f439a97365a27bf1360c1/cf6e4e7f-7f10-4a06-80ad-6a1386fafad0.docx"
    },
    {
      "artifact": "output/enhancement/attachments/cuc-aigc-2026-personal-form.docx",
      "bytes": 20432,
      "excerpt": "个人报名表要求第一作者原创承诺和签名、版权纠纷由团队承担；简介≤500字、技术说明≤1000字、影响荣誉≤500字，可无指导老师。",
      "extract": "第一作者电子签名",
      "extraction_file": "output/enhancement/attachments/cuc-aigc-2026-personal-form.txt",
      "locator": "参赛者承诺、作品简介、技术使用情况",
      "method": "官方通知链接49；urllib直接下载HTTP200，zipfile+ElementTree读取word/document.xml全部段落；脚注尾注无文字，页脚仅页码",
      "note": "2026-09-30定向公开规则补核；只更新有出处的字段。个人/账号资格、未明许可、金额及时间精度不据此升级。",
      "observed_at": "2026-09-30T07:09:35.710758Z",
      "origin": "manual_review",
      "sha256": "80fa1c665c802fe2748a616139466db52fd57a3694cfbc1217667fbf152868d5",
      "url": "https://ccs.cuc.edu.cn/_upload/article/files/2f/0f/090a559f439a97365a27bf1360c1/3dbcdbe8-2043-4301-b10f-42298a3d90dd.docx"
    }
  ],
  "fees": [
    {
      "amount": 0,
      "currency": "CNY",
      "scope": "章程第3条：主办方不收报名、评审及其他赛事费用；会员入会可能成本、制作与出行成本仍未知或另计。",
      "type": "报名费"
    }
  ],
  "fit_rules": {
    "published_allowed": {
      "evidence": {
        "official": true,
        "scope": "2026",
        "url": "https://www.cuc.edu.cn/2026/0811/c10001a273225/page.htm",
        "verified_at": "2026-09-30T07:10:25Z"
      },
      "value": true
    }
  },
  "id": "a9fc87f318602759f8f83ba1",
  "importance": {
    "basis": "主办高校及行业联合会正式通知；含大学生组与影视创作方向，身份仍须用户自行核实。"
  },
  "kind": "competition",
  "official_url": "https://www.cuc.edu.cn/2026/0811/c10001a273225/page.htm",
  "organizer": "中国传媒大学、中国新闻技术工作者联合会",
  "origin": "manual_review",
  "platform": "中国传媒大学",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "public_review": {
    "at": "2026-09-30T07:10:25Z",
    "conflicts": [],
    "fields_verified": [
      "官方页面发布时间2026-08-08",
      "章程及个人表全文",
      "个人/机构会员硬门与未成年人限制",
      "各赛道提交数量及允许已公开作品",
      "复赛公示",
      "个人表材料字数和原创责任",
      "赛事费用及奖励性质"
    ],
    "limitations": [
      {
        "method": "web.open",
        "result": "工具返回not accessible，未读取官网提交协议；未宣称入口已可用。",
        "url": "https://aigc.capt.cn/"
      }
    ],
    "method": "2026-09-30本轮官方公开页及公开DOCX定向核验；详见逐条evidence与source_attachments。未登录或提交。",
    "overall": "部分字段已核，整体仍有缺口",
    "remaining": [
      "本人会员和成年/学生身份",
      "入会程序、耗时及可能会费",
      "视频时长、格式和其他提交端规格",
      "报名端完整授权及可用入口"
    ],
    "research_file": "output/enhancement/research-rules.json",
    "unknown_fields": {
      "absolute_deadline": null,
      "licence_commercial_use": null,
      "licence_derivative_rights": null,
      "licence_duration": null,
      "licence_region": null,
      "licence_sublicensing": null,
      "membership_fee": null,
      "timezone": null
    }
  },
  "public_review_history": [
    {
      "at": "2026-09-30",
      "evidence": [
        {
          "excerpt": "个人含大学生/成人组及机构组，六赛道包括AIGC视频。免费，证书及纪念品，未承诺现金。",
          "note": "父线程2026-09-30官方原文研究移交；人工条款不会由自动刷新覆盖。未公开字段留空。",
          "observed_at": "2026-09-30",
          "origin": "manual_handoff",
          "url": "https://www.cuc.edu.cn/2026/0811/c10001a273225/page.htm"
        },
        {
          "excerpt": "学院官方通知与章程附件入口。",
          "note": "附件本次未核全文。",
          "observed_at": "2026-09-30",
          "origin": "manual_handoff",
          "url": "https://ccs.cuc.edu.cn/2026/0801/c5526a273086/page.htm"
        }
      ],
      "fields_before": {
        "assessment": {
          "ai_policy": "allowed",
          "personal_eligibility": "not_checked",
          "reason": "已核公开公告；具体作品、账号与完整授权尚未逐项核验，保留候选。",
          "role": "candidate"
        },
        "eligibility": [
          "机构组；个人组含大学生组、成人组。具体个人资格需报名端复核。"
        ],
        "fees": [
          {
            "amount": 0,
            "currency": "CNY",
            "scope": "公告明示免费；其他制作与出行成本不据此免除",
            "type": "报名费"
          }
        ],
        "program": {
          "effective_version": null,
          "exit": null,
          "join": null,
          "ongoing_requirements": null,
          "revenue": null,
          "settlement": null
        },
        "publication_at": "2026-08-01",
        "rewards": [
          {
            "amount": null,
            "label": "证书与纪念品",
            "scope": "公告没有现金金额",
            "type": "other",
            "validity": null
          }
        ],
        "risks": [
          {
            "detail": "完整授权条款在尚未读出的DOCX章程中，不能按“未提版权”推定无约束。",
            "level": "review",
            "type": "licence"
          }
        ],
        "steps": [
          "通过学校公告确认赛事官网，阅读完整DOCX章程后准备作品；11月答辩终评。"
        ],
        "summary": "个人含大学生/成人组及机构组，六赛道包括AIGC视频。免费，证书及纪念品，未承诺现金。",
        "time": {
          "absolute_deadline": null,
          "absolute_start": null,
          "batches": [],
          "confirmed": true,
          "deadline": "2026-10-11",
          "deadline_raw": "2026-10-11",
          "deadline_tentative": false,
          "evidence": "官方本届公告披露窗口；时区仅在原文明示时填写。",
          "mechanism": "fixed",
          "policy_effective": null,
          "policy_end": null,
          "policy_version": null,
          "start": "2026-08-01",
          "timezone": null
        },
        "verification": "partial",
        "verified_at": "2026-09-30",
        "work_requirements": [
          "六赛道：视频、音频、文图、沉浸交互、互动可视化、数据新闻。",
          "AIGC视频含短视频、微短剧、动漫剧、微电影、网剧与网大；内容不限，完整规格须查章程。"
        ]
      },
      "method": "pre_enhancement_record_snapshot_from_primary_mode_ro",
      "note": "原始证据与被更新字段的历史快照；其中‘DOCX未读’等旧描述已由当前补核替代，不是当前状态。",
      "overall": "partial",
      "public_review": null
    }
  ],
  "publication_at": "2026-08-08",
  "rewards": [
    {
      "amount": null,
      "label": "证书与纪念品",
      "scope": "公告没有现金金额",
      "type": "other",
      "validity": null
    }
  ],
  "risks": [
    {
      "detail": "DOCX章程和个人表已全文读取，确认原创责任与复赛公示，但未给出主办方使用许可期限、地域、商业/改编/转授权范围；报名官网未能访问，完整提交协议仍未知。",
      "level": "review",
      "type": "licence"
    },
    {
      "detail": "已公开刊播作品可参赛；复赛作品将公示，可能影响后续其他赛事首映资格。不能把接受已公开作品解读为无公开影响。",
      "level": "review",
      "type": "submission"
    },
    {
      "detail": "第一作者须报名前完成联合会个人会员入会；本人会员、成年/学生状态、入会耗时与可能会费均未核。",
      "level": "review",
      "type": "eligibility"
    }
  ],
  "source_attachments": [
    {
      "bytes": 22597,
      "format": "docx",
      "label": "AIGC与可视化创作大赛章程（官方DOCX）",
      "local_path": "output/enhancement/attachments/cuc-aigc-2026-rules.docx",
      "method": "官方通知链接47；web不支持DOCX，随后urllib直接下载HTTP200，zipfile+ElementTree读取word/document.xml全部段落；页脚仅页码，无额外条款",
      "sha256": "4b6662875d431578fe5f9bda1b61a3271871a4641c0e7f137ae671057b4b0b82",
      "text_path": "output/enhancement/attachments/cuc-aigc-2026-rules.txt",
      "url": "https://ccs.cuc.edu.cn/_upload/article/files/2f/0f/090a559f439a97365a27bf1360c1/cf6e4e7f-7f10-4a06-80ad-6a1386fafad0.docx",
      "verified_at": "2026-09-30T07:09:35.556790Z"
    },
    {
      "bytes": 20432,
      "format": "docx",
      "label": "2026大赛个人组报名表（官方DOCX）",
      "local_path": "output/enhancement/attachments/cuc-aigc-2026-personal-form.docx",
      "method": "官方通知链接49；urllib直接下载HTTP200，zipfile+ElementTree读取word/document.xml全部段落；脚注尾注无文字，页脚仅页码",
      "sha256": "80fa1c665c802fe2748a616139466db52fd57a3694cfbc1217667fbf152868d5",
      "text_path": "output/enhancement/attachments/cuc-aigc-2026-personal-form.txt",
      "url": "https://ccs.cuc.edu.cn/_upload/article/files/2f/0f/090a559f439a97365a27bf1360c1/3dbcdbe8-2043-4301-b10f-42298a3d90dd.docx",
      "verified_at": "2026-09-30T07:09:35.710758Z"
    }
  ],
  "source_id": "cuc_aigc_2026",
  "steps": [
    "官方DOCX章程和个人表已读取；报名前先确认联合会会员资格与入会完成情况，再核报名官网提交协议和作品规格。",
    "报名及初赛作品提交截至2026-10-11（仅日期，时区未注明）；11月决赛答辩终评，具体日期待后续公告。",
    "本轮访问https://aigc.capt.cn/失败，不能据此确认当前提交入口可用；本库不报名。"
  ],
  "summary": "个人大学生/成人组与机构组，六赛道含AIGC视频；个人第一作者须报名前完成联合会会员入会。赛事不收费，奖励证书及纪念品；本人会员和年龄资格未核。",
  "tags": [
    "AI",
    "影视创作"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": true,
    "deadline": "2026-10-11",
    "deadline_raw": "2026-10-11",
    "deadline_tentative": false,
    "evidence": "官方本届公告披露窗口；时区仅在原文明示时填写。",
    "mechanism": "fixed",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "start": "2026-08-01",
    "timezone": null
  },
  "title": "首届（2026）AIGC与可视化创作大赛",
  "verification": "partial",
  "verified_at": "2026-09-30T07:10:25Z",
  "work_requirements": [
    "六赛道：视频、音频、文图、沉浸交互、互动可视化、数据新闻。",
    "AIGC视频含短视频、微短剧、动漫剧、微电影、网剧与网大；内容不限；视频时长、编码等提交端规格未在已读通知、章程或个人表中明确。",
    "个人组每赛道最多2件，机构组每赛道最多3件；可提交已公开刊播作品或专为大赛新作。",
    "个人表：作品简介≤500字；AIGC/可视化技术使用说明≤1000字；影响或荣誉≤500字；无指导老师可填‘无’。",
    "第一作者签署原创承诺；版权等纠纷由创作团队承担。"
  ]
}
~~~~


## 记录 26：6ea09526c3f7ee86e7981e88

- `id`：6ea09526c3f7ee86e7981e88
- `source_id`：smg_seko_2026
- `version`：2
- `edition`：2026

### 原字段 `document`

~~~~json
{
  "assessment": {
    "ai_policy": "allowed",
    "personal_eligibility": "not_checked",
    "reason": "已核公开公告；具体作品、账号与完整授权尚未逐项核验，保留候选。",
    "role": "candidate"
  },
  "edition": "2026",
  "eligibility": [
    "全球个人或团队，不限国籍、年龄、职业，每人/队≤3件。"
  ],
  "entry_url": "https://seko.sensetime.com/activity/2079017609580478466",
  "evidence": [
    {
      "excerpt": "上海广播电视台与静安区主办；30秒–8分钟，Seko及命题AI比例有要求；奖金金额未公布，截止暂定。",
      "note": "父线程2026-09-30官方原文研究移交；人工条款不会由自动刷新覆盖。未公开字段留空。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://seko.sensetime.com/activity/2079017609580478466"
    },
    {
      "artifact": "output/enhancement/attachments/smg-seko-20260930.html",
      "bytes": 267787,
      "excerpt": "公开正文要求两邮箱与Seko活动页双投、每人/队≤3件、说明≤300字、提交不可修改；国际传播赛道需字幕。作者保留版权并许可无偿非商业使用。页头10/31 23:59:59与正文10/31暂定并存，时区未明；奖金未给金额。",
      "extract": "即日起—10月31日（暂定）",
      "locator": "作品要求、主题要求、参赛方式、版权与免责声明",
      "method": "web.open官方活动页正文；urllib另存HTTP200公开HTML",
      "note": "2026-09-30定向公开规则补核；只更新有出处的字段。个人/账号资格、未明许可、金额及时间精度不据此升级。",
      "observed_at": "2026-09-30T07:10:25Z",
      "origin": "manual_review",
      "sha256": "106d490eaee4772c89c5802cd92acc276372552659c69439c4375aa519cca787",
      "url": "https://seko.sensetime.com/activity/2079017609580478466"
    }
  ],
  "fit_rules": {
    "ai_required": {
      "evidence": {
        "official": true,
        "scope": "2026",
        "url": "https://seko.sensetime.com/activity/2079017609580478466",
        "verified_at": "2026-09-30T07:10:25Z"
      },
      "value": true
    },
    "alternatives": {
      "note": "开放赛道要求Seko核心工具，静安命题赛道AI参与≥70%；未选择赛道不合并成全局限制。"
    },
    "duration_max_seconds": {
      "evidence": {
        "official": true,
        "scope": "2026",
        "url": "https://seko.sensetime.com/activity/2079017609580478466",
        "verified_at": "2026-09-30T07:10:25Z"
      },
      "value": 480
    },
    "duration_min_seconds": {
      "evidence": {
        "official": true,
        "scope": "2026",
        "url": "https://seko.sensetime.com/activity/2079017609580478466",
        "verified_at": "2026-09-30T07:10:25Z"
      },
      "value": 30
    }
  },
  "id": "6ea09526c3f7ee86e7981e88",
  "kind": "competition",
  "official_url": "https://seko.sensetime.com/activity/2079017609580478466",
  "organizer": "上海广播电视台、上海市静安区人民政府；东方娱乐承办；商汤冠名",
  "origin": "manual_review",
  "platform": "SMG / Seko",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "public_review": {
    "at": "2026-09-30T07:10:25Z",
    "conflicts": [
      {
        "body": "10月31日（暂定）",
        "display": "2026-10-31 23:59:59",
        "field": "time.deadline",
        "resolution": null,
        "retain": "confirmed=false; deadline_tentative=true; timezone=null; absolute_deadline=null",
        "source_ref": "smg"
      }
    ],
    "fields_verified": [
      "双投方式及两邮箱",
      "作品时长分组",
      "≤300字创作说明和版权承诺",
      "国际传播赛道字幕",
      "同类赛事限制与不可修改",
      "非商业使用权",
      "截止暂定冲突与奖金金额未明"
    ],
    "limitations": [],
    "method": "2026-09-30本轮官方公开页及公开DOCX定向核验；详见逐条evidence与source_attachments。未登录或提交。",
    "overall": "部分字段已核，整体仍有缺口",
    "remaining": [
      "正式截止公告及时区",
      "同类赛事边界及本人既往参赛记录",
      "实际Seko使用、素材授权及账户投稿资格",
      "奖金领取、税费、结算和完整投稿协议"
    ],
    "research_file": "output/enhancement/research-rules.json",
    "unknown_fields": {
      "absolute_deadline": null,
      "cash_per_person": null,
      "cash_pool": null,
      "licence_duration": null,
      "licence_region": null,
      "same_event_definition": null,
      "timezone": null
    }
  },
  "public_review_history": [
    {
      "at": "2026-09-30",
      "evidence": [
        {
          "excerpt": "上海广播电视台与静安区主办；30秒–8分钟，Seko及命题AI比例有要求；奖金金额未公布，截止暂定。",
          "note": "父线程2026-09-30官方原文研究移交；人工条款不会由自动刷新覆盖。未公开字段留空。",
          "observed_at": "2026-09-30",
          "origin": "manual_handoff",
          "url": "https://seko.sensetime.com/activity/2079017609580478466"
        }
      ],
      "fields_before": {
        "assessment": {
          "ai_policy": "allowed",
          "personal_eligibility": "not_checked",
          "reason": "已核公开公告；具体作品、账号与完整授权尚未逐项核验，保留候选。",
          "role": "candidate"
        },
        "eligibility": [
          "全球个人或团队，不限国籍、年龄、职业，每人/队≤3件。"
        ],
        "program": {
          "effective_version": null,
          "exit": null,
          "join": null,
          "ongoing_requirements": null,
          "revenue": null,
          "settlement": null
        },
        "publication_at": "2026-07-24",
        "rewards": [
          {
            "amount": null,
            "label": "16个综合奖的奖金",
            "scope": "承诺奖金但金额尚未公布，不能估算总池或个人收益",
            "type": "cash",
            "validity": null
          },
          {
            "amount": null,
            "label": "展映、证书及合作机会",
            "scope": "数量、领取条件或结算细则未公开，不视为保底收益",
            "type": "screening",
            "validity": null
          }
        ],
        "risks": [
          {
            "detail": "版权归作者；主办方获无偿非商业展播、宣传和汇编权。",
            "level": "review",
            "type": "licence"
          },
          {
            "detail": "此前参加同类赛事的作品可能不合格；提交不可修改。",
            "level": "review",
            "type": "submission"
          }
        ],
        "steps": [
          "邮箱与Seko活动页双投；邮箱地址与全部表单须查看官方页。",
          "提交后不可修改；2026年11月评审、2027年3月颁奖。"
        ],
        "summary": "上海广播电视台与静安区主办；30秒–8分钟，Seko及命题AI比例有要求；奖金金额未公布，截止暂定。",
        "time": {
          "absolute_deadline": null,
          "absolute_start": null,
          "batches": [],
          "confirmed": false,
          "deadline": "2026-10-31T23:59:59",
          "deadline_raw": "2026-10-31T23:59:59",
          "deadline_tentative": true,
          "evidence": "页面10月31日23:59:59；正文称10月31日暂定，原文未明确时区。",
          "mechanism": "fixed",
          "policy_effective": null,
          "policy_end": null,
          "policy_version": null,
          "start": "2026-07-24",
          "timezone": null
        },
        "verification": "partial",
        "verified_at": "2026-09-30",
        "work_requirements": [
          "30秒–8分钟，≥1080p，MP4/MOV。",
          "开放赛道Seko须为核心工具；静安命题AI参与≥70%；片头AI标注，片尾注明Seko及环节。",
          "作品不得参加过其他同类赛事；是否属于同类须按赛事当前规则复核。"
        ]
      },
      "method": "pre_enhancement_record_snapshot_from_primary_mode_ro",
      "note": "原始证据与被更新字段的历史快照；其中‘DOCX未读’等旧描述已由当前补核替代，不是当前状态。",
      "overall": "partial",
      "public_review": null
    }
  ],
  "publication_at": "2026-07-24",
  "rewards": [
    {
      "amount": null,
      "label": "16个综合奖的奖金",
      "scope": "承诺奖金但金额尚未公布，不能估算总池或个人收益",
      "type": "cash",
      "validity": null
    },
    {
      "amount": null,
      "label": "展映、证书及合作机会",
      "scope": "数量、领取条件或结算细则未公开，不视为保底收益",
      "type": "screening",
      "validity": null
    }
  ],
  "risks": [
    {
      "detail": "版权归作者；主办方获无偿非商业展播、宣传和汇编权。许可期限、地域、排他/撤销和转授权细则未披露。",
      "level": "review",
      "type": "licence"
    },
    {
      "detail": "官方要求未参加过其他同类赛事，提交后不可修改；同类赛事定义及本人既往投稿记录仍待确认。",
      "level": "review",
      "type": "submission"
    }
  ],
  "source_attachments": [
    {
      "bytes": 267787,
      "format": "html",
      "label": "SMG/Seko官方活动页（公开HTML存档）",
      "local_path": "output/enhancement/attachments/smg-seko-20260930.html",
      "method": "web.open官方活动页正文；urllib另存HTTP200公开HTML",
      "sha256": "106d490eaee4772c89c5802cd92acc276372552659c69439c4375aa519cca787",
      "url": "https://seko.sensetime.com/activity/2079017609580478466",
      "verified_at": "2026-09-30T07:10:25Z"
    }
  ],
  "source_id": "smg_seko_2026",
  "steps": [
    "将报名信息、作品链接和版权声明等发送至aigcs2026@163.com及wumengyang@sensetime.com，并在Seko官方活动页投稿；完整表单及本账号资格未核，本库不发送或提交。",
    "提交后不可修改；2026年11月评审、2027年3月颁奖。"
  ],
  "summary": "上海广播电视台与静安区主办；30秒–8分钟，Seko及命题AI比例有要求；奖金金额未公布，截止暂定。",
  "tags": [
    "AI",
    "影视创作"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": false,
    "deadline": "2026-10-31T23:59:59",
    "deadline_raw": "2026-10-31T23:59:59",
    "deadline_tentative": true,
    "evidence": "页面10月31日23:59:59；正文称10月31日暂定，原文未明确时区。",
    "mechanism": "fixed",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "start": "2026-07-24",
    "timezone": null
  },
  "title": "创所未见·2026年度AI短片计划",
  "verification": "partial",
  "verified_at": "2026-09-30T07:10:25Z",
  "work_requirements": [
    "30秒–8分钟，≥1080p，MP4/MOV。",
    "开放赛道Seko须为核心工具；静安命题AI参与≥70%；片头AI标注，片尾注明Seko及环节。",
    "作品不得参加过其他同类赛事；是否属于同类须按赛事当前规则复核。",
    "微短片30秒–3分钟、常规短片3–8分钟；3分钟分组边界应按主办方当前表单选择。",
    "创作说明≤300字，包含AI技术应用说明和创意阐述；提交报名信息与版权原创承诺。",
    "国际传播赛道全部作品需配字幕，鼓励中英双语。"
  ]
}
~~~~


## 记录 27：57eb71171b59492e80edb94b

- `id`：57eb71171b59492e80edb94b
- `source_id`：vacat_2026
- `version`：1
- `edition`：2026 / 穹顶巨幕特别赛道

### 原字段 `document`

~~~~json
{
  "assessment": {
    "ai_policy": "allowed",
    "personal_eligibility": "not_checked",
    "reason": "已核公开公告；具体作品、账号与完整授权尚未逐项核验，保留候选。",
    "role": "candidate"
  },
  "edition": "2026 / 穹顶巨幕特别赛道",
  "eligibility": [
    "全球专业创作者、学生与爱好者。"
  ],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "当前仅穹顶巨幕特别赛道仍有窗口，最高奖励8万元。常规叙事短片、微短剧及其他专项已8月31日截止。",
      "note": "父线程2026-09-30官方原文研究移交；人工条款不会由自动刷新覆盖。未公开字段留空。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://www.lg.gov.cn/gkmlpt/content/12/12890/post_12890803.html"
    }
  ],
  "id": "57eb71171b59492e80edb94b",
  "kind": "competition",
  "official_url": "https://www.lg.gov.cn/gkmlpt/content/12/12890/post_12890803.html",
  "organizer": "抖音、深圳市龙岗区人民政府、上海电影股份有限公司",
  "origin": "manual_review",
  "platform": "抖音 / 上影",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": "2026-07-10",
  "relations": [
    {
      "note": "特别赛道独立窗口；不改变母赛事常规赛道截止。",
      "target_id": "969f262b17644b658ed0d23a",
      "type": "special_track"
    }
  ],
  "rewards": [
    {
      "amount": 80000,
      "currency": "CNY",
      "label": "穹顶巨幕赛道最高奖励",
      "scope": "特别赛道单奖最高，不是常规赛道仍开放的证明",
      "type": "cash",
      "unit": "元",
      "validity": null
    },
    {
      "amount": null,
      "label": "dou+等流量支持",
      "scope": "非现金",
      "type": "traffic",
      "validity": null
    },
    {
      "amount": null,
      "label": "孵化及投资机会",
      "scope": "投资机会不是保底奖金",
      "type": "other",
      "validity": null
    }
  ],
  "risks": [
    {
      "detail": "政府通知未披露完整授权、独家或版权条款，正式投递前须复核。",
      "level": "review",
      "type": "licence"
    }
  ],
  "source_id": "vacat_2026",
  "steps": [
    "查抖音官方投稿专区的穹顶巨幕完整规则和入口。"
  ],
  "summary": "当前仅穹顶巨幕特别赛道仍有窗口，最高奖励8万元。常规叙事短片、微短剧及其他专项已8月31日截止。",
  "tags": [
    "AI",
    "影视创作"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": true,
    "deadline": "2026-10-21T00:00:00",
    "deadline_raw": "2026-10-20 24:00",
    "deadline_tentative": false,
    "evidence": "官方本届公告披露窗口；时区仅在原文明示时填写。",
    "mechanism": "fixed",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "start": "2026-07-10T00:00:00",
    "timezone": null
  },
  "title": "第三届瓦卡奖VACAT—AI穹顶巨幕特别赛道",
  "verification": "partial",
  "verified_at": "2026-09-30",
  "work_requirements": [
    "AI穹顶巨幕特别赛道；普通横版叙事短片不能据此视为符合，具体投递规格待核。"
  ]
}
~~~~


## 记录 28：969f262b17644b658ed0d23a

- `id`：969f262b17644b658ed0d23a
- `source_id`：vacat_2026
- `version`：1
- `edition`：2026 / 常规及原专项赛道

### 原字段 `document`

~~~~json
{
  "assessment": {
    "ai_policy": "allowed",
    "personal_eligibility": "not_checked",
    "reason": "已核公开公告；具体作品、账号与完整授权尚未逐项核验，保留候选。",
    "role": "candidate"
  },
  "edition": "2026 / 常规及原专项赛道",
  "eligibility": [
    "全球专业创作者、学生与爱好者。"
  ],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "常规叙事/微短剧与原专项8月31日已截止；不要套用穹顶赛道10月20日的截止。",
      "note": "父线程2026-09-30官方原文研究移交；人工条款不会由自动刷新覆盖。未公开字段留空。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://www.lg.gov.cn/gkmlpt/content/12/12890/post_12890803.html"
    }
  ],
  "id": "969f262b17644b658ed0d23a",
  "kind": "competition",
  "official_url": "https://www.lg.gov.cn/gkmlpt/content/12/12890/post_12890803.html",
  "organizer": "抖音、深圳市龙岗区人民政府、上海电影股份有限公司",
  "origin": "manual_review",
  "platform": "抖音 / 上影",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": "2026-07-10",
  "rewards": [
    {
      "amount": 20000,
      "currency": "CNY",
      "label": "常规视频金奖最高",
      "scope": "已截止常规视频单奖",
      "type": "cash",
      "unit": "元",
      "validity": null
    },
    {
      "amount": 10000,
      "currency": "CNY",
      "label": "常规图像金奖最高",
      "scope": "已截止图像单奖",
      "type": "cash",
      "unit": "元",
      "validity": null
    }
  ],
  "risks": [
    {
      "detail": "完整授权条款未核。",
      "level": "review",
      "type": "licence"
    }
  ],
  "source_id": "vacat_2026",
  "steps": [],
  "summary": "常规叙事/微短剧与原专项8月31日已截止；不要套用穹顶赛道10月20日的截止。",
  "tags": [
    "AI",
    "影视创作"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": true,
    "deadline": "2026-08-31",
    "deadline_raw": "2026-08-31",
    "deadline_tentative": false,
    "evidence": "官方本届公告披露窗口；时区仅在原文明示时填写。",
    "mechanism": "fixed",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "start": "2026-07-10T00:00:00",
    "timezone": null
  },
  "title": "第三届AI视觉创意大赛（瓦卡奖VACAT）常规赛道",
  "verification": "partial",
  "verified_at": "2026-09-30",
  "work_requirements": [
    "常规视频、图像与专项各有规格，原文细则须另核。"
  ]
}
~~~~


## 记录 29：94f2c228f9cda3ce3db9025c

- `id`：94f2c228f9cda3ce3db9025c
- `source_id`：bjiff_aigc_2026
- `version`：1
- `edition`：2026

### 原字段 `document`

~~~~json
{
  "assessment": {
    "ai_policy": "allowed",
    "personal_eligibility": "not_checked",
    "reason": "已核公开公告；具体作品、账号与完整授权尚未逐项核验，保留候选。",
    "role": "candidate"
  },
  "edition": "2026",
  "eligibility": [
    "全球个人及高校师生，不限国籍、年龄。"
  ],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "2026已截止；主流电影节连续第三届AIGC单元。作者版权保留，主单元现金未公布。",
      "note": "父线程2026-09-30官方原文研究移交；人工条款不会由自动刷新覆盖。未公开字段留空。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://www.bjiff.com/bannergdtp/202602/t20260203_188677.html"
    }
  ],
  "id": "94f2c228f9cda3ce3db9025c",
  "kind": "competition",
  "official_url": "https://www.bjiff.com/bannergdtp/202602/t20260203_188677.html",
  "organizer": "中国传媒大学；北影节组委会办公室指导；动画与数字艺术学院承办",
  "origin": "manual_review",
  "platform": "北京国际电影节",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": "2026-02-03",
  "rewards": [
    {
      "amount": null,
      "label": "主单元荣誉",
      "scope": "没有已公开奖金；不是天坛奖主竞赛",
      "type": "other",
      "validity": null
    }
  ],
  "risks": [
    {
      "detail": "作者保留版权，主办方获非商业展映、宣传、档案权；投递端其他条款待核。",
      "level": "review",
      "type": "licence"
    }
  ],
  "source_id": "bjiff_aigc_2026",
  "steps": [
    "2026已结束，仅追踪下一届正式公告，不生成2027轮次。"
  ],
  "summary": "2026已截止；主流电影节连续第三届AIGC单元。作者版权保留，主单元现金未公布。",
  "tags": [
    "AI",
    "影视创作"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": true,
    "deadline": "2026-03-30",
    "deadline_raw": "2026-03-30",
    "deadline_tentative": false,
    "evidence": "官方本届公告披露窗口；时区仅在原文明示时填写。",
    "mechanism": "fixed",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "start": "2026-02-03",
    "timezone": null
  },
  "title": "第十六届北京国际电影节AIGC电影单元",
  "verification": "partial",
  "verified_at": "2026-09-30",
  "work_requirements": [
    "短片1–20分钟，AI流程≥70%；长片≥45分钟，AI≥50%。",
    "剧集每集1–5分钟，全季≥8集，提交≥5集，AI≥50%；≥1080p MP4/MOV，完整AI流程说明。"
  ]
}
~~~~


## 记录 30：f2531346de21e67a636e3725

- `id`：f2531346de21e67a636e3725
- `source_id`：bjiff_aigc_2026
- `version`：1
- `edition`：2026 / 通义万相专属赛道

### 原字段 `document`

~~~~json
{
  "assessment": {
    "ai_policy": "allowed",
    "personal_eligibility": "not_checked",
    "reason": "历史子赛道，具体工具与作品资格未完整核验。",
    "role": "candidate"
  },
  "edition": "2026 / 通义万相专属赛道",
  "eligibility": [],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "官方主单元公告另列通义万相专属赛道10万元奖池，不能当成主单元奖金。",
      "note": "父线程2026-09-30官方原文研究移交；人工条款不会由自动刷新覆盖。未公开字段留空。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://www.bjiff.com/bannergdtp/202602/t20260203_188677.html"
    }
  ],
  "id": "f2531346de21e67a636e3725",
  "kind": "competition",
  "official_url": "https://www.bjiff.com/bannergdtp/202602/t20260203_188677.html",
  "organizer": "中国传媒大学；北影节组委会办公室指导；动画与数字艺术学院承办",
  "origin": "manual_review",
  "platform": "北京国际电影节 / 通义万相",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": "2026-02-03",
  "relations": [
    {
      "note": "专属奖金与工具资格独立。",
      "target_id": "94f2c228f9cda3ce3db9025c",
      "type": "special_track"
    }
  ],
  "rewards": [
    {
      "amount": 100000,
      "currency": "CNY",
      "label": "通义万相专属赛道奖金池",
      "scope": "子赛道总池，非主单元或个人收益",
      "type": "cash",
      "unit": "元",
      "validity": null
    }
  ],
  "risks": [
    {
      "detail": "完整子赛道授权与工具门槛待核。",
      "level": "review",
      "type": "licence"
    }
  ],
  "source_id": "bjiff_aigc_2026",
  "steps": [],
  "summary": "官方主单元公告另列通义万相专属赛道10万元奖池，不能当成主单元奖金。",
  "tags": [
    "AI",
    "影视创作"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": true,
    "deadline": "2026-03-30",
    "deadline_raw": "2026-03-30",
    "deadline_tentative": false,
    "evidence": "官方本届公告披露窗口；时区仅在原文明示时填写。",
    "mechanism": "fixed",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "start": null,
    "timezone": null
  },
  "title": "北影节AIGC2026—通义万相妙思+专属赛道",
  "verification": "partial",
  "verified_at": "2026-09-30",
  "work_requirements": []
}
~~~~


## 记录 31：8be090b0a8e1eff0ef6c92f8

- `id`：8be090b0a8e1eff0ef6c92f8
- `source_id`：student_tv_2026
- `version`：1
- `edition`：2026

### 原字段 `document`

~~~~json
{
  "assessment": {
    "ai_policy": "allowed",
    "personal_eligibility": "not_checked",
    "reason": "已核公开公告；具体作品、账号与完整授权尚未逐项核验，保留候选。",
    "role": "candidate"
  },
  "edition": "2026",
  "eligibility": [
    "大学生赛事，要求学校及指导教师信息；毕业生和国际资格细则未核。"
  ],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "大学生影视赛事，2026已截止；奖金、奖杯、奖状有提及但未公开奖金金额。",
      "note": "父线程2026-09-30官方原文研究移交；人工条款不会由自动刷新覆盖。未公开字段留空。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://comm.ecnu.edu.cn/c3/c5/c51744a771013/page.htm"
    }
  ],
  "id": "8be090b0a8e1eff0ef6c92f8",
  "kind": "competition",
  "official_url": "https://comm.ecnu.edu.cn/c3/c5/c51744a771013/page.htm",
  "organizer": "华东师范大学、上海外国语大学；上海市教委等指导",
  "origin": "manual_review",
  "platform": "上海大学生电视节",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": "2026-07-21",
  "rewards": [
    {
      "amount": null,
      "label": "紫丁香及赛道奖奖金",
      "scope": "金额未公布",
      "type": "cash",
      "validity": null
    },
    {
      "amount": null,
      "label": "奖杯、奖状",
      "scope": "数量、领取条件或结算细则未公开，不视为保底收益",
      "type": "other",
      "validity": null
    }
  ],
  "risks": [
    {
      "detail": "须原创完整合法版权；主承协办方获无偿非营利展播、出版、教学推广与赛事展示权。",
      "level": "review",
      "type": "licence"
    }
  ],
  "source_id": "student_tv_2026",
  "steps": [
    "2026已截止，保留各单元规格与下一届关注；获奖名单10月18–20日，10月24日颁奖暂定。"
  ],
  "summary": "大学生影视赛事，2026已截止；奖金、奖杯、奖状有提及但未公开奖金金额。",
  "tags": [
    "AI",
    "影视创作"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": true,
    "deadline": "2026-09-21T00:00:00",
    "deadline_raw": "2026-09-20 24:00",
    "deadline_tentative": false,
    "evidence": "官方本届公告披露窗口；时区仅在原文明示时填写。",
    "mechanism": "fixed",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "start": "2026-07-21",
    "timezone": null
  },
  "title": "第十九届上海大学生电视节AI视频大赛",
  "verification": "partial",
  "verified_at": "2026-09-30",
  "work_requirements": [
    "MINI剧情/纪录15–30分钟，AI影像≥20%。",
    "AI微短剧3集×3分钟，可全AI；AI剧本8000–10000字加≥500字人机方案。"
  ]
}
~~~~


## 记录 32：5b989cd9eebff2c081df9dd7

- `id`：5b989cd9eebff2c081df9dd7
- `source_id`：aniwow_2026
- `version`：1
- `edition`：2026

### 原字段 `document`

~~~~json
{
  "assessment": {
    "ai_policy": "allowed",
    "personal_eligibility": "not_checked",
    "reason": "已核公开公告；具体作品、账号与完整授权尚未逐项核验，保留候选。",
    "role": "candidate"
  },
  "edition": "2026",
  "eligibility": [
    "高校相关专业在校创作及毕业作品；2026届毕业生可先交未完成版，入围后须完成。"
  ],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "高校动画与数字艺术主流赛事，已截止。所有使用AI的作品必须投C数字艺术类，传统动画类不能接收纯AI。",
      "note": "父线程2026-09-30官方原文研究移交；人工条款不会由自动刷新覆盖。未公开字段留空。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://www.cuc.edu.cn/2026/0825/c10001a273403/page.htm"
    }
  ],
  "fees": [
    {
      "amount": 0,
      "currency": "CNY",
      "scope": "公告明示免费；其他制作与出行成本不据此免除",
      "type": "报名费"
    }
  ],
  "id": "5b989cd9eebff2c081df9dd7",
  "kind": "competition",
  "official_url": "https://www.cuc.edu.cn/2026/0825/c10001a273403/page.htm",
  "organizer": "中国（北京）国际大学生动画节组委会、中国传媒大学动画与数字艺术学院",
  "origin": "manual_review",
  "platform": "Aniwow / 中国传媒大学",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": "2026-08-22",
  "rewards": [
    {
      "amount": null,
      "label": "白杨奖奖金",
      "scope": "金额未知",
      "type": "cash",
      "validity": null
    },
    {
      "amount": null,
      "label": "证书与奖杯",
      "scope": "数量、领取条件或结算细则未公开，不视为保底收益",
      "type": "other",
      "validity": null
    }
  ],
  "risks": [
    {
      "detail": "作者有版权；线下展映授权2026-09-14至12-31；另有无偿媒体宣传、播映、出版许可，发表通常不能撤销删除。",
      "level": "review",
      "type": "licence"
    }
  ],
  "source_id": "aniwow_2026",
  "steps": [
    "2026征集已截止；下一届未知，不推算2027日期。"
  ],
  "summary": "高校动画与数字艺术主流赛事，已截止。所有使用AI的作品必须投C数字艺术类，传统动画类不能接收纯AI。",
  "tags": [
    "AI",
    "影视创作"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": true,
    "deadline": "2026-09-14",
    "deadline_raw": "2026-09-14",
    "deadline_tentative": false,
    "evidence": "官方本届公告披露窗口；时区仅在原文明示时填写。",
    "mechanism": "fixed",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "start": null,
    "timezone": null
  },
  "title": "Aniwow!2026第21届国际大学生动画节白杨奖",
  "verification": "partial",
  "verified_at": "2026-09-30",
  "work_requirements": [
    "任何AI使用均须投C数字艺术类并披露；数字智能影像含剧情、实验、动画。",
    "英文字幕，初选H.264 MP4；受委托广告宣传片不合格；已发表作品须注明。"
  ]
}
~~~~


## 记录 33：090a25b695cf9fcd315e7f16

- `id`：090a25b695cf9fcd315e7f16
- `source_id`：aaiff_2026
- `version`：1
- `edition`：2026

### 原字段 `document`

~~~~json
{
  "assessment": {
    "ai_policy": "allowed",
    "personal_eligibility": "not_checked",
    "reason": "已核公开公告；具体作品、账号与完整授权尚未逐项核验，保留候选。",
    "role": "candidate"
  },
  "edition": "2026",
  "eligibility": [
    "全球，免费；未成年需监护人同意，网站不面向16岁以下；中国大陆支付税务可行性未核。"
  ],
  "entry_url": "https://www.aaiff.ai/",
  "evidence": [
    {
      "excerpt": "已截止；现金总池100万美元，最高单奖45万美元。宣传中的另100万美元属于制作投资。电影节10月1–3日。",
      "note": "父线程2026-09-30官方原文研究移交；人工条款不会由自动刷新覆盖。未公开字段留空。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://aaiff.ai/terms"
    }
  ],
  "fees": [
    {
      "amount": 0,
      "currency": "CNY",
      "scope": "公告明示免费；其他制作与出行成本不据此免除",
      "type": "报名费"
    }
  ],
  "id": "090a25b695cf9fcd315e7f16",
  "kind": "competition",
  "official_url": "https://aaiff.ai/terms",
  "organizer": "Astana AI Film Festival Foundation",
  "origin": "manual_review",
  "platform": "Astana AI Film Festival",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": null,
  "rewards": [
    {
      "amount": 1000000,
      "currency": "USD",
      "label": "现金总奖池",
      "scope": "主题赛75万+开放赛25万美元，非个人收益",
      "type": "cash",
      "unit": "USD",
      "validity": null
    },
    {
      "amount": 450000,
      "currency": "USD",
      "label": "最高单项现金",
      "scope": "总池内单奖，不相加",
      "type": "cash",
      "unit": "USD",
      "validity": null
    },
    {
      "amount": 1000000,
      "currency": "USD",
      "label": "另行选择的制作投资",
      "scope": "不是奖金，另行选择/合作",
      "type": "other",
      "unit": "USD",
      "validity": null
    }
  ],
  "risks": [
    {
      "detail": "作者保留版权，可投其他节展；非独家、全球、免费节展宣传与档案授权；合作平台分发另须书面同意。",
      "level": "review",
      "type": "licence"
    }
  ],
  "source_id": "aaiff_2026",
  "steps": [
    "2026已截止；原投递要求YouTube或Google Drive链接，其境内可用性另核，不绕过访问限制。"
  ],
  "summary": "已截止；现金总池100万美元，最高单奖45万美元。宣传中的另100万美元属于制作投资。电影节10月1–3日。",
  "tags": [
    "AI",
    "影视创作"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": true,
    "deadline": "2026-09-07",
    "deadline_raw": "2026-09-07",
    "deadline_tentative": false,
    "evidence": "官方本届公告披露窗口；时区仅在原文明示时填写。",
    "mechanism": "fixed",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": "2026-09-15条款更新",
    "start": "2026-05-25",
    "timezone": null
  },
  "title": "Astana AI Film Festival 2026（AAIFF）",
  "verification": "partial",
  "verified_at": "2026-09-30",
  "work_requirements": [
    "≥3分钟，生成式AI核心参与而非只后期；英文烧录字幕与工具/流程披露。"
  ]
}
~~~~


## 记录 34：88f7c183097d995cdee38eb6

- `id`：88f7c183097d995cdee38eb6
- `source_id`：first_2026
- `version`：2
- `edition`：2026

### 原字段 `document`

~~~~json
{
  "assessment": {
    "ai_policy": "limited",
    "personal_eligibility": "not_checked",
    "reason": "对主要AI生成作品不建议参加；仅作混合实拍路线限制参考，未核完整当前窗口。",
    "role": "restriction"
  },
  "edition": "2026",
  "eligibility": [],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "便携设备实拍须为主体；AIGC/CGI生成影像≤30%，完全或主要AI生成作品不接收。",
      "note": "父线程2026-09-30官方原文研究移交；人工条款不会由自动刷新覆盖。未公开字段留空。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://www.firstfilm.org.cn/wp-content/uploads/2026/03/%E7%AC%AC%E4%BA%8C%E5%8D%81%E5%B1%8AFIRST%E9%9D%92%E5%B9%B4%E7%94%B5%E5%B1%95%E8%B6%85%E7%9F%AD%E7%89%87%E5%8D%95%E5%85%83%E7%AB%A0%E7%A8%8B.pdf"
    }
  ],
  "fit_rules": {
    "ai_max_percent": {
      "evidence": {
        "official": true,
        "scope": "2026",
        "url": "https://www.firstfilm.org.cn/wp-content/uploads/2026/03/%E7%AC%AC%E4%BA%8C%E5%8D%81%E5%B1%8AFIRST%E9%9D%92%E5%B9%B4%E7%94%B5%E5%B1%95%E8%B6%85%E7%9F%AD%E7%89%87%E5%8D%95%E5%85%83%E7%AB%A0%E7%A8%8B.pdf",
        "verified_at": "2026-09-30"
      },
      "value": 30
    }
  },
  "id": "88f7c183097d995cdee38eb6",
  "kind": "competition",
  "official_url": "https://www.firstfilm.org.cn/wp-content/uploads/2026/03/%E7%AC%AC%E4%BA%8C%E5%8D%81%E5%B1%8AFIRST%E9%9D%92%E5%B9%B4%E7%94%B5%E5%B1%95%E8%B6%85%E7%9F%AD%E7%89%87%E5%8D%95%E5%85%83%E7%AB%A0%E7%A8%8B.pdf",
  "organizer": "FIRST青年电影展",
  "origin": "manual_review",
  "platform": "FIRST青年电影展",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": null,
  "record_context": "historical_reference",
  "rewards": [],
  "risks": [
    {
      "detail": "本次只核AI硬限制，完整首发与授权条款尚未核验。",
      "level": "review",
      "type": "licence"
    }
  ],
  "source_id": "first_2026",
  "steps": [],
  "summary": "便携设备实拍须为主体；AIGC/CGI生成影像≤30%，完全或主要AI生成作品不接收。",
  "tags": [
    "影视创作"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": false,
    "deadline": null,
    "evidence": null,
    "mechanism": "unspecified",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "start": null,
    "timezone": null
  },
  "title": "FIRST青年电影展2026超短片—AI限制参考",
  "verification": "partial",
  "verified_at": "2026-09-30",
  "work_requirements": [
    "实拍主体，生成影像≤30%；不是纯AI短片征集。"
  ]
}
~~~~


## 记录 35：65f3cd66f70120b610ba6723

- `id`：65f3cd66f70120b610ba6723
- `source_id`：hkaiiff_2027
- `version`：1
- `edition`：2027

### 原字段 `document`

~~~~json
{
  "assessment": {
    "ai_policy": "unspecified",
    "personal_eligibility": "not_checked",
    "reason": "仅作尽调候选，不进入正式推荐；未注册或付费。",
    "role": "due_diligence"
  },
  "edition": "2027",
  "eligibility": [],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "指南列2026年10月1日至2027年3月1日，报名99美元。2027奖励、主体与资格仍待核，百万级宣传不能视为现金奖金。",
      "note": "父线程2026-09-30官方原文研究移交；人工条款不会由自动刷新覆盖。未公开字段留空。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://www.hkaiiff.org/zh-hans/festival/2027/documents/entry-guide"
    }
  ],
  "fees": [
    {
      "amount": 99,
      "currency": "USD",
      "scope": "官方2027指南；跨境支付及退款规则未核，本库不支付",
      "type": "报名费"
    }
  ],
  "id": "65f3cd66f70120b610ba6723",
  "kind": "competition",
  "official_url": "https://www.hkaiiff.org/zh-hans/festival/2027/documents/entry-guide",
  "organizer": null,
  "origin": "manual_review",
  "platform": "HKAIIFF",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": null,
  "rewards": [],
  "risks": [
    {
      "detail": "完整主体、2027奖项性质、AI与授权条款未完成核验。",
      "level": "review",
      "type": "licence"
    }
  ],
  "source_id": "hkaiiff_2027",
  "steps": [],
  "summary": "指南列2026年10月1日至2027年3月1日，报名99美元。2027奖励、主体与资格仍待核，百万级宣传不能视为现金奖金。",
  "tags": [
    "影视创作"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": true,
    "deadline": "2027-03-01",
    "deadline_raw": "2027-03-01",
    "deadline_tentative": false,
    "evidence": "官方本届公告披露窗口；时区仅在原文明示时填写。",
    "mechanism": "fixed",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "start": "2026-10-01",
    "timezone": null
  },
  "title": "HKAIIFF2027—付费与奖励待尽调",
  "verification": "partial",
  "verified_at": "2026-09-30",
  "work_requirements": []
}
~~~~


## 记录 36：8b37ba7ad68d0847fb3aca6a

- `id`：8b37ba7ad68d0847fb3aca6a
- `source_id`：runway_aif_2026
- `version`：1
- `edition`：2026

### 原字段 `document`

~~~~json
{
  "assessment": {
    "ai_policy": "allowed",
    "personal_eligibility": "not_checked",
    "reason": "历史条款存在奖励口径冲突，保留逐项最高奖而不写无争议总池。",
    "role": "due_diligence"
  },
  "edition": "2026",
  "eligibility": [
    "18+，地区清单未排除中国；实际参赛及收款资格仍未对照个人。"
  ],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "已截止；3–15分钟AI电影，免费18+。单奖5万美元；列项现金合计79500美元与条款总ARV61500美元有冲突，未消解。",
      "note": "父线程2026-09-30官方原文研究移交；人工条款不会由自动刷新覆盖。未公开字段留空。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://aif.runwayml.com/terms-film"
    }
  ],
  "fees": [
    {
      "amount": 0,
      "currency": "CNY",
      "scope": "公告明示免费；其他制作与出行成本不据此免除",
      "type": "报名费"
    }
  ],
  "id": "8b37ba7ad68d0847fb3aca6a",
  "kind": "competition",
  "official_url": "https://aif.runwayml.com/terms-film",
  "organizer": "Runway",
  "origin": "manual_review",
  "platform": "Runway",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": null,
  "reward_conflict": "列项50000+15000+10000+2×1000+5×500=79500美元（研究计算）；条款总ARV61500美元，官方口径未消解。",
  "rewards": [
    {
      "amount": 50000,
      "currency": "USD",
      "label": "电影组最高单奖",
      "scope": "列项单奖；未确认总ARV口径",
      "type": "cash",
      "unit": "USD",
      "validity": null
    },
    {
      "amount": null,
      "label": "另列平台积分",
      "scope": "积分不能计入现金总奖池",
      "type": "credits",
      "validity": null
    }
  ],
  "risks": [
    {
      "detail": "完整授权与跨境结算条款仍待逐项复核。",
      "level": "review",
      "type": "licence"
    }
  ],
  "source_id": "runway_aif_2026",
  "steps": [],
  "summary": "已截止；3–15分钟AI电影，免费18+。单奖5万美元；列项现金合计79500美元与条款总ARV61500美元有冲突，未消解。",
  "tags": [
    "AI",
    "影视创作"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": true,
    "deadline": "2026-04-27T16:59:59-04:00",
    "deadline_raw": "2026-04-27T16:59:59-04:00",
    "deadline_tentative": false,
    "evidence": "官方ET时刻；1月为-05:00、4月为-04:00，保留已含偏移的具体时刻。",
    "mechanism": "fixed",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "start": "2026-01-28T09:00:00-05:00",
    "timezone": null
  },
  "title": "Runway AI Film Festival 2026电影组",
  "verification": "partial",
  "verified_at": "2026-09-30",
  "work_requirements": [
    "电影组3–15分钟AI生成视频。"
  ]
}
~~~~


## 记录 37：e07414bef25cfbfe8263dbe5

- `id`：e07414bef25cfbfe8263dbe5
- `source_id`：jimeng_growth
- `version`：3
- `edition`：2026 / 造梦新章

### 原字段 `document`

~~~~json
{
  "assessment": {
    "ai_policy": "allowed",
    "personal_eligibility": "not_checked",
    "reason": "已核公开公告；具体作品、账号与完整授权尚未逐项核验，保留候选。",
    "role": "candidate"
  },
  "edition": "2026 / 造梦新章",
  "eligibility": [
    ">1分钟原创AI叙事短片，审核入选；超创为定向邀请。",
    "优质层参考半年抖音30万赞、小红书3万赞或B站5万赞；个人层级和资格未核。"
  ],
  "entry_url": "https://bytedance.larkoffice.com/docx/YxNFd4psVoyvwwxFg2Pc7IgQnjg",
  "evidence": [
    {
      "excerpt": "2026年7–12月的分层创作者扶持；积分、会员与投稿奖励都有条件，现金子活动另列。",
      "note": "父线程2026-09-30官方原文研究移交；人工条款不会由自动刷新覆盖。未公开字段留空。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://bytedance.larkoffice.com/docx/YxNFd4psVoyvwwxFg2Pc7IgQnjg"
    },
    {
      "excerpt": "总窗口2026年7–12月仅月精度；全文明确北京时间，有问卷入口但审核加入。现金9/20版和画布细则另列；规则包含永久不可撤销全球非独家传播、转载、改编等授权。",
      "method": "manual_public_review_handoff",
      "note": "本轮公开原文复核交接。历史证据保留；自动抓取能力和本账号资格不随人工补核升级。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://bytedance.larkoffice.com/docx/YxNFd4psVoyvwwxFg2Pc7IgQnjg"
    }
  ],
  "fit_rules": {
    "ai_required": {
      "evidence": {
        "official": true,
        "scope": "2026 / 造梦新章",
        "url": "https://bytedance.larkoffice.com/docx/YxNFd4psVoyvwwxFg2Pc7IgQnjg",
        "verified_at": "2026-09-30"
      },
      "value": true
    },
    "duration_min_seconds": {
      "evidence": {
        "official": true,
        "scope": "2026 / 造梦新章",
        "url": "https://bytedance.larkoffice.com/docx/YxNFd4psVoyvwwxFg2Pc7IgQnjg",
        "verified_at": "2026-09-30"
      },
      "inclusive": false,
      "value": 60
    }
  },
  "id": "e07414bef25cfbfe8263dbe5",
  "kind": "creator_program",
  "official_url": "https://bytedance.larkoffice.com/docx/YxNFd4psVoyvwwxFg2Pc7IgQnjg",
  "organizer": "即梦AI",
  "origin": "manual_review",
  "platform": "即梦 / 抖音",
  "program": {
    "effective_version": "官方飞书2026-09-29修改记录，生效日期未注明",
    "exit": null,
    "join": "按层级申请/审核，超创定向邀请",
    "ongoing_requirements": "原创权属、公开保留和审核要求；持续层级考核细则待全文核验",
    "revenue": "新锐首入10000积分；优质月5000积分；超创月10000积分；合格投稿1888/6888积分、精选28888积分，均有条件",
    "settlement": "积分与会员发放细则待全文核验"
  },
  "public_review": {
    "at": "2026-09-30",
    "fields_verified": [
      "北京时间",
      "2026年7–12月总窗口（月精度）",
      "审核制和文档内问卷入口",
      "授权的永久/不可撤销/全球/非独家性质"
    ],
    "method": "上游官方公开页面人工复核交接；未登录、未提交表单",
    "overall": "部分字段已核，整体仍有缺口",
    "remaining": [
      "本人层级资格",
      "完整持续考核和退出条件",
      "积分/会员发放细则",
      "未披露的生效日与总计划具体日时"
    ]
  },
  "publication_at": null,
  "rewards": [
    {
      "amount": null,
      "label": "分层与投稿积分",
      "scope": "按审核、层级和稿件条件发放，不能相加为个人保底",
      "type": "credits",
      "validity": null
    },
    {
      "amount": null,
      "label": "优质高级会员1月；超创高级会员及剪映SVIP",
      "scope": "层级权益，不是现金",
      "type": "other",
      "validity": null
    }
  ],
  "risks": [
    {
      "detail": "原创完整权属与公开保留要求；商业导流限制及品牌广告例外须全文核验。",
      "level": "review",
      "type": "licence"
    },
    {
      "detail": "FAQ提及资源位展示授权及爆款角色/剧本IP优先发行采买；具体授权期限、采买价格和权利范围未核。",
      "level": "review",
      "type": "licence"
    },
    {
      "detail": "规则含永久、不可撤销、全球、非独家的传播、转载、改编等授权；参加前需逐项对照全文权利范围。长期授权成本不能只按奖励金额判断。",
      "level": "high",
      "type": "licence"
    }
  ],
  "source_id": "jimeng_growth",
  "steps": [
    "在官方成长计划文档核对层级与提报入口，审核后加入；本库不提报。",
    "官方文档内问卷入口已确认存在；按层级提报审核。未核验问卷的独立URL，未填写或提交。"
  ],
  "summary": "2026年7–12月的分层创作者扶持；积分、会员与投稿奖励都有条件，现金子活动另列。",
  "tags": [
    "AI",
    "影视创作"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": true,
    "deadline": null,
    "evidence": "本轮官方公开全文明确北京时间（UTC+08:00）；总计划仅月份精度，现金子活动仅日期精度，不补造具体时刻。",
    "mechanism": "fixed",
    "month_period": {
      "end": "2026-12",
      "start": "2026-07"
    },
    "policy_effective": null,
    "policy_end": null,
    "policy_version": "文档2026-09-29修改，生效日未注明",
    "start": null,
    "timezone": "+08:00"
  },
  "title": "即梦AI创作者成长计划·造梦新章",
  "verification": "partial",
  "verified_at": "2026-09-30",
  "work_requirements": [
    "原创、完整权属、公开保留；商业导流不参与，品牌广告另有例外须看全文。"
  ]
}
~~~~


## 记录 38：a4dd21da51346371e24f5094

- `id`：a4dd21da51346371e24f5094
- `source_id`：jimeng_growth
- `version`：3
- `edition`：2026 / 9-20锋芒回响

### 原字段 `document`

~~~~json
{
  "assessment": {
    "ai_policy": "allowed",
    "personal_eligibility": "not_checked",
    "reason": "已核公开公告；具体作品、账号与完整授权尚未逐项核验，保留候选。",
    "role": "candidate"
  },
  "canvas_requirements": [
    "仅限已入选成长计划的创作者；基础奖金和画布奖金可以叠加，两项分别审核，并非上传即获奖金。",
    "必须从画布直接“发布 → 上传新短片”；先从其他入口发布再绑定画布不适用。",
    "内容和画布须在新规则启动后制作；历史内容不适用。一画布对应一短片，通常分别审核1–3个工作日。",
    "优质画布须覆盖4个创作阶段；至少4个概念结果且覆盖至少2类；至少10个分镜结果、10个动态结果和1个粗剪节点。",
    "画布内AI直接生成时长目标至少80%，覆盖高潮和高光；参数完整、创作路径可追溯。",
    "开源后提示词、参考素材和连线可公开，他人可复制模板；提交前核对参考素材、角色和工作流的可公开权利。"
  ],
  "cash_tiers": [
    {
      "base": 600,
      "canvas_bonus": 200,
      "condition": "T+7播放10万",
      "currency": "CNY",
      "tax": null
    },
    {
      "base": 3000,
      "canvas_bonus": 500,
      "condition": "T+7播放50万",
      "currency": "CNY",
      "tax": null
    },
    {
      "base": 15000,
      "canvas_bonus": 3000,
      "condition": "T+7播放100万",
      "currency": "CNY",
      "tax": null
    },
    {
      "base": 18000,
      "canvas_bonus": 4000,
      "condition": "T+7播放300万",
      "currency": "CNY",
      "tax": null
    },
    {
      "base": 25000,
      "canvas_bonus": 5000,
      "condition": "T+7播放500万或20万赞",
      "currency": "CNY",
      "tax": null
    },
    {
      "base": 30000,
      "canvas_bonus": 8000,
      "condition": "72小时1000万播放或50万赞",
      "currency": "CNY",
      "tax": null
    },
    {
      "base": 60000,
      "canvas_bonus": 10000,
      "condition": "72小时2000万播放或100万赞",
      "currency": "CNY",
      "tax": null
    }
  ],
  "edition": "2026 / 9-20锋芒回响",
  "eligibility": [
    "已入选成长计划层级；个人层级、作品与数据达标均未核。"
  ],
  "entry_url": "https://bytedance.larkoffice.com/docx/YxNFd4psVoyvwwxFg2Pc7IgQnjg",
  "evidence": [
    {
      "excerpt": "成长计划内9月20日至10月31日的有条件现金激励；顶档单条7万元并非保底，禁竞品露出。",
      "note": "父线程2026-09-30官方原文研究移交；人工条款不会由自动刷新覆盖。未公开字段留空。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://bytedance.larkoffice.com/docx/YxNFd4psVoyvwwxFg2Pc7IgQnjg"
    },
    {
      "excerpt": "9/20升级现金激励独立窗口及档位。",
      "note": "画布全文另页未完整核验。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://bytedance.larkoffice.com/docx/YxNFd4psVoyvwwxFg2Pc7IgQnjg#VV0VdNGgvoBfWyxcv5ScVON8nDg"
    },
    {
      "excerpt": "北京时间9/20生效、10/31截止，日期精度；7个基础/画布现金档、周最多3条、长期保留作品和话题、最高档3个月竞品排他、工作流宣传及永久不可撤销全球非独家授权已按公开全文核对。",
      "method": "manual_public_review_handoff",
      "note": "本轮公开原文复核交接。历史证据保留；自动抓取能力和本账号资格不随人工补核升级。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://bytedance.larkoffice.com/docx/YxNFd4psVoyvwwxFg2Pc7IgQnjg"
    },
    {
      "excerpt": "画布加奖公开全文人工核对：成长计划入选者、画布直接发布新短片、新规则后制作、一画布一片；4阶段、4概念/2类、10分镜、10动态、1粗剪，AI直接时长目标≥80%且覆盖高潮；参数路径完整、开源可复制，两项通常分别审核1–3工作日。",
      "method": "manual_public_review_handoff",
      "note": "页面2026-09-30修改。此前“未完整核验”是旧证据状态；本条补核独立保留，不表示本机自动抓取接通。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://bytedance.larkoffice.com/docx/X84WdYVa0oQXD3xb0ATcIaOjnUe"
    }
  ],
  "fit_rules": {
    "ai_required": {
      "evidence": {
        "official": true,
        "scope": "2026 / 9-20锋芒回响",
        "url": "https://bytedance.larkoffice.com/docx/YxNFd4psVoyvwwxFg2Pc7IgQnjg",
        "verified_at": "2026-09-30"
      },
      "value": true
    },
    "duration_min_seconds": {
      "evidence": {
        "official": true,
        "scope": "2026 / 9-20锋芒回响",
        "url": "https://bytedance.larkoffice.com/docx/YxNFd4psVoyvwwxFg2Pc7IgQnjg",
        "verified_at": "2026-09-30"
      },
      "inclusive": false,
      "value": 60
    }
  },
  "id": "a4dd21da51346371e24f5094",
  "kind": "limited_benefit",
  "official_url": "https://bytedance.larkoffice.com/docx/YxNFd4psVoyvwwxFg2Pc7IgQnjg",
  "organizer": "即梦AI",
  "origin": "manual_review",
  "platform": "即梦 / 抖音",
  "program": {
    "effective_version": "2026-09-20升级生效，2026-10-31截止（北京时间；仅日期）；画布细则2026-09-30修改",
    "exit": null,
    "join": "须已入选成长计划层级；即梦+抖音同步发布并在官方问卷提报审核",
    "ongoing_requirements": "获奖作品不得删除或隐藏，露出话题长期保留；现金需配合工作流宣传。最高档另有申报后3个月发布内容与个人主页竞品排他要求",
    "revenue": "每条一次提报最高档；基础和优质画布奖金可叠加但分别审核；现金每周最多3条，不是上传即获奖",
    "settlement": "次月第一周统一发放上月审核通过的现金至抖音钱包，7个工作日到账；180个工作日未提现视为放弃"
  },
  "public_review": {
    "at": "2026-09-30",
    "fields_verified": [
      "北京时间与日精度窗口",
      "七档基础现金与画布加奖",
      "画布公开全文",
      "审核/结算/作品持续保留",
      "授权和最高档竞品排他"
    ],
    "method": "上游官方公开页面人工复核交接；未登录、未提交表单",
    "overall": "部分字段已核，整体仍有缺口",
    "remaining": [
      "本人层级/作品/数据资格",
      "现金税前或税后口径",
      "未披露的具体开始/截止时刻",
      "个人退出和违约处理细则"
    ]
  },
  "publication_at": null,
  "relations": [
    {
      "note": "现金子活动独立于7–12月母计划和积分/会员权益；9/10旧版已下线。",
      "target_id": "e07414bef25cfbfe8263dbe5",
      "type": "under_program"
    }
  ],
  "rewards": [
    {
      "amount": 600,
      "currency": "CNY",
      "label": "T+7十万播放基础档",
      "scope": "有条件单条档位，不是所有投稿均获奖",
      "type": "cash",
      "unit": "元",
      "validity": null
    },
    {
      "amount": 200,
      "currency": "CNY",
      "label": "优质开源画布增量",
      "scope": "十万播放档另需合格画布",
      "type": "cash",
      "unit": "元",
      "validity": null
    },
    {
      "amount": 70000,
      "currency": "CNY",
      "label": "最高档单条上限（含合格画布）",
      "scope": "72小时2000万播放或100万赞；6万+画布1万；每条一次最高档，不与其他档位重复相加",
      "type": "cash",
      "unit": "元",
      "validity": null
    },
    {
      "amount": 2000,
      "label": "合格单条2000积分",
      "scope": "单条有条件奖励；每周最多10000积分",
      "type": "credits",
      "validity": null
    }
  ],
  "risks": [
    {
      "detail": "现金资格严格禁竞品露出，范围包含视频、评论、工具名称/Logo/界面等；版权与资源位条款仍以母计划全文为准。",
      "level": "high",
      "type": "tool_restriction"
    },
    {
      "detail": "规则含永久、不可撤销、全球、非独家的传播、转载、改编等授权；参加前需逐项对照全文权利范围。长期授权成本不能只按奖励金额判断。",
      "level": "high",
      "type": "licence"
    },
    {
      "detail": "最高现金档另要求申报后3个月发布内容和个人主页排他竞品；基础现金资格也禁止视频、评论中的竞品模型和工作流工具名称、Logo、口播、话题与界面。",
      "level": "high",
      "type": "exclusivity"
    },
    {
      "detail": "获奖作品不能删除或隐藏，露出话题长期保留；现金需要配合工作流宣传。开源画布使提示词、参考素材和连线公开并允许他人复制模板。",
      "level": "high",
      "type": "ongoing"
    }
  ],
  "source_id": "jimeng_growth",
  "steps": [
    "先取得成长计划层级；即梦+抖音同步发布>1分钟原创AI叙事短片，带#即梦AI创作者成长计划并提报审核。",
    "申领画布加奖须从画布直接“发布 → 上传新短片”；按本页画布要求准备新内容，一画布一短片，两项分别审核。",
    "达到数据档位后，一条作品一次提报最高档；现金每周最多3条，合格投稿2000积分/条、每周最多10000积分。",
    "次月第一周统一发放上月审核通过现金，7个工作日到账；180个工作日未提现视为放弃。"
  ],
  "summary": "成长计划内9月20日至10月31日的有条件现金激励；顶档单条7万元并非保底，禁竞品露出。",
  "tags": [
    "AI",
    "影视创作"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": true,
    "deadline": "2026-10-31",
    "deadline_raw": "2026-10-31",
    "deadline_tentative": false,
    "evidence": "本轮官方公开全文明确北京时间（UTC+08:00）；总计划仅月份精度，现金子活动仅日期精度，不补造具体时刻。",
    "mechanism": "fixed",
    "policy_effective": "2026-09-20",
    "policy_end": null,
    "policy_version": "9/20升级规则；9/10版于9/20下线；画布细则2026-09-30修改",
    "start": "2026-09-20",
    "timezone": "+08:00"
  },
  "title": "锋芒回响—即梦9/20升级现金激励",
  "verification": "partial",
  "verified_at": "2026-09-30",
  "work_requirements": [
    "即梦与抖音同步>1分钟原创叙事作品，指定#即梦AI创作者成长计划，提报审核。",
    "现金禁视频及评论中的竞品模型/工作流工具名称、Logo、口播、话题与界面。"
  ]
}
~~~~


## 记录 39：d5a03fd8ee9dcd20dbf447e3

- `id`：d5a03fd8ee9dcd20dbf447e3
- `source_id`：jimeng_new_image
- `version`：1
- `edition`：2026 / 004

### 原字段 `document`

~~~~json
{
  "assessment": {
    "ai_policy": "allowed",
    "personal_eligibility": "not_checked",
    "reason": "已颁奖的独立历史轮次，不能替代当前成长计划。",
    "role": "historical"
  },
  "edition": "2026 / 004",
  "eligibility": [],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "旧新影像活动官方已颁奖至6月30日；不视为常年开放。完整原报名期未核。",
      "note": "父线程2026-09-30官方原文研究移交；人工条款不会由自动刷新覆盖。未公开字段留空。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://jimeng.jianying.com/ai-tool/activity-detail/2026-004-dreamina-weekly-challenge"
    }
  ],
  "id": "d5a03fd8ee9dcd20dbf447e3",
  "kind": "competition",
  "official_url": "https://jimeng.jianying.com/ai-tool/activity-detail/2026-004-dreamina-weekly-challenge",
  "organizer": "即梦AI",
  "origin": "manual_review",
  "platform": "即梦",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": null,
  "record_context": "historical_reference",
  "rewards": [],
  "risks": [],
  "source_id": "jimeng_new_image",
  "steps": [],
  "summary": "旧新影像活动官方已颁奖至6月30日；不视为常年开放。完整原报名期未核。",
  "tags": [
    "AI",
    "影视创作"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": false,
    "deadline": null,
    "evidence": null,
    "mechanism": "unspecified",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "provider_phase": "awarded",
    "source_window": {
      "end": "2026-06-30",
      "note": "官方活动页面已颁奖阶段，非推定报名截止。"
    },
    "start": null,
    "timezone": null
  },
  "title": "即梦新影像2026-004（已颁奖历史参考）",
  "verification": "partial",
  "verified_at": "2026-09-30",
  "work_requirements": []
}
~~~~


## 记录 40：afad2fbc539d43185773a6e4

- `id`：afad2fbc539d43185773a6e4
- `source_id`：kling_artist
- `version`：1
- `edition`：3.0 / 2026-04公告

### 原字段 `document`

~~~~json
{
  "assessment": {
    "ai_policy": "unspecified",
    "personal_eligibility": "not_checked",
    "reason": "已核公开公告；具体作品、账号与完整授权尚未逐项核验，保留候选。",
    "role": "candidate"
  },
  "edition": "3.0 / 2026-04公告",
  "eligibility": [],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "官方认证账号4月27日披露创作者计划；月百万现金、千万灵感值和亿曝光都是平台资源池。现行门槛、档位与期限未知。",
      "note": "父线程2026-09-30官方原文研究移交；人工条款不会由自动刷新覆盖。未公开字段留空。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://www.sina.cn/news/detail/5292411603651728.html"
    }
  ],
  "id": "afad2fbc539d43185773a6e4",
  "kind": "creator_program",
  "official_url": "https://www.sina.cn/news/detail/5292411603651728.html",
  "organizer": "可灵AI",
  "origin": "manual_review",
  "platform": "可灵",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": "现行申请规则尚未核验",
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": "2026-04-27",
  "rewards": [
    {
      "amount": 1000000,
      "currency": "CNY",
      "label": "月百万现金资源池",
      "scope": "官方平台月资源池，不是个人收益或当前档位保证",
      "type": "cash",
      "unit": "元",
      "validity": null
    },
    {
      "amount": 10000000,
      "label": "月千万灵感值资源池",
      "scope": "平台资源池，非现金",
      "type": "credits",
      "validity": null
    },
    {
      "amount": 100000000,
      "label": "月亿级曝光资源池",
      "scope": "平台曝光资源，非现金",
      "type": "traffic",
      "validity": null
    }
  ],
  "risks": [
    {
      "detail": "当前加入、现金档位、版权/独家与截止未核；不能标常年可报名。",
      "level": "review",
      "type": "licence"
    }
  ],
  "source_id": "kling_artist",
  "steps": [
    "从官方认证可灵AI账号追踪现行申请与规则；不得按2024/2025转载默认当前门槛。"
  ],
  "summary": "官方认证账号4月27日披露创作者计划；月百万现金、千万灵感值和亿曝光都是平台资源池。现行门槛、档位与期限未知。",
  "tags": [
    "影视创作"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": false,
    "deadline": null,
    "evidence": null,
    "mechanism": "unspecified",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "start": null,
    "timezone": null
  },
  "title": "可灵创作者计划3.0 / 灵感聚光计划",
  "verification": "partial",
  "verified_at": "2026-09-30",
  "work_requirements": []
}
~~~~


## 记录 41：441197e6c9aff981cc3d32a0

- `id`：441197e6c9aff981cc3d32a0
- `source_id`：kling_partner
- `version`：1
- `edition`：公开合作机制（轮次未核）

### 原字段 `document`

~~~~json
{
  "assessment": {
    "ai_policy": "unspecified",
    "personal_eligibility": "not_checked",
    "reason": "已核公开公告；具体作品、账号与完整授权尚未逐项核验，保留候选。",
    "role": "candidate"
  },
  "edition": "公开合作机制（轮次未核）",
  "eligibility": [],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "面向商单与品牌制作机构的合作；项目收入和宣发机会，不是定额补贴。",
      "note": "父线程2026-09-30官方原文研究移交；人工条款不会由自动刷新覆盖。未公开字段留空。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://ir.kuaishou.com/static-files/1561a9ec-6131-4d2d-81a7-b220c8520c25"
    }
  ],
  "id": "441197e6c9aff981cc3d32a0",
  "kind": "creator_program",
  "official_url": "https://ir.kuaishou.com/static-files/1561a9ec-6131-4d2d-81a7-b220c8520c25",
  "organizer": "可灵AI / 快手",
  "origin": "manual_review",
  "platform": "可灵 / 快手",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": "当前加入细则未知",
    "ongoing_requirements": null,
    "revenue": "商单/品牌制作项目收入，比例未知",
    "settlement": null
  },
  "publication_at": null,
  "rewards": [
    {
      "amount": null,
      "label": "商单、合作收入与宣发机会",
      "scope": "不是保底补贴",
      "type": "other",
      "validity": null
    }
  ],
  "risks": [
    {
      "detail": "合作合同中的权利、分成、退出与结算须具体核验。",
      "level": "review",
      "type": "licence"
    }
  ],
  "source_id": "kling_partner",
  "steps": [],
  "summary": "面向商单与品牌制作机构的合作；项目收入和宣发机会，不是定额补贴。",
  "tags": [
    "影视创作"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": false,
    "deadline": null,
    "evidence": null,
    "mechanism": "unspecified",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "start": null,
    "timezone": null
  },
  "title": "可灵未来合伙人计划",
  "verification": "partial",
  "verified_at": "2026-09-30",
  "work_requirements": []
}
~~~~


## 记录 42：8b7d34b49a64b3b8f4bfe493

- `id`：8b7d34b49a64b3b8f4bfe493
- `source_id`：minimax_design
- `version`：2
- `edition`：公开入驻计划（轮次未核）

### 原字段 `document`

~~~~json
{
  "assessment": {
    "ai_policy": "allowed",
    "personal_eligibility": "not_checked",
    "reason": "已核公开公告；具体作品、账号与完整授权尚未逐项核验，保留候选。",
    "role": "candidate"
  },
  "contact_email": "creators@minimaxi.com",
  "edition": "公开入驻计划（轮次未核）",
  "eligibility": [
    "面向严肃创作者；具体资格门槛未公开核验。"
  ],
  "entry_status": "官方联系入口已确认；申请筛选与合同条款待问",
  "entry_url": "https://design.minimax.cn/",
  "evidence": [
    {
      "excerpt": "严肃创作者共创Skills、玩法和原创IP；Agent抢先、Skills收益分成、联合营销。不是海螺国内超创规则。",
      "note": "父线程2026-09-30官方原文研究移交；人工条款不会由自动刷新覆盖。未公开字段留空。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://design.minimax.cn/"
    },
    {
      "excerpt": "官方页面确认 creators@minimaxi.com 入驻联系；权益为Agent早期体验、Skills收益分成、联合营销。未公开分成比例、结算、筛选、材料与截止；指南飞书登录未继续。",
      "method": "manual_public_review_handoff",
      "note": "本轮公开原文复核交接。历史证据保留；自动抓取能力和本账号资格不随人工补核升级。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://design.minimax.cn/"
    }
  ],
  "id": "8b7d34b49a64b3b8f4bfe493",
  "kind": "creator_program",
  "official_url": "https://design.minimax.cn/",
  "organizer": "MiniMax Design",
  "origin": "manual_review",
  "platform": "MiniMax Design",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": "官方入驻联系邮箱 creators@minimaxi.com 已确认；筛选条件与提交材料未公开。指南飞书需登录，未继续。",
    "ongoing_requirements": "共创Skills/玩法/原创IP，持续要求未核",
    "revenue": "Skills收益分成，比例未核",
    "settlement": null
  },
  "public_review": {
    "at": "2026-09-30",
    "fields_verified": [
      "官方联系邮箱",
      "三类权益的存在"
    ],
    "method": "上游官方公开页面人工复核交接；未登录、未提交表单",
    "overall": "部分字段已核，整体仍有缺口",
    "remaining": [
      "筛选条件/材料",
      "分成比例/结算",
      "版权/持续/退出条款",
      "当前报名窗口或常年开放依据"
    ]
  },
  "publication_at": null,
  "rewards": [
    {
      "amount": null,
      "label": "Agent抢先、Skills分成与联合营销",
      "scope": "比例和结算未知，非定额补贴",
      "type": "other",
      "validity": null
    }
  ],
  "risks": [
    {
      "detail": "原创IP、Skills权属、收益比例、退出和结算条款未核。",
      "level": "review",
      "type": "licence"
    }
  ],
  "source_id": "minimax_design",
  "steps": [
    "查看官网执导者入驻入口并复核合同/分成，再决定是否申请。",
    "通过官方页面列出的 creators@minimaxi.com 核对入驻流程、分成比例、结算、版权、持续和退出条件；本库没有发送邮件。"
  ],
  "summary": "严肃创作者共创Skills、玩法和原创IP；Agent抢先、Skills收益分成、联合营销。不是海螺国内超创规则。",
  "tags": [
    "AI",
    "影视创作"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": false,
    "deadline": null,
    "evidence": null,
    "mechanism": "unspecified",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "start": null,
    "timezone": null
  },
  "title": "MiniMax Design执导者入驻计划",
  "verification": "partial",
  "verified_at": "2026-09-30",
  "work_requirements": []
}
~~~~


## 记录 43：cc3cf426236d7396b4103de4

- `id`：cc3cf426236d7396b4103de4
- `source_id`：hailuo_affiliate
- `version`：1
- `edition`：公开推广计划（轮次未核）

### 原字段 `document`

~~~~json
{
  "assessment": {
    "ai_policy": "unspecified",
    "personal_eligibility": "not_checked",
    "reason": "推广合作属于次要创作相关机会，大陆结算资格与税务未核。",
    "role": "secondary"
  },
  "edition": "公开推广计划（轮次未核）",
  "eligibility": [
    "申请审核；中国大陆支付和税务资格未核。"
  ],
  "entry_url": "https://hailuoai.video/affiliate",
  "evidence": [
    {
      "excerpt": "审核后的海外推广成交佣金10%–30%，最低支付10美元；活跃伙伴有Pro/内测权益。短片投稿本身不获得这笔收益。",
      "note": "父线程2026-09-30官方原文研究移交；人工条款不会由自动刷新覆盖。未公开字段留空。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://hailuoai.video/affiliate"
    }
  ],
  "id": "cc3cf426236d7396b4103de4",
  "kind": "creator_program",
  "official_url": "https://hailuoai.video/affiliate",
  "organizer": "Hailuo AI",
  "origin": "manual_review",
  "platform": "海螺 / Hailuo",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": "公开申请后审核",
    "ongoing_requirements": "活跃伙伴Pro及内测权益；付费广告禁用品牌关键词与Logo",
    "revenue": "成交佣金10%–30%；退款扣佣",
    "settlement": "最低10美元；交易跟踪日结束后27天锁定，锁定月结束后30天支付"
  },
  "publication_at": null,
  "rewards": [
    {
      "amount": null,
      "label": "推广成交佣金10%–30%",
      "scope": "按有效推广交易，非短片奖金；资格、退款和结算条件适用",
      "type": "cash",
      "validity": null
    },
    {
      "amount": null,
      "label": "活跃伙伴Pro与内测权益",
      "scope": "须审核及保持活跃",
      "type": "other",
      "validity": null
    }
  ],
  "risks": [
    {
      "detail": "退款扣佣；付费广告禁止品牌关键词/Logo，中国大陆资格、支付和税务尚未核。",
      "level": "review",
      "type": "promotion"
    }
  ],
  "source_id": "hailuo_affiliate",
  "steps": [
    "官方Affiliate入口申请审核后按规则推广成交，不在本库生成推广链接或报名。"
  ],
  "summary": "审核后的海外推广成交佣金10%–30%，最低支付10美元；活跃伙伴有Pro/内测权益。短片投稿本身不获得这笔收益。",
  "tags": [
    "影视创作"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": false,
    "deadline": null,
    "evidence": null,
    "mechanism": "unspecified",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "start": null,
    "timezone": null
  },
  "title": "Hailuo海外Affiliate推广合作计划",
  "verification": "partial",
  "verified_at": "2026-09-30",
  "work_requirements": []
}
~~~~


## 记录 44：eb01230e80d2a963f1363394

- `id`：eb01230e80d2a963f1363394
- `source_id`：vidu_artist
- `version`：2
- `edition`：公开创作者计划（轮次未核）

### 原字段 `document`

~~~~json
{
  "assessment": {
    "ai_policy": "allowed",
    "personal_eligibility": "not_checked",
    "reason": "已核公开公告；具体作品、账号与完整授权尚未逐项核验，保留候选。",
    "role": "candidate"
  },
  "edition": "公开创作者计划（轮次未核）",
  "eligibility": [
    "无粉丝门槛，申请须审核；新锐/艺术家两层。",
    "新锐面向潜力及持续探索的创作者；艺术家面向具专业能力、个人风格和一定行业影响力的创作者。本人适配类别及审核结果未知。"
  ],
  "entry_url": "https://www.vidu.com/zh/artist-program",
  "evidence": [
    {
      "excerpt": "公开申请审核，无粉丝门槛、不签独家；新锐/艺术家两层，积分、认证、内测、流量与合作，没有固定现金承诺。",
      "note": "父线程2026-09-30官方原文研究移交；人工条款不会由自动刷新覆盖。未公开字段留空。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://www.vidu.com/zh/artist-program"
    },
    {
      "excerpt": "公开页确认填表审核入群再解锁权益，新锐/艺术家两层、五项权益以及持续创作/活动/打卡/共创意愿。无粉丝门槛且不签独家；未列日级起止、积分额度、结算、退出及完整使用许可。首屏‘随时可提’含义不明，不推定提现或退出承诺。",
      "extract": "官方将对申请进行审核",
      "local_fetch": {
        "artifact": "output/enhancement/attachments/vidu-artist-20260930.html",
        "at_utc": "2026-09-30T07:10:29.715326Z",
        "bytes": 29178,
        "final_url": "https://www.vidu.cn/zh/artist-program",
        "http_status": 200,
        "quality": "应用壳；保存的HTML没有匹配到中文规则，不能据此宣称本机正文抓取成功。实际规则核验依据为web.open公开正文。",
        "requested_url": "https://www.vidu.com/zh/artist-program",
        "sha256": "763332765c5294f624c296f3da4cd02a8580b839e72bfba9febf638572002d2a"
      },
      "locator": "加入权益、两种创作者身份、我们希望你是、如何加入",
      "method": "web.open官方公开页正文；未点击报名、未展开受限入口",
      "note": "2026-09-30定向公开规则补核；只更新有出处的字段。个人/账号资格、未明许可、金额及时间精度不据此升级。 本机请求转vidu.cn仅得到应用壳；规则核验依据是web.open公开正文，不能宣称本机正文抓取成功。",
      "observed_at": "2026-09-30T07:10:25Z",
      "origin": "manual_review",
      "url": "https://www.vidu.com/zh/artist-program"
    }
  ],
  "id": "eb01230e80d2a963f1363394",
  "kind": "creator_program",
  "official_url": "https://www.vidu.com/zh/artist-program",
  "organizer": "Vidu",
  "origin": "manual_review",
  "platform": "Vidu",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": "填公开报名表并选择类别，官方审核通过后邀请入社群、对接运营并解锁认证权益；无粉丝门槛。表单URL及本账户可提交性未核。",
    "ongoing_requirements": "官方定位期望持续创作分享、参与活动、打卡及产品共创；未公开定量考核、投稿频率或退层规则，不能视为完整合同义务已核。",
    "revenue": "入选创作积分与任务/活动积分机会，另有认证、内测、推荐流量、合作及社群；积分额度和固定现金未公开，不能视为保底收益。",
    "settlement": null
  },
  "public_review": {
    "at": "2026-09-30T07:10:25Z",
    "conflicts": [],
    "fields_verified": [
      "公开申请需官方审核入群",
      "新锐和艺术家两层定位",
      "五项权益方向",
      "持续创作、打卡和共创意愿",
      "无粉丝门槛和不签独家宣传",
      "长期机制与未明起止、结算、退出的区别"
    ],
    "limitations": [
      {
        "artifact": "output/enhancement/attachments/vidu-artist-20260930.html",
        "at_utc": "2026-09-30T07:10:29.715326Z",
        "bytes": 29178,
        "final_url": "https://www.vidu.cn/zh/artist-program",
        "http_status": 200,
        "quality": "应用壳；保存的HTML没有匹配到中文规则，不能据此宣称本机正文抓取成功。实际规则核验依据为web.open公开正文。",
        "requested_url": "https://www.vidu.com/zh/artist-program",
        "sha256": "763332765c5294f624c296f3da4cd02a8580b839e72bfba9febf638572002d2a"
      }
    ],
    "method": "2026-09-30本轮官方公开页及公开DOCX定向核验；详见逐条evidence与source_attachments。未登录或提交。",
    "overall": "部分字段已核，整体仍有缺口",
    "remaining": [
      "本人审核资格和类别",
      "积分发放、有效期、结算及具体任务",
      "版权展示/改编等许可、首发要求和退出规则",
      "FAQ折叠答案及完整报名表条款"
    ],
    "research_file": "output/enhancement/research-rules.json",
    "unknown_fields": {
      "application_form_url": null,
      "credits_amount": null,
      "credits_validity": null,
      "deadline": null,
      "licence_terms": null,
      "policy_effective": null,
      "policy_version": null,
      "premiere_requirement": null,
      "program.exit": null,
      "program.settlement": null,
      "review_turnaround": null,
      "start": null,
      "timezone": null
    }
  },
  "public_review_history": [
    {
      "at": "2026-09-30",
      "evidence": [
        {
          "excerpt": "公开申请审核，无粉丝门槛、不签独家；新锐/艺术家两层，积分、认证、内测、流量与合作，没有固定现金承诺。",
          "note": "父线程2026-09-30官方原文研究移交；人工条款不会由自动刷新覆盖。未公开字段留空。",
          "observed_at": "2026-09-30",
          "origin": "manual_handoff",
          "url": "https://www.vidu.com/zh/artist-program"
        }
      ],
      "fields_before": {
        "assessment": {
          "ai_policy": "allowed",
          "personal_eligibility": "not_checked",
          "reason": "已核公开公告；具体作品、账号与完整授权尚未逐项核验，保留候选。",
          "role": "candidate"
        },
        "eligibility": [
          "无粉丝门槛，申请须审核；新锐/艺术家两层。"
        ],
        "program": {
          "effective_version": null,
          "exit": null,
          "join": "公开申请审核，无粉丝门槛",
          "ongoing_requirements": "层级与持续要求需按当前审核细则",
          "revenue": "积分、认证、内测、流量及合作；未公开固定现金",
          "settlement": null
        },
        "publication_at": null,
        "rewards": [
          {
            "amount": null,
            "label": "平台创作积分",
            "scope": "额度及发放条件待核",
            "type": "credits",
            "validity": null
          },
          {
            "amount": null,
            "label": "流量与合作机会",
            "scope": "数量、领取条件或结算细则未公开，不视为保底收益",
            "type": "traffic",
            "validity": null
          },
          {
            "amount": null,
            "label": "认证及内测权益",
            "scope": "数量、领取条件或结算细则未公开，不视为保底收益",
            "type": "other",
            "validity": null
          }
        ],
        "risks": [
          {
            "detail": "官网明示不签独家；具体展示授权、合作合同与退出细则仍须复核。",
            "level": "review",
            "type": "licence"
          }
        ],
        "steps": [
          "官方创作者计划页面申请审核；与付费套餐购买分开。"
        ],
        "summary": "公开申请审核，无粉丝门槛、不签独家；新锐/艺术家两层，积分、认证、内测、流量与合作，没有固定现金承诺。",
        "time": {
          "absolute_deadline": null,
          "absolute_start": null,
          "batches": [],
          "confirmed": false,
          "deadline": null,
          "evidence": null,
          "mechanism": "unspecified",
          "policy_duration": "官方称长期成长机制，未明示常年报名；缺截止不等于永久有效",
          "policy_effective": null,
          "policy_end": null,
          "policy_version": null,
          "start": null,
          "timezone": null
        },
        "verification": "partial",
        "verified_at": "2026-09-30",
        "work_requirements": []
      },
      "method": "pre_enhancement_record_snapshot_from_primary_mode_ro",
      "note": "原始证据与被更新字段的历史快照；其中‘DOCX未读’等旧描述已由当前补核替代，不是当前状态。",
      "overall": "partial",
      "public_review": null
    }
  ],
  "publication_at": null,
  "rewards": [
    {
      "amount": null,
      "label": "平台创作积分",
      "scope": "额度及发放条件待核",
      "type": "credits",
      "validity": null
    },
    {
      "amount": null,
      "label": "流量与合作机会",
      "scope": "数量、领取条件或结算细则未公开，不视为保底收益",
      "type": "traffic",
      "validity": null
    },
    {
      "amount": null,
      "label": "认证及内测权益",
      "scope": "数量、领取条件或结算细则未公开，不视为保底收益",
      "type": "other",
      "validity": null
    },
    {
      "amount": null,
      "label": "创作者专属社群",
      "scope": "审核通过后邀请加入；不是固定现金或收益保障",
      "type": "other",
      "validity": null
    }
  ],
  "risks": [
    {
      "detail": "官网明示不签独家；具体展示授权、合作合同与退出细则仍须复核。",
      "level": "review",
      "type": "licence"
    },
    {
      "detail": "公开页未披露首发要求、积分结算或退出规则；首屏‘随时可提’含义不清，不能解释成可随时退出或无条件提现。",
      "level": "review",
      "type": "first_release"
    }
  ],
  "source_id": "vidu_artist",
  "steps": [
    "公开页有报名按钮；填表选类别→官方审核入群对接运营→解锁认证权益。未核独立表单URL或提交端协议，本库不申请。",
    "长期成长机制不等于官方承诺常年可申请；母计划报名按钮不证明ViduEarn子活动开放。"
  ],
  "summary": "公开申请审核，无粉丝门槛、不签独家；新锐/艺术家两层，积分、认证、内测、流量与合作，没有固定现金承诺。",
  "tags": [
    "AI",
    "影视创作"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": false,
    "deadline": null,
    "evidence": null,
    "mechanism": "unspecified",
    "policy_duration": "官方称长期成长机制，未明示常年报名；缺截止不等于永久有效",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "start": null,
    "timezone": null
  },
  "title": "Vidu创作者计划",
  "verification": "partial",
  "verified_at": "2026-09-30T07:10:25Z",
  "work_requirements": []
}
~~~~


## 记录 45：f5b419d006f340d23210de1c

- `id`：f5b419d006f340d23210de1c
- `source_id`：vidu_earn
- `version`：2
- `edition`：官方活动3337027127191000

### 原字段 `document`

~~~~json
{
  "assessment": {
    "ai_policy": "allowed",
    "personal_eligibility": "not_checked",
    "reason": "官方日期与未开始/禁用状态冲突，待复核；宣传金额不是已核个人可领取。",
    "role": "candidate"
  },
  "edition": "官方活动3337027127191000",
  "eligibility": [],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "中文宣传单篇最高3000元税后、月结；详情显示2026-06-14至2028-06-29，但Not Started且禁用，门槛待公布。",
      "note": "父线程2026-09-30官方原文研究移交；人工条款不会由自动刷新覆盖。未公开字段留空。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://www.vidu.com/activity/3337027127191000"
    },
    {
      "excerpt": "中文宣传最高3000元税后、月结；详情未开始与禁用状态单独保留。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://www.vidu.com/zh/earn"
    },
    {
      "excerpt": "2026-09-30官方活动详情仍NotStarted、报名禁用；日期2026-06-14至2028-06-29与状态冲突，粉丝/互动门槛待公布。中文“立即报名”和最高3000元不能证明该活动开放。",
      "method": "manual_public_review_handoff",
      "note": "本轮公开原文复核交接。历史证据保留；自动抓取能力和本账号资格不随人工补核升级。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://www.vidu.com/activity/3337027127191000"
    }
  ],
  "id": "f5b419d006f340d23210de1c",
  "kind": "limited_benefit",
  "official_url": "https://www.vidu.com/activity/3337027127191000",
  "organizer": "Vidu",
  "origin": "manual_review",
  "platform": "Vidu",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": "中文宣传月结；当前活动状态冲突，实际细则未核"
  },
  "public_review": {
    "at": "2026-09-30",
    "fields_verified": [
      "详情仍NotStarted且禁用",
      "展示日期和开放状态冲突",
      "粉丝/互动门槛尚待公布"
    ],
    "method": "上游官方公开页面人工复核交接；未登录、未提交表单",
    "overall": "部分字段已核，整体仍有缺口",
    "remaining": [
      "当前真实开放状态",
      "粉丝/互动门槛",
      "可领取现金的完整条件",
      "版权和退出细则"
    ]
  },
  "publication_at": null,
  "relations": [
    {
      "note": "创作者成长与有条件稿件激励分别核验；加入母计划不证明星火开放。",
      "target_id": "eb01230e80d2a963f1363394",
      "type": "under_program"
    }
  ],
  "rewards": [
    {
      "amount": 3000,
      "currency": "CNY",
      "label": "中文宣传单篇最高3000元税后",
      "scope": "待复核的官方宣传上限；未证明当前可领",
      "type": "cash",
      "unit": "元",
      "validity": null
    }
  ],
  "risks": [
    {
      "detail": "当前报名、内容门槛和版权细则未核，不按宣传奖励推动投稿。",
      "level": "review",
      "type": "licence"
    }
  ],
  "source_id": "vidu_earn",
  "steps": [],
  "summary": "中文宣传单篇最高3000元税后、月结；详情显示2026-06-14至2028-06-29，但Not Started且禁用，门槛待公布。",
  "tags": [
    "AI",
    "影视创作"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": false,
    "conflict": "2026-09-30复核：活动详情仍NotStarted/报名禁用，与展示日期冲突；粉丝互动门槛待公布。中文立即报名不证明此活动开放。",
    "deadline": null,
    "evidence": null,
    "mechanism": "fixed",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "source_window": {
      "end": "2028-06-29",
      "note": "页面展示周期；不等同已确认报名窗口。",
      "start": "2026-06-14"
    },
    "start": null,
    "timezone": null
  },
  "title": "Vidu星火 / ViduEarn（官方状态冲突）",
  "verification": "partial",
  "verified_at": "2026-09-30",
  "work_requirements": []
}
~~~~


## 记录 46：0254476b2666d6b86c004b0a

- `id`：0254476b2666d6b86c004b0a
- `source_id`：hailuo_life_2025
- `version`：1
- `edition`：2025

### 原字段 `document`

~~~~json
{
  "assessment": {
    "ai_policy": "allowed",
    "personal_eligibility": "not_checked",
    "reason": "往届获奖结果，仅保留历史线索。",
    "role": "historical"
  },
  "edition": "2025",
  "eligibility": [],
  "entry_url": null,
  "evidence": [
    {
      "excerpt": "官方完整获奖名单公告；2025已颁奖，不是2026开放征集或国内超创现行规则。",
      "note": "父线程2026-09-30官方原文研究移交；人工条款不会由自动刷新覆盖。未公开字段留空。",
      "observed_at": "2026-09-30",
      "origin": "manual_handoff",
      "url": "https://www.minimax.cn/news/海影节minimax登岛海螺ai我的人生电影完整获奖名单公布"
    }
  ],
  "id": "0254476b2666d6b86c004b0a",
  "kind": "competition",
  "official_url": "https://www.minimax.cn/news/海影节minimax登岛海螺ai我的人生电影完整获奖名单公布",
  "organizer": "MiniMax / 海螺AI",
  "origin": "manual_review",
  "platform": "海螺 / MiniMax",
  "program": {
    "effective_version": null,
    "exit": null,
    "join": null,
    "ongoing_requirements": null,
    "revenue": null,
    "settlement": null
  },
  "publication_at": null,
  "record_context": "historical_reference",
  "rewards": [],
  "risks": [],
  "source_id": "hailuo_life_2025",
  "steps": [],
  "summary": "官方完整获奖名单公告；2025已颁奖，不是2026开放征集或国内超创现行规则。",
  "tags": [
    "AI",
    "影视创作"
  ],
  "time": {
    "absolute_deadline": null,
    "absolute_start": null,
    "batches": [],
    "confirmed": false,
    "deadline": null,
    "evidence": null,
    "mechanism": "unspecified",
    "policy_effective": null,
    "policy_end": null,
    "policy_version": null,
    "provider_phase": "awarded",
    "start": null,
    "timezone": null
  },
  "title": "海螺AI「我的人生电影」（2025获奖历史参考）",
  "verification": "partial",
  "verified_at": "2026-09-30",
  "work_requirements": []
}
~~~~


