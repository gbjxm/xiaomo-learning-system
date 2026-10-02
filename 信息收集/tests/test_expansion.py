import copy
import json
import unittest
from datetime import datetime,timezone
from pathlib import Path
from unittest.mock import patch
from email.message import Message
from helpers import ScopedTemp
from opportunities.articles import extract_article
from opportunities.collect import fetch,parse_page
from opportunities.model import decorate,empty_document,normalize,official_datetime,temporal_status
from opportunities.storage import Store

ROOT=Path(__file__).resolve().parents[1]
UTC=timezone.utc

class ExpansionTimeTests(unittest.TestCase):
    def test_twenty_four_means_next_midnight_and_retains_uncertain_timezone(self):
        self.assertEqual(official_datetime('2026-10-05 24:00'),'2026-10-06T00:00:00')
        with self.assertRaises(ValueError):official_datetime('2026-10-05 24:30')
        d=empty_document('libtv','AI征集','LibTV','https://www.liblib.tv/activity/991','2026')
        d['time'].update(confirmed=True,mechanism='fixed',start='2026-09-14',deadline=official_datetime('2026-10-05 24:00'))
        self.assertEqual(temporal_status(d,datetime(2026,10,5,6,tzinfo=UTC))['code'],'window')
        self.assertEqual(temporal_status(d,datetime(2026,10,5,12,tzinfo=UTC))['code'],'uncertain')
        self.assertEqual(temporal_status(d,datetime(2026,10,6,13,tzinfo=UTC))['code'],'closed')

    def test_month_precision_does_not_invent_days_or_archive_after_months(self):
        d=empty_document('libtv','成长机制','LibTV','https://www.liblib.tv/activity/991','2026','creator_program')
        d['time'].update(confirmed=True,mechanism='fixed',month_period={'start':'2026-07','end':'2026-12'})
        d=normalize(d)
        self.assertIsNone(d['time']['start']);self.assertIsNone(d['time']['deadline'])
        self.assertEqual(temporal_status(d,datetime(2026,9,30,tzinfo=UTC))['code'],'window')
        self.assertEqual(temporal_status(d,datetime(2027,1,2,tzinfo=UTC))['code'],'uncertain')

    def test_tentative_and_conflicting_official_dates_never_become_closed_or_open(self):
        d=empty_document('libtv','暂定活动','LibTV','https://www.liblib.tv/activity/992','2026')
        d['time'].update(confirmed=True,mechanism='fixed',start='2026-07-24',deadline='2026-10-31',deadline_tentative=True)
        self.assertEqual(temporal_status(d,datetime(2026,11,5,tzinfo=UTC))['code'],'uncertain')
        d['time'].update(deadline_tentative=False,deadline='2028-06-29',conflict='日期和Not Started矛盾')
        self.assertEqual(temporal_status(d,datetime(2026,9,30,tzinfo=UTC))['code'],'uncertain')

    def test_urgency_uses_confirmed_window_and_does_not_promote_unknown_deadline(self):
        docs=json.loads((ROOT/'config/reviewed_expansion_20260930.json').read_text(encoding='utf-8'))['documents']
        rules=json.loads((ROOT/'config/rules.json').read_text(encoding='utf-8')); now=datetime(2026,9,30,tzinfo=UTC)
        jinji=next(d for d in docs if d['source_id']=='jinji_ai_2026')
        seko=next(d for d in docs if d['source_id']=='smg_seko_2026')
        self.assertEqual(decorate(jinji,rules,now)['deadline_urgency'],'公告7天内截止 · 开放待核')
        self.assertIsNone(decorate(seko,rules,now)['deadline_urgency'])

class ExpansionPersistenceTests(unittest.TestCase):
    def setUp(self):
        self.temp=ScopedTemp(ROOT/'output','test-expansion-'); self.store=Store(ROOT,Path(self.temp.name)/'db.sqlite3',seed=False)
    def tearDown(self):self.temp.cleanup()

    def test_batch_is_idempotent_and_live_refresh_preserves_hand_fields_and_preferences(self):
        docs=json.loads((ROOT/'config/reviewed_expansion_20260930.json').read_text(encoding='utf-8'))['documents']
        for d in docs:self.assertEqual(self.store.upsert(d),'new')
        target=normalize(next(d for d in docs if d['source_id']=='jimeng_growth' and d['kind']=='limited_benefit'))
        self.store.preference(target['id'],True,'我写的资格核对笔记')
        for d in docs:self.assertEqual(self.store.upsert(d),'unchanged')
        incoming=copy.deepcopy(target);incoming.update(origin='live_fetch',rewards=[],risks=[],relations=[],summary='抓到外壳不覆盖人工证据')
        self.assertEqual(self.store.upsert(incoming),'unchanged')
        item=Store(ROOT,self.store.db_path,seed=False).details(target['id'])
        self.assertTrue(item['starred']);self.assertEqual(item['note'],'我写的资格核对笔记')
        self.assertEqual(item['version'],1);self.assertEqual(item['rewards'],target['rewards']);self.assertEqual(item['relations'],target['relations'])
        self.assertEqual(len(self.store.items()),len(docs))

    def test_parent_child_links_are_bidirectional_without_inherited_deadline_or_rewards(self):
        p=empty_document('libtv','母计划','LibTV','https://www.liblib.tv/activity/991','2026母计划','creator_program')
        p=normalize(p); c=empty_document('libtv','独立子期','LibTV',p['official_url'],'2026子期','limited_benefit')
        c['relations']=[{'type':'under_program','target_id':p['id']}]
        c['time'].update(confirmed=True,mechanism='fixed',start='2026-01-01',deadline='2026-03-31');c=normalize(c)
        self.store.upsert(p);self.store.upsert(c)
        self.assertEqual(self.store.details(p['id'])['related_items'][0]['direction'],'child')
        self.assertEqual(self.store.details(c['id'])['related_items'][0]['direction'],'parent')
        self.assertIsNone(self.store.details(p['id'])['time']['deadline'])
        self.assertEqual(self.store.details(p['id'])['rewards'],[])
        next_round=copy.deepcopy(c);next_round['edition']='2027子期';next_round=normalize(next_round)
        self.assertNotEqual(c['id'],next_round['id']);self.assertEqual(self.store.upsert(next_round),'new')

    def test_self_relation_rejected_and_tentative_item_not_archived(self):
        d=normalize(empty_document('libtv','暂定','LibTV','https://www.liblib.tv/activity/992','2026'))
        d['relations']=[{'type':'under_program','target_id':d['id']}]
        with self.assertRaises(ValueError):normalize(d)
        d.pop('relations');d['time'].update(confirmed=True,deadline='2026-01-01',deadline_tentative=True)
        self.store.upsert(d);self.store.archive_expired(datetime(2026,9,30,tzinfo=UTC))
        self.assertIsNone(self.store.items()[0]['archived_at'])

class ExpansionParserTests(unittest.TestCase):
    def test_streamed_public_body_requires_closed_container_and_exact_mapping(self):
        raw='<main>加载</main><div hidden id="S:0"><p>Vidu 创作者计划</p><p>长期成长，新锐与艺术家权益</p></div><script>$RC("B:0","S:0");exfiltrate()</script>'
        s={'id':'vidu_artist','url':'https://www.vidu.com/zh/artist-program'}
        p,complete,_=extract_article(s,raw,parse_page(raw),parse_page)
        self.assertTrue(complete);self.assertNotIn('exfiltrate',p.text)
        self.assertFalse(extract_article(s,raw.replace('"B:0"','"B:2"'),parse_page(raw),parse_page)[1])

    def test_official_announcement_container_excludes_sidebar_and_injected_script(self):
        raw='<div class="br2">旁栏福利并非本公告</div><div class="br2"><p>申报标准</p><p>AI画面至少50%。</p><script>sendSecret()</script><p>注意事项</p><p>版权归创作方。</p></div><footer>其他活动</footer>'
        s={'id':'jinji_ai_2026','url':'https://www.xmwenlian.com/home/article/detail/id/7928.html'}
        page,complete,_=extract_article(s,raw,parse_page(raw),parse_page)
        self.assertTrue(complete);self.assertNotIn('旁栏',page.text);self.assertNotIn('sendSecret',page.text)
        self.assertFalse(extract_article(s,raw+raw,parse_page(raw+raw),parse_page)[1])

    def test_chinese_official_url_is_encoded_once_without_changing_saved_identity(self):
        class Response:
            def __init__(self):self.headers=Message();self.headers['Content-Type']='text/html; charset=utf-8'
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def read(self,*args):return b'<p>ok</p>'
        class Opener:
            def open(self,request,**kwargs):self.url=request.full_url;return Response()
        opener=Opener();s={'allowed_hosts':['www.minimax.cn']};url='https://www.minimax.cn/news/海螺/%E5%A5%96'
        with patch('opportunities.collect.validate_network_url'),patch('opportunities.collect.urllib.request.build_opener',return_value=opener):
            fetch(url,s,{'request_timeout_seconds':1,'max_response_bytes':1000})
        self.assertIn('%E6%B5%B7%E8%9E%BA',opener.url);self.assertIn('/%E5%A5%96',opener.url)
        self.assertNotIn('%25E5',opener.url)
