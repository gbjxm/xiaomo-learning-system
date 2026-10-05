import json
import shutil
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
import uuid
from helpers import ScopedTemp
from pathlib import Path
from opportunities.collect import UpdateManager
from opportunities.server import make_server
from opportunities.storage import Store

ROOT = Path(__file__).resolve().parents[1]

class ServerTests(unittest.TestCase):
    def setUp(self):
        (ROOT / "output").mkdir(exist_ok=True)
        self.temp = ScopedTemp(ROOT / "output","http-test-")
        self.root = Path(self.temp.name)
        (self.root / 'config').mkdir()
        for name in ('sources.json','rules.json'):
            shutil.copyfile(ROOT / 'config' / name, self.root / 'config' / name)
        (self.root / 'static').mkdir()
        shutil.copyfile(ROOT / 'static' / 'index.html', self.root / 'static' / 'index.html')
        self.path = self.root / "data.sqlite3"
        self.store = Store(self.root,self.path)
        self.calls = []
        self.release = threading.Event()
        def runner(store,**kwargs):
            self.calls.append(kwargs["run_id"]);self.release.wait(3);return {"fixture":True}
        self.manager = UpdateManager(self.store,runner)
        self.server = make_server(self.store,0,self.manager)
        self.thread = threading.Thread(target=self.server.serve_forever)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.server.server_address[1]}"
    def tearDown(self):
        self.release.set();self.manager.stop();self.server.shutdown();self.thread.join(3);self.server.server_close();self.temp.cleanup()
    def request(self,path,body=None,token=None,origin=None):
        headers={}
        if body is not None:headers["Content-Type"]="application/json"
        if token:headers["X-Local-Token"]=token
        if origin:headers["Origin"]=origin
        req=urllib.request.Request(self.base+path,data=json.dumps(body).encode() if body is not None else None,headers=headers)
        with urllib.request.urlopen(req,timeout=4) as response:return response.status,json.loads(response.read())
    def test_startup_and_get_do_not_trigger_collection(self):
        _,data=self.request('/api/state')
        self.assertEqual(self.server.server_address[0],'127.0.0.1')
        self.assertTrue(data['items'])
        self.assertFalse(data['runs'])
        self.assertFalse(self.calls)
        self.assertTrue(all(s['last_attempt_at'] is None for s in data['sources']))
    def test_double_post_starts_one_task(self):
        _,data=self.request('/api/state');token=data['token']
        _,one=self.request('/api/update',{},token)
        _,two=self.request('/api/update',{},token)
        self.assertEqual(one['run_id'],two['run_id'])
        self.assertTrue(one['started']);self.assertFalse(two['started'])
        self.release.set();self.manager.thread.join(3)
        self.assertEqual(len(self.calls),1)
    def test_external_origin_and_missing_token_are_blocked(self):
        _,data=self.request('/api/state')
        with self.assertRaises(urllib.error.HTTPError) as ctx:self.request('/api/update',{},data['token'],'https://foreign.example')
        self.assertEqual(ctx.exception.code,403)
        with self.assertRaises(urllib.error.HTTPError) as ctx:self.request('/api/update',{})
        self.assertEqual(ctx.exception.code,403)
    def test_stop_and_restart_persist_note_and_data(self):
        _,data=self.request('/api/state');item=data['items'][0]
        self.request('/api/preference',{'id':item['id'],'starred':True,'note':'重启保留','expectedPreferenceRevision':item['preference_revision'],'submissionId':uuid.uuid4().hex},data['token'])
        self.request('/api/stop',{},data['token']);self.thread.join(3)
        self.assertFalse(self.thread.is_alive())
        restarted=Store(self.root,self.path)
        selected=next(x for x in restarted.items() if x['id']==item['id'])
        self.assertTrue(selected['starred']);self.assertEqual(selected['note'],'重启保留')
        self.assertEqual(len(restarted.items()),len(data['items']))
    def test_legacy_preference_without_version_is_rejected(self):
        _,data=self.request('/api/state');item=data['items'][0]
        with self.assertRaises(urllib.error.HTTPError) as caught:
            self.request('/api/preference',{'id':item['id'],'note':'旧客户端不可覆盖'},data['token'])
        self.assertEqual(caught.exception.code,409)
        _,latest=self.request('/api/detail?id='+item['id'])
        self.assertEqual((latest['note'],latest['preference_revision']),(item['note'],item['preference_revision']))
    def test_no_path_traversal_and_static_security_headers(self):
        with self.assertRaises(urllib.error.HTTPError) as ctx:self.request('/../app.py')
        self.assertEqual(ctx.exception.code,404)
        with urllib.request.urlopen(self.base+'/') as response:
            self.assertIn("script-src 'self'",response.headers['Content-Security-Policy'])
            self.assertEqual(response.headers['X-Content-Type-Options'],'nosniff')
    def test_export_includes_history_and_evidence(self):
        _,data=self.request('/api/export')
        self.assertEqual(len(data['versions']),len(data['documents']))
        self.assertIn('observations',data)

    def test_detail_with_and_without_dimension_evidence(self):
        _,state=self.request('/api/state');item=state['items'][0]
        _,detail=self.request('/api/detail?id='+item['id'])
        self.assertEqual(detail['observations'],[])
        self.assertEqual(detail['page_changes'],[])
        dimensions={'article':{'state':'text_complete'},'rules':{'state':'partial'},'account':{'state':'not_checked'}}
        self.store.observe(item['source_id'],item['official_url'],'公开规则A','hash1','run','text_complete',dimensions)
        self.store.observe(item['source_id'],item['official_url'],'公开规则B','hash2','run','text_complete',dimensions)
        _,detail=self.request('/api/detail?id='+item['id'])
        self.assertEqual(len(detail['observations']),2)
        self.assertEqual(detail['observations'][0]['coverage']['article']['state'],'text_complete')
        self.assertEqual(len(detail['page_changes']),1)
        self.assertEqual(detail['page_changes'][0]['state'],'review_pending')

if __name__ == '__main__':unittest.main()
