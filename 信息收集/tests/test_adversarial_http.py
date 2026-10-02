import http.client
import json
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

from helpers import ScopedTemp
from opportunities.backup import BackupManager
from opportunities.collect import UpdateManager
from opportunities.model import empty_document, identity
from opportunities.server import make_server
from opportunities.storage import Store

ROOT = Path(__file__).resolve().parents[1]


class AdversarialHTTPTests(unittest.TestCase):
    def setUp(self):
        self.temp = ScopedTemp(ROOT / 'output', 'test-adversarial-http-')
        self.root = Path(self.temp.name)
        (self.root / 'config').mkdir()
        for name in ('sources.json', 'rules.json'):
            (self.root / 'config' / name).write_bytes((ROOT / 'config' / name).read_bytes())
        self.store = Store(self.root, seed=False)
        doc = empty_document('libtv', '隔离HTTP测试', 'LibTV', 'https://www.liblib.tv/activity/900099', '2026 / HTTP')
        self.store.upsert(doc)
        self.item_id = identity(doc)
        self.server = make_server(self.store, 0, UpdateManager(self.store, lambda *a, **k: {}))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.port = self.server.server_address[1]
        self.token = self.request('GET', '/api/state')[1]['token']

    def tearDown(self):
        self.server.manager.stop()
        self.server.shutdown()
        self.thread.join(3)
        self.server.server_close()
        self.temp.cleanup()

    def request(self, method, path, body=None, headers=None):
        conn = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        payload = json.dumps(body).encode() if isinstance(body, dict) else body
        defaults = {'Content-Type': 'application/json', 'X-Local-Token': getattr(self, 'token', '')}
        conn.request(method, path, payload, {**defaults, **(headers or {})})
        response = conn.getresponse()
        result = response.status, json.loads(response.read())
        conn.close()
        return result

    def test_ambiguous_and_invalid_json_never_mutates(self):
        for raw in (b'{"id":"x","id":"y"}', b'{"value":NaN}', b'{"value":Infinity}',
                    b'{"note":"\\ud800"}', ('{"value":' + '[' * 40 + '0' + ']' * 40 + '}').encode()):
            with self.subTest(raw=raw):
                self.assertEqual(self.request('POST', '/api/preference', raw)[0], 400)
        self.assertEqual(self.store.details(self.item_id)['note'], '')

    def test_duplicate_security_or_length_headers_rejected(self):
        for key, value in (('Host', f'127.0.0.1:{self.port}'), ('Origin', f'http://127.0.0.1:{self.port}'),
                           ('X-Local-Token', self.token), ('Content-Length', '2')):
            with self.subTest(header=key):
                conn = http.client.HTTPConnection('127.0.0.1', self.port, timeout=4)
                conn.putrequest('POST', '/api/preference', skip_host=True)
                fields = [('Host', f'127.0.0.1:{self.port}'), ('Origin', f'http://127.0.0.1:{self.port}'),
                          ('Content-Type', 'application/json'), ('X-Local-Token', self.token), ('Content-Length', '2')]
                for name, text in fields + [(key, value)]:
                    conn.putheader(name, text)
                conn.endheaders(b'{}')
                response = conn.getresponse()
                self.assertEqual(response.status, 400 if key == 'Content-Length' else 403)
                response.read()
                conn.close()

    def test_foreign_origin_host_and_missing_token_rejected(self):
        for headers in ({'Origin': 'https://foreign.example'}, {'Host': 'evil.example'}, {'X-Local-Token': ''}):
            self.assertEqual(self.request('POST', '/api/preference', {'id': self.item_id, 'note': 'attack'}, headers)[0], 403)
        self.assertEqual(self.request('GET', '/api/state', headers={'Origin': 'https://foreign.example'})[0], 403)
        self.assertEqual(self.store.details(self.item_id)['note'], '')

    def test_restore_receipt_is_idempotent_and_binds_exact_confirmation(self):
        self.store.preference(self.item_id, note='备份内容')
        backup = BackupManager(self.store).create()
        self.store.preference(self.item_id, note='恢复前内容')
        preview = self.request('POST', '/api/backup/preview', {'id': backup['id']})[1]
        payload = {'id': backup['id'], 'confirm_token': preview['confirm_token'], 'confirmed': True, 'operation_id': 'a' * 32}
        status, result = self.request('POST', '/api/backup/restore', payload)
        self.assertEqual(status, 200, result)
        self.assertTrue(result['restored'])
        self.store.preference(self.item_id, note='恢复后新笔记')
        status, replay = self.request('POST', '/api/backup/restore', payload)
        self.assertEqual(status, 200, replay)
        self.assertTrue(replay['already_completed'])
        self.assertEqual(self.store.details(self.item_id)['note'], '恢复后新笔记')
        self.assertEqual(self.request('POST', '/api/backup/restore', {**payload, 'confirm_token': 'another'})[0], 400)
        receipt = self.request('GET', '/api/backup/restore-status?operation=' + 'a' * 32)[1]
        self.assertEqual(receipt['status'], 'completed')
        self.assertNotIn('binding', receipt)

    def test_unconfirmed_restore_and_invalid_receipts_do_not_write(self):
        self.assertEqual(self.request('POST', '/api/backup/restore', {'confirmed': False})[0], 400)
        self.assertEqual(self.request('GET', '/api/backup/restore-status?operation=../x')[0], 400)
        self.assertEqual(self.request('GET', '/api/backup/restore-status?operation=' + 'b' * 32)[1]['status'], 'unknown')

    def test_read_failure_is_json_without_false_success(self):
        with patch.object(self.store, 'bootstrap', side_effect=ValueError('fixture-invalid')):
            status, result = self.request('GET', '/api/state')
        self.assertEqual(status, 500)
        self.assertIn('error', result)
        self.assertEqual(self.request('GET', '/api/state')[0], 200)


if __name__ == '__main__':
    unittest.main()
