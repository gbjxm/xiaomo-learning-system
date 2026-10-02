"""Local standard-library ZIP packaging. The JSON protocol is passed through stdin.

Does not read credentials, contact a network, or modify any existing destination.
Archives use stored entries, which avoids hidden decompression amplification.
"""
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import stat
import sys
import zipfile

MAX_FILES = 10000
MAX_TOTAL = 4 * 1024 ** 3
MAX_MANIFEST = 8 * 1024 ** 2
RESERVED = {'CON', 'PRN', 'AUX', 'NUL', *('COM' + str(i) for i in range(1, 10)), *('LPT' + str(i) for i in range(1, 10))}


def safe_name(name):
    if not isinstance(name, str) or not name or '\\' in name or ':' in name or len(name) > 400 or any(ord(c) < 32 for c in name):
        raise ValueError('Unsafe ZIP entry name')
    p = PurePosixPath(name)
    if p.is_absolute() or any(x in ('', '.', '..') or x.endswith(('.', ' ')) or x.split('.')[0].upper() in RESERVED for x in name.split('/')):
        raise ValueError('Unsafe ZIP entry path')
    return name


def digest_file(p):
    h = hashlib.sha256()
    with open(p, 'rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def inspect_archive(package, require_backup=False):
    with zipfile.ZipFile(package, 'r') as z:
        entries = z.infolist()
        if len(entries) > MAX_FILES:
            raise ValueError('ZIP has too many entries')
        names, total = {}, 0
        for entry in entries:
            name = safe_name(entry.filename)
            folded = name.casefold()
            if folded in names or entry.is_dir() or entry.flag_bits & 1:
                raise ValueError('Duplicate, directory or encrypted ZIP entry')
            mode = entry.external_attr >> 16
            if stat.S_IFMT(mode) not in (0, stat.S_IFREG):
                raise ValueError('Non-regular ZIP entry')
            if entry.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
                raise ValueError('Unsupported ZIP compression')
            total += entry.file_size
            if total > MAX_TOTAL or entry.file_size > MAX_TOTAL or (entry.file_size > 1024 * 1024 and entry.file_size / max(1, entry.compress_size) > 200):
                raise ValueError('ZIP exceeds size or compression-ratio limit')
            names[folded] = entry
        manifest_entry = names.get('manifest.json')
        if not manifest_entry or manifest_entry.file_size > MAX_MANIFEST:
            raise ValueError('Missing or oversized manifest')
        manifest = json.loads(z.read(manifest_entry).decode('utf-8'))
        if manifest.get('format') != 'xiaomo-observatory-package' or manifest.get('formatVersion') != 1 or manifest.get('kind') not in ('backup', 'export'):
            raise ValueError('Not a supported observatory package')
        if require_backup and manifest['kind'] != 'backup':
            raise ValueError('An export is not a complete backup')
        listed = {}
        for item in manifest.get('files', []):
            name = safe_name(item['path'])
            if name.casefold() in listed or name.casefold() == 'manifest.json':
                raise ValueError('Duplicate manifest path')
            entry = names.get(name.casefold())
            if not entry or entry.filename != name or not isinstance(item.get('byteLength'), int) or item['byteLength'] != entry.file_size:
                raise ValueError('Manifest byte length or path mismatch')
            claimed = item.get('sha256')
            if not isinstance(claimed, str) or len(claimed) != 64 or any(c not in '0123456789abcdef' for c in claimed):
                raise ValueError('Invalid manifest SHA-256')
            h = hashlib.sha256()
            with z.open(entry) as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                    h.update(chunk)
            if h.hexdigest() != claimed:
                raise ValueError('ZIP content SHA-256 mismatch: ' + name)
            listed[name.casefold()] = item
        if set(names) != set(listed) | {'manifest.json'}:
            raise ValueError('ZIP contains an unlisted file')
        if require_backup and ('data/observatory.sqlite3' not in listed or 'schema.sql' not in listed or 'configuration.json' not in listed):
            raise ValueError('Backup is missing required recovery files')
        return manifest


def build(request):
    output = Path(request['outputPath'])
    if not output.is_absolute() or output.exists():
        raise ValueError('Output must be a new absolute path')
    files = request['files']
    if len(files) > MAX_FILES - 1:
        raise ValueError('Too many files')
    manifest = request['manifest']
    manifest['files'] = []
    unique, total = set(), 0
    for item in files:
        name = safe_name(item['path'])
        if name.casefold() in unique or name.casefold() == 'manifest.json':
            raise ValueError('Duplicate output entry')
        unique.add(name.casefold())
        source = Path(item['sourcePath'])
        if not source.is_absolute() or source.is_symlink() or not source.is_file():
            raise ValueError('Package source must be an ordinary absolute file')
        size = source.stat().st_size
        total += size
        if total > MAX_TOTAL:
            raise ValueError('Package exceeds first-version 4 GiB total limit')
        sha = digest_file(source)
        if item.get('sha256') and sha != item['sha256']:
            raise ValueError('Package source changed before packaging')
        manifest['files'].append({'path': name, 'byteLength': size, 'sha256': sha})
    temp = output.with_name(output.name + '.part')
    if temp.exists():
        raise ValueError('Partial package already exists')
    try:
        with zipfile.ZipFile(temp, 'x', compression=zipfile.ZIP_STORED, allowZip64=True) as z:
            for item in files:
                z.write(item['sourcePath'], item['path'])
            z.writestr('manifest.json', json.dumps(manifest, ensure_ascii=False, indent=2).encode('utf-8'))
        inspect_archive(temp)
        # Windows rename refuses to replace an existing target; POSIX hard-link provides the same guarantee.
        os.link(temp, output)
        temp.unlink()
        return {'manifest': manifest, 'byteLength': output.stat().st_size, 'sha256': digest_file(output)}
    except BaseException:
        if temp.exists():
            temp.unlink()
        raise


def extract(request):
    package = Path(request['packagePath'])
    target = Path(request['targetDir'])
    if not package.is_absolute() or not target.is_absolute() or target.exists():
        raise ValueError('Restore target must be a new absolute directory')
    # Caller supplies the canonical authorized isolation root; the helper independently checks containment.
    allowed = Path(request['allowedRoot']).resolve(strict=True)
    final = target.resolve(strict=False)
    if allowed == final or allowed not in final.parents:
        raise ValueError('Restore target escapes authorized isolation root')
    manifest = inspect_archive(package, require_backup=True)
    target.mkdir(parents=True, exist_ok=False)
    if target.is_symlink() or allowed not in target.resolve(strict=True).parents:
        raise ValueError('Created recovery directory escaped authorized root')
    try:
        with zipfile.ZipFile(package, 'r') as z:
            for entry in z.infolist():
                relative = PurePosixPath(safe_name(entry.filename))
                destination = target.joinpath(*relative.parts)
                destination.parent.mkdir(parents=True, exist_ok=True)
                if target.resolve() not in destination.resolve(strict=False).parents:
                    raise ValueError('ZIP destination escapes recovery directory')
                with z.open(entry) as stream, open(destination, 'xb') as output:
                    shutil.copyfileobj(stream, output, length=1024 * 1024)
        for item in manifest['files']:
            p = target.joinpath(*PurePosixPath(item['path']).parts)
            if p.stat().st_size != item['byteLength'] or digest_file(p) != item['sha256']:
                raise ValueError('Extracted content failed verification')
        return {'manifest': manifest, 'targetDir': str(target), 'verifiedFiles': len(manifest['files'])}
    except BaseException:
        # This helper created exactly this fresh directory after checking its resolved authorized root.
        shutil.rmtree(target)
        raise


def main():
    request = json.load(sys.stdin)
    action = request.get('action')
    if action == 'build':
        result = build(request)
    elif action == 'inspect':
        result = {'manifest': inspect_archive(Path(request['packagePath']), request.get('requireBackup', False))}
    elif action == 'extract':
        result = extract(request)
    else:
        raise ValueError('Unknown local package action')
    print(json.dumps({'ok': True, 'data': result}, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'ok': False, 'error': {'code': 'PACKAGE_VALIDATION_FAILED', 'message': str(error)}}, ensure_ascii=False))
        sys.exit(1)
