"""Scoped test files with inherited Windows permissions (not mkdtemp's 0700 ACL)."""
import shutil
import uuid
from pathlib import Path

class ScopedTemp:
    def __init__(self,root,prefix):
        self.root=Path(root).resolve()
        self.root.mkdir(parents=True,exist_ok=True)
        self.path=self.root/(prefix+uuid.uuid4().hex)
        self.path.mkdir()
        self.name=str(self.path)
    def cleanup(self):
        target=self.path.resolve()
        if target.parent != self.root or not target.name.startswith(('test-','http-test-')):
            raise ValueError('测试清理路径超出范围')
        shutil.rmtree(target)
