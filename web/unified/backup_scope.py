"""Explicit data-only scope for the four-system local backup (no runtime execution)."""
from pathlib import Path, PurePosixPath
import hashlib, json, os

NAV_PREFIX = '领航室'
NAV_STATE = NAV_PREFIX + '/状态/领航状态.json'
NAV_REQUIRED = ('状态/领航状态.json', '当前处境.md', '人生罗盘.md', 'connections.json')
NAV_DOCUMENTS = ('00_开始这里.md', 'AGENTS.md', '系统约定.md', '核心架构.md', '核心接续用法.md')
DATA_DIRECTORIES = ('运行记录', '信息收集/static/media', '信息收集/data/attachments', '素材观察室/attachments')
DATA_FILES = ('信息收集/config/sources.json', '信息收集/config/rules.json', '信息收集/config/visual_assets.json', '学习小岛/data/ui-state.json', '三系统工作台/data/workspace-state.json')

def json_object(raw):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result: raise ValueError('JSON包含重复字段')
            result[key] = value
        return result
    return json.loads(raw.decode('utf-8-sig'), object_pairs_hook=unique)

def no_links(path):
    # Check the lexical ancestry before resolve() can erase a redirect.
    for item in (path, *path.parents):
        if item.is_symlink() or item.is_junction(): raise ValueError('备份与恢复路径不能包含链接或目录重定向')

def transient(path):
    return path.name.endswith(('.tmp', '.part', '.lock')) or '.incoming' in path.parts

def walk(directory):
    if not directory.exists(): return
    no_links(directory)
    for current, dirs, files in os.walk(directory, followlinks=False):
        current = Path(current)
        for name in dirs:
            no_links(current / name)
        dirs[:] = [name for name in dirs if name != '.incoming']
        for name in files:
            file = current / name
            no_links(file)
            if not transient(file): yield file

def navigation_state(raw):
    if len(raw) > 8 * 1024**2: raise ValueError('领航状态超过8MiB读取上限')
    state = json_object(raw)
    if not isinstance(state, dict) or state.get('schema') not in ('xiaomo.navigation-state/v1', 'xiaomo.navigation-state/v2') or type(state.get('revision')) is not int or state['revision'] < 0:
        raise ValueError('领航状态版本或身份不正确')
    for key in ('decisions', 'applied_events', *(['records', 'resources', 'routes'] if state['schema'].endswith('/v2') else [])):
        if not isinstance(state.get(key), list): raise ValueError('领航状态缺少核心列表')
    return state

def navigation_identity(raw, source_root):
    state = navigation_state(raw)
    return {'sourceRoot': str(source_root), 'schema': state['schema'], 'revision': state['revision'], 'stateSha256': hashlib.sha256(raw).hexdigest(), 'ids': {key: [row['id'] for row in state.get(key, [])] for key in ('records', 'decisions', 'resources', 'routes')}}

def navigation_links(state):
    result = []
    for record in state.get('records', []):
        link = record.get('journey_document')
        if link is None: continue
        if not isinstance(link, dict) or not isinstance(link.get('file'), str): raise ValueError('领航关联文档结构错误，不能静默遗漏')
        name = link['file']; parsed = PurePosixPath(name)
        if '\\' in name or ':' in name or parsed.is_absolute() or '..' in parsed.parts or name != parsed.as_posix() or parsed.suffix.lower() not in ('.md', '.txt'):
            raise ValueError('领航关联文档必须是领航目录内的相对Markdown或文本文件')
        if parsed.parts[0] in ('状态', 'tools', '.agents', 'work', 'output', '验证'):
            raise ValueError('领航关联文档不能指向状态、工具或验证目录')
        result.append(name)
    return sorted(set(result))

def inventory(root, isolation, default_root):
    """Returns archive path -> source; navigation may use only the explicit configured root."""
    no_links(root)
    sources = {}
    for name in DATA_DIRECTORIES:
        for file in walk(root / name): sources[file.relative_to(root).as_posix()] = (file, root)
    for name in DATA_FILES:
        if (root / name).exists(): sources[name] = (root / name, root)
    connection = root / 'navigation-connection.json'; nav = None
    if connection.exists():
        no_links(connection)
        if connection.stat().st_size > 16 * 1024: raise ValueError('领航连接配置过大')
        config = json_object(connection.read_bytes())
        if not isinstance(config, dict) or set(config) != {'schemaVersion', 'navigationRoot'} or config['schemaVersion'] != 1 or not isinstance(config['navigationRoot'], str) or not Path(config['navigationRoot']).is_absolute():
            raise ValueError('领航连接必须只含版本与本机绝对目录，不收录凭据')
        nav = Path(config['navigationRoot']); no_links(nav); nav = nav.resolve(strict=True)
        if str(nav).startswith('\\\\') or nav == root or (root != default_root and not nav.is_relative_to(root)):
            raise ValueError('隔离备份的领航目录必须在隔离项目内，不能指向正式资料或网络目录')
        sources['navigation-connection.json'] = (connection, root)
        for name in NAV_REQUIRED:
            file = nav / name
            no_links(file)
            if not file.is_file(): raise ValueError('领航必要资料缺失：' + name)
            sources[NAV_PREFIX + '/' + name] = (file, nav)
        for name in NAV_DOCUMENTS:
            if (nav / name).is_file(): sources[NAV_PREFIX + '/' + name] = (nav / name, nav)
        for file in walk(nav / '依据'):
            if file.suffix.lower() not in ('.md', '.txt', '.json'): raise ValueError('领航依据出现未纳入文本备份范围的文件，需明确范围：' + file.name)
            sources[NAV_PREFIX + '/' + file.relative_to(nav).as_posix()] = (file, nav)
        state_file = nav / '状态/领航状态.json'
        if state_file.stat().st_size > 8 * 1024**2: raise ValueError('领航状态超过8MiB读取上限')
        state = navigation_state(state_file.read_bytes())
        for name in navigation_links(state): sources[NAV_PREFIX + '/' + name] = (nav / name, nav)
    lock_roots = [root / '运行记录/.自然记录', root / '运行记录/.学习提交']
    if nav: lock_roots.append(nav / '状态')
    for directory in lock_roots:
        if directory.exists() and any(directory.glob('*.lock')): raise ValueError('有保存正在进行或遗留锁待核对；请完成保存后再备份，未改动原锁')
    return sources, nav

def allowed_member(name):
    if name in DATA_FILES or name in ('navigation-connection.json', '信息收集/data/opportunities.sqlite3', '素材观察室/data/observatory.sqlite3'): return True
    if any(name.startswith(prefix + '/') for prefix in DATA_DIRECTORIES): return not transient(PurePosixPath(name))
    if name.startswith(NAV_PREFIX + '/'):
        relative = name[len(NAV_PREFIX) + 1:]
        return relative in NAV_REQUIRED or relative in NAV_DOCUMENTS or (PurePosixPath(relative).suffix.lower() in ('.md', '.txt', '.json') and PurePosixPath(relative).parts[0] not in ('状态', 'tools', '.agents', 'work', 'output', '验证'))
    return False

def verify_navigation(read, names, manifest):
    saved = 'navigation-connection.json' in names
    if manifest.get('navigationSaved') is not saved: raise ValueError('领航备份范围清单不符')
    if not saved:
        if any(name.startswith(NAV_PREFIX + '/') for name in names) or 'navigationIdentity' in manifest: raise ValueError('未保存领航配置，不能夹带领航资料')
        return
    if not all(NAV_PREFIX + '/' + name in names for name in NAV_REQUIRED): raise ValueError('领航备份缺少必要资料')
    config = json_object(read('navigation-connection.json'))
    if not isinstance(config, dict) or set(config) != {'schemaVersion', 'navigationRoot'} or config['schemaVersion'] != 1 or not isinstance(config['navigationRoot'], str) or not Path(config['navigationRoot']).is_absolute() or config['navigationRoot'].startswith(('\\\\', '//')):
        raise ValueError('领航连接清单必须是原本机绝对目录')
    raw = read(NAV_STATE)
    # Package verification must not touch the old source path or a network share.
    if manifest.get('navigationIdentity') != navigation_identity(raw, Path(os.path.abspath(config['navigationRoot']))): raise ValueError('领航状态与身份清单不符')
    for name in navigation_links(navigation_state(raw)):
        if NAV_PREFIX + '/' + name not in names: raise ValueError('领航关联文档未包含在备份内')

def inspect_restored(target, manifest):
    """Evidence-only read; never initialize/migrate/rebind or execute the restored files."""
    import sqlite3
    result = {'databases': [], 'navigation': None, 'pendingLearningRequests': [], 'pendingIntakeRequests': [], 'identitiesPreserved': True, 'runtimeActivated': False}
    for snapshot in manifest['databaseSnapshots']:
        db = sqlite3.connect((target / snapshot['path']).as_uri() + '?mode=ro&immutable=1', uri=True)
        try:
            if db.execute('PRAGMA quick_check').fetchone()[0] != 'ok' or db.execute('PRAGMA foreign_key_check').fetchone(): raise ValueError('恢复数据库完整性校验失败')
            counts = {table: db.execute('SELECT count(*) FROM "' + table.replace('"', '""') + '"').fetchone()[0] for table in snapshot['counts']}
            if counts != snapshot['counts']: raise ValueError('恢复数据库行数与快照不符')
            identities = {}
            for table in ('store_meta', 'app_meta'):
                if table in counts:
                    db.row_factory = sqlite3.Row; identities[table] = [dict(row) for row in db.execute('SELECT * FROM ' + table)]
            result['databases'].append({'path': snapshot['path'], 'quickCheck': 'ok', 'counts': counts, 'identities': identities})
        finally: db.close()
    if manifest.get('navigationSaved'): result['navigation'] = manifest['navigationIdentity']
    for directory, pending in (('.学习提交', 'pendingLearningRequests'), ('.自然记录', 'pendingIntakeRequests')):
        for file in (target / '运行记录' / directory).glob('*.json'):
            journal = json_object(file.read_bytes())
            if journal.get('status') != 'committed': result[pending].append({'file': file.relative_to(target).as_posix(), 'status': journal.get('status')})
    return result
