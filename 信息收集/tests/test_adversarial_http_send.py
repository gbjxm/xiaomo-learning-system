"""HTTP mutation receipts under transport failures, without sockets or a DB."""
from __future__ import annotations

import io
import json
import socket
import unittest
from contextlib import ExitStack
from email.message import Message
from types import SimpleNamespace
from unittest.mock import patch

from opportunities import server as server_module


OPERATION = "a" * 32
RESTORE_BODY = {
    "id": "isolated-backup",
    "confirm_token": "isolated-preview-token",
    "confirmed": True,
    "operation_id": OPERATION,
}


class FakePath:
    def resolve(self):
        return self

    def __str__(self):
        return "isolated-no-database-path"

    def __truediv__(self, name):
        return self

    def exists(self):
        return False


class FakeHTTPServer:
    """Capture the real Handler class without binding an address."""

    def __init__(self, address, handler):
        self.server_address = address
        self.RequestHandlerClass = handler


class FailingWriter:
    def __init__(self, error):
        self.error = error
        self.calls = 0

    def write(self, body):
        self.calls += 1
        raise self.error


class TimedOutReader:
    def __init__(self):
        self.lengths = []

    def read(self, length):
        self.lengths.append(length)
        raise socket.timeout("isolated request body read timeout")


class HTTPMutationSendTests(unittest.TestCase):
    def setUp(self):
        self.restore_calls = []
        calls = self.restore_calls

        class FakeBackupManager:
            def __init__(self, store):
                self.directory = FakePath()

            def restore(self, backup_id, confirm_token):
                calls.append((backup_id, confirm_token))
                return {"restored": True, "pre_restore_backup": "isolated-before"}

        stack = ExitStack()
        self.addCleanup(stack.close)
        stack.enter_context(patch.object(server_module, "BackupManager", FakeBackupManager))
        stack.enter_context(patch.object(server_module, "ThreadingHTTPServer", FakeHTTPServer))
        # These guards fail the test if the fixture accidentally reaches real IO.
        stack.enter_context(patch("socket.socket", side_effect=AssertionError("This test must not open a socket")))
        stack.enter_context(patch("sqlite3.connect", side_effect=AssertionError("This test must not open a database")))
        self.store = SimpleNamespace(db_path=FakePath(), items=lambda: [])
        manager = SimpleNamespace(status=lambda: {"running": False})
        fake_server = server_module.make_server(self.store, manager=manager)
        self.Handler = fake_server.RequestHandlerClass

    def handler(self, body=None, path="/api/backup/restore"):
        handler = object.__new__(self.Handler)
        handler.path = path
        handler.trusted = lambda mutation=False: True
        raw = json.dumps(RESTORE_BODY if body is None else body).encode("utf-8")
        handler.headers = Message()
        handler.headers["Content-Length"] = str(len(raw))
        handler.headers["Content-Type"] = "application/json"
        handler.rfile = io.BytesIO(raw)
        handler.wfile = io.BytesIO()
        handler.codes = []
        handler.sent_headers = []
        handler.send_response = lambda code, message=None: handler.codes.append(code)
        handler.send_header = lambda name, value: handler.sent_headers.append((name, value))
        handler.end_headers = lambda: None
        handler.close_connection = False
        return handler

    def receipt(self):
        handler = self.handler(path="/api/backup/restore-status?operation=" + OPERATION)
        replies = []
        handler.send = lambda code, body, *args, **kwargs: replies.append((code, body))
        handler.do_GET()
        self.assertEqual(len(replies), 1)
        self.assertEqual(replies[0][0], 200)
        return replies[0][1]

    def assert_completed_restore(self, handler):
        self.assertEqual(self.restore_calls, [(RESTORE_BODY["id"], RESTORE_BODY["confirm_token"])])
        self.assertEqual(handler.codes, [200], "A committed restore must not acquire a false 408/500 response")
        self.assertTrue(handler.close_connection)
        receipt = self.receipt()
        self.assertEqual(receipt["status"], "completed")
        self.assertEqual(receipt["operation_id"], OPERATION)
        self.assertTrue(receipt["result"]["restored"])
        self.assertEqual(receipt["result"]["pre_restore_backup"], "isolated-before")
        self.assertNotIn("error", receipt)

    def test_restore_body_write_timeout_preserves_completed_receipt(self):
        handler = self.handler()
        handler.wfile = FailingWriter(socket.timeout("isolated response body timeout"))
        handler.do_POST()
        self.assertEqual(handler.wfile.calls, 1)
        self.assert_completed_restore(handler)
        # Reading/replaying the recorded result must not run the mutation again.
        replay = self.handler()
        replay.do_POST()
        self.assertEqual(replay.codes, [200])
        self.assertTrue(json.loads(replay.wfile.getvalue())["already_completed"])
        self.assertEqual(len(self.restore_calls), 1)

    def test_restore_body_write_oserror_preserves_completed_receipt(self):
        handler = self.handler()
        handler.wfile = FailingWriter(OSError("isolated broken response stream"))
        handler.do_POST()
        self.assert_completed_restore(handler)

    def test_restore_header_flush_timeout_preserves_completed_receipt(self):
        handler = self.handler()
        handler.end_headers = lambda: (_ for _ in ()).throw(socket.timeout("isolated response header timeout"))
        handler.do_POST()
        self.assertEqual(handler.wfile.getvalue(), b"")
        self.assert_completed_restore(handler)

    def test_restore_header_flush_oserror_preserves_completed_receipt(self):
        handler = self.handler()
        handler.end_headers = lambda: (_ for _ in ()).throw(OSError("isolated header stream failure"))
        handler.do_POST()
        self.assert_completed_restore(handler)

    def test_request_body_read_timeout_returns_true_408_without_restoring(self):
        handler = self.handler()
        reader = TimedOutReader()
        handler.rfile = reader
        handler.do_POST()
        self.assertEqual(handler.codes, [408])
        self.assertEqual(reader.lengths, [int(handler.headers["Content-Length"])])
        self.assertEqual(self.restore_calls, [])
        self.assertTrue(handler.close_connection)
        self.assertIn("操作未执行", json.loads(handler.wfile.getvalue())["error"])
        self.assertEqual(self.receipt()["status"], "unknown")

    def test_saved_profile_response_timeout_is_not_a_request_read_failure(self):
        payload = {
            "duration_seconds": 240, "is_student": False, "ai_tools": [],
            "is_published": False, "uses_ai": False, "ai_percent": 0,
        }
        handler = self.handler(payload, "/api/profile")
        handler.wfile = FailingWriter(socket.timeout("isolated profile response timeout"))
        with patch.object(server_module, "save_profile", return_value=payload) as save:
            handler.do_POST()
        save.assert_called_once_with(self.store, payload)
        self.assertEqual(handler.codes, [200])
        self.assertEqual(handler.wfile.calls, 1)
        self.assertTrue(handler.close_connection)
        self.assertEqual(self.restore_calls, [])


if __name__ == "__main__":
    unittest.main()
