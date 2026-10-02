"""Bounded discovery from configured official HTML lists; candidates stay unverified."""
from __future__ import annotations
import hashlib
import re
from datetime import date as calendar_date
from html.parser import HTMLParser
from urllib.parse import unquote, urljoin, urlsplit
from .model import canonical_url, json_text, utcnow
from .articles import challenge_reason, coverage, VOID

class ListElement:
    def __init__(self, tag, attrs=None, parent=None):
        self.tag, self.attrs, self.parent = tag, attrs or {}, parent
        self.children = []
    def has_class(self, name):
        return name in self.attrs.get('class', '').split()
    def descendants(self):
        pending = list(reversed(self.children))
        while pending:
            element = pending.pop()
            if isinstance(element, ListElement):
                yield element
                pending.extend(reversed(element.children))
    def text(self):
        parts, pending = [], list(reversed(self.children))
        while pending:
            element = pending.pop()
            if isinstance(element, str):
                parts.append(element)
            elif element.tag not in ('script', 'style', 'noscript', 'svg'):
                pending.extend(reversed(element.children))
        return re.sub(r'\s+', ' ', ' '.join(parts)).strip()
    def ancestor_class(self, name):
        element = self.parent
        while element is not None:
            if element.has_class(name):
                return True
            element = element.parent
        return False

class ScopedList(HTMLParser):
    """Read fixed public card containers without executing page scripts."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = ListElement('root')
        self.stack = [self.root]
    def handle_starttag(self, tag, attrs):
        element = ListElement(tag, dict(attrs), self.stack[-1])
        self.stack[-1].children.append(element)
        if tag not in VOID:
            self.stack.append(element)
    def handle_startendtag(self, tag, attrs):
        self.stack[-1].children.append(ListElement(tag, dict(attrs), self.stack[-1]))
    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                break
    def handle_data(self, data):
        self.stack[-1].children.append(data)

def scoped_links(raw, source_id, diagnostics=None):
    parser = ScopedList();parser.feed(raw)
    links = []
    diagnostics = diagnostics if diagnostics is not None else {}
    diagnostics.update(listed_cards=0, unparsed_cards=0)
    def first(element, tag=None, class_name=None):
        return next((node for node in element.descendants() if (tag is None or node.tag == tag) and (class_name is None or node.has_class(class_name))), None)
    def append(anchor, title, date):
        diagnostics['listed_cards'] += 1
        if anchor is None or not anchor.attrs.get('href') or not title or not date:
            diagnostics['unparsed_cards'] += 1
            return
        match = re.fullmatch(r'(20\d{2})-?(\d{2})-?(\d{2})', date)
        if match:
            publication = '-'.join(match.groups())
            try:
                calendar_date.fromisoformat(publication)
            except ValueError:
                diagnostics['unparsed_cards'] += 1
                return
            links.append({'url':anchor.attrs['href'], 'title':title[:600], 'listed_publication_at':publication})
        else:
            diagnostics['unparsed_cards'] += 1
    for node in parser.root.descendants():
        if source_id == 'bjiff_ai_list' and node.tag == 'li' and node.ancestor_class('listbox'):
            anchor = first(node, 'a');title = first(node, 'span', 'txt');date = first(node, 'span', 'date')
            append(anchor, title.text() if title else '', date.text() if date else '')
        elif source_id == 'xm_calls_list' and node.tag == 'li' and node.ancestor_class('m18') and node.ancestor_class('fl') and node.ancestor_class('b') and not node.ancestor_class('fr'):
            # The verified .fl > .m18 > .b list excludes right-column sidebars.
            anchor = next((child for child in node.children if isinstance(child, ListElement) and child.tag == 'a'), None)
            date = next((child for child in node.children if isinstance(child, ListElement) and child.tag == 'span'), None)
            append(anchor, anchor.text() if anchor else '', date.text() if date else '')
        elif source_id == 'cuc_news_list' and node.tag == 'li' and node.has_class('news') and node.ancestor_class('news_list'):
            anchor = first(node, 'a', 'news_title');date = first(node, 'div', 'news_meta')
            append(anchor, anchor.text() if anchor else '', date.text() if date else '')
        elif source_id == 'first_featured_list' and node.tag == 'div' and node.has_class('idx1-box-inner'):
            title = first(node, 'div', 'idx1-box_tit');date = first(node, 'div', 'idx1-box_date')
            anchor = first(title, 'a') if title else None
            append(anchor, anchor.text() if anchor else '', date.text() if date else '')
        elif source_id == 'minimax_blog_list' and node.tag == 'a' and first(node, 'section'):
            title = first(node, 'h3');date = re.search(r'\b20\d{2}-\d{2}-\d{2}\b', node.text())
            append(node, title.text() if title else '', date[0] if date else '')
    return links

class ListLinks(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links, self.anchor, self.skip = [], None, []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ('script','style','noscript','svg'):
            self.skip.append(tag)
        if tag == 'a' and not self.skip and attrs.get('href'):
            self.anchor = {'href':attrs['href'],'parts':[],'title':attrs.get('title','')}
    def handle_data(self, data):
        if self.anchor is not None and not self.skip:
            self.anchor['parts'].append(data)
    def handle_endtag(self, tag):
        if tag == 'a' and self.anchor is not None:
            text = re.sub(r'\s+',' ',' '.join(self.anchor['parts'])).strip()
            title = self.anchor['title'].strip() or text
            self.links.append({'url':self.anchor['href'],'title':title[:600]})
            self.anchor = None
        if self.skip and tag == self.skip[-1]:
            self.skip.pop()

def list_entries(raw, source, diagnostics=None):
    scoped_ids = {'bjiff_ai_list', 'xm_calls_list', 'cuc_news_list', 'first_featured_list', 'minimax_blog_list'}
    if source['id'] in scoped_ids:
        links = scoped_links(raw, source['id'], diagnostics)
    else:
        parser = ListLinks();parser.feed(raw);links = parser.links
    config = source['discovery']
    entries = {}
    for link in links:
        try:
            joined = urljoin(source['url'],link['url'])
            parts = urlsplit(joined)
            # CUC's official news cards still publish legacy HTTP links. Upgrade
            # only this known host, with no credentials or nondefault port.
            if source['id'] == 'cuc_news_list' and parts.scheme == 'http' and parts.hostname == 'www.cuc.edu.cn' and not parts.username and not parts.password and parts.port in (None, 80):
                joined = 'https://www.cuc.edu.cn'+parts.path+('?' + parts.query if parts.query else '')
            url = canonical_url(joined)
        except (ValueError,TypeError):
            continue
        parts = urlsplit(url)
        if parts.hostname not in source['allowed_hosts'] or not any(parts.path.startswith(prefix) for prefix in config['path_prefixes']) or not parts.path.endswith(config.get('path_suffix','')) or not link['title']:
            continue
        entry = {'official_url':url,'title':link['title']}
        if link.get('listed_publication_at'):
            entry['listed_publication_at'] = link['listed_publication_at']
        # A reused URL is not sufficient evidence for the same round. Keep
        # different listed titles for the conservative identity check below.
        entries.setdefault((url, link['title']),entry)
    return list(entries.values())

def relevant(entry, source):
    title = entry['title'].casefold();config = source['discovery']
    if any(word.casefold() in title for word in config.get('exclude_title', [])):
        return False
    if not any(word.casefold() in title for word in config['opportunity_words']):
        return False
    creative = config.get('creative_words', [])
    return not creative or any(word.casefold() in title for word in creative)

def round_tokens(title):
    return re.findall(r'第[\d一二三四五六七八九十百]+[届期季轮]|\d{1,2}月|20\d{2}[-/]\d{1,2}', title)

def candidate_identity(source_id, url, title):
    year = re.search(r'20\d{2}',title)
    rounds = round_tokens(title)
    # Unknown rounds remain separate. Same annual URL is never proof of the same edition.
    edition = (year[0] if year else '年度未核')+' / '+(' '.join(rounds) if rounds else '轮次待核-'+hashlib.sha256(title.encode()).hexdigest()[:10])
    return hashlib.sha256(json_text([source_id,url,edition]).encode()).hexdigest()[:24],edition

def existing_item(store, url, title):
    year = re.search(r'20\d{2}',title)
    rounds = set(round_tokens(title))
    if not year or not rounds:
        return None
    # URL/year alone cannot establish that a recurring call is the old edition.
    matches = [item for item in store.items() if canonical_url(item['official_url']) == url
               and re.search(r'20\d{2}', item['edition']) is not None
               and re.search(r'20\d{2}', item['edition'])[0] == year[0]
               and set(round_tokens(item['edition'] + ' ' + item['title'])) == rounds]
    return matches[0]['id'] if len(matches) == 1 else None

def publication_range(entries):
    dates = sorted(entry['listed_publication_at'] for entry in entries if entry.get('listed_publication_at'))
    return {'oldest': dates[0] if dates else None, 'newest': dates[-1] if dates else None}


def checked_page_url(value, source, current_url):
    """Registered HTTPS list paths only; fetch also checks DNS/robots/redirects."""
    target = canonical_url(urljoin(current_url, value))
    parts = urlsplit(target)
    decoded = unquote(parts.path)
    prefixes = source['discovery']['pagination']['path_prefixes']
    if (parts.hostname not in source['allowed_hosts'] or '\\' in decoded
            or any(part in ('.', '..') for part in decoded.split('/'))
            or not any(parts.path.startswith(prefix) for prefix in prefixes)):
        raise ValueError('下一页不属于已登记的官方列表路径；已停止，未请求该地址')
    return target


def next_list_page(raw, source, current_url, index):
    """Read verified literal variables/links without executing site scripts."""
    config = source['discovery'].get('pagination')
    if not config:
        return None, 'single_page_scope', {}
    if config['mode'] == 'bjiff_static':
        match = re.search(
            r'function\s+createPageNumNav\s*\(\s*\)\s*\{\s*'
            r'var\s+_nCurrPage\s*=\s*(\d+)\s*\+\s*1\s*;\s*'
            r'var\s+_sFileName\s*=\s*[\'"]index[\'"]\s*;\s*'
            r'var\s+_sFileExt\s*=\s*[\'"]html[\'"]\s*;\s*'
            r'var\s+_nPageCount\s*=\s*(\d+)\s*;', raw)
        if not match:
            raise ValueError('北影节已验证的分页常量结构发生变化；未猜测下一页')
        current, count = int(match[1]) + 1, int(match[2])
        if current != index or not 1 <= current <= count <= 10000:
            raise ValueError('官方分页页码与当前请求不一致；已停止')
        declared = {'page_count_reported': count, 'current_page_reported': current}
        if current == count:
            return None, 'official_last_page', declared
        return checked_page_url('index_' + str(current) + '.html', source, current_url), None, declared
    if config['mode'] != 'next_link':
        raise ValueError('未适配的分页方式；未猜测下一页')
    parser = ScopedList(); parser.feed(raw)
    anchors = [node for node in parser.root.descendants() if node.tag == 'a' and node.has_class('next')]
    values = []
    for anchor in anchors:
        value = anchor.attrs.get('href', '').strip()
        # Disabled terminal links are never fetched or executed.
        if value.lower() in ('', '#', 'javascript:void(0)', 'javascript:void(0);'):
            continue
        values.append(checked_page_url(value, source, current_url))
    values = list(dict.fromkeys(values))
    if len(values) > 1:
        raise ValueError('页面含相互冲突的下一页地址；已停止，待人工核查')
    declared = {}
    for node in parser.root.descendants():
        if node.tag == 'em' and node.has_class('all_pages') and node.text().isdigit():
            count = int(node.text())
            if 1 <= count <= 10000:
                declared['page_count_reported'] = count
        elif node.tag == 'em' and node.has_class('curr_page') and node.text().isdigit():
            declared['current_page_reported'] = int(node.text())
    if declared.get('current_page_reported') not in (None, index):
        raise ValueError('官方分页页码与当前请求不一致；已停止')
    if not values:
        if declared.get('page_count_reported', index) > index:
            raise ValueError('官方显示仍有后续页，但未取得可靠下一页链接；已停止')
        return None, 'no_next_link', declared
    if declared.get('page_count_reported') == index:
        raise ValueError('官方末页与下一页链接冲突；已停止')
    return values[0], None, declared


def collect_list(store, source, run_id, cancel, fetcher, parse_page):
    config = source['discovery']
    pagination = config.get('pagination')
    page_limit = min(pagination.get('max_pages', 3), 5) if pagination else 1
    if type(page_limit) is not int or page_limit < 1:
        raise ValueError('分页上限必须为1至5的整数')
    base = {'source_id':source['id'],'status':'partial','message':'','new':0,'changed':0,'pages':0,'processed':True,'coverage':coverage('partial_text','公开列表已取得；候选原文另核','partial','未将线索自动写为正式记录')}
    entries, entry_keys, signatures, visited, per_page, list_failures = [], set(), set(), set(), [], []
    diagnostics = {'listed_cards':0, 'unparsed_cards':0}
    scan_started = utcnow()
    current_url, stop_reason, remaining_pages = source['url'], None, False
    text_chars, duplicate_entries, declared_count = 0, 0, None
    previous_scan = None
    if hasattr(store, 'sources'):
        previous = next((row for row in store.sources() if row['id'] == source['id']), None)
        previous_discovery = (previous or {}).get('coverage', {}).get('discovery', {}) if (previous or {}).get('coverage') else {}
        if previous_discovery.get('scan_pages'):
            previous_scan = {key:previous_discovery.get(key) for key in ('scan_started_at','scan_finished_at','scan_pages','date_range','stop_reason','scope')}
        elif previous_discovery.get('previous_scan'):
            previous_scan = previous_discovery['previous_scan']
    while current_url:
        index = len(per_page) + 1
        if cancel.is_set() and index == 1:
            return {**base, 'status':'pending', 'processed':False, 'cancelled':True, 'message':'用户停止了当前检查；该来源尚未请求，不能视为无更新'}
        if cancel.is_set():
            stop_reason, remaining_pages = 'cancelled', True
            break
        if current_url in visited:
            stop_reason, remaining_pages = 'repeated_page', True
            break
        visited.add(current_url)
        item = {'url':current_url, 'page':index, 'status':'failed', 'entries':0}
        try:
            raw, raw_hash = fetcher(current_url, source, store.rules)
            page = parse_page(raw)
            if challenge_reason(raw, page.title, page.text):
                raise ValueError('官方列表返回访问验证，已停止该源，未绕过')
            page_diagnostics = {}
            page_entries = list_entries(raw, {**source, 'url':current_url}, page_diagnostics)
            item.update(raw_hash=raw_hash, entries=len(page_entries), date_range=publication_range(page_entries), **page_diagnostics)
            if len(page_entries) < config.get('minimum_entries', 1):
                stop_reason = 'invalid_list'
                raise ValueError('列表结构未达到已验证的条目形态，不能判断零新增；保留旧列表快照')
            signature = hashlib.sha256(json_text([(entry['official_url'],entry['title'],entry.get('listed_publication_at')) for entry in page_entries]).encode()).hexdigest()
            if signature in signatures:
                stop_reason = 'repeated_page'
                raise ValueError('下一页重复已取得的列表内容；未把重复页面当作更多覆盖')
            signatures.add(signature)
            item['status'] = 'success'
            per_page.append(item)
            base['pages'] += 1
            text_chars += len(page.text)
            for key in diagnostics:
                diagnostics[key] += page_diagnostics.get(key, 0)
            for entry in page_entries:
                key = (entry['official_url'], entry['title'])
                if key in entry_keys:
                    duplicate_entries += 1
                    continue
                entry_keys.add(key)
                entries.append({**entry,'list_page_url':current_url,'list_raw_hash':raw_hash})
            list_text = '\n'.join(entry['official_url']+'\t'+entry['title']+('\t'+entry['listed_publication_at'] if entry.get('listed_publication_at') else '') for entry in page_entries)
            store.observe(source['id'], current_url, list_text, raw_hash, run_id, 'official_list')
            if cancel.is_set():
                stop_reason, remaining_pages = 'cancelled', True
                break
            try:
                next_url, page_stop, declared = next_list_page(raw, source, current_url, index)
                item.update(declared)
                declared_count = declared.get('page_count_reported', declared_count)
            except ValueError as exc:
                stop_reason, remaining_pages = ('unsafe_next_link' if '路径' in str(exc) or 'HTTPS' in str(exc) else 'pagination_structure_changed'), True
                item['pagination_error'] = str(exc)[:300]
                break
            if not next_url:
                stop_reason = page_stop
                break
            if next_url in visited:
                stop_reason, remaining_pages = 'repeated_page', True
                break
            if len(per_page) >= page_limit:
                stop_reason, remaining_pages = 'page_limit', True
                break
            current_url = next_url
        except (OSError, ValueError) as exc:
            item['error'] = str(exc)[:400]
            per_page.append(item)
            list_failures.append({'url':current_url,'page':index,'error':item['error']})
            stop_reason, remaining_pages = stop_reason or 'page_failed', True
            break
    scan_pages = sum(row['status'] == 'success' for row in per_page)
    scan = {'scan_pages':scan_pages,'page_limit':page_limit,'scan_started_at':scan_started,'scan_finished_at':utcnow(),'date_range':publication_range(entries),'stop_reason':stop_reason or 'cancelled','per_page':per_page,'remaining_pages':remaining_pages,'list_failures':len(list_failures),'list_failure_details':list_failures,'duplicate_entries':duplicate_entries,'page_count_reported':declared_count}
    if previous_scan:
        scan['previous_scan'] = previous_scan
    if not scan_pages:
        base['status'] = 'failed' if list_failures else 'partial'
        base['coverage']['article'].update(state='failed' if list_failures else 'not_checked', note='未取得可靠列表；保留原有已保存证据')
        base['coverage']['discovery'] = {'state':'failed' if list_failures else 'partial_list','scanned':0,'selected':0,'accepted':0,'processed':0,'new_candidates':0,'article_failures':0,'article_failure_details':[],'scope':source['scope'],**diagnostics,**scan}
        base['message'] = (list_failures[0]['error'] if list_failures else '本次检查已停止')+'；不能作为零新增；旧列表与原文保留。'
        return base
    matched = [entry for entry in entries if relevant(entry,source)]
    limit = min(source['discovery'].get('max_candidates',8),store.rules['max_items_per_source'])
    selected = matched[:limit];new_count=0;article_failures=0;known_count=0;processed_count=0;identity_changes=0;round_ambiguities=0
    article_failure_details=[]
    previous_candidates=store.candidates()
    previous_by_id={item['id']:item for item in previous_candidates}
    observed=utcnow()
    for entry in selected:
        if cancel.is_set():
            break
        processed_count += 1
        identifier,edition = candidate_identity(source['id'],entry['official_url'],entry['title'])
        known = existing_item(store,entry['official_url'],entry['title'])
        previous=previous_by_id.get(identifier)
        related=[item['id'] for item in previous_candidates if item['official_url']==entry['official_url'] and item['id']!=identifier]
        evidence={'list_url':entry['list_page_url'],'list_root_url':source['url'],'listed_title':entry['title'],'observed_at':observed,'list_raw_hash':entry['list_raw_hash'],'method':'official_public_html_list','article_state':'not_checked','note':'列表发现不等于开放；公告日期、资格、奖励与版权需逐项核验'}
        evidence['identity_state']='explicit_round' if round_tokens(entry['title']) else 'ambiguous_round'
        evidence['identity_note']='仅列表标题提供明确轮次；规则与开放状态另核' if evidence['identity_state']=='explicit_round' else '标题未明确轮次；保留候选ID，不能用同年URL证明同一期'
        if related:
            evidence['related_candidate_ids']=related
            evidence['related_candidates_note']='同URL线索可能来自其他信源或标题变更；仅关联待核，不自动合并人工审阅状态'
        if entry.get('listed_publication_at'):
            evidence['listed_publication_at'] = entry['listed_publication_at']
        body=''
        try:
            article_raw,article_hash = fetcher(entry['official_url'],source,store.rules)
            article=parse_page(article_raw)
            if challenge_reason(article_raw, article.title, article.text):
                raise ValueError('官方正文返回访问限制；未继续尝试')
            body=article.text[:120000];base['pages']+=1
            evidence.update(article_state='partial_text' if len(body)>80 else 'no_text',article_raw_hash=article_hash,article_text_chars=len(body),article_links=[urljoin(entry['official_url'],link) for link in article.links if link.startswith(('https://','/'))][:30])
            if len(body)<=80:
                article_failures+=1
                evidence['article_error']='未取得足够可读正文；不视为完成候选原文检查'
                article_failure_details.append({'candidate_id':identifier,'official_url':entry['official_url'],'title':entry['title'],'error':evidence['article_error']})
            store.observe(source['id'],entry['official_url'],body or '未取得可读正文',article_hash,run_id,'partial')
        except (OSError,ValueError) as error:
            article_failures+=1;evidence.update(article_state='failed',article_error=str(error)[:300])
            article_failure_details.append({'candidate_id':identifier,'official_url':entry['official_url'],'title':entry['title'],'error':evidence['article_error']})
        title_rounds=set(re.findall(r'第[\d一二三四五六七八九十百]+[届期季轮]',entry['title']))
        body_rounds=set(re.findall(r'第[\d一二三四五六七八九十百]+[届期季轮]',body))
        round_conflict=bool(title_rounds and body_rounds and not body_rounds.issubset(title_rounds))
        changed_evidence=bool(previous and ((body and previous.get('body') and body != previous['body']) or (entry.get('listed_publication_at') and previous['evidence'].get('listed_publication_at') and entry['listed_publication_at']!=previous['evidence']['listed_publication_at'])))
        if round_conflict or changed_evidence:
            evidence['identity_state']='ambiguous_update'
            evidence['identity_note']='标题与正文轮次不一致，或同URL同标题的正文/发布时间发生变化；可能为新轮次，保留原ID及人工状态，需人工确认'
            evidence['identity_ambiguity_reasons']=(['标题与正文包含不同轮次'] if round_conflict else [])+(['同候选正文或发布时间发生变化'] if changed_evidence else [])
            identity_changes += 1
            known=None
        if evidence['identity_state']!='explicit_round':
            round_ambiguities += 1
        known_count += bool(known)
        new_count+=store.save_candidate({**entry,'id':identifier,'source_id':source['id'],'edition':edition,'evidence':evidence,'body':body,'known_item_id':known})
    complete=len(matched)<=limit and not cancel.is_set() and not article_failures and not identity_changes and not diagnostics.get('unparsed_cards') and not remaining_pages and not list_failures
    base['coverage']['article'].update(state='partial_text',text_chars=text_chars)
    scan['scan_finished_at'] = utcnow()
    base['coverage']['discovery']={'state':'success' if complete and new_count else 'success_zero' if complete else 'partial_list','scanned':len(entries),'selected':len(selected),'matched':len(matched),'accepted':processed_count,'processed':processed_count,'new_candidates':new_count,'known_items':known_count,'article_failures':article_failures,'article_failure_details':article_failure_details,'identity_changes_pending':identity_changes,'round_ambiguities':round_ambiguities,'scope':source['scope'],'limit':limit,**diagnostics,**scan}
    stop_labels={'official_last_page':'官方末页','no_next_link':'未显示下一页','single_page_scope':'仅配置首屏','page_limit':'达到本次页数上限，仍有后续页','page_failed':'后续列表读取失败','invalid_list':'列表结构不可靠','cancelled':'用户取消','repeated_page':'下一页重复','unsafe_next_link':'下一页地址不安全','pagination_structure_changed':'分页结构变化待核'}
    scope_label = '本页' if not pagination else f'本次已扫描的{scan_pages}页范围'
    base['message']=f"{scope_label}解析 {len(entries)} 个公告；筛出 {len(selected)} 条，实际处理 {processed_count} 条，新增线索 {new_count}，已有条目 {known_count}，正文失败 {article_failures}。停止原因：{stop_labels.get(scan['stop_reason'],scan['stop_reason'])}。"+('该扫描范围发现检查成功零新增。' if complete and not new_count else '')+('未完成页、未解析条目、正文失败、轮次变更待核、处理上限或取消均不能视为无更新。' if not complete else '')+'候选保持待核，不计为已核开放机会。'
    return base
