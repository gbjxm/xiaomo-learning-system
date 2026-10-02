"""Offline hostile/partial pagination tests; no real database or network writes."""
import copy
import hashlib
import json
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

from helpers import ScopedTemp
from opportunities import collect
from opportunities.discovery import next_list_page
from opportunities.storage import Store

ROOT = Path(__file__).resolve().parents[1]


class PaginationTests(unittest.TestCase):
    def setUp(self):
        self.temp = ScopedTemp(ROOT / 'output', 'test-stage2-pagination-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'config').mkdir()
        self.rules = json.loads((ROOT / 'config/rules.json').read_text(encoding='utf-8'))
        self.source = {
            'id':'bjiff_ai_list','name':'SYNTHETIC bounded list','platform':'SYNTHETIC',
            'url':'https://official.test/list/','allowed_hosts':['official.test'],
            'adapter':'official_list','respect_robots':True,'scope':'SYNTHETIC maximum three pages','note':'SYNTHETIC',
            'discovery':{'path_prefixes':['/events/'],'path_suffix':'.html','minimum_entries':1,
                         'max_candidates':8,'opportunity_words':['报名'],'creative_words':['AI'],'exclude_title':[],
                         'pagination':{'mode':'next_link','max_pages':3,'path_prefixes':['/list/']}},
        }
        self.calls = []
        guard = patch('urllib.request.OpenerDirector.open', side_effect=AssertionError('Live network is forbidden'))
        guard.start(); self.addCleanup(guard.stop)

    def store(self):
        (self.root / 'config/rules.json').write_text(json.dumps(self.rules),encoding='utf-8')
        (self.root / 'config/sources.json').write_text(json.dumps([self.source]),encoding='utf-8')
        return Store(self.root,seed=False)

    def listing(self, index, next_url=None, title=None, extra=''):
        title = title or f'2026 AI第{index}期报名'
        anchor = f'<a class="next" href="{next_url}">下一页</a>' if next_url else ''
        return (f'<html><title>SYNTHETIC list</title><div class="listbox"><ul><li>'
                f'<a href="/events/{index}.html"><span class="txt">{title}</span></a>'
                f'<span class="date">2026-09-{index:02d}</span></li></ul></div>{anchor}{extra}</html>')

    @staticmethod
    def article():
        return '<title>SYNTHETIC article</title><p>'+('AI创作公开报名说明，具体资格奖励版权仍待核。'*12)+'</p>'

    def fetcher(self, mapping, callback=None):
        def fetch(url, source, rules):
            self.calls.append(url)
            if callback:
                callback(url)
            value = mapping[url]
            if isinstance(value, Exception):
                raise value
            return value, hashlib.sha256(value.encode()).hexdigest()
        return fetch

    def mapping(self, count, keep_next=False):
        result = {}
        for index in range(1,count+1):
            url = self.source['url'] if index == 1 else f'https://official.test/list/{index}.html'
            next_url = f'/list/{index+1}.html' if index < count or keep_next else None
            result[url] = self.listing(index,next_url)
            result[f'https://official.test/events/{index}.html'] = self.article()
        return result

    def run_pages(self, store, mapping, cancel=None, callback=None):
        return collect.update_once(store,fetcher=self.fetcher(mapping,callback),cancel=cancel)['results'][0]

    def test_two_real_links_stop_without_guessing_a_third(self):
        store = self.store(); row = self.run_pages(store,self.mapping(2)); d = row['coverage']['discovery']
        self.assertEqual((d['scan_pages'],d['scanned'],d['new_candidates']),(2,2,2))
        self.assertEqual((d['stop_reason'],d['state']),('no_next_link','success'))
        self.assertEqual(d['date_range'],{'oldest':'2026-09-01','newest':'2026-09-02'})
        self.assertEqual(len(self.calls),4)

    def test_limit_with_an_unread_next_page_is_partial(self):
        row = self.run_pages(self.store(),self.mapping(3,keep_next=True)); d = row['coverage']['discovery']
        self.assertEqual((d['scan_pages'],d['stop_reason'],d['state']),(3,'page_limit','partial_list'))
        self.assertTrue(d['remaining_pages'])
        self.assertNotIn('https://official.test/list/4.html',self.calls)
        self.assertNotIn('成功零新增',row['message'])

    def test_failure_later_preserves_that_pages_previous_snapshot(self):
        store = self.store(); mapping=self.mapping(2); self.run_pages(store,mapping)
        with store.connection() as conn:
            before=[tuple(r) for r in conn.execute('SELECT text_hash,body FROM observations WHERE url=?',('https://official.test/list/2.html',))]
        mapping['https://official.test/list/2.html']=OSError('SYNTHETIC timeout')
        row=self.run_pages(store,mapping);d=row['coverage']['discovery']
        self.assertEqual((d['scan_pages'],d['list_failures'],d['stop_reason']),(1,1,'page_failed'))
        self.assertEqual(d['state'],'partial_list')
        self.assertEqual(d['list_failure_details'][0]['url'],'https://official.test/list/2.html')
        with store.connection() as conn:
            after=[tuple(r) for r in conn.execute('SELECT text_hash,body FROM observations WHERE url=?',('https://official.test/list/2.html',))]
        self.assertEqual(before,after)
        self.assertEqual(d['previous_scan']['scan_pages'],2)

    def test_first_page_failure_preserves_all_old_list_values_and_is_not_zero(self):
        store=self.store(); self.run_pages(store,self.mapping(2))
        with store.connection() as conn:
            before=[tuple(r) for r in conn.execute('SELECT url,text_hash,body FROM observations ORDER BY id')]
        row=self.run_pages(store,{self.source['url']:OSError('SYNTHETIC first failure')})
        self.assertEqual((row['status'],row['coverage']['discovery']['state']),('failed','failed'))
        self.assertEqual(row['coverage']['discovery']['previous_scan']['scan_pages'],2)
        with store.connection() as conn:
            after=[tuple(r) for r in conn.execute('SELECT url,text_hash,body FROM observations ORDER BY id')]
        self.assertEqual(before,after)

    def test_repeated_url_is_never_requested_twice(self):
        mapping=self.mapping(1);mapping[self.source['url']]=self.listing(1,self.source['url'])
        row=self.run_pages(self.store(),mapping)
        self.assertEqual(row['coverage']['discovery']['stop_reason'],'repeated_page')
        self.assertEqual(self.calls.count(self.source['url']),1)

    def test_repeated_content_does_not_increase_scanned_coverage(self):
        mapping=self.mapping(2);mapping['https://official.test/list/2.html']=mapping[self.source['url']]
        row=self.run_pages(self.store(),mapping);d=row['coverage']['discovery']
        self.assertEqual((d['scan_pages'],d['scanned'],d['stop_reason']),(1,1,'repeated_page'))
        self.assertEqual(d['per_page'][1]['status'],'failed')

    def test_untrusted_targets_are_not_requested(self):
        for target in ['https://evil.test/list/2.html','http://official.test/list/2.html',
                       'https://127.0.0.1/list/2.html','file:///etc/passwd',
                       'https://name:secret@official.test/list/2.html',
                       '/list/%2e%2e/private','/list/%5cprivate']:
            with self.subTest(target=target):
                self.calls.clear();source=copy.deepcopy(self.source)
                raw=self.listing(1,target)
                store=self.store();row=self.run_pages(store,{self.source['url']:raw,'https://official.test/events/1.html':self.article()})
                self.assertIn(row['coverage']['discovery']['stop_reason'],('unsafe_next_link','pagination_structure_changed'))
                self.assertNotIn(target,self.calls)

    def test_disabled_javascript_terminal_link_is_not_executed(self):
        mapping=self.mapping(1);mapping[self.source['url']]=self.listing(1,'javascript:void(0);')
        row=self.run_pages(self.store(),mapping)
        self.assertEqual(row['coverage']['discovery']['stop_reason'],'no_next_link')
        self.assertEqual(len(self.calls),2)

    def test_conflicting_next_links_stop_before_either_request(self):
        mapping=self.mapping(1);mapping[self.source['url']]=self.listing(1,'/list/2.html',extra='<a class="next" href="/list/3.html">下一页</a>')
        row=self.run_pages(self.store(),mapping)
        self.assertEqual(row['coverage']['discovery']['stop_reason'],'pagination_structure_changed')
        self.assertEqual(len(self.calls),2)

    def test_declared_remaining_pages_without_next_link_are_partial(self):
        mapping=self.mapping(1);mapping[self.source['url']]=self.listing(1,extra='<em class="curr_page">1</em><em class="all_pages">2</em>')
        row=self.run_pages(self.store(),mapping)
        self.assertEqual(row['coverage']['discovery']['stop_reason'],'pagination_structure_changed')
        self.assertEqual(row['coverage']['discovery']['state'],'partial_list')

    def test_bjiff_literal_constants_are_read_without_script_execution(self):
        source=copy.deepcopy(self.source);source['discovery']['pagination']['mode']='bjiff_static'
        raw='function createPageNumNav(){var _nCurrPage = 0+1;var _sFileName="index";var _sFileExt="html";var _nPageCount=2; alert("never execute");}'
        url,stop,declared=next_list_page(raw,source,self.source['url'],1)
        self.assertEqual(url,'https://official.test/list/index_1.html')
        self.assertIsNone(stop);self.assertEqual(declared['page_count_reported'],2)
        url,stop,_=next_list_page(raw.replace('0+1','1+1'),source,url,2)
        self.assertIsNone(url);self.assertEqual(stop,'official_last_page')

    def test_bjiff_changed_script_structure_is_not_evaluated_or_guessed(self):
        source=copy.deepcopy(self.source);source['discovery']['pagination']['mode']='bjiff_static'
        with self.assertRaises(ValueError):next_list_page('function createPageNumNav(){eval("unsafe");}',source,self.source['url'],1)

    def test_candidate_keeps_actual_second_page_url_and_hash(self):
        store=self.store();mapping=self.mapping(2);self.run_pages(store,mapping)
        candidate=next(r for r in store.candidates() if r['official_url'].endswith('/2.html'))
        self.assertEqual(candidate['evidence']['list_url'],'https://official.test/list/2.html')
        self.assertEqual(candidate['evidence']['list_root_url'],self.source['url'])
        self.assertEqual(candidate['evidence']['list_raw_hash'],hashlib.sha256(mapping['https://official.test/list/2.html'].encode()).hexdigest())

    def test_cancel_after_first_response_skips_next_and_articles(self):
        event=threading.Event();row=self.run_pages(self.store(),self.mapping(2),event,lambda _:event.set())
        d=row['coverage']['discovery']
        self.assertEqual((d['scan_pages'],d['processed'],d['stop_reason']),(1,0,'cancelled'))
        self.assertEqual(len(self.calls),1)

    def test_different_round_titles_at_same_url_are_not_coalesced(self):
        store=self.store();mapping=self.mapping(2)
        mapping['https://official.test/list/2.html']=mapping['https://official.test/list/2.html'].replace('/events/2.html','/events/1.html')
        self.run_pages(store,mapping)
        self.assertEqual(len(store.candidates()),2)
        self.assertEqual({r['edition'] for r in store.candidates()},{'2026 / 第1期','2026 / 第2期'})

    def test_invalid_later_list_does_not_replace_saved_content(self):
        store=self.store();mapping=self.mapping(2);self.run_pages(store,mapping)
        with store.connection() as conn:before=conn.execute('SELECT COUNT(*) FROM observations WHERE url=?',('https://official.test/list/2.html',)).fetchone()[0]
        mapping['https://official.test/list/2.html']='<title>Unexpected structure</title><p>No verified cards</p>'
        row=self.run_pages(store,mapping)
        self.assertEqual(row['coverage']['discovery']['stop_reason'],'invalid_list')
        with store.connection() as conn:after=conn.execute('SELECT COUNT(*) FROM observations WHERE url=?',('https://official.test/list/2.html',)).fetchone()[0]
        self.assertEqual(before,after)


if __name__ == '__main__':
    unittest.main()
