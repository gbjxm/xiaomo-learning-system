"""Known public article containers and JSON data; no JavaScript execution."""
from __future__ import annotations
import json
import re
from html.parser import HTMLParser

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

def challenge_reason(raw, title="", text=""):
    """Identify blocking responses, without executing scripts or solving checks."""
    if re.search(r'EO-Bot-Js-Token|function\s+solveChallenge\b|(?:window\.)?solveChallenge\s*\(|__cf_chl|cf-chl-|challenges\.cloudflare\.com', raw, re.I):
        return "官方响应包含浏览器访问验证脚本"
    if re.search(r'验证码|访问受限|访问异常|access denied|just a moment|checking your browser|security verification', title, re.I):
        return "官方页面标题为访问验证或访问限制"
    visible = text[:3000]
    if re.search(r'(?:安全验证|浏览器(?:校验|验证)|captcha|verify (?:that )?you are human|checking your browser|access denied)', visible, re.I) and re.search(r'请(?:先)?完成|验证后(?:继续|访问)|尚未通过|需要.*验证|security check|verify (?:that )?you are human|checking your browser|access denied', visible, re.I):
        return "官方正文要求先完成访问验证"
    return ""

class ArticleContainer(HTMLParser):
    def __init__(self, tag="article", class_name="article-content", element_id=None):
        super().__init__(convert_charrefs=False)
        self.tag, self.class_name = tag, class_name
        self.element_id = element_id
        self.groups, self.group_start = [], 0
        self.stack, self.parts = [], []
        self.matches, self.closed = 0, False

    def handle_starttag(self, tag, attrs):
        classes = dict(attrs).get("class", "").split()
        matches = dict(attrs).get("id") == self.element_id if self.element_id is not None else (self.class_name is None or self.class_name in classes)
        if tag == self.tag and matches and not self.stack:
            self.matches += 1
            self.group_start = len(self.parts)
            self.stack = [tag]
            self.parts.append(self.get_starttag_text())
        elif self.stack:
            self.parts.append(self.get_starttag_text())
            if tag not in VOID:
                self.stack.append(tag)

    def handle_startendtag(self, tag, attrs):
        if self.stack:
            self.parts.append(self.get_starttag_text())

    def handle_endtag(self, tag):
        if self.stack:
            self.parts.append(f"</{tag}>")
            for index in range(len(self.stack) - 1, -1, -1):
                if self.stack[index] == tag:
                    del self.stack[index:]
                    if not self.stack:
                        self.closed = True
                        self.groups.append("".join(self.parts[self.group_start:]))
                    break

    def handle_data(self, data):
        if self.stack:
            self.parts.append(data)

    def handle_entityref(self, name):
        self.handle_data(f"&{name};")

    def handle_charref(self, name):
        self.handle_data(f"&#{name};")

def xingtu_article(raw, parse_page):
    scope = ArticleContainer()
    scope.feed(raw)
    page = parse_page("".join(scope.parts))
    complete = scope.matches == 1 and scope.closed and not scope.stack and len(page.text) > 80
    return page, complete, "官方 article-content 容器" if complete else "正文容器缺失、未闭合或为空"

def bili_article(parser, parse_page):
    """Only decode the official page's strict JSON rich-text configuration."""
    for script in parser.scripts:
        match = re.search(r"window\.__initialState\s*=\s*", script)
        if not match:
            continue
        try:
            data, _ = json.JSONDecoder().raw_decode(script[match.end():])
        except (ValueError, RecursionError):
            continue
        if not isinstance(data, dict) or not isinstance(data.get("table-rich-text"), list):
            continue
        fragments = []
        for component in data["table-rich-text"]:
            value = component.get("htmlObj", {}).get("dangerHtml") if isinstance(component, dict) else None
            if isinstance(value, str) and len(value) <= 120000:
                fragments.append(value)
        page = parse_page("\n".join(fragments))
        known = {"GlobalConfig", "BaseInfo", "table-rich-text", "pc-share-new", "firstScreenResource", "pc-baseinfo"}
        unknown = [key for key in data if key not in known]
        complete = bool(fragments and len(page.text) > 80 and not unknown and len(fragments) == len(data["table-rich-text"]))
        reason = "公开 __initialState JSON 的全部富文本组件" if complete else "公开富文本已提取，其他组件或图片正文尚未覆盖"
        return page, complete, reason
    return None, False, "没有识别到公开富文本JSON；不执行网页脚本"

def extract_article(source, raw, parser, parse_page):
    if source["id"] in {"douyin_selected", "douyin_partner_intro"}:
        return xingtu_article(raw, parse_page)
    if source["id"] in {"kling_artist", "hailuo_affiliate", "vidu_artist", "minimax_design"}:
        tag, cls, markers = {
            "kling_artist": ("article", "article-content", ["创作者计划3.0", "灵感聚光计划"]),
            "hailuo_affiliate": ("main", "relative", ["commission", "faq"]),
            "vidu_artist": ("main", None, ["Vidu 创作者计划", "新锐"]),
            "minimax_design": ("section", "community", ["执导者", "Skills"]),
        }[source["id"]]
        scope = ArticleContainer(tag, cls)
        scope.feed(raw)
        page = parse_page("".join(scope.parts))
        if source["id"] == "vidu_artist" and len(page.text) < 80:
            streamed = ArticleContainer("div", None, element_id="S:0")
            streamed.feed(raw)
            if re.search(r'\$RC\("B:0","S:0"\)', raw):
                scope = streamed
                page = parse_page("".join(scope.parts))
        complete = scope.matches == 1 and scope.closed and not scope.stack and all(word.casefold() in page.text.casefold() for word in markers)
        if source["id"] == "minimax_design":
            return page, False, "官网community入驻说明含隐藏区；当前展示和申请入口未核"
        if not complete and len(page.text) < 80:
            return None, False, "官方正文容器或流式映射不全，保留原页面部分文字"
        return page, complete, "已核官方公开正文容器（含明确映射的流式HTML，不执行脚本）" if complete else "官方正文容器或关键标识不全，保留部分提取"
    if source["url"].startswith("https://www.bilibili.com/blackboard/"):
        return bili_article(parser, parse_page)
    if source["id"] == "jinji_ai_2026":
        scope = ArticleContainer("div", "br2")
        scope.feed(raw)
        articles = [parse_page(part) for part in scope.groups if "申报标准" in part and "注意事项" in part]
        page = articles[0] if len(articles) == 1 else parse_page("".join(scope.parts))
        complete = len(articles) == 1 and not scope.stack
        return page, complete, "厦门市文联 br2 公告正文容器" if complete else "文联公告正文容器缺失或未闭合"
    return None, False, "指定公告正文结构尚未适配"

def public_fields(source_id, text):
    """Exact local excerpts, scoped to what each official page actually states."""
    patterns = {
        "kling_artist": {
            "计划版本": r"[^\n]*创作者计划3\.0[^\n]*",
            "平台资源池": r"[^\n]*每月百万现金[^\n]*",
        },
        "hailuo_affiliate": {
            "佣金说明": r"[^\n]*commission[^\n]*",
            "锁定时点": r"[^\n]*27[^\n]*",
            "支付说明": r"[^\n]*(?:\$10|30 days)[^\n]*",
        },
        "vidu_artist": {
            "长期机制定位": r"[^\n]*长期成长[^\n]*",
            "层级与权益": r"[^\n]*新锐[^\n]*",
            "非独家说明": r"[^\n]*不[^\n]*独家[^\n]*",
        },
        "minimax_design": {
            "入驻说明": r"[^\n]*严肃创作者[^\n]*",
            "收益权益": r"[^\n]*Skills[^\n]*",
        },
        "jinji_ai_2026": {
            "截止原文": r"[^\n]*申报截止时间[^\n]*",
            "AI画面占比与标识": r"[^\n]*AI生成画面占比[^\n]*",
            "版权归属与使用范围": r"[^\n]*组委会拥有入围作品非商业[^\n]*",
            "报名费用": r"[^\n]*免收申报报名费[^\n]*",
            "科影融合邮箱": r"[^\n]*zgkpzx@kpcswa\.org\.cn[^\n]*",
            "影游联动邮箱": r"[^\n]*AI@bigscreen1950\.com[^\n]*",
        },
        "douyin_selected": {
            "精选计划定位": r"由抖音发起的长期优质创作倡议[^\n]*",
            "长期在线说明": r"平台主推项目达人，长期在线",
        },
        "douyin_partner_intro": {
            "伙伴计划升级": r"[^\n]*中视频伙伴计划会升级[^\n]*",
        },
        "bili_huahuo_rules": {
            "规则生效": r"[^\n]*2025[^\n]*(?:10月1日|10.01|10-01)[^\n]*",
            "适用结算方式": r"[^\n]*确认结算方式变更为[^\n]*贝壳自提[^\n]*",
            "到账时点": r"[^\n]*T\+1[^\n]*",
            "提现入口": r"[^\n]*B站APP[^\n]*贝壳提现[^\n]*",
        },
    }
    fields = {}
    for name, pattern in patterns.get(source_id, {}).items():
        match = re.search(pattern, text)
        if match:
            fields[name] = match[0].strip()[:2500]
    missing = {
        "kling_artist": ["当前申请门槛与现金档位", "完整版权/独家与有效期"],
        "hailuo_affiliate": ["签约端完整推广合同及适用地区/支付税务条款"],
        "vidu_artist": ["具体积分与持续达标/退出细则", "完整合作授权合同"],
        "minimax_design": ["当前可用申请入口（HTML社群区隐藏）", "分成比例、合同与结算期限"],
        "jinji_ai_2026": ["公告未注明截止时区", "二维码报名入口与报名表尚未核验"],
        "douyin_selected": ["创作者加入方式与资格", "收益与结算细则", "持续达标与退出条件", "专属AI内容资格"],
        "douyin_partner_intro": ["现行伙伴计划完整规则", "账号开放批次", "当前收益算法与结算", "专属AI内容资格"],
        "bili_huahuo_rules": ["链接中的完整提现与计税条款", "后续版本有效性"],
    }.get(source_id, ["完整活动/机制条款"])
    return {"state": "partial", "fields": fields, "missing": missing, "reason": "已提取公告明示信息；页面未说明或外链未核部分保留未知"}

def coverage(article_state="not_checked", article_reason="本轮未取得公开正文", rules_state="not_checked", rules_reason="未完成规则字段核对"):
    return {
        "article": {"state": article_state, "reason": article_reason},
        "rules": {"state": rules_state, "reason": rules_reason},
        "account": {"state": "not_checked", "reason": "未连接个人账号；公开规则不能证明本账号或AI作品符合资格"},
    }
