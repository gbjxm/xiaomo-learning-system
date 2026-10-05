from __future__ import annotations
import hashlib
import json
import secrets
import socket
import re
import threading
from contextlib import nullcontext
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit
from .collect import UpdateManager
from .model import json_text
from .storage import AlreadyRunning
from .fit import get_profile, save_profile, evaluate_fit
from .digest import summarize_run
from .backup import BackupManager
from .visuals import visual_metadata, serve_visual
from .review import ReviewManager
from .evidence import EvidenceManager
from .searching import SearchService
from . import works
from .workspace import records, mutation_guard
from .write_protocol import WriteConflict

def make_server(store, port=8765, manager=None):
    manager = manager or UpdateManager(store)
    backups=BackupManager(store)
    reviews, searching = ReviewManager(store), SearchService(store)
    evidence_holder = {}
    def evidence_service():
        if not evidence_holder:
            evidence_holder["service"] = EvidenceManager(store)
        return evidence_holder["service"]
    from .merging import MergeService
    merging = MergeService(store)
    restore_operations={}
    restore_lock=threading.RLock()
    token = secrets.token_urlsafe(32)
    marker = hashlib.sha256(str(store.db_path.resolve()).encode()).hexdigest()[:16]
    origins = {f"http://127.0.0.1:{port}", f"http://localhost:{port}"}
    hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"
        def setup(self):
            super().setup()
            self.connection.settimeout(8)
        def log_message(self, fmt, *args):
            return
        def send(self, code, body, content_type="application/json; charset=utf-8", filename=None):
            # Windows may reset a rejected POST while unread bytes are still
            # queued. Drain only an unambiguous, small body with a short bound;
            # authentication and the operation remain rejected.
            if code >= 400 and getattr(self,'command','') == 'POST' and not getattr(self,'_body_consumed',False):
                lengths = self.headers.get_all('Content-Length',[])
                if len(lengths) == 1 and not self.headers.get('Transfer-Encoding'):
                    try:
                        remaining = int(lengths[0])
                        if 0 < remaining <= 20000:
                            self.connection.settimeout(0.15)
                            self.rfile.read(remaining)
                    except (ValueError,OSError):
                        pass
                    finally:
                        self.connection.settimeout(8)
                self._body_consumed=True
            if not isinstance(body, bytes):
                body = json_text(body).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("Cross-Origin-Resource-Policy", "same-origin")
            self.send_header("Cross-Origin-Opener-Policy", "same-origin")
            self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
            self.send_header("Connection", "close")
            if filename:
                self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
            try:
                self.end_headers()
                self.wfile.write(body)
            except OSError:
                pass
            self.close_connection = True
        def trusted(self, mutation=False):
            if len(self.headers.get_all('Host',[]))!=1 or len(self.headers.get_all('Origin',[]))>1 or len(self.headers.get_all('X-Local-Token',[]))>1:
                self.send(403,{'error':'拒绝重复的本地凭证或来源请求头'})
                return False
            host = self.headers.get("Host", "")
            origin = self.headers.get("Origin")
            if host not in hosts or (origin and origin not in origins):
                self.send(403, {"error": "仅允许本机信息库页面访问"})
                return False
            if mutation and self.headers.get("X-Local-Token") != token:
                self.send(403, {"error": "本地操作凭证失效，请刷新页面"})
                return False
            return True
        def do_GET(self):
            try:
                self.dispatch_GET()
            except (ValueError, TypeError) as error:
                self.send(400 if urlsplit(self.path).path.startswith(('/api/search','/api/saved-views','/api/review/','/api/evidence','/api/works','/api/merge/')) else 500, {'error':str(error) if urlsplit(self.path).path.startswith(('/api/search','/api/saved-views','/api/review/','/api/evidence','/api/works','/api/merge/')) else '读取未完成，现有资料未修改；请检查本地数据或重试'})
            except Exception:
                self.send(500,{'error':'读取未完成，现有资料未修改；请检查本地数据或重试'})
        def dispatch_GET(self):
            if not self.trusted():
                return
            path = urlsplit(self.path).path
            query = parse_qs(urlsplit(self.path).query)
            def argument(name, default=''):
                values = query.get(name, [default])
                if len(values) != 1:
                    raise ValueError('查询参数重复')
                return values[0]
            if path == "/api/health":
                self.send(200, {"app": "xiaomo-opportunities", "marker": marker, "local_only": True})
            elif path == "/api/state":
                self.send(200, {**store.bootstrap(), "token": token, "update": manager.status(), 'merge_groups':merging.groups()})
            elif path == '/api/search':
                history = argument('history','0')
                if history not in ('0','1'):
                    raise ValueError('历史检索开关无效')
                self.send(200, searching.search(argument('q'), history == '1'))
            elif path == '/api/saved-views':
                self.send(200, {'views':searching.list_views()})
            elif path == '/api/review/candidate':
                self.send(200, reviews.candidate(argument('id')))
            elif path == '/api/review/history':
                self.send(200, reviews.history(argument('id')))
            elif path == '/api/review/receipt':
                self.send(200, reviews.receipt(argument('id')))
            elif path == '/api/evidence':
                self.send(200, evidence_service().list(argument('id')))
            elif path == '/api/evidence/download':
                content, mime, filename = evidence_service().file(argument('id'))
                self.send(200, content, mime, filename)
            elif path == '/api/works':
                self.send(200, works.list_workspace(store))
            elif path in ('/api/works/prepare', '/api/works/fit'):
                self.send(200, works.prepare_application(store,argument('work_id'),argument('opportunity_id')))
            elif path == '/api/merge/suspects':
                self.send(200, merging.suspects())
            elif path == '/api/merge/compare':
                self.send(200, merging.compare(argument('target_id'),argument('source_id')))
            elif path == '/api/merge/status':
                self.send(200, merging.status(argument('operation_id',argument('id'))))
            elif path == "/api/visuals":
                self.send(200, visual_metadata(store.root))
            elif path.startswith('/media/'):
                asset_id=path[len('/media/'):]
                visual=serve_visual(store.root,asset_id)
                if visual:
                    body,mime=visual
                    self.send(200,body,mime)
                else:
                    self.send(404,{'error':'图片不可用；可继续使用文字标识'})
            elif path == "/api/update":
                self.send(200, manager.status())
            elif path == "/api/detail":
                item_id = parse_qs(urlsplit(self.path).query).get("id", [""])[0]
                detail = store.details(item_id)
                if detail:
                    detail['fit']=evaluate_fit(detail,get_profile(store))
                self.send(200 if detail else 404, detail or {"error": "条目不存在"})
            elif path == '/api/digest':
                run_id=parse_qs(urlsplit(self.path).query).get('id',[None])[0]
                self.send(200,summarize_run(store,run_id))
            elif path == '/api/backups':
                self.send(200,backups.list())
            elif path == '/api/backup/restore-status':
                operation=parse_qs(urlsplit(self.path).query).get('operation',[''])[0]
                if not re.fullmatch(r'[a-f0-9]{32}',operation):
                    self.send(400,{'error':'恢复操作标识无效'})
                else:
                    with restore_lock:
                        receipt=restore_operations.get(operation)
                        self.send(200,{key:value for key,value in receipt.items() if key!='binding'} if receipt else {'status':'unknown','operation_id':operation,'note':'本服务尚未确认此操作；服务重启后内存收据不保留。请核对当前资料与恢复前快照，不自动重试恢复。'})
            elif path == '/api/backup/download':
                backup_id=parse_qs(urlsplit(self.path).query).get('id',[''])[0]
                try:
                    file=backups.path(backup_id)
                    self.send(200,backups.read(backup_id),'application/zip',file.name)
                except ValueError as error:
                    self.send(400,{'error':str(error)})
                except OSError:
                    self.send(404,{'error':'备份文件不存在或无法读取'})
            elif path == "/api/export":
                self.send(200, store.export(), filename="creative-opportunities.json")
            elif path in ("/", "/index.html", "/app.js", "/visuals.js", "/profile.js", "/enhancement-views.js", "/backup-ui.js", "/review-ui.js", "/search-ui.js", "/works-ui.js", "/merge-ui.js", "/library-tools.js", "/style.css", "/favicon.svg"):
                filename = "index.html" if path == "/" else path[1:]
                content_type = 'application/javascript; charset=utf-8' if filename.endswith('.js') else {"index.html":"text/html; charset=utf-8", "style.css":"text/css; charset=utf-8", "favicon.svg":"image/svg+xml"}[filename]
                self.send(200, (store.root / "static" / filename).read_bytes(), content_type)
            else:
                self.send(404, {"error": "页面不存在"})
        def do_POST(self):
            if not self.trusted(mutation=True):
                return
            path = urlsplit(self.path).path
            try:
                if len(self.headers.get_all('Content-Length',[]))>1 or self.headers.get('Transfer-Encoding'):
                    raise ValueError('请求正文长度不明确，操作未执行')
                length = int(self.headers.get("Content-Length", "0"))
                limit = 96*1024*1024 if path == '/api/backup/import' else 12*1024*1024 if path == '/api/evidence/import' else 512000 if path in ('/api/review/preview','/api/applications/save','/api/evidence/field','/api/merge/preview') else 20000
                if length < 0 or length > limit or self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                    raise ValueError('JSON请求超过此操作允许的大小，操作未执行')
                def unique_object(pairs):
                    value={}
                    for key,item in pairs:
                        if key in value:
                            raise ValueError('JSON字段重复，无法明确判断操作')
                        value[key]=item
                    return value
                def validate_strings(value,depth=0):
                    if depth>32:
                        raise ValueError('JSON嵌套过深')
                    if isinstance(value,str) and any(0xD800<=ord(char)<=0xDFFF for char in value):
                        raise ValueError('JSON包含无效Unicode字符')
                    if isinstance(value,dict):
                        for key,item in value.items():validate_strings(key,depth+1);validate_strings(item,depth+1)
                    elif isinstance(value,list):
                        for item in value:validate_strings(item,depth+1)
                try:
                    raw=self.rfile.read(length)
                    self._body_consumed=True
                except socket.timeout:
                    self.send(408,{'error':'请求读取超时，操作未执行'})
                    return
                if len(raw)!=length:
                    raise ValueError('请求正文不完整；操作未执行')
                body = json.loads(raw or b"{}",object_pairs_hook=unique_object,parse_constant=lambda value:(_ for _ in ()).throw(ValueError('JSON数值必须有限')))
                validate_strings(body)
                if not isinstance(body, dict):
                    raise ValueError("请求必须是JSON对象")
                guarded = path in ('/api/preference','/api/review/confirm','/api/review/change','/api/evidence/import','/api/evidence/field','/api/saved-views','/api/saved-views/remove','/api/works/save','/api/works/delete','/api/applications/save','/api/applications/delete','/api/merge/confirm','/api/merge/undo')
                with mutation_guard(store) if guarded else nullcontext():
                    if path == "/api/update":
                        state, started = manager.start()
                        self.send(202 if state.get("running") else 200, {**state, "started": started})
                    elif path == "/api/preference":
                        if set(body) - {'id','starred','note','expectedPreferenceRevision','submissionId'}:
                            raise ValueError('个人资料请求含未知字段')
                        self.send(200, store.preference(body.get("id"), starred=body.get("starred"), note=body.get("note"), expected_revision=body.get('expectedPreferenceRevision'), submission_id=body.get('submissionId'), require_cas=True))
                    elif path == '/api/profile':
                        profile=save_profile(store,body)
                        self.send(200,{'saved':True,'work_profile':profile,'fits':{item['id']:evaluate_fit(item,profile) for item in store.items()}})
                    elif path == '/api/candidate/review':
                        store.candidate_review(body.get('id'),body.get('state'))
                        self.send(200,{'saved':True})
                    elif path == '/api/review/preview':
                        self.send(200, reviews.preview(body))
                    elif path == '/api/review/confirm':
                        self.send(200, reviews.confirm(body))
                    elif path == '/api/review/change':
                        self.send(200, reviews.review_change(body))
                    elif path == '/api/evidence/import':
                        self.send(200, evidence_service().import_file(body))
                    elif path == '/api/evidence/field':
                        self.send(200, evidence_service().save_field(body))
                    elif path == '/api/saved-views':
                        if set(body)-{'id','expected_revision','data'}:
                            raise ValueError('保存视图请求含未知字段')
                        self.send(200, {'saved':True, 'record':searching.save_view(body.get('data'),body.get('id'),body.get('expected_revision',0))})
                    elif path == '/api/saved-views/remove':
                        if body.get('confirmed') is not True:
                            raise ValueError('移除视图需要明确确认')
                        self.send(200, searching.remove_view(body.get('id'),body.get('expected_revision')))
                    elif path == '/api/works/save':
                        if 'revision' not in body:
                            raise WriteConflict('作品页面版本已更新；请重新加载后核对并保存，草稿保留。', code='refresh_required')
                        self.send(200, works.save_work(store,body,require_submission=True))
                    elif path == '/api/works/delete':
                        self.send(200, works.delete_work(store,body))
                    elif path == '/api/applications/save':
                        self.send(200, works.save_application(store,body))
                    elif path == '/api/applications/delete':
                        self.send(200, works.delete_application(store,body))
                    elif path == '/api/merge/compare':
                        self.send(200, merging.compare(body.get('target_id'),body.get('source_id')))
                    elif path == '/api/merge/preview':
                        self.send(200, merging.preview(body.get('target_id'),body.get('source_id'),body.get('choices')))
                    elif path == '/api/merge/confirm':
                        self.send(200, merging.confirm(body.get('confirm_token'),body.get('operation_id'),body.get('same_entity',False)))
                    elif path == '/api/merge/undo-preview':
                        self.send(200, merging.undo_preview(body.get('group_id')))
                    elif path == '/api/merge/undo':
                        self.send(200, merging.undo(body.get('confirm_token'),body.get('operation_id'),body.get('confirmed',False)))
                    elif path == '/api/merge/cancel':
                        self.send(200, merging.cancel(body.get('token')))
                    elif path == '/api/backup/import':
                        import base64, binascii
                        if set(body) != {'content_base64'} or not isinstance(body['content_base64'],str) or len(body['content_base64']) > 4*((64*1024*1024+2)//3):
                            raise ValueError('导入备份须为不超过64MB的ZIP编码')
                        try:content=base64.b64decode(body['content_base64'],validate=True)
                        except (ValueError,binascii.Error) as error:raise ValueError('备份编码无效') from error
                        self.send(200,backups.import_archive(content))
                    elif path == '/api/backup/create':
                        self.send(200,backups.create())
                    elif path == '/api/backup/preview':
                        if manager.status().get('running'):
                            raise AlreadyRunning('检查正在进行；完成后才能预览恢复')
                        self.send(200,backups.preview(body.get('id')))
                    elif path == '/api/backup/restore':
                        if body.get('confirmed') is not True:
                            raise ValueError('必须先查看预览并明确点击确认恢复')
                        if manager.status().get('running'):
                            raise AlreadyRunning('检查正在进行；完成后才能恢复')
                        operation=body.get('operation_id')
                        if operation is not None and (not isinstance(operation,str) or not re.fullmatch(r'[a-f0-9]{32}',operation)):
                            raise ValueError('恢复操作标识无效')
                        with restore_lock:
                            binding=hashlib.sha256(json_text([body.get('id'),body.get('confirm_token')]).encode()).hexdigest()
                            receipt=restore_operations.get(operation) if operation else None
                            if receipt:
                                if receipt['binding']!=binding:
                                    raise ValueError('恢复操作标识已绑定另一份备份或确认，不能复用')
                                if receipt['status']=='completed':
                                    self.send(200,{**receipt['result'],'already_completed':True})
                                    return
                                raise ValueError('该次恢复已失败，请重新预览并使用新操作标识')
                            if operation:
                                while len(restore_operations)>=50:restore_operations.pop(next(iter(restore_operations)))
                                restore_operations[operation]={'operation_id':operation,'binding':binding,'status':'pending'}
                            try:
                                result=backups.restore(body.get('id'),body.get('confirm_token'))
                            except Exception as error:
                                recovery=bool(getattr(error,'restore_committed',False) or (backups.directory/'.restore-journal.json').exists())
                                if operation:restore_operations[operation].update(status='recovery_required' if recovery else 'failed',error=str(error))
                                raise
                            if operation:
                                result={**result,'operation_id':operation}
                                restore_operations[operation].update(status='completed',result=result)
                            self.send(200,result)
                    elif path == "/api/stop":
                        manager.cancel.set()
                        self.send(200, {"stopping": True})
                        threading.Thread(target=self.server.shutdown, name="user-stop").start()
                    else:
                        self.send(404, {"error": "操作不存在"})
            except WriteConflict as exc:
                self.send(409, {'error': str(exc), **exc.details})
            except AlreadyRunning as exc:
                self.send(409,{'error':str(exc)})
            except socket.timeout:
                self.close_connection=True
            except (ValueError, TypeError, RecursionError, UnicodeError, json.JSONDecodeError) as exc:
                self.send(400, {"error": str(exc)})
            except Exception:
                self.send(500, {"error": "操作失败，请检查本地控制台与数据文件"})
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    if port == 0:
        actual_port = server.server_address[1]
        origins.clear()
        origins.update({f"http://127.0.0.1:{actual_port}", f"http://localhost:{actual_port}"})
        hosts.clear()
        hosts.update({f"127.0.0.1:{actual_port}", f"localhost:{actual_port}"})
    server.daemon_threads = True
    server.store, server.manager, server.marker = store, manager, marker
    return server
