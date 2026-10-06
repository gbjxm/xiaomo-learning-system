"""Build the approved A terminal into CSP-safe static files.

Only this directory's index.html, app.css, and approved assets are generated.
app.js is maintained next to this builder. No service or records are changed.
"""
from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parent
APPROVED = Path(r'D:\codex\小陌的学习系统\web\设计提案\个人终端-四岛与领航船-v2\a-selected')
html = (APPROVED / 'index.html').read_text(encoding='utf-8-sig')
css = re.search(r'<style>([\s\S]*?)</style>', html).group(1)
html = re.sub(r'<style>[\s\S]*?</style>', '<link rel="stylesheet" href="/terminal/app.css">', html)
html = re.sub(r'<script\b[^>]*>[\s\S]*?</script>', '', html)
html = re.sub(r'<!-- Direction A[\s\S]*?-->', '<!-- Approved A layout; existing systems keep their own records and assistants. -->', html)
html = re.sub(r'<dialog\b[^>]*>[\s\S]*?</dialog>', '', html)
html = html.replace('<title>小陌的个人终端 · A版视觉优化预览</title>', '<title>小陌的个人终端</title>')
html = html.replace('<body>', '<body data-terminal-home="true">')
html = html.replace('href="assets/', 'href="/terminal/assets/')

# Keep the sea-only enhancement when rebuilding from the approved layout.
sea_surface = (ROOT / 'sea-surface.svg').read_text(encoding='utf-8').strip()
html, sea_replacements = re.subn(r'<svg class="map-waves"[\s\S]*?</svg>', lambda _: sea_surface, html, count=1)
assert sea_replacements == 1, 'The sea overview layer was not found.'
html = html.replace('<link rel="stylesheet" href="/terminal/app.css">', '<link rel="stylesheet" href="/terminal/app.css"><link rel="stylesheet" href="/terminal/sea-surface.css">', 1)
assert (ROOT / 'sea-surface.css').is_file()


# The approved ship raster is identical to the image embedded in its old SVG.
html = re.sub(r'<span class="ship-art">[\s\S]*?</span>', '<span class="ship-art"><img src="/terminal/assets/ship.png" alt="" width="1536" height="1024"></span>', html, count=1)

# Use real links so opening in a new tab, browser history and back all work.
def convert_island(m):
    before, key, after, inner = m.groups()
    return '<a ' + before + 'data-island="' + key + '" href="#' + key + '"' + after + '>' + inner + '</a>'
html = re.sub(r'<button ([^>]*?)data-island="([^"]+)"([^>]*?)>([\s\S]*?)</button>', convert_island, html)
html = re.sub(r'<button ([^>]*?)data-cabin([^>]*?)>([\s\S]*?)</button>', lambda m: '<a '+m[1]+'data-cabin href="#cabin"'+m[2]+'>'+m[3]+'</a>', html)
html = re.sub(r'<button ([^>]*?)data-sea([^>]*?)>([\s\S]*?)</button>', lambda m: '<a '+m[1]+'data-sea href="#sea"'+m[2]+'>'+m[3]+'</a>', html)
html = re.sub(r'<button ([^>]*?)data-learning([^>]*?)>([\s\S]*?)</button>', lambda m: '<a '+m[1]+'data-learning href="/learning/?entry=resume"'+m[2]+'>'+m[3]+'</a>', html)
station_routes = {'navigation':'/navigation/?view=journey','journal':'/navigation/?view=profile','material':'/observatory/?space=daily','info':'/information/?space=daily'}
html = re.sub(r'<button ([^>]*?)data-station="([^"]+)"([^>]*?)>([\s\S]*?)</button>', lambda m: '<a '+m[1]+'data-station="'+m[2]+'" href="'+station_routes[m[2]]+'"'+m[3]+'>'+m[4]+'</a>', html)
home_routes = {'step':'/learning/?entry=resume','talk':'/navigation/?view=chat','learn':'/learning/content/'}
html = re.sub(r'<button ([^>]*?)data-home-action="([^"]+)"([^>]*?)>([\s\S]*?)</button>', lambda m: '<a '+m[1]+'data-home-action="'+m[2]+'" href="'+home_routes[m[2]]+'"'+m[3]+'>'+m[4]+'</a>', html)
html = re.sub(r'(<a\b[^>]*data-home-action="learn"[^>]*>)[\s\S]*?(</a>)', r'\1我的内容\2', html, count=1)
html = html.replace('<a data-learning href="/learning/?entry=resume">选一处开始 →</a>', '<a data-learning href="/learning/?entry=resume">继续学习 →</a>')

menu = '''<details class="systems-menu" id="systemsMenu"><summary>四个系统</summary><nav class="systems-list" aria-label="四系统快捷入口"><a href="/learning/?entry=resume">学习小岛<span>学习、练习与接续</span></a><a href="/navigation/?view=journey">领航桌<span>记录、交流与个人资料</span></a><a href="/observatory/?space=daily">素材观察室<span>收藏与观察研究</span></a><a href="/information/?space=daily">信息台<span>发现信息与机会</span></a></nav></details>'''
html = html.replace('<a class="primary" data-learning', menu+'<a class="primary" data-learning', 1)
html = html.replace('data-station="journal"', 'data-station="profile"')
html = html.replace('<span class="tag">走过的路，随手留下</span><h2>旅程册</h2><p>每日旅程 · 记录与回看</p>', '<span class="tag">让领航师更了解你</span><h2>我的资料</h2><p>背景 · 偏好 · 当前处境</p>')
html = html.replace('<span class="tag">聊聊此刻，看看方向</span><h2>领航桌</h2><p>个人交流 · 当前想法</p>', '<span class="tag">留下近况，坐下来聊聊</span><h2>领航桌</h2><p>随手记录 · 和领航师聊聊</p>')
summary = '''<details class="resume-summary" id="resumeSummary" hidden><summary>接着上次</summary><div class="resume-content"><p id="resumeText" role="status">展开后读取最近的学习接续。</p><div class="resume-actions"><a href="/learning/?entry=resume">继续学习 →</a><button type="button" id="reloadResume">重新读取</button></div></div></details>'''
html = html.replace('<div class="full-scene island-scenes" id="fullScene"></div>', summary+'<div class="full-scene island-scenes" id="fullScene"></div>')
html = re.sub(r'<footer class="footer">[\s\S]*?</footer>', '<footer class="footer"><span>海上的家 · 小陌的个人终端</span><div><button id="motion" type="button" aria-pressed="false">暂停轻动效</button><span aria-hidden="true"> · </span><a href="/navigation/?view=profile">我的资料</a></div></footer>', html)
html = html.replace('</body>', '<script src="/terminal/app.js" defer></script></body>')

css += '''
a{color:inherit;text-decoration:none}a:focus-visible,summary:focus-visible{outline:3px solid #9b713d;outline-offset:5px}a.primary{display:inline-block}.topbar{position:relative;z-index:10}.topnav a{padding:9px 0;font-size:14px;white-space:nowrap}.topnav a:hover{border-bottom:1px solid var(--ink)}.topnav a[aria-current="page"]{border-bottom:1px solid #789178}.topnav .primary{padding:11px 20px}.brand{flex-shrink:0}.island-link{display:block}.ship-art img{width:100%;height:100%;object-fit:contain;display:block}.station{display:block}.home-actions a{padding:9px 23px;font-size:14px;white-space:nowrap}.home-actions a+a{border-left:1px solid #c4ccb5}.footer a{font-size:12px;text-decoration:underline;text-underline-offset:4px}.full-scene .scene-place{pointer-events:auto;cursor:pointer}.full-scene .scene-hit{pointer-events:all;fill:transparent}.full-scene .scene-destination{outline:none}.full-scene .scene-destination:focus-visible .scene-hit{stroke:#9b713d;stroke-width:2;stroke-dasharray:5 4;fill:#fffdf425}.full-scene .scene-destination:focus-visible .scene-label-bg{stroke:#6e8870;stroke-width:2;fill:#fffef9}.cabin-review{display:inline-block;margin-top:18px;border-bottom:1px solid #87967a;padding:4px 0;font-size:14px}.systems-menu{position:relative;font-size:14px}.systems-menu>summary{list-style:none;cursor:pointer;white-space:nowrap;padding:9px 0}.systems-menu>summary::-webkit-details-marker{display:none}.systems-menu>summary:after{content:"⌄";font-size:14px;margin-left:7px}.systems-list{position:absolute;right:0;top:calc(100% + 15px);width:245px;padding:10px 20px;background:#f8f2e3;border:1px solid #bcc6ad;border-radius:6px;box-shadow:0 12px 35px #2d483626;z-index:20}.systems-list a{display:block;padding:14px 0;border-bottom:1px solid #d8ddcb}.systems-list a:last-child{border-bottom:0}.systems-list span{display:block;font-size:12px;color:#60715f;margin-top:5px}.resume-summary{position:absolute;top:94px;left:40px;z-index:4;width:248px;font-size:14px}.resume-summary>summary{display:inline-block;cursor:pointer;list-style:none;padding:9px 13px;border:1px solid #b9c5ab;background:#f7f2e4;border-radius:4px}.resume-summary>summary:after{content:"＋";margin-left:19px}.resume-summary[open]>summary:after{content:"−"}.resume-content{padding:16px;margin-top:7px;border:1px solid #b9c5ab;border-radius:4px;background:#fbf7eb;box-shadow:0 8px 24px #53684918}.resume-content p{font-size:14px;line-height:1.8;white-space:pre-line;overflow-wrap:anywhere;max-height:280px;overflow:auto}.resume-actions{display:flex;justify-content:space-between;gap:10px;margin-top:17px;font-size:13px}.resume-actions a,.resume-actions button{font-size:13px;padding:3px 0;border-bottom:1px solid #a1b090}.scene-header>div{max-width:60%;text-align:center}.scene-header>a:last-child{font-size:14px;white-space:nowrap}@media(max-width:1300px){.topnav{gap:17px}.resume-summary{left:28px;top:98px;width:225px}}@media(max-width:850px){.topbar{align-items:flex-start}.topnav{gap:15px;flex-wrap:wrap;justify-content:flex-start}.topnav a,.systems-menu>summary{font-size:13px}.systems-list{right:auto;left:0}.resume-summary{position:relative;top:auto;left:auto;margin:8px 0;width:100%}.resume-content{max-width:100%}.full-scene.home-scene{height:calc(100% - 138px)}.home-actions a{padding:9px 15px}.footer{gap:10px}.footer>span{font-size:11px}.scene-header>div{max-width:48%}.scene-header h1{font-size:23px}.back{font-size:12px}.scene-header>a:last-child{font-size:13px}.station p{font-size:14px}}
'''

assets = ROOT / 'assets'
assets.mkdir(parents=True, exist_ok=True)
for name in ('home.png','story.png','visual.png','post.png','ship.png','home.svg','story.svg','visual.svg','post.svg','ocean.svg','islands.css'):
    shutil.copy2(APPROVED / 'assets' / name, assets / name)
assert not re.search(r'<style\b|\sstyle=|\son[a-z]+=|<script(?![^>]*\bsrc=)', html, re.I)
assert not re.search(r'@[A-Z_]+@', html)
assert '预览' not in html
(ROOT / 'index.html').write_text(html, encoding='utf-8')
(ROOT / 'app.css').write_text(css.replace('}', '}\n'), encoding='utf-8')
print('Built', ROOT)
print('HTML bytes', len(html.encode()), 'CSS bytes', len(css.encode()))
