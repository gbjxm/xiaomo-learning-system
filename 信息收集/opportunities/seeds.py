"""Facts handed over by the preceding official-source review, never live demo data."""
from .model import empty_document

def handed_over():
    documents = []
    def seed(source, title, platform, url, edition, kind="competition"):
        doc = empty_document(source, title, platform, url, edition, kind)
        doc["origin"] = "manual_handoff"
        doc["evidence"] = [{"origin": "manual_handoff", "url": url, "observed_at": None, "excerpt": "前序任务人工核验移交；未提供精确核验时刻。与本次抓取分开。", "note": "部分字段已核；缺失字段仍待核验。"}]
        documents.append(doc)
        return doc
    king = seed("libtv", "王者无界剧场计划", "LibTV / 抖音", "https://www.liblib.tv/activity/62", "2026 / 活动62")
    king.update(organizer="LibTV × 王者荣耀 / 腾讯", entry_url=king["official_url"], summary="王者 IP AI 影像征集。现金、奖励积分和启动算力分开；获奖作品版权转让及排他授权需重点审阅。", tags=["AI", "影视", "王者IP", "短片"])
    king["time"].update(mechanism="fixed", start="2026-09-21T15:00:00", deadline="2026-11-22T23:59:59", confirmed=True, evidence="移交核验：2026-09-21 15:00 至 2026-11-22 23:59:59；原文未注明时区。")
    king["rewards"] = [{"type":"cash","label":"税前现金总奖池","amount":1500000,"currency":"CNY","scope":"总奖池","validity":None}, {"type":"cash","label":"一等奖","amount":500000,"currency":"CNY","scope":"单奖（总奖池内）","validity":None}, {"type":"credits","label":"奖励积分","amount":3000000,"unit":"积分","scope":"奖励池","validity":"3个月"}, {"type":"compute","label":"启动算力池","amount":7000000,"unit":"算力池（口径待核）","scope":"独立扶持池","validity":None}]
    king["eligibility"] = ["王者 IP 新创作作品；具体主体资格待核"]
    king["work_requirements"] = ["时长至少2分钟", "16:9 横版，至少720p", "王者IP新作"]
    king["steps"] = ["在 LibTV 活动入口提交", "抖音同步投稿并使用官方指定话题；话题完整文本待本次核验"]
    king["risks"] = [{"type":"exclusive","level":"high","detail":"腾讯广泛排他、可转授权；使用范围须审阅官方全文。"}, {"type":"transfer","level":"high","detail":"获奖作品著作权转让是发奖前提；是否接受应在投稿前判断。"}]
    short = seed("aishorts", "HiShorts! × updream AI 短片大赛", "updream / B站", "https://www.bilibili.com/blackboard/era/DjrNk7LG6agRh9Lu.html", "2026 / AiShorts")
    short.update(organizer="HiShorts! × updream", summary="AI 短片征集，官方图片规则需要人工核读。截止日期未核，不能采用第三方冲突日期。", tags=["AI","短片","影视"])
    short["work_requirements"] = ["2–30分钟", "2026-03-20后创作", "1080p横版 MOV / MP4"]
    short["rewards"] = [{"type":"credits","label":"积分奖励，数量待核"}, {"type":"promotion","label":"推广支持，细则待核"}, {"type":"screening","label":"展映机会，细则待核"}]
    short["risks"] = [{"type":"unknown","level":"unknown","detail":"版权、独家和首发条件待核；尚未读到完整图片规则。"}]
    director = seed("updream", "updream 特约导演计划", "updream / B站", "https://www.updream.cn/", "轮次未核", "creator_program")
    director.update(summary="仅核到提交作品链接可获积分；长期开放与加入、收益、结算、退出条件未核。", tags=["AI","导演","创作者","积分"])
    director["program"]["join"] = "提交作品链接；入口与完整资格待核"
    director["rewards"] = [{"type":"credits","label":"提交作品链接可获积分，数量及有效期待核"}]
    old = seed("bili_white", "updream 白模创作赛（历史）", "B站 / updream", "https://www.bilibili.com/opus/1237442539704811557", "2026 / 08-17轮")
    old.update(summary="历史公告用于核对归档与奖励分类。已核报名结束；积分和投流不作为现金。", tags=["AI","视频","积分"])
    old["time"].update(mechanism="fixed", start="2026-08-17", deadline="2026-09-15", confirmed=True, evidence="前序人工核验报名期：08-17至09-15，原文时区未注明。")
    old["rewards"] = [{"type":"credits","label":"积分奖励，数量待核"}, {"type":"traffic","label":"投流支持，细则待核"}]
    remix = seed("bili_remix", "B站二创赛（历史）", "B站", "https://www.bilibili.com/opus/1175154222470004785", "2026 / 03-03轮")
    remix.update(summary="已核历史报名期，5万元奖金池；花火 / 贝壳为结算信息，不能重复计入奖金。", tags=["二创","视频","现金"])
    remix["time"].update(mechanism="fixed", start="2026-03-03", deadline="2026-03-31", confirmed=True, evidence="前序人工核验报名期：03-03至03-31，时区未注明。")
    remix["rewards"] = [{"type":"cash","label":"奖金总池","amount":50000,"currency":"CNY","scope":"总奖池"}]
    remix["program"]["settlement"] = "花火 / 贝壳结算；具体兑换、税费条件待核"
    selected = seed("douyin_selected", "抖音精选计划", "抖音", "https://www.xingtu.cn/help-center/demander/114908", "长期倡议 / 2026核验", "creator_program")
    selected.update(organizer="抖音", verified_at="2026-09-30", summary="官方长期优质创作倡议，2026-05-19仍列长期在线。属于内容精选与扶持，现金分成尚未核到。", tags=["创作者","视频","内容精选","扶持"])
    selected["time"]["policy_duration"] = "官方长期在线倡议；不等于已核全年可加入"
    selected["program"]["ongoing_requirements"] = "优质内容创作倡议；具体持续达标门槛未核"
    selected["rewards"] = [{"type":"promotion","label":"内容精选与扶持，非已核现金分成"}]
    selected["risks"] = [{"type":"unknown","level":"unknown","detail":"AI内容准入、版权与独家条款未核。"}]
    selected["evidence"][0].update(observed_at="2026-09-30", excerpt="研究移交：官方定义为长期优质创作倡议，2026-05-19仍列长期在线；核验仅提供日期。")
    limited = seed("douyin_selected", "精选达人团 · 限时流量激励计划（历史子活动）", "抖音", selected["official_url"], "2026 / 截止03-31子活动", "limited_benefit")
    limited.update(organizer="抖音", verified_at="2026-09-30", summary="精选计划的独立限时子活动，已核2026-03-31结束；不影响父计划的长期属性。", tags=["流量","创作者"])
    limited["time"].update(mechanism="fixed", deadline="2026-03-31", confirmed=True, evidence="官方限时子活动截止2026-03-31，开始时间未核。")
    limited["rewards"] = [{"type":"traffic","label":"限时流量激励，细则待核"}]
    limited["evidence"][0].update(observed_at="2026-09-30", excerpt="研究移交：精选达人团限时流量激励计划截至2026-03-31。")
    partner = seed("douyin_partner_rules", "创作者伙伴计划", "抖音 / 西瓜", "https://i.snssdk.com/magic/eco/runtime/release/661ceef7d4f467070808af60?appType=ixigua&magic_page_no=1&magic_source=mu_jhgz_v3a1", "官方规则 / 修订日期未核", "creator_program")
    partner.update(organizer="抖音 / 西瓜视频", verified_at="2026-09-30", summary="中视频升级后的原创内容现金激励与抖西分成；官方不定期开放，加入时间以账号页面、公告或站内信为准。", tags=["原创","创作者","视频","现金"])
    partner["time"].update(mechanism="batches", confirmed=True, evidence="官方明示不定期开放；本账号本期起止未核。", batches=["账号定向 / 分批，以作者实际页面、公告或站内信为准"])
    partner["program"].update(join="以账号实际页面、公告或站内信为准；统一当前门槛未核", revenue="原创内容现金激励、抖西分成；现行计算细则待核", ongoing_requirements="官方存在持续评估；具体达标标准待核", exit="存在退出 / 清退机制；具体触发与申诉条件待核")
    partner["rewards"] = [{"type":"cash","label":"原创内容现金激励与抖西分成（非固定金额）","amount":None,"scope":"以官方现行账号规则为准"}]
    partner["risks"] = [{"type":"unknown","level":"unknown","detail":"六张长图已由前序研究阅读，但有内测且无修订日期；AI准入与当前统一门槛未核。"}]
    partner["evidence"][0].update(observed_at="2026-09-30", excerpt="研究移交：官方六张规则长图，图片需OCR / 人工核验；现行修订日期未注明。")
    partner["evidence"].append({"origin":"manual_handoff","url":"https://www.xingtu.cn/help-center/author/141762","observed_at":"2026-09-30","excerpt":"官方升级说明确认中视频升级为创作者伙伴计划。"})
    incentive = seed("bili_incentive", "B站视频创作激励", "B站", "https://www.bilibili.com/opus/1198858284376784900", "官方客服2026-05-05 / 2026核验", "creator_program")
    incentive.update(organizer="哔哩哔哩", publication_at="2026-05-05", verified_at="2026-09-30", summary="官方长期扶持机制。基础激励与框下 / 暂停广告分成不可拆分，贝壳结算；AI作品准入仍待核。", tags=["创作者","视频","现金","激励"])
    incentive["time"]["policy_duration"] = "官方说明为长期扶持；未据此推断全年开放申请"
    incentive["eligibility"] = ["权益等级≥3", "信用分≥80", "非封禁账号、企业蓝V、纪念账号", "四条机制的专属AI内容资格均未核到"]
    incentive["program"].update(join="按官方申请入口及当前账号状态操作；具体入口待核", revenue="基础激励 + 框下 / 暂停广告分成不可拆分；详细稿件与计算条款待核", settlement="贝壳结算；周期、税费与提现条件待核")
    incentive["rewards"] = [{"type":"cash","label":"创作激励 + 广告分成（不可拆分；贝壳结算）","amount":None,"scope":"收益随稿件与规则变化，非固定补贴"}]
    incentive["risks"] = [{"type":"unknown","level":"unknown","detail":"AI作品资格、稿件版权与当前持续达标 / 退出条件待核；不沿用2023旧门槛。"}]
    incentive["evidence"][0].update(observed_at="2026-09-30", excerpt="研究移交：2026-05-05官方客服说明的公开申请资格、收益组合与贝壳结算。")
    huahuo = seed("bili_huahuo", "B站花火商业合作平台", "B站", "https://e.bilibili.com/observe/observe_1.html", "商业合作机制 / 2026核验", "creator_program")
    huahuo.update(organizer="哔哩哔哩", verified_at="2026-09-30", summary="品牌与UP主商业合作撮合机制。收入依实际订单，不是保底补贴或播放分成，当前准入门槛未核。", tags=["创作者","商业合作","视频"])
    huahuo["program"].update(revenue="商业合作订单收入，以实际合同与订单为准", settlement="选择贝壳自提的个人订单：完成T+1转贝壳（2025-10-01改动）；其余模式待核")
    huahuo["rewards"] = [{"type":"other","label":"商业合作撮合与订单收入（无保底承诺）"}]
    huahuo["risks"] = [{"type":"unknown","level":"review","detail":"订单授权、品牌独家、合同义务需逐单审阅；AI作品准入未核。"}]
    huahuo["evidence"][0].update(observed_at="2026-09-30", excerpt="研究移交：官方花火平台定义为商业合作撮合。")
    billing = seed("bili_huahuo_rules", "花火个人订单 · 贝壳自提结算规则更新", "B站", "https://www.bilibili.com/blackboard/activity-EHM5wokgqh.html", "2025-10-01生效结算改动", "rule_update")
    billing.update(organizer="哔哩哔哩", verified_at="2026-09-30", summary="选择贝壳自提的个人订单，订单完成T+1转贝壳；不推断其他结算模式。", tags=["结算","创作者","规则"])
    billing["time"].update(confirmed=True, policy_effective="2025-10-01", policy_version="2025-10-01结算改动", evidence="官方结算改动生效日期2025-10-01；终止日期未说明。")
    billing["program"].update(settlement="选择贝壳自提的个人订单，完成T+1转贝壳", effective_version="2025-10-01结算改动")
    billing["evidence"][0].update(observed_at="2026-09-30", excerpt="研究移交：官方2025-10-01结算改动；当前未知的其他模式保持空。")
    return documents
