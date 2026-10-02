"""Run `python app.py serve --open` or `python app.py update` from this directory."""
from __future__ import annotations
import argparse
import hashlib
import json
import sys
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path
from opportunities.collect import update_once
from opportunities.model import json_text, utcnow
from opportunities.server import make_server
from opportunities.storage import AlreadyRunning, ProcessLock, Store

ROOT = Path(__file__).resolve().parent

def main(argv=None):
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description="小陌创作机会库：本地保存、按需检查")
    parser.add_argument("--db", type=Path, help="可选独立数据文件（用于验证或备份副本）")
    commands = parser.add_subparsers(dest="command", required=True)
    serve = commands.add_parser("serve", help="启动仅本机网页；不自动检查更新")
    serve.add_argument("--port", type=int, default=8765)
    serve.add_argument("--open", action="store_true", help="打开默认浏览器")
    check = commands.add_parser("update", help="单次检查官方信源并退出")
    check.add_argument("--source", action="append", help="只检查指定信源ID，可重复")
    export = commands.add_parser("export", help="导出完整条目、历史和核验记录")
    export.add_argument("path", type=Path)
    import_cmd = commands.add_parser("import", help="导入人工核验补充的JSON；保留历史")
    import_cmd.add_argument("path", type=Path)
    args = parser.parse_args(argv)
    if args.command == "serve" and not 1024 <= args.port <= 65535:
        parser.error("端口应在1024至65535之间")
    try:
        store = Store(ROOT, args.db)
        if args.command == "update":
            if args.source:
                known = {source["id"] for source in store.source_config}
                if set(args.source) - known:
                    parser.error("未知信源ID：" + ",".join(set(args.source) - known))
            def progress(result, done, total):
                print(f"[{done}/{total}] {result['source_id']}: {result['status']} — {result['message']}", flush=True)
            summary = update_once(store, progress=progress, source_ids=set(args.source) if args.source else None)
            print(json.dumps(summary, ensure_ascii=False, indent=2))
            # A run with failed sources is explicitly distinguishable from a complete run.
            return 2 if summary["counts"]["failed"] else 0
        if args.command == "export":
            args.path.write_text(json.dumps(store.export(), ensure_ascii=False, indent=2), encoding="utf-8")
            print("已导出：" + str(args.path.resolve()))
            return 0
        if args.command == "import":
            payload = json.loads(args.path.read_text(encoding="utf-8-sig"))
            docs = payload.get("documents", [payload]) if isinstance(payload, dict) else payload
            if not isinstance(docs, list):
                raise ValueError("导入文件应为条目对象、条目数组或包含documents的对象")
            # Validate all before writing any document.
            from opportunities.model import normalize
            sources = {source["id"] for source in store.source_config}
            validated = []
            for doc in docs:
                doc = {**doc, "origin": "manual_review"}
                if doc["source_id"] not in sources:
                    raise ValueError("请先在config/sources.json登记官方信源")
                validated.append(normalize(doc))
            all_ids = {item["id"] for item in store.items()} | {item["id"] for item in validated}
            if any(relation["target_id"] not in all_ids for doc in validated for relation in doc.get("relations", [])):
                raise ValueError("关联目标未入库；请把母计划和子活动放入同一批次")
            counts = {"new": 0, "changed": 0, "unchanged": 0}
            from opportunities.backup import collection_guard
            with collection_guard(store):
                current_sources={source['id'] for source in store.source_config}
                if any(doc['source_id'] not in current_sources for doc in validated):
                    raise ValueError('导入准备期间来源配置已改变，请核对后重新导入')
                current_ids={item['id'] for item in store.items()} | {item['id'] for item in validated}
                if any(relation['target_id'] not in current_ids for doc in validated for relation in doc.get('relations',[])):
                    raise ValueError('导入准备期间关联目标已改变，请核对后重新导入')
                from opportunities.digest import capture_before, finalize_digest
                before=capture_before(store)
                import uuid
                run_id=uuid.uuid4().hex
                store.start_run(run_id)
                for doc in validated:
                    counts[store.upsert(doc, "人工核验JSON补充", protect_manual=False)] += 1
                archived=store.archive_expired()
                summary={'kind':'manual_review','new':counts['new'],'changed':counts['changed'],'archived':archived,'sources':0,'digest':finalize_digest(store,run_id,before)}
                store.finish_run(run_id,summary)
            print(json.dumps(counts, ensure_ascii=False))
            return 0
        url = f"http://127.0.0.1:{args.port}"
        lock = ProcessLock(store.db_path.parent / "server.lock")
        try:
            lock.__enter__()
        except AlreadyRunning:
            expected = hashlib.sha256(str(store.db_path.resolve()).encode()).hexdigest()[:16]
            try:
                with urllib.request.urlopen(url + "/api/health", timeout=2) as response:
                    health = json.loads(response.read(2000))
                if health.get("app") == "xiaomo-opportunities" and health.get("marker") == expected:
                    print("信息库已运行：" + url)
                    if args.open:
                        webbrowser.open(url)
                    return 0
            except (OSError, ValueError, urllib.error.URLError):
                pass
            raise AlreadyRunning("同一信息库已有服务运行；请查看原窗口或停止后重启")
        server = None
        try:
            server = make_server(store, args.port)
            print("小陌创作机会库  " + url, flush=True)
            print("仅localhost；启动不采集。点击「检查更新」执行一轮。关闭窗口 / Ctrl+C / 页面停止服务即可退出。", flush=True)
            if args.open:
                webbrowser.open(url)
            server.serve_forever(poll_interval=0.2)
        except KeyboardInterrupt:
            print("正在停止服务…", flush=True)
        finally:
            if server:
                server.manager.stop()
                server.server_close()
            lock.__exit__(None, None, None)
        return 0
    except AlreadyRunning as exc:
        print(str(exc), file=sys.stderr)
        return 3
    except (OSError, ValueError) as exc:
        print(f"未完成：{exc}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
