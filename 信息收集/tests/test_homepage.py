import copy
import json
import unittest
from datetime import datetime, timezone
from pathlib import Path
from opportunities.model import decorate, empty_document, normalize, temporal_status, time_bounds
from opportunities.storage import Store
from helpers import ScopedTemp

ROOT = Path(__file__).resolve().parents[1]
UTC = timezone.utc
NOW = datetime(2026, 9, 30, 12, tzinfo=UTC)
RULES = json.loads((ROOT / 'config/rules.json').read_text(encoding='utf-8'))

def reviewed(kind='competition'):
    doc = empty_document('libtv', '官方机会', 'LibTV', 'https://www.liblib.tv/activity/991', '2026', kind)
    doc.update(origin='manual_review', verified_at='2026-09-30', verification='partial', evidence=[{'origin': 'manual_review', 'url': doc['official_url'], 'excerpt': '当届官方公开窗口和规则'}])
    doc['time'].update(confirmed=True, evidence='官方窗口', mechanism='fixed', start='2026-09-01T10:00:00+08:00', deadline='2026-11-01T23:59:00+08:00')
    return normalize(doc)

class HomepageTimeAndPriorityTests(unittest.TestCase):
    def test_partial_public_review_can_rank_first_without_personal_account(self):
        doc=reviewed();doc['assessment']={'role':'candidate','personal_eligibility':'not_checked','ai_policy':'unspecified'}
        item=decorate(doc,RULES,NOW)
        self.assertEqual(item['priority']['group'],0)
        self.assertEqual(item['status']['code'],'open')
        self.assertEqual(item['verification'],'partial')

    def test_ongoing_and_expired_child_keep_independent_priority(self):
        parent=reviewed('creator_program');parent['time'].update(mechanism='ongoing',start=None,deadline=None)
        child=reviewed('limited_benefit');child['time'].update(start='2026-01-01',deadline='2026-03-31')
        self.assertEqual(decorate(parent,RULES,NOW)['priority']['group'],0)
        self.assertEqual(decorate(child,RULES,NOW)['priority']['group'],5)
        self.assertIsNone(parent['time']['deadline'])

    def test_date_and_unknown_timezone_windows_are_not_confirmed_open(self):
        for start,end,tz in [('2026-09-01','2026-11-01','+08:00'),('2026-09-01T10:00:00','2026-11-01T23:59:00',None)]:
            doc=reviewed();doc['time'].update(start=start,deadline=end,timezone=tz)
            item=decorate(doc,RULES,NOW)
            self.assertEqual(item['status']['code'],'window')
            self.assertEqual(item['priority']['group'],1)

    def test_new_publication_does_not_promote_unknown_or_future(self):
        doc=reviewed();doc['publication_at']='2026-09-30T00:00:00+00:00';doc['time'].update(confirmed=False,start=None,deadline=None)
        item=decorate(doc,RULES,NOW);self.assertTrue(item['is_new_publication']);self.assertEqual(item['priority']['group'],3)
        doc['time'].update(confirmed=True,start='2026-10-02T00:00:00+08:00',deadline='2026-10-31T23:59:00+08:00')
        self.assertEqual(decorate(doc,RULES,NOW)['priority']['group'],2)

    def test_month_boundaries_conservative_and_no_invented_saved_days(self):
        doc=reviewed('creator_program');doc['time'].update(start=None,deadline=None,month_period={'start':'2026-10','end':'2026-12'},timezone=None)
        cases=[(datetime(2026,9,30,9,tzinfo=UTC),'upcoming'),(datetime(2026,9,30,10,tzinfo=UTC),'uncertain'),(datetime(2026,10,1,12,tzinfo=UTC),'window'),(datetime(2026,12,31,10,tzinfo=UTC),'uncertain'),(datetime(2027,1,1,12,tzinfo=UTC),'uncertain')]
        for now,code in cases:self.assertEqual(temporal_status(doc,now)['code'],code)
        self.assertTrue(temporal_status(doc,cases[-1][0])['possible_expired'])
        self.assertIsNone(doc['time']['deadline']);self.assertIsNone(doc['time']['start'])
        doc['time']['timezone']='+08:00'
        self.assertEqual(temporal_status(doc,datetime(2026,9,30,17,tzinfo=UTC))['code'],'window')

    def test_policy_start_and_end_unknown_timezone_do_not_bypass_boundaries(self):
        doc=reviewed('rule_update');doc['time'].update(start=None,deadline=None,policy_effective='2026-10-01T00:00:00',policy_end=None)
        self.assertEqual(temporal_status(doc,datetime(2026,9,30,12,tzinfo=UTC))['code'],'uncertain')
        doc=reviewed('creator_program');doc['time'].update(mechanism='ongoing',start=None,deadline=None,policy_end='2026-10-01T00:00:00')
        self.assertEqual(temporal_status(doc,datetime(2026,9,30,12,tzinfo=UTC))['code'],'uncertain')

    def test_conflict_and_tentative_never_get_confirmed_countdown(self):
        for flag in ({'conflict':'NotStarted与日期冲突'},{'deadline_tentative':True}):
            doc=reviewed();doc['time'].update(deadline='2026-10-02T00:00:00+08:00',**flag)
            item=decorate(doc,RULES,NOW)
            self.assertEqual(item['priority']['group'],3);self.assertIsNone(item['deadline_urgency']);self.assertIsNone(item['priority']['deadline_order'])

    def test_only_extracted_or_stale_review_ranks_behind_verified_time(self):
        doc=reviewed();doc['origin']='live_fetch'
        self.assertEqual(decorate(doc,RULES,NOW)['priority']['group'],3)
        doc['origin']='manual_review';doc['verified_at']='2026-07-01'
        self.assertEqual(decorate(doc,RULES,NOW)['priority']['group'],3)

    def test_offset_equivalence_and_date_last_fractional_second(self):
        a=reviewed();b=copy.deepcopy(a)
        b['time']['deadline']='2026-11-01T15:59:00+00:00'
        self.assertEqual(decorate(a,RULES,NOW)['priority']['deadline_order'],decorate(b,RULES,NOW)['priority']['deadline_order'])
        doc=reviewed();doc['time'].update(deadline='2026-09-30',timezone='+08:00')
        self.assertEqual(temporal_status(doc,datetime(2026,9,30,15,59,59,500000,tzinfo=UTC))['code'],'window')
        self.assertEqual(temporal_status(doc,datetime(2026,9,30,16,tzinfo=UTC))['code'],'closed')

class HomepageReviewedDataTests(unittest.TestCase):
    def test_scoped_manual_review_preserves_preferences_evidence_versions_and_is_idempotent(self):
        payload=json.loads((ROOT/'config/reviewed_homepage_20260930.json').read_text(encoding='utf-8'))
        with ScopedTempWrapper() as store:
            for d in payload['documents']:
                original=copy.deepcopy(d);original.pop('public_review',None);original['evidence']=original['evidence'][:1]
                store.upsert(original);store.preference(d['id'],True,'保留用户已写的笔记')
                old_version=store.details(d['id'])['version'];store.upsert(d,protect_manual=False)
                live=copy.deepcopy(d);live.update(origin='live_fetch',evidence=[],risks=[],program={})
                store.upsert(live);store.upsert(d,protect_manual=False)
                item=Store(ROOT,store.db_path,seed=False).details(d['id'])
                self.assertEqual(item['note'],'保留用户已写的笔记');self.assertTrue(item['starred'])
                self.assertEqual(item['version'],old_version+1);self.assertEqual(item['evidence'],d['evidence']);self.assertEqual(item['verification'],'partial')

    def test_jimeng_full_tiers_canvas_and_rights_remain_independent_from_machine_fetch(self):
        docs=json.loads((ROOT/'config/reviewed_homepage_20260930.json').read_text(encoding='utf-8'))['documents']
        child=next(d for d in docs if d['id']=='a4dd21da51346371e24f5094')
        self.assertEqual(len(child['cash_tiers']),7);self.assertEqual(max(t['base']+t['canvas_bonus'] for t in child['cash_tiers']),70000)
        self.assertEqual(child['time']['timezone'],'+08:00');self.assertEqual(len(child['time']['deadline']),10)
        self.assertTrue(any('不可撤销' in r['detail'] for r in child['risks']));self.assertTrue(any('3个月' in r['detail'] for r in child['risks']))
        self.assertEqual(len(child['canvas_requirements']),6);self.assertEqual(child['verification'],'partial')

class ScopedTempWrapper:
    def __enter__(self):
        self.temp=ScopedTemp(ROOT/'output','test-homepage-');self.store=Store(ROOT,Path(self.temp.name)/'db.sqlite3',seed=False);return self.store
    def __exit__(self,*args):self.temp.cleanup()
