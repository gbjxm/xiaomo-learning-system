"""Offline regressions for official-source network and rule boundaries.

All HTTP responses, redirects and DNS answers are local fakes. No application
database or live official site is used by these tests.
"""
import copy
import hashlib
import json
import threading
import unittest
from email.message import Message
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch
from urllib.error import HTTPError

from opportunities import collect
from opportunities.discovery import candidate_identity, existing_item, list_entries
from opportunities.model import empty_document
from opportunities.storage import Store
from helpers import ScopedTemp


class FakeHTTPResponse:
    def __init__(self, body, content_type="text/html", status=200):
        self.body = body.encode("utf-8")
        self.status = status
        self.url = None
        self.headers = Message()
        self.headers["Content-Type"] = content_type + "; charset=utf-8"

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self, limit):
        return self.body[:limit]

    def geturl(self):
        return self.url

    def getcode(self):
        return self.status


class FakeHTTPRedirectOpener:
    """Exercise the real redirect callback without connecting a socket."""

    def __init__(self, handler, routes, calls):
        self.handler, self.routes, self.calls = handler, routes, calls

    def open(self, request, **kwargs):
        for _ in range(5):
            url = request.full_url
            self.calls.append(url)
            route = self.routes[url]
            if isinstance(route, Exception):
                raise route
            if isinstance(route, tuple) and route[0] == "redirect":
                request = self.handler.redirect_request(
                    request, None, 302, "Found", Message(), route[1]
                )
                continue
            route.url = url
            return route
        raise AssertionError("Fake redirect chain exceeded the test limit")


class AdversarialNetworkTests(unittest.TestCase):
    def setUp(self):
        self.rules = {
            "request_timeout_seconds": 1,
            "max_response_bytes": 10000,
            "max_items_per_source": 30,
            "keywords": ["AI", "影视", "创作者"],
        }
        self.source = {
            "id": "libtv",
            "platform": "LibTV",
            "url": "https://www.liblib.tv/public",
            "allowed_hosts": ["www.liblib.tv", "liblib.tv"],
            "respect_robots": True,
        }
        self.robots_url = "https://www.liblib.tv/robots.txt"
        with collect._robot_lock:
            collect._robot_cache.clear()
        self.addCleanup(self.clear_robot_cache)
        self.calls, self.routes = [], {}
        for patcher in (
            patch("socket.create_connection", side_effect=AssertionError("Actual network access is forbidden")),
            patch("urllib.request.urlopen", side_effect=AssertionError("Actual network access is forbidden")),
            patch("opportunities.collect.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("93.184.216.34", 443))]),
            patch("opportunities.collect.urllib.request.getproxies", return_value={}),
            patch("opportunities.collect.urllib.request.proxy_bypass", return_value=True),
            patch("opportunities.collect.urllib.request.build_opener", side_effect=self.make_opener),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)

    def clear_robot_cache(self):
        with collect._robot_lock:
            collect._robot_cache.clear()

    def make_opener(self, *handlers):
        handler = next(h for h in handlers if isinstance(h, collect.RestrictedRedirect))
        return FakeHTTPRedirectOpener(handler, self.routes, self.calls)

    def test_redirect_rechecks_same_host_disallowed_path(self):
        target = "https://www.liblib.tv/restricted"
        self.routes.update({
            self.robots_url: FakeHTTPResponse("User-agent: *\nDisallow: /restricted\n", "text/plain"),
            self.source["url"]: ("redirect", target),
            target: FakeHTTPResponse("This content must never be requested"),
        })
        with self.assertRaises(ValueError):
            collect.fetch(self.source["url"], self.source, self.rules)
        self.assertEqual(self.calls, [self.robots_url, self.source["url"]])
        self.assertNotIn(target, self.calls)

    def test_redirect_checks_registered_alias_robots_before_content(self):
        target = "https://liblib.tv/restricted"
        target_robots = "https://liblib.tv/robots.txt"
        self.routes.update({
            self.robots_url: FakeHTTPResponse("User-agent: *\nAllow: /\n", "text/plain"),
            self.source["url"]: ("redirect", target),
            target_robots: FakeHTTPResponse("User-agent: *\nDisallow: /\n", "text/plain"),
            target: FakeHTTPResponse("This content must never be requested"),
        })
        with self.assertRaises(ValueError):
            collect.fetch(self.source["url"], self.source, self.rules)
        self.assertEqual(self.calls, [self.robots_url, self.source["url"], target_robots])
        self.assertNotIn(target, self.calls)

    def test_robots_html_verification_fragment_fails_closed(self):
        fragment = (
            "<title>Just a moment...</title><main>Checking your browser. "
            "Please enable JavaScript and cookies to continue.</main>"
        )
        self.routes.update({
            self.robots_url: FakeHTTPResponse(fragment, "text/html"),
            self.source["url"]: FakeHTTPResponse("Content must not be requested"),
        })
        with self.assertRaises(ValueError):
            collect.fetch(self.source["url"], self.source, self.rules)
        self.assertEqual(self.calls, [self.robots_url])

    def test_empty_text_plain_robots_allows_content(self):
        self.routes.update({
            self.robots_url: FakeHTTPResponse("", "text/plain"),
            self.source["url"]: FakeHTTPResponse("<p>Public content</p>"),
        })
        raw, _ = collect.fetch(self.source["url"], self.source, self.rules)
        self.assertEqual(raw, "<p>Public content</p>")
        self.assertEqual(self.calls, [self.robots_url, self.source["url"]])

    def test_robots_404_allows_content(self):
        self.routes.update({
            self.robots_url: HTTPError(self.robots_url, 404, "Not Found", Message(), None),
            self.source["url"]: FakeHTTPResponse("<p>Public content</p>"),
        })
        raw, _ = collect.fetch(self.source["url"], self.source, self.rules)
        self.assertEqual(raw, "<p>Public content</p>")
        self.assertEqual(self.calls, [self.robots_url, self.source["url"]])

    def article_source(self):
        return {
            "id": "douyin_selected",
            "platform": "抖音",
            "url": "https://www.xingtu.cn/help-center/author/rules",
            "allowed_hosts": ["www.xingtu.cn"],
            "adapter": "article",
            "note": "公开规则",
            "respect_robots": True,
        }

    def collect_article(self, raw):
        source = self.article_source()
        self.routes.update({
            "https://www.xingtu.cn/robots.txt": FakeHTTPResponse("User-agent: *\nAllow: /\n", "text/plain"),
            source["url"]: FakeHTTPResponse(raw),
        })
        store = SimpleNamespace(rules=self.rules, observe=Mock(return_value=False))
        result = collect.collect_source(store, source, "offline-regression", threading.Event())
        return store, result

    def test_long_http200_challenge_does_not_save_article_observation(self):
        raw = (
            '<title>官方页面</title><article class="article-content"><p>'
            "安全验证，请先完成 captcha 验证后继续。"
            + "该请求尚未通过浏览器校验。" * 40
            + "</p></article>"
        )
        store, result = self.collect_article(raw)
        self.assertEqual(result["status"], "failed")
        self.assertNotEqual(result["coverage"]["article"]["state"], "text_complete")
        store.observe.assert_not_called()

    def test_normal_article_mentioning_security_code_is_not_a_challenge(self):
        text = (
            "AI影视创作者计划公开征集公告。"
            "报名时平台可能发送安全验证码；请勿向他人透露验证码。"
            + "作品应符合原创要求，活动权益和规则需按官方公告核对。" * 25
        )
        raw = '<title>官方征集公告</title><article class="article-content"><p>' + text + "</p></article>"
        store, result = self.collect_article(raw)
        self.assertEqual(result["status"], "partial")
        self.assertEqual(result["coverage"]["article"]["state"], "text_complete")
        store.observe.assert_called_once()
        self.assertIn(text, store.observe.call_args.args[2])

    def test_non_feishu_authoritative_rules_link_keeps_libtv_partial(self):
        rule_url = "https://rules.other-official.example/terms"
        description = (
            "AI影视大赛\n征集时间：2026-10-01 至 2026-10-31\n"
            "## 参赛对象\n面向个人AI影视创作者。\n"
            "## 作品要求\n提交原创短片。"
            + "详细规格须遵守公开征集要求。" * 35
            + "\n## 投稿方式\n在平台提交作品。\n"
            "## 活动奖励\n现金奖金10000元。\n"
            "## 版权\n作者保留著作权并授权非商业展映。\n"
            "## 完整规则\n完整规则以 " + rule_url + " 为准，报名须遵守该处补充条款。"
        )
        meta = {
            "activityId": 998,
            "name": "AI影视大赛",
            "description": description,
            "rewardDescription": "现金奖金10000元",
        }
        document, complete = collect.candidate(self.source, meta, self.rules)
        self.assertFalse(complete)
        self.assertEqual(document["verification"], "partial")
        self.assertIsNone(document["verified_at"])
        self.assertIn(rule_url, document["evidence"][0]["external_rules"])
        self.assertEqual(self.calls, [])

    def test_relative_rule_link_is_unchecked_dependency(self):
        description = ('AI影视征集\n征集时间：2026-10-01 至 2026-10-31\n'
                       '## 参赛对象\n个人创作者\n## 作品要求\n原创短片\n'
                       '## 投稿方式\n平台提交\n## 活动奖励\n现金奖金\n'
                       '## 版权\n非排他授权\n## 完整规则\n[完整规则](/terms)\n') + '详细作品规则待核。' * 50
        document, complete = collect.candidate(self.source, {'activityId': 999, 'name': 'AI影视征集', 'description': description}, self.rules)
        self.assertFalse(complete)
        self.assertIn('https://www.liblib.tv/terms', document['evidence'][0]['external_rules'])


ROOT = Path(__file__).resolve().parents[1]


class AdversarialDiscoveryTests(unittest.TestCase):
    """SYNTHETIC reserved .test lists; isolated SQLite and fakefetch only."""

    def setUp(self):
        self.temp = ScopedTemp(ROOT / 'output', 'test-adversarial-discovery-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'config').mkdir()
        self.rules = json.loads((ROOT / 'config/rules.json').read_text(encoding='utf-8'))
        self.source = {
            'id': 'synthetic_list', 'name': 'SYNTHETIC official list', 'platform': 'SYNTHETIC',
            'url': 'https://official.test/list', 'allowed_hosts': ['official.test'],
            'adapter': 'official_list', 'respect_robots': True,
            'scope': 'SYNTHETIC first-page-only fixture', 'note': 'No live access',
            'discovery': {'path_prefixes': ['/events/'], 'path_suffix': '.html',
                          'minimum_entries': 1, 'max_candidates': 8,
                          'opportunity_words': ['报名', '征集'], 'creative_words': ['AI'], 'exclude_title': []},
        }
        self.url = 'https://official.test/events/0.html'
        network_guard = patch('urllib.request.OpenerDirector.open', side_effect=AssertionError('Live network forbidden'))
        network_guard.start()
        self.addCleanup(network_guard.stop)

    def make_store(self, sources=None):
        (self.root / 'config/rules.json').write_text(json.dumps(self.rules), encoding='utf-8')
        (self.root / 'config/sources.json').write_text(json.dumps(sources or [self.source]), encoding='utf-8')
        return Store(self.root, seed=False)

    @staticmethod
    def listing(title, date=None):
        if date is None:
            return '<html><title>SYNTHETIC list</title><a href="/events/0.html">' + title + '</a></html>'
        return '<html><div class="listbox"><ul><li><a href="/events/0.html"><span class="txt">' + title + '</span><span class="date">' + date + '</span></a></li></ul></div></html>'

    @staticmethod
    def article(text='SYNTHETIC AI征集正文，未核完整规则。'):
        return '<html><title>SYNTHETIC article</title><p>' + text * 8 + '</p></html>'

    @staticmethod
    def fakefetch(mapping, calls=None, callback=None):
        def fetch(url, source, rules):
            if calls is not None:
                calls.append(url)
            if callback:
                callback(url, source)
            value = mapping[url]
            if isinstance(value, Exception):
                raise value
            return value, hashlib.sha256(value.encode()).hexdigest()
        return fetch

    def run_list(self, store, listing, body=None):
        return collect.update_once(store, fetcher=self.fakefetch({self.source['url']: listing, self.url: body or self.article()}))

    def test_same_year_different_round_is_not_linked_to_old_item(self):
        store = self.make_store()
        old = empty_document(self.source['id'], '2026 AI第1期报名', 'SYNTHETIC', self.url, '2026 / 第1期')
        store.upsert(old, 'SYNTHETIC previous edition')
        result = self.run_list(store, self.listing('2026 AI第2期报名'))
        candidate = store.candidates()[0]
        self.assertIsNone(candidate['known_item_id'])
        self.assertEqual(candidate['review_state'], 'pending')
        self.assertEqual(candidate['edition'], '2026 / 第2期')
        self.assertEqual(result['results'][0]['coverage']['discovery']['known_items'], 0)

    def test_matching_explicit_round_can_link_and_unknown_round_cannot(self):
        store = self.make_store()
        old = empty_document(self.source['id'], '2026 AI第1期报名', 'SYNTHETIC', self.url, '2026 / 第1期')
        store.upsert(old)
        self.assertEqual(existing_item(store, self.url, '2026 AI第1期征集'), store.items()[0]['id'])
        self.assertIsNone(existing_item(store, self.url, '2026 AI征集'))

    def test_title_body_round_conflict_does_not_link_known_item(self):
        store = self.make_store()
        store.upsert(empty_document(self.source['id'], '2026 AI第1期报名', 'SYNTHETIC', self.url, '2026 / 第1期'))
        result = self.run_list(store, self.listing('2026 AI第1期报名'), self.article('SYNTHETIC 第2期报名，新截止规则。'))
        candidate = store.candidates()[0]
        self.assertIsNone(candidate['known_item_id'])
        self.assertEqual(candidate['evidence']['identity_state'], 'ambiguous_update')
        self.assertEqual(result['results'][0]['coverage']['discovery']['state'], 'partial_list')

    def test_reused_url_body_and_publication_change_flags_ambiguity_preserves_id_review(self):
        self.source['id'] = 'bjiff_ai_list'
        store = self.make_store()
        title = '2026 AI创作者扶持计划报名'
        self.run_list(store, self.listing(title, '2026-04-01'), self.article('SYNTHETIC 第一期报名。'))
        first = store.candidates()[0]
        store.candidate_review(first['id'], 'dismissed')
        second = self.run_list(store, self.listing(title, '2026-08-01'), self.article('SYNTHETIC 第二期报名，新规则。'))
        candidates = store.candidates()
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0]['id'], first['id'])
        self.assertEqual(candidates[0]['review_state'], 'dismissed')
        self.assertEqual(candidates[0]['evidence']['identity_state'], 'ambiguous_update')
        coverage = second['results'][0]['coverage']['discovery']
        self.assertEqual(coverage['state'], 'partial_list')
        self.assertEqual(coverage['identity_changes_pending'], 1)
        with store.connection() as conn:
            self.assertEqual(conn.execute('SELECT COUNT(*) FROM observations WHERE url=?', (self.url,)).fetchone()[0], 2)

    def test_legacy_identity_algorithm_remains_stable(self):
        identifier, edition = candidate_identity('xm_calls_list', 'https://www.xmwenlian.com/home/article/detail/id/7928.html', '2026金鸡AI影展（暨AIGC未来影像）作品征集公告')
        # A fixed ID from the saved, genuinely fetched candidate is the contract.
        self.assertEqual((identifier, edition), ('623c9b9b74d5551e9af650a6', '2026 / 轮次待核-a99756b643'))

    def test_unknown_title_change_retains_separate_ids_with_related_evidence(self):
        store = self.make_store()
        self.run_list(store, self.listing('AI创作者扶持计划报名开启'))
        self.run_list(store, self.listing('AI创作者扶持计划报名开始'))
        candidates = store.candidates()
        self.assertEqual(len(candidates), 2)
        related = [row for row in candidates if row['evidence'].get('related_candidate_ids')]
        self.assertEqual(len(related), 1)
        self.assertEqual(related[0]['evidence']['identity_state'], 'ambiguous_round')

    def test_cross_source_duplicates_keep_provenance_and_add_relation_on_later_check(self):
        other = copy.deepcopy(self.source)
        other['id'], other['url'] = 'synthetic_other', 'https://official.test/list-other'
        store = self.make_store([self.source, other])
        listing = self.listing('2026 AI第1期报名')
        fetcher = self.fakefetch({self.source['url']: listing, other['url']: listing, self.url: self.article()})
        collect.update_once(store, source_ids=[self.source['id']], fetcher=fetcher)
        collect.update_once(store, source_ids=[other['id']], fetcher=fetcher)
        candidates = store.candidates()
        self.assertEqual(len(candidates), 2)
        self.assertEqual({row['source_id'] for row in candidates}, {self.source['id'], other['id']})
        self.assertTrue(any(row['evidence'].get('related_candidate_ids') for row in candidates))

    def test_article_failure_is_partial_not_success_zero_and_has_details(self):
        store = self.make_store()
        listing = self.listing('2026 AI第1期报名')
        self.run_list(store, listing)
        result = collect.update_once(store, fetcher=self.fakefetch({self.source['url']: listing, self.url: OSError('SYNTHETIC timeout')}))
        cov = result['results'][0]['coverage']['discovery']
        self.assertEqual(cov['state'], 'partial_list')
        self.assertEqual(cov['article_failures'], 1)
        self.assertEqual(cov['article_failure_details'][0]['official_url'], self.url)
        self.assertEqual(cov['article_failure_details'][0]['candidate_id'], store.candidates()[0]['id'])
        self.assertNotIn('成功零新增', result['results'][0]['message'])
        self.assertTrue(store.candidates()[0]['body'])

    def test_no_text_article_is_incomplete_not_zero(self):
        store = self.make_store()
        result = self.run_list(store, self.listing('2026 AI第1期报名'), '<html><title>Empty</title></html>')
        cov = result['results'][0]['coverage']['discovery']
        self.assertEqual(cov['state'], 'partial_list')
        self.assertEqual(cov['article_failures'], 1)

    def test_partially_unparsed_scoped_cards_and_invalid_date_do_not_claim_complete(self):
        self.source['id'] = 'first_featured_list'
        store = self.make_store()
        def card(index, date):
            return f'<div class="idx1-box-inner"><div class="idx1-box_tit"><a href="/events/{index}.html">2026 AI报名</a></div><div class="idx1-box_date">{date}</div></div>'
        raw = card(0, '20260813') + card(1, '2026/08/14') + card(2, '20269999')
        result = self.run_list(store, raw)
        cov = result['results'][0]['coverage']['discovery']
        self.assertEqual(cov['state'], 'partial_list')
        self.assertEqual((cov['listed_cards'], cov['unparsed_cards'], cov['scanned']), (3, 2, 1))
        self.assertEqual(store.candidates()[0]['evidence']['listed_publication_at'], '2026-08-13')

    def test_cancel_skips_unstarted_sources_and_reports_processed_candidates(self):
        sources = []
        for index in range(6):
            src = copy.deepcopy(self.source)
            src['id'], src['url'] = 'synthetic_cancel_' + str(index), 'https://official.test/list-' + str(index)
            sources.append(src)
        store = self.make_store(sources)
        event, calls = threading.Event(), []
        mapping = {src['url']: self.listing('2026 AI第1期报名') for src in sources}
        result = collect.update_once(store, cancel=event, fetcher=self.fakefetch(mapping, calls, lambda *args: event.set()))
        self.assertEqual(len(calls), 1)
        self.assertEqual((result['processed_sources'], result['cancelled_sources']), (1, 5))
        self.assertEqual(result['counts']['failed'], 0)
        processed = next(row for row in result['results'] if row.get('processed'))
        cov = processed['coverage']['discovery']
        self.assertEqual((cov['selected'], cov['accepted'], cov['processed']), (1, 0, 0))
        with store.connection() as conn:
            self.assertEqual(conn.execute('SELECT status FROM runs WHERE id=?', (result['run_id'],)).fetchone()[0], 'cancelled')

    def test_zero_candidates_is_qualified_by_first_page_scope(self):
        store = self.make_store()
        result = self.run_list(store, self.listing('2026 AI研究成果发布'))
        row = result['results'][0]
        self.assertEqual(row['coverage']['discovery']['state'], 'success_zero')
        self.assertEqual(row['coverage']['discovery']['scope'], self.source['scope'])
        self.assertIn('本页', row['message'])


if __name__ == "__main__":
    unittest.main()
