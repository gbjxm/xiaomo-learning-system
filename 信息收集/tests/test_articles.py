import json
import sqlite3
import threading
import unittest
from contextlib import closing
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from helpers import ScopedTemp
from opportunities.articles import bili_article, public_fields, xingtu_article
from opportunities.collect import candidate, collect_source, parse_page, section
from opportunities.storage import SCHEMA, Store

ROOT = Path(__file__).resolve().parents[1]

class ArticleTests(unittest.TestCase):
    def test_xingtu_article_omits_navigation_and_preserves_complete_text(self):
        raw = '<nav>导航中的收益门槛不可用</nav><article class="article-content"><p>' + '公开正文内容。' * 20 + '</p><a href="https://www.xingtu.cn/help-center/author/2">官方相关说明</a><img src="/rule.png"></article><footer>页尾无关</footer>'
        page, complete, _ = xingtu_article(raw, parse_page)
        self.assertTrue(complete)
        self.assertNotIn('导航', page.text)
        self.assertNotIn('页尾', page.text)
        self.assertEqual(page.images, ['/rule.png'])
        self.assertEqual(len(page.links), 1)

    def test_unclosed_or_multiple_articles_cannot_claim_complete(self):
        body = '<article class="article-content">' + '正文' * 60
        self.assertFalse(xingtu_article(body, parse_page)[1])
        self.assertFalse(xingtu_article((body + '</article>') * 2, parse_page)[1])

    def test_bili_strict_json_extracts_text_without_running_scripts(self):
        content = '<p>公告结算内容。' + '明确适用范围。' * 20 + '</p><script>raiseSensitive()</script>'
        config = {'table-rich-text': [{'htmlObj': {'dangerHtml': content}}], 'BaseInfo': {}}
        parser = parse_page('<script>window.__initialState = ' + json.dumps(config).replace('</', '<\\/') + '; raiseSensitive();</script>')
        page, complete, _ = bili_article(parser, parse_page)
        self.assertTrue(complete)
        self.assertIn('公告结算', page.text)
        self.assertNotIn('raiseSensitive', page.text)
        parser = parse_page('<script>window.__initialState = (function(){return {};})()</script>')
        self.assertIsNone(bili_article(parser, parse_page)[0])

    def test_unknown_bili_component_keeps_article_partial(self):
        config = {'table-rich-text': [{'htmlObj': {'dangerHtml': '<p>' + '公告' * 60 + '</p>'}}], 'unread-image-module': [{'url': 'rule.png'}]}
        page, complete, _ = bili_article(parse_page('<script>window.__initialState = ' + json.dumps(config) + '</script>'), parse_page)
        self.assertTrue(page.text)
        self.assertFalse(complete)

    def test_intro_does_not_import_commercial_threshold_into_partner_rules(self):
        rules = public_fields('douyin_partner_intro', '中视频伙伴计划会升级为全新的创作者伙伴计划。\n商单报价最低1000，月结。')
        self.assertEqual(set(rules['fields']), {'伙伴计划升级'})
        self.assertNotIn('1000', json.dumps(rules['fields']))
        self.assertEqual(rules['state'], 'partial')

    def test_markdown_inline_labels_do_not_truncate_submission_steps(self):
        text = '### 投稿方式\n**投稿递交**：LibTV与抖音双端\n**社媒要求**：指定话题\n## 奖励机制\n奖励另计'
        excerpt = section(text, ['投稿方式'])
        self.assertTrue(any('双端' in line for line in excerpt))
        self.assertTrue(any('指定话题' in line for line in excerpt))
        self.assertFalse(any('奖励另计' in line for line in excerpt))

    def test_reference_to_requirements_in_intro_is_not_the_requirements_section(self):
        text = '### 更多详情请查看作品要求章节\n无关导语\n### ⚠️ 作品要求\n作品不少于2分钟\n### 投稿方式\n双端投稿'
        excerpt = section(text, ['作品要求'])
        self.assertTrue(any('不少于2分钟' in line for line in excerpt))
        self.assertFalse(any('无关导语' in line for line in excerpt))

    def test_libtv_extracts_reward_body_but_does_not_claim_external_rules_complete(self):
        source = {'id': 'libtv', 'platform': 'LibTV', 'url': 'https://www.liblib.tv/activity'}
        rules = json.loads((ROOT/'config/rules.json').read_text(encoding='utf-8'))
        meta = {'activityId': 998, 'name': 'AI电影大赛', 'rewardDescription': '大奖等你来', 'description': '## 作品要求\n至少90秒\n## 如何参赛\n上传作品\n## 活动奖励\n现金奖金5万元，另有积分\n## 活动详情\nhttps://resonate.feishu.cn/wiki/example\n![](https://example.com/rule.png)'}
        doc, complete = candidate(source, meta, rules)
        self.assertEqual({reward['type'] for reward in doc['rewards']}, {'cash', 'credits'})
        self.assertTrue(all(reward['amount'] is None for reward in doc['rewards']))
        self.assertTrue(doc['steps'])
        self.assertFalse(complete)
        self.assertTrue(doc['evidence'][0]['external_rules'])

class DimensionStorageTests(unittest.TestCase):
    def setUp(self):
        self.temp = ScopedTemp(ROOT/'output', 'test-dimensions-')
        self.path = Path(self.temp.name)/'library.sqlite3'
        self.store = Store(ROOT, self.path)

    def tearDown(self):
        self.temp.cleanup()

    def test_complete_public_article_remains_separate_from_rules_and_account(self):
        source = next(s for s in self.store.source_config if s['id'] == 'douyin_selected')
        body = '由抖音发起的长期优质创作倡议，明确文本说明。' + '其余产品说明。' * 20
        raw = '<title>官方说明</title><article class="article-content"><p>' + body + '</p></article>'
        result = collect_source(self.store, source, 'run', threading.Event(), lambda *args: (raw, 'hash'))
        self.assertEqual(result['coverage']['article']['state'], 'text_complete')
        self.assertEqual(result['coverage']['rules']['state'], 'partial')
        self.assertEqual(result['coverage']['account']['state'], 'not_checked')
        self.assertEqual(result['status'], 'partial')
        self.store.record_attempt('run', source, result, '2026-09-30')
        current = next(s for s in self.store.sources() if s['id'] == source['id'])
        self.assertTrue(current['last_article_success_at'])
        self.assertIsNone(current['last_success_at'])
        original = next(item for item in self.store.items() if item['source_id'] == source['id'])
        self.assertEqual(original['origin'], 'manual_handoff')
        self.assertEqual(original['version'], 1)
        self.assertEqual(original['verified_at'], '2026-09-30')

    def test_verification_page_stops_after_one_request_and_preserves_prior_article_success(self):
        source = next(s for s in self.store.source_config if s['id'] == 'bili_incentive')
        self.store.record_attempt('earlier', source, {'status': 'partial', 'message': 'text', 'coverage': {'article': {'state': 'text_complete'}}}, '2026-09-29')
        previous = next(s for s in self.store.sources() if s['id'] == source['id'])['last_article_success_at']
        calls = []
        def fetcher(*args):
            calls.append(args[0]); return '<title>验证码_哔哩哔哩</title>', 'hash'
        result = collect_source(self.store, source, 'new', threading.Event(), fetcher)
        self.assertEqual(len(calls), 1)
        self.assertEqual(result['status'], 'failed')
        self.assertEqual(result['coverage']['article']['state'], 'blocked')
        self.store.record_attempt('new', source, result, '2026-09-30')
        self.assertEqual(next(s for s in self.store.sources() if s['id'] == source['id'])['last_article_success_at'], previous)

    def test_old_schema_migration_preserves_all_rows_and_is_repeatable(self):
        legacy = Path(self.temp.name)/'legacy.sqlite3'
        with closing(sqlite3.connect(legacy)) as conn:
            with conn:
                conn.executescript(SCHEMA)
                conn.execute("INSERT INTO settings VALUES('seeds_imported','1')")
                conn.execute("INSERT INTO sources(id,config,status,message) VALUES('saved', '{}', 'failed', 'keep')")
                conn.execute('PRAGMA user_version=1')
        first = Store(ROOT, legacy, seed=False)
        second = Store(ROOT, legacy, seed=False)
        with second.connection() as conn:
            self.assertEqual(conn.execute("SELECT message FROM sources WHERE id='saved'").fetchone()[0], 'keep')
            self.assertEqual(conn.execute('PRAGMA user_version').fetchone()[0], 3)
            self.assertIn('coverage', {row[1] for row in conn.execute('PRAGMA table_info(observations)')})

    def test_concurrent_old_database_startup_migrates_once(self):
        legacy = Path(self.temp.name)/'concurrent.sqlite3'
        with closing(sqlite3.connect(legacy)) as conn:
            conn.executescript(SCHEMA)
        ready = threading.Barrier(2)
        def start():
            ready.wait(3)
            return Store(ROOT,legacy,seed=False)
        with ThreadPoolExecutor(max_workers=2) as pool:
            stores=list(pool.map(lambda _:start(),range(2)))
        self.assertEqual(len(stores),2)
        with stores[0].connection() as conn:
            self.assertEqual(conn.execute('PRAGMA user_version').fetchone()[0],3)

if __name__ == '__main__':
    unittest.main()
