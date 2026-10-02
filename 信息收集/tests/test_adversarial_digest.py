import copy,unittest
from opportunities.digest import build_digest
from opportunities.model import empty_document,normalize,temporal_status

class AdversarialDigest(unittest.TestCase):
    def setUp(self):
        self.doc=normalize(empty_document('fixture','规则','平台','https://www.liblib.tv/activity/62','2026'))
    def snapshot(self,doc,version):
        return {'captured_at':'2026-09-30T10:00:00+00:00','items':{doc['id']:{'document':doc,'version':version,'status':temporal_status(doc),'added_at':'2026-09-30T09:00:00+00:00','changed_at':'2026-09-30T10:00:00+00:00'}}}
    def compare(self,before,after):return build_digest(self.snapshot(before,1),self.snapshot(after,2))
    def test_cash_tier_canvas_and_fees_not_silent(self):
        for field,before,after in [('cash_tiers',[{'base':600,'canvas_bonus':200}],[{'base':700,'canvas_bonus':200}]),('canvas_requirements',['≥10分镜'],['≥20分镜']),('fees',[{'amount':0,'currency':'CNY'}],[{'amount':99,'currency':'CNY'}])]:
            with self.subTest(field=field):
                old=copy.deepcopy(self.doc);new=copy.deepcopy(old);old[field]=before;new[field]=after
                result=self.compare(old,new);self.assertEqual(result['counts']['rules_changed'],1);self.assertTrue(any(change['field'].startswith(field) for event in result['events'] for change in event['changes']))
    def test_condition_change_tracks_gate_but_not_refresh_noise(self):
        old=copy.deepcopy(self.doc);old['fit_rules']={'duration_min_seconds':{'value':60,'evidence':{'observed_at':'a'}}}
        new=copy.deepcopy(old);new['fit_rules']['duration_min_seconds']['evidence']['observed_at']='b'
        self.assertEqual(self.compare(old,new)['counts']['rules_changed'],0)
        new['fit_rules']['duration_min_seconds']['value']=120
        self.assertEqual(self.compare(old,new)['counts']['rules_changed'],1)
    def test_partial_source_body_failures_are_visible_individually(self):
        attempt={'source_id':'fixture','status':'partial','finished_at':'2026-09-30T10:00:00+00:00','coverage':{'discovery':{'article_failure_details':[{'candidate_id':'one','title':'第一篇','official_url':'https://www.liblib.tv/activity/1','error':'HTTP403'},{'candidate_id':'two','title':'第二篇','official_url':'https://www.liblib.tv/activity/2','error':'HTTP404'}]}}}
        result=build_digest(self.snapshot(self.doc,1),self.snapshot(self.doc,1),attempts=[attempt])
        self.assertEqual(result['counts']['failed'],2);self.assertEqual({x['message'] for x in result['events']},{'HTTP403','HTTP404'})

if __name__=='__main__':unittest.main()
