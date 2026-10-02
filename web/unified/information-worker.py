"""Owned local information backend; never runs an update or opens a browser."""
import argparse
import sys
from pathlib import Path

PROJECT_ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(PROJECT_ROOT/'信息收集'))
from opportunities.storage import Store, ProcessLock
from opportunities.server import make_server

def main():
    p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--port',type=int,required=True);a=p.parse_args()
    root=a.root.resolve();database=root/'data'/'opportunities.sqlite3'
    if not database.is_file():raise ValueError('Existing information database required; no implicit initialization')
    lock=ProcessLock(root/'data'/'server.lock');server=None
    with lock:
        store=Store(root,seed=False);server=make_server(store,a.port)
        print('Owned information backend ready',flush=True)
        try:server.serve_forever(poll_interval=0.2)
        except KeyboardInterrupt:pass
        finally:server.manager.stop();server.server_close()

if __name__=='__main__':main()
