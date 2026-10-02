"""Single-run official-source collection. No schedule, accounts, or script execution."""
from __future__ import annotations
import concurrent.futures
import hashlib
import html
import ipaddress
import json
import re
import socket
import threading
import time
import urllib.error
import urllib.request
import urllib.robotparser
import uuid
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import quote, urljoin, urlsplit, urlunsplit
from .model import canonical_url, empty_document, utcnow
from .storage import ProcessLock
from .backup import collection_guard
from .articles import challenge_reason, coverage, extract_article, public_fields
from .discovery import collect_list

_robot_lock = threading.Lock()
_robot_cache = {}

def check_robots(url, source, rules):
    """Respect explicit crawler prohibitions, including policies naming OpenAI agents."""
    host = urlsplit(url).hostname
    with _robot_lock:
        policy = _robot_cache.get(host)
        if policy is None:
            robot_url='https://'+host+'/robots.txt'
            validate_network_url(robot_url,source['allowed_hosts'])
            request=urllib.request.Request(robot_url,headers={'User-Agent':'XiaomoCreativeLibrary/1.0 (personal on-demand official-source check)','Accept':'text/plain','Accept-Encoding':'identity'})
            opener=urllib.request.build_opener(RestrictedRedirect(source['allowed_hosts']))
            try:
                with opener.open(request,timeout=min(10,rules['request_timeout_seconds'])) as response:
                    raw=response.read(200001)
                    if len(raw)>200000:raise ValueError('robots策略超过校验上限；停止该源')
                    text=raw.decode(response.headers.get_content_charset() or 'utf-8','replace')
                    content_type=response.headers.get_content_type()
                if content_type not in ('text/plain','text/html') or re.search(r'<\s*(?:!doctype|/?[A-Za-z][\w:-]*(?:\s|/?>))',text,re.I) or challenge_reason(text,text[:300],text):
                    raise ValueError('robots入口返回验证/应用页面；无法确认访问策略，停止该源')
                policy=urllib.robotparser.RobotFileParser(robot_url);policy.parse(text.splitlines())
            except urllib.error.HTTPError as error:
                if error.code not in (404,410):raise
                policy=True
            _robot_cache[host]=policy
    if policy is not True and any(not policy.can_fetch(agent,url) for agent in ('XiaomoCreativeLibrary','ChatGPT-User','GPTBot','OAI-SearchBot')):
        raise ValueError('robots明确禁止相关自动访问；未请求该页面')

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts, self.scripts, self.links, self.images, self.headings = [], [], [], [], []
        self.skip, self.current_script, self.heading = [], None, None
        self.title, self.in_title = "", False
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ("script", "style", "svg", "noscript"):
            self.skip.append(tag)
        if tag == "script":
            self.current_script = []
        if tag in ("p", "div", "br", "li", "h1", "h2", "h3", "section") and not self.skip:
            self.parts.append("\n")
        if tag == "title":
            self.in_title = True
        if tag in ("h1", "h2", "h3"):
            self.heading = []
        if tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])
        if tag == "img" and attrs.get("src"):
            self.images.append(attrs["src"])
    def handle_endtag(self, tag):
        if tag == "script" and self.current_script is not None:
            self.scripts.append("".join(self.current_script))
            self.current_script = None
        if self.skip and tag == self.skip[-1]:
            self.skip.pop()
        if tag == "title":
            self.in_title = False
        if tag in ("h1", "h2", "h3") and self.heading is not None:
            self.headings.append("".join(self.heading).strip())
            self.heading = None
        if tag in ("p", "div", "li", "section") and not self.skip:
            self.parts.append("\n")
    def handle_data(self, data):
        if self.current_script is not None:
            self.current_script.append(data)
        if self.in_title:
            self.title += data
        if self.heading is not None and not self.skip:
            self.heading.append(data)
        if not self.skip:
            self.parts.append(data)
    @property
    def text(self):
        value = re.sub(r"[ \t\r]+", " ", "".join(self.parts))
        value = re.sub(r"预计\d+天后结束", "预计结束倒计时（动态）", value)
        return "\n".join(line.strip() for line in value.splitlines() if line.strip())

def parse_page(raw):
    parser = PageParser()
    parser.feed(raw)
    return parser

def libtv_data(parser):
    """Decode public Next flight JSON/string records; never evaluate JavaScript."""
    decoder, frames, objects = json.JSONDecoder(), [], []
    for script in parser.scripts:
        for match in re.finditer(r"__next_f\.push\(", script):
            try:
                frame, _ = decoder.raw_decode(script[match.end():])
                if isinstance(frame, list) and len(frame) > 1 and frame[0] == 1 and isinstance(frame[1], str):
                    frames.append(frame[1])
            except (ValueError, RecursionError):
                continue
    joined = "".join(frames)
    encoded, references = joined.encode(), {}
    for match in re.finditer(rb"([0-9a-f]+):T([0-9a-f]+),", encoded):
        length = int(match[2], 16)
        if length <= 1000000:
            references[match[1].decode()] = encoded[match.end():match.end() + length].decode("utf-8", "replace")
    budget = [25000]
    def walk(value, depth=0):
        budget[0] -= 1
        if depth > 12 or budget[0] < 0:
            return
        if isinstance(value, dict):
            if isinstance(value.get("activityId"), int) and isinstance(value.get("name"), str):
                objects.append(value)
            for child in value.values():
                walk(child, depth + 1)
        elif isinstance(value, list):
            for child in value:
                walk(child, depth + 1)
        elif isinstance(value, str) and value.lstrip().startswith(("{", "[")):
            try:
                walk(json.loads(value), depth + 1)
            except (ValueError, RecursionError):
                pass
    for match in re.finditer(r"(?:^|\n)[0-9a-f]+:(?=[\[{])", joined):
        try:
            walk(decoder.raw_decode(joined[match.end():])[0])
        except (ValueError, RecursionError):
            pass
    # Flight T records have explicit byte lengths and may touch the following JSON
    # record without a newline. Decode only the public activity object shape.
    for match in re.finditer(r'\{\s*"activityId"\s*:', joined):
        try:
            value, _ = decoder.raw_decode(joined[match.start():])
            if isinstance(value, dict) and isinstance(value.get("activityId"), int) and isinstance(value.get("name"), str):
                objects.append(value)
        except (ValueError, RecursionError):
            continue
    found = {}
    for obj in objects:
        description = obj.get("description", "")
        if isinstance(description, str) and re.fullmatch(r"\$[0-9a-f]+", description):
            description = references.get(description[1:], "")
        if not isinstance(description, str):
            description = ""
        found[obj["activityId"]] = {key: obj.get(key) for key in ("activityId", "name", "rewardDescription", "startAt", "endAt", "createdAt", "updatedAt")}
        found[obj["activityId"]]["description"] = description.replace("\\n", "\n")[:120000]
    return list(found.values())

def timestamp(ms):
    if isinstance(ms, (int, float)) and 946684800000 <= ms <= 4102444800000:
        return datetime.fromtimestamp(ms / 1000, timezone.utc).isoformat(timespec="seconds")
    return None

def section(text, labels):
    # Keep exact excerpts; unsupported layouts are incomplete, not imagined rules.
    lines, output, active, level = text.splitlines(), [], False, 7
    for line in lines:
        heading = re.match(r"\s*(#{1,6})\s+\S", line)
        is_heading = bool(heading or re.match(r"\s*[一二三四五六七八九十]+[、.]", line))
        title = re.sub(r"^\s*(?:#{1,6}\s+|[一二三四五六七八九十]+[、.]\s*)", "", line)
        starts_with_label = any(re.match(r"^[^\u4e00-\u9fffA-Za-z]*" + re.escape(label), title) for label in labels)
        if not active and starts_with_label and (is_heading or len(line) < 100):
            active = True
            level = len(heading[1]) if heading else 7
            output.append(line.strip())
        elif active and heading and len(heading[1]) <= level:
            break
        elif active:
            output.append(line.strip())
    return [line for line in output if line and line != "---"][:40]

def labelled_window(text):
    text = text.replace("**", "")
    date = r"(20\d{2}[.年/-]\d{1,2}[.月/-]\d{1,2}日?(?:[ T]*\d{1,2}:\d{2}(?::\d{2})?)?)"
    pattern = r"(?:征集时间|征稿时间|投稿时间|报名时间|活动时间|征集期|征稿期|投稿期|报名期)[^\n]{0,25}?" + date + r"\s*(?:至|到|[—–~～-]+)\s*" + date
    match = re.search(pattern, text)
    if not match:
        return None
    def clean(raw):
        parts = re.fullmatch(r"(20\d{2})[.年/-](\d{1,2})[.月/-](\d{1,2})日?(?:[ T]*(\d{1,2}):(\d{2})(?::(\d{2}))?)?", raw)
        year, month, day, hour, minute, second = parts.groups()
        parsed = datetime(int(year), int(month), int(day), int(hour or 0), int(minute or 0), int(second or 0))
        return parsed.isoformat(timespec="seconds") if hour else parsed.date().isoformat()
    try:
        return clean(match[1]), clean(match[2]), match[0]
    except ValueError:
        return None

def candidate(source, metadata, rules):
    description = metadata["description"]
    title = metadata["name"].strip()[:300]
    content = title + "\n" + description
    if not any(word.lower() in content.lower() for word in rules["keywords"]):
        return None, False
    year = re.search(r"20\d{2}", content)
    start, end = timestamp(metadata.get("startAt")), timestamp(metadata.get("endAt"))
    edition = f"{start[:4] if start else year[0] if year else '年度未核'} / 活动{metadata['activityId']}"
    kind = "competition" if any(word in content for word in ("赛", "征集", "评审")) else "limited_benefit" if any(word in content for word in ("限时", "福利", "算力池")) else "creator_program" if "计划" in content else "competition"
    doc = empty_document(source["id"], title, source["platform"], urljoin(source["url"], f"/activity/{metadata['activityId']}"), edition, kind)
    doc["summary"] = str(metadata.get("rewardDescription") or "官方活动线索，完整条款需核验")[:800]
    doc["tags"] = [word for word in rules["keywords"] if word.lower() in content.lower()]
    # createdAt is platform record creation, not evidence of announcement publication.
    doc["time"]["source_window"] = {"start": start, "end": end, "note": "官方结构化活动周期，不自动等同于完整报名规则"}
    window = labelled_window(description)
    if window:
        doc["time"].update(mechanism="fixed", start=window[0], deadline=window[1], confirmed=True, evidence=window[2])
    doc["eligibility"] = section(description, ["参赛对象", "参与对象", "参与资格", "参赛资格"])
    doc["work_requirements"] = section(description, ["作品要求", "投稿要求", "创作要求", "参赛要求"])
    doc["steps"] = section(description, ["参与方式", "投稿方式", "报名方式", "投稿流程", "如何参赛", "投稿递交", "发布与提交", "发布要求"])
    if doc["steps"]:
        doc["entry_url"] = doc["official_url"]
    risk_sections = section(description, ["版权", "著作权", "授权", "声明", "注意事项"])
    risks_text = "\n".join(risk_sections)
    for risk_type, words in (("exclusive", ["排他", "独家"]), ("transfer", ["转让"]), ("licence", ["授权"]), ("first_release", ["首发"])):
        relevant = [line for line in description.splitlines() if any(word in line for word in words)][:8]
        if relevant:
            doc["risks"].append({"type": risk_type, "level": "high" if risk_type in ("exclusive", "transfer") else "review", "detail": "\n".join(relevant)[:6000]})
    reward_body = section(description, ["奖励机制", "活动奖励", "参赛奖励", "活动激励", "三大激励", "奖池"])
    reward_text = str(metadata.get("rewardDescription") or "") + ("\n" + "\n".join(reward_body) if reward_body else "")
    for category, words in (("cash", ["现金", "奖金"]), ("credits", ["积分"]), ("compute", ["算力"]), ("traffic", ["流量", "投流"]), ("promotion", ["推广"]), ("screening", ["展映"])):
        if any(word in reward_text for word in words):
            excerpt = "\n".join(line for line in reward_text.splitlines() if any(word in line for word in words))[:2500]
            doc["rewards"].append({"type": category, "label": words[0] + "奖励（数量及口径待核）", "amount": None, "scope": "官方奖励段落已提及；具体数量与结算口径需复核", "source_excerpt": excerpt})
    doc["evidence"] = [{"origin": "live_fetch", "url": doc["official_url"], "observed_at": utcnow(), "excerpt": "官方公开活动清单内嵌数据与规则正文；非实时登录态。", "note": "正文未完整覆盖的字段保持空；图片需人工阅读。"}]
    image_refs = re.findall(r"!\[[^\]]*\]\(([^)]+)\)", description)
    # Any referenced document is unchecked, regardless of its hosting provider.
    # Preserve evidence only: arbitrary outbound links are never fetched here.
    references = re.findall(r"https?://[^\s)<>\"']+", description)
    references += re.findall(r'\[[^\]]*\]\(([^)]+)\)', description)
    references += re.findall(r'''href\s*=\s*["']([^"']+)["']''', description, re.I)
    external_rules = sorted({urljoin(doc['official_url'],value.strip().rstrip('.,;，。；')) for value in references if value.strip() and urljoin(doc['official_url'],value.strip().rstrip('.,;，。；')) != doc['official_url']})
    complete = bool(window and doc["eligibility"] and doc["work_requirements"] and doc["steps"] and doc["rewards"] and doc["risks"] and len(description) > 400 and not image_refs and not external_rules)
    doc["evidence"][0]["image_refs"] = image_refs
    doc["evidence"][0]["external_rules"] = external_rules
    doc["verification"] = "extracted" if complete else "partial"
    if complete:
        doc["verified_at"] = utcnow()
    return doc, complete

class RestrictedRedirect(urllib.request.HTTPRedirectHandler):
    def __init__(self, hosts, source=None, rules=None):
        super().__init__()
        self.hosts = hosts
        self.source, self.rules = source, rules
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        validate_network_url(newurl, self.hosts)
        if self.source is not None and self.source.get('respect_robots', False):
            check_robots(newurl, self.source, self.rules)
        return super().redirect_request(req, fp, code, msg, headers, newurl)

def validate_network_url(url, hosts):
    canonical_url(url)
    host = urlsplit(url).hostname.lower()
    if host not in hosts:
        raise ValueError("跳转到未登记的域名，已停止")
    # urllib sends HTTPS via an already-configured proxy when applicable. In that
    # case the proxy resolves the target; local sandbox DNS can be a synthetic
    # 198.18/15 mapping and is not the address used by the connection.
    if urllib.request.getproxies().get("https") and not urllib.request.proxy_bypass(host):
        return
    for addr in socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM):
        ip = ipaddress.ip_address(addr[4][0])
        if not ip.is_global:
            raise ValueError("官方地址解析为非公网地址，已停止")

def fetch(url, source, rules):
    hosts = source["allowed_hosts"]
    validate_network_url(url, hosts)
    if source.get('respect_robots',False):
        check_robots(url,source,rules)
    opener = urllib.request.build_opener(RestrictedRedirect(hosts, source, rules))
    parts = urlsplit(url)
    request_url = urlunsplit((parts.scheme, parts.netloc, quote(parts.path, safe="/%:@"), quote(parts.query, safe="%=&?+/:@"), ""))
    request = urllib.request.Request(request_url, headers={"User-Agent": "XiaomoCreativeLibrary/1.0 (personal on-demand official-source check)", "Accept": "text/html,application/json;q=0.9", "Accept-Encoding": "identity"})
    with opener.open(request, timeout=rules["request_timeout_seconds"]) as response:
        content_type = response.headers.get_content_type()
        if content_type not in ("text/html", "application/json", "text/plain", "application/xhtml+xml"):
            raise ValueError(f"未支持正文类型：{content_type}")
        raw = response.read(rules["max_response_bytes"] + 1)
        if len(raw) > rules["max_response_bytes"]:
            raise ValueError("正文超出大小上限，未进行截断式完整核验")
        charset = response.headers.get_content_charset() or "utf-8"
        return raw.decode(charset, "replace"), hashlib.sha256(raw).hexdigest()

def collect_source(store, source, run_id, cancel, fetcher=fetch):
    result = {"source_id": source["id"], "status": "pending", "message": source["note"], "new": 0, "changed": 0, "pages": 0, "processed": False, "coverage": coverage()}
    if source["adapter"] == "unadapted":
        result["coverage"] = coverage("unadapted", source["note"], "unadapted", "公开规则源未适配，未请求账号登录")
        return result
    if cancel.is_set():
        return {**result, "cancelled": True, "message": "用户停止了当前检查；该信源未执行"}
    try:
        result['processed'] = True
        if source['adapter']=='official_list':
            return collect_list(store,source,run_id,cancel,fetcher,parse_page)
        raw, raw_hash = fetcher(source["url"], source, store.rules)
        parser = parse_page(raw)
        body = parser.text
        blocked = challenge_reason(raw, parser.title, body)
        if blocked:
            result["coverage"] = coverage("blocked", "官方返回访问验证页，已停止该源", "not_checked", "未取得正文，保留独立人工证据")
            return {**result, "status": "failed", "message": "官方页面返回访问限制 / 验证页面；未绕过", "pages": 0}
        result["pages"] = 1
        if source["adapter"] == "libtv":
            entries = libtv_data(parser)
            if not entries:
                store.observe(source["id"], source["url"], body, raw_hash, run_id, "partial")
                return {**result, "status": "partial", "message": "可读列表，但未提取到可验证的活动实体；清单结构可能变化"}
            listed_count = len(entries)
            limited = listed_count > store.rules['max_items_per_source']
            entries = entries[:store.rules["max_items_per_source"]]
            processed_entries = 0
            full_count, accepted, field_count, images, external = 0, 0, 0, 0, 0
            for entry in entries:
                if cancel.is_set():
                    break
                processed_entries += 1
                doc, complete = candidate(source, entry, store.rules)
                if not doc:
                    continue
                accepted += 1
                full_count += int(complete)
                field_count += sum(bool(doc[key]) for key in ("eligibility", "work_requirements", "steps", "rewards", "risks")) + int(doc["time"]["confirmed"])
                images += len(doc["evidence"][0]["image_refs"])
                external += len(doc["evidence"][0]["external_rules"])
                text = entry["name"] + "\n" + str(entry.get("rewardDescription") or "") + "\n" + entry["description"]
                page_coverage = coverage("embedded_text", "已取得官方嵌入正文；图片及外链另核", "complete" if complete else "partial", "已提取有明确标签的规则段落；缺字段保留空")
                page_coverage["article"].update(text_chars=len(text), image_refs=doc["evidence"][0]["image_refs"], external_rules=doc["evidence"][0]["external_rules"])
                page_coverage["rules"].update(fields={key:doc[key] for key in ("eligibility", "work_requirements", "steps", "rewards", "risks") if doc[key]}, confirmed_window=doc["time"]["confirmed"])
                delta = store.observe(source["id"], doc["official_url"], text, raw_hash, run_id, "extracted" if complete else "partial", page_coverage)
                outcome = store.upsert(doc)
                result["new"] += outcome == "new"
                result["changed"] += int(outcome == "changed" or delta)
            store.observe(source["id"], source["url"], "\n".join(f"{entry['activityId']}: {entry['name']}" for entry in entries), raw_hash, run_id, "list")
            incomplete = full_count != accepted or limited or cancel.is_set()
            result["coverage"] = coverage("embedded_text", f"已取得{len(entries)}条官方嵌入正文；不等于图片或外链全文", "partial" if incomplete else "complete", f"提取到{field_count}组明确规则段落；{full_count}/{accepted}条规则覆盖完整")
            result["coverage"]["article"].update(entries=processed_entries, listed_entries=listed_count, image_refs=images, external_rules=external)
            result["coverage"]["rules"].update(complete_items=full_count, checked_items=accepted, extracted_field_groups=field_count, blockers=["图片内容未核", "外链完整规则未核", "正文缺失或未说明的字段保留未知"])
            if incomplete:
                result["status"] = "partial"
                result["message"] = f"本页列出 {listed_count} 个公开活动，实际处理 {processed_entries} 个，筛选保留 {accepted} 个；{full_count} 个通过正文结构检查。缺失规则 / 图片条款待人工核验" + ("；已达到本次条数上限" if limited else "") + ("；用户已取消，未执行部分不能视为无更新" if cancel.is_set() else "")
            else:
                result["status"] = "success" if result["new"] or result["changed"] else "success_zero"
                result["message"] = f"本次已检查公开清单范围：{accepted} 条；" + ("有新增或变更" if result["status"] == "success" else "成功零新增、零变更")
        else:
            article, text_complete, method = extract_article(source, raw, parser, parse_page)
            if article is not None:
                body = article.text
            page = article or parser
            image_refs = sorted(set(urljoin(source["url"], ref) for ref in page.images))
            links = sorted(set(urljoin(source["url"], ref) for ref in page.links if ref.startswith(("https://", "/"))))
            if len(body) > 115000:
                text_complete = False
                method = "正文超出证据保存上限，未作完整文本核验"
            if source["adapter"] == "homepage":
                result["coverage"] = coverage("homepage_only", "取得产品主页，不代表发现机制正文", "unadapted", "福利或机制列表尚未适配")
            else:
                result["coverage"] = coverage("text_complete" if text_complete else "partial_text" if len(body) > 80 else "no_text", method)
                result["coverage"]["rules"] = public_fields(source["id"], body)
            result["coverage"]["article"].update(text_chars=len(body), image_refs=image_refs, links=links)
            quality = "text_complete" if text_complete else "partial" if source["adapter"] in ("article", "image_article") else "homepage_only"
            evidence_text = body or "（未取得可读正文）"
            if image_refs:
                evidence_text += "\n\n[官方正文图片引用，图片内容未核]\n" + "\n".join(image_refs)
            if links:
                evidence_text += "\n\n[官方正文链接，外链内容未核]\n" + "\n".join(links)
            delta = store.observe(source["id"], source["url"], evidence_text, raw_hash, run_id, quality, result["coverage"])
            result["changed"] += int(delta)
            result["status"] = "partial" if source["adapter"] in ("article", "image_article") else "pending"
            result["message"] = (f"公开正文文本完整取得（{len(body)}字）；规则字段仍有缺口，图片 / 外链及账号资格另核" if text_complete else "取得部分页面文字，正文 / 规则结构尚不完整；不能判定没有更新") if source["adapter"] != "homepage" else "主页可访问，未接通可完整检查的福利 / 机制规则源"
            if source["adapter"] == "image_article":
                result["message"] = f"已取得公开页（发现 {len(parser.images)} 个图片引用）；图片规则需 OCR / 人工核验，纯文字不能算完整检查"
        return result
    except (OSError, ValueError, urllib.error.URLError) as exc:
        message = str(exc)
        if isinstance(exc, urllib.error.HTTPError):
            message = f"HTTP {exc.code}；页面不可用或受访问限制"
        result["coverage"] = coverage("blocked" if isinstance(exc, urllib.error.HTTPError) and exc.code in (401, 403, 412, 429) else "failed", message, "not_checked", "请求失败，不代表规则没有更新")
        return {**result, "status": "failed", "message": message[:400] + "；保留已保存内容，不视为无更新"}
    except Exception as exc:
        result["coverage"] = coverage("failed", f"解析器错误：{type(exc).__name__}", "not_checked", "解析失败，不代表规则没有更新")
        return {**result, "status": "failed", "message": f"解析器错误 {type(exc).__name__}：{str(exc)[:200]}；保留已保存内容"}

def update_once(store, run_id=None, cancel=None, fetcher=fetch, progress=None, source_ids=None):
    run_id, cancel = run_id or uuid.uuid4().hex, cancel or threading.Event()
    with collection_guard(store):
        from .digest import capture_before, finalize_digest
        before=capture_before(store)
        candidate_before={item['id'] for item in store.candidates()}
        with _robot_lock:
            _robot_cache.clear()
        store.start_run(run_id)
        selected = [source for source in store.source_config if source_ids is None or source["id"] in source_ids]
        results = []
        try:
            def check(source):
                attempted = utcnow()
                result = collect_source(store, source, run_id, cancel, fetcher)
                store.record_attempt(run_id, source, result, attempted)
                return result
            with concurrent.futures.ThreadPoolExecutor(max_workers=4, thread_name_prefix="single-check") as pool:
                futures = {pool.submit(check, source): source for source in selected}
                for future in concurrent.futures.as_completed(futures):
                    result = future.result()
                    results.append(result)
                    if progress:
                        progress(result, len(results), len(selected))
            archived = store.archive_expired()
            counts = {state: sum(row["status"] == state and not row.get('cancelled') for row in results) for state in ("success_zero", "success", "partial", "failed", "pending")}
            dimensions = {name:{state:sum(row["coverage"][name]["state"] == state for row in results) for state in sorted({row["coverage"][name]["state"] for row in results})} for name in ("article", "rules", "account")}
            summary = {"run_id": run_id, "sources": len(selected), "processed_sources": sum(bool(row.get('processed')) for row in results), "cancelled_sources": sum(bool(row.get('cancelled')) for row in results), "counts": counts, "dimensions": dimensions, "new": sum(row["new"] for row in results), "changed": sum(row["changed"] for row in results), "archived": archived, "results": results}
            summary['discovery']={name:sum(row.get('coverage',{}).get('discovery',{}).get('state')==name for row in results) for name in ('success','success_zero','partial_list')}
            summary['digest']=finalize_digest(store,run_id,before)
            new_candidates=[item for item in store.candidates() if item['id'] not in candidate_before]
            summary['digest']['counts']['candidate_new']=len(new_candidates)
            for item in new_candidates:
                summary['digest']['events'].append({'category':'candidate_new','item_id':None,'candidate_id':item['id'],'title':item['title'],'source_id':item['source_id'],'official_url':item['official_url'],'at':item['first_seen_at'],'changes':[],'time_source':'官方列表发现；开放与规则待核','evidence_urls':[item['evidence']['list_url']]})
            store.finish_run(run_id, summary, "cancelled" if cancel.is_set() else "finished")
            return summary
        except BaseException:
            cancel.set()
            store.finish_run(run_id, {"error": "检查中断，未完成的信源不视为无更新", "results": results}, "interrupted")
            raise

class UpdateManager:
    def __init__(self, store, runner=update_once):
        self.store, self.runner = store, runner
        self.lock, self.cancel = threading.Lock(), threading.Event()
        self.thread, self.last_finished, self.state = None, 0, {"running": False, "completed": 0, "total": 0}
    def progress(self, result, completed, total):
        with self.lock:
            self.state.update(completed=completed, total=total, last_source=result["source_id"])
    def start(self):
        with self.lock:
            if self.state["running"]:
                return dict(self.state), False
            if time.monotonic() - self.last_finished < self.store.rules["update_click_cooldown_seconds"]:
                return {**self.state, "cooldown": True}, False
            run_id = uuid.uuid4().hex
            self.cancel.clear()
            self.state = {"running": True, "run_id": run_id, "completed": 0, "total": len(self.store.source_config)}
            self.thread = threading.Thread(target=self._run, args=(run_id,), name="on-demand-update")
            self.thread.start()
            return dict(self.state), True
    def _run(self, run_id):
        try:
            summary = self.runner(self.store, run_id=run_id, cancel=self.cancel, progress=self.progress)
            extra = {"summary": summary}
        except Exception as exc:
            extra = {"error": str(exc)}
        with self.lock:
            self.state.update(running=False, **extra)
            self.last_finished = time.monotonic()
    def status(self):
        with self.lock:
            return dict(self.state)
    def stop(self):
        self.cancel.set()
        if self.thread:
            self.thread.join()
