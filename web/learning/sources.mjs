import path from 'node:path';
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

const DEFAULT_CONFIG = 'D:\\obsidian\\影视知识树\\.codex\\knowledge-tree.json';
const MAX_DOCUMENT = 24000;
const MAX_PROCESS_OUTPUT = 3 * 1024 * 1024;
const COURSES = Object.freeze({ C001: '查理老师的编剧课', C002: '老白的分镜课' });
const CAPABILITIES = Object.freeze({ text: true, image: false, audio: false, video: false });
const digest = text => createHash('sha256').update(text).digest('hex');
const inside = (child, root) => { const relative = path.relative(root, child); return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)); };
const samePath = (left, right) => path.relative(path.resolve(left), path.resolve(right)) === '';

function chapterNumber(value, maximum = 100) {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 && value <= maximum ? value : null;
  if (typeof value !== 'string') return null;
  const token = value.trim().replace(/^第/, '').replace(/(?:课|节)$/, '');
  if (/^\d{1,3}$/.test(token)) return chapterNumber(Number(token), maximum);
  const digits = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (Object.hasOwn(digits, token)) return chapterNumber(digits[token], maximum);
  if (/^[一二三四五六七八九]?十[一二三四五六七八九]?$/.test(token)) {
    const [tens, units] = token.split('十');
    return chapterNumber((digits[tens] ?? 1) * 10 + (digits[units] ?? 0), maximum);
  }
  if (token === '一百') return 100;
  return null;
}

// Only an explicit ordinal identifies a lesson. References such as “那一课”
// and counts such as “看了三课” leave the identity to a verified selection or
// the same task's saved sources. Keep lists/ranges unresolved rather than
// silently selecting one endpoint (including “第六/第七课”).
export function explicitCourseChapter(message, maximum = 100) {
  const number = '[一二两三四五六七八九十零百\\d]{1,5}';
  const sequence = new RegExp(`第\\s*${number}(?:\\s*(?:课|节))?(?:\\s*(?:[/／、,，或和及至到—–~～-]|或者)\\s*(?:第\\s*)?${number}(?:\\s*(?:课|节))?)*\\s*(?:课|节)`, 'g');
  const matches = [...String(message).matchAll(sequence)];
  const values = [...new Set(matches.flatMap(match => [...match[0].matchAll(new RegExp(number, 'g'))]
    .map(token => chapterNumber(token[0], maximum))))];
  return { mentioned: matches.length > 0, ambiguous: values.length > 1,
    chapter: values.length === 1 ? values[0] : null };
}

function locateCourse(message, courseId, chapter, selectedSource) {
  let selection = selectedSource;
  if (typeof selection === 'string') {
    const match = /^course:(C00[12]):(\d{1,3})(?::([a-f0-9]{12}))?$/.exec(selection);
    if (!match) return { error: '所选资料身份无效；只接受当前正式课文身份，不接受本机文件路径。' };
    selection = { courseId: match[1], chapter: Number(match[2]), sectionId: match[3] };
  }
  if (selection != null && (typeof selection !== 'object' || Array.isArray(selection)
    || Object.keys(selection).some(key => !['courseId', 'chapter', 'heading', 'sectionId'].includes(key)))) {
    return { error: '所选资料必须使用课程、课次与章节身份，不能指定任意文件路径。' };
  }
  const named = [...Object.keys(COURSES)].filter(id => message.includes(id === 'C001' ? '查理' : '老白'));
  if (named.length > 1 && !selection?.courseId && !courseId) return { error: '本次涉及多门课程，需先明确这次引用的课程与课次。' };
  const id = selection?.courseId ?? (named.length === 1 ? named[0] : message.includes('影视飓风') ? 'C003' : courseId);
  const explicit = explicitCourseChapter(message);
  if (selection?.chapter == null && chapter == null && explicit.ambiguous) {
    return { error: '本次涉及多个课次，尚未确定要引用哪一课；请明确课次后再读取，没有自动选取其中一课。' };
  }
  const number = chapterNumber(selection?.chapter ?? chapter ?? explicit.chapter);
  return { id, chapter: number, heading: selection?.heading, sectionId: selection?.sectionId };
}

function sections(markdown) {
  const lines = markdown.split('\n');
  const result = []; let current; let fenced = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) fenced = !fenced;
    if (fenced) continue;
    const match = /^## (.+?)\s*$/.exec(lines[i]);
    if (!match) continue;
    if (current) { current.lineEnd = i; current.content = lines.slice(current.lineStart - 1, i).join('\n'); result.push(current); }
    current = { heading: match[1], lineStart: i + 1 };
  }
  if (current) { current.lineEnd = lines.length; current.content = lines.slice(current.lineStart - 1).join('\n'); result.push(current); }
  return result;
}

function chooseSections(all, message, matched, selection) {
  if (selection.heading || selection.sectionId) {
    const exact = all.filter(item => item.heading === selection.heading || digest(item.heading).slice(0, 12) === selection.sectionId
      || selection.heading && item.content.split('\n').some(line => /^#{3,6} /.test(line) && line.replace(/^#{3,6} /, '').trim() === selection.heading));
    if (exact.length !== 1) return [];
    const boundaries = all.filter(item => /条件|边界|局限|可靠性|适用|限制|反例/.test(item.heading));
    return [...new Set([...exact, ...boundaries])];
  }
  const terms = message.replace(/查理|老白|影视飓风|第?[一二三四五六七八九十\d]+[课节]|请|帮我|解释一下|解释|课程|这节|这个|怎么|为什么/g, ' ')
    .split(/[\s，。！？、：；“”‘’（）()\-]+/).filter(term => term.length >= 2).slice(0, 14);
  const hits = (matched?.method_chunks ?? []).map(item => item.heading).filter(Boolean);
  const eligible = all.filter(item => !/辅助图|既有整理关联|导航/.test(item.heading) || /辅助图|教学图|图解|关联|导航/.test(message));
  const scored = eligible.map(item => {
    let score = /原理|核心|方法|条件|边界|时间线笔记|可靠性/.test(item.heading) ? 3 : 0;
    if (/辅助图|关联|练习|后续要求|分集脉络|本课速览|导航/.test(item.heading)) score -= 2;
    for (const term of terms) if (item.content.includes(term)) score += 2;
    for (const heading of hits) if (item.heading === heading || item.content.includes(`### ${heading}`)) score += 4;
    return { item, score };
  }).filter(row => row.score > 0).sort((a, b) => b.score - a.score || a.item.lineStart - b.item.lineStart);
  const boundaries = eligible.filter(item => /条件|边界|局限|可靠性|适用|限制|反例/.test(item.heading));
  return [...new Set([...scored.slice(0, 4).map(row => row.item), ...boundaries])].sort((a, b) => a.lineStart - b.lineStart);
}

/** A bounded local reader. Inputs select known courses, never arbitrary local paths. */
export class LearningSourceReader {
  constructor({ projectRoot, knowledgeConfig, scope = 'production', spawnImpl = spawn } = {}) {
    if (!projectRoot) throw new TypeError('projectRoot is required');
    this.projectRoot = path.resolve(projectRoot);
    this.knowledgeConfig = knowledgeConfig;
    this.scope = scope;
    this.spawnImpl = spawnImpl;
  }

  async #json(script, args, { configPath, cwd = this.projectRoot } = {}) {
    return new Promise((resolve, reject) => {
      let child; let stdout = ''; let settled = false;
      const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(value); };
      const timer = setTimeout(() => { child?.kill?.(); finish(new Error('本地资料读取超时。')); }, 20000);
      const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', KNOWLEDGE_TREE_CONFIG: configPath };
      for (const key of Object.keys(env)) if (/^(OPENAI_API_KEY|CODEX_API_KEY|LEARNING_API_KEY|OPENAI_BASE_URL|CODEX_BASE_URL)$/i.test(key)) delete env[key];
      try { child = this.spawnImpl('python', ['-B', '-X', 'utf8', script, ...args], { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); }
      catch { finish(new Error('本地知识读取工具无法启动。')); return; }
      child.stdout?.setEncoding?.('utf8');
      child.stdout?.on('data', chunk => { stdout += chunk; if (Buffer.byteLength(stdout) > MAX_PROCESS_OUTPUT) { child.kill?.(); finish(new Error('本地资料响应超出安全预算。')); } });
      child.stderr?.on('data', () => {});
      child.on('error', () => finish(new Error('本地知识读取工具不可用。')));
      child.on('close', code => {
        if (code !== 0) { finish(new Error('本地知识工具未完成读取；没有采用其摘要。')); return; }
        try { finish(null, JSON.parse(stdout)); } catch { finish(new Error('本地资料响应不是有效的读取记录。')); }
      });
    });
  }

  async #configuration() {
    const selected = this.knowledgeConfig ?? process.env.KNOWLEDGE_TREE_CONFIG ?? DEFAULT_CONFIG;
    if (typeof selected !== 'string' || !path.isAbsolute(selected)) throw new Error('知识树配置必须是已确定的绝对文件路径。');
    const configPath = await realpath(selected);
    const workspace = path.dirname(path.dirname(configPath));
    const loader = path.join(workspace, 'skills', 'operate-personal-knowledge-tree', 'scripts', 'knowledge_tree_config.py');
    const config = await this.#json(loader, [], { configPath, cwd: workspace });
    if (!config || typeof config !== 'object' || ![1, 2].includes(config.version)) throw new Error('共享配置加载器未确认有效配置版本。');
    if (typeof config.config_path !== 'string' || !samePath(await realpath(config.config_path), configPath)) throw new Error('共享配置加载器返回了不同的配置身份。');
    if (!['workspace', 'vault', 'learning_root', 'skills_root'].every(key => typeof config[key] === 'string' && path.isAbsolute(config[key]))) throw new Error('共享配置加载器未确认绝对工作区、学习分区与技能源路径。');
    config.vault = await realpath(config.vault);
    config.learning_root = await realpath(config.learning_root);
    config.skills_root = await realpath(config.skills_root);
    if (!inside(config.learning_root, config.vault)) throw new Error('学习资料目录越出当前配置的 Vault。');
    return { ...config, config_path: configPath };
  }

  async read({ message = '', courseId, chapter, selectedSource, artifact } = {}) {
    const sources = []; const warnings = [];
    const result = { sources, warnings, capabilities: { ...CAPABILITIES } };
    if (artifact && typeof artifact === 'object') {
      if (artifact.kind === 'media_reference') {
        warnings.push('本次只收到媒体引用，文字模型未查看图片、未听原声、未连续审看视频。');
        result.handoff = { reason: 'media_evidence_required', title: artifact.title || '待核验媒体', version: artifact.version ?? null,
          reference: typeof artifact.text === 'string' ? artifact.text : '', capabilities: { ...CAPABILITIES } };
      } else if (typeof artifact.text === 'string' && artifact.text.trim()) {
        const original = artifact.text; const content = original.slice(0, MAX_DOCUMENT);
        const limitations = [artifact.kind === 'transcript' ? '这是用户提供的转录文字；未听原录音，不能据此判断声音与表演。' : '这是用户本次提供的文字，未经外部原件核验。'];
        if (content.length < original.length) { limitations.push('用户文字超出本次上下文预算，当前只读到明确标记的前段。'); warnings.push(limitations.at(-1)); }
        sources.push({ id: `user-text:${digest(original).slice(0, 20)}`, title: artifact.title || '本次用户文字', path: null, heading: null,
          lineStart: 1, lineEnd: content.split('\n').length, documentHash: digest(original), snapshot: `input:${digest(original)}`,
          scope: { kind: 'current_user_input', version: artifact.version ?? null }, content, coverage: content === original ? 'document' : 'section', sourceKind: 'user_text',
          authorship: artifact.authorship ?? 'user_provided', origin: artifact.origin ?? artifact.authorship ?? 'user_provided', helpLevel: artifact.helpLevel ?? '帮助程度未记录；不推断独立完成', limitations });
      }
    }
    const selection = locateCourse(String(message), courseId, chapter, selectedSource);
    if (selection.error) { warnings.push(selection.error); return result; }
    if (!selection.id) return result;
    if (selection.id === 'C003') { warnings.push('影视飓风剪辑课的名称与版本尚未绑定正式正文；本次没有读取对应课程，不以其他剪辑笔记替代。'); return result; }
    if (!Object.hasOwn(COURSES, selection.id)) { warnings.push('当前课程身份未绑定可读取的正式课文。'); return result; }
    warnings.push('这里读取的是现有正式课程资料候选；用户所学版本尚未核实，课文存在与课数不表示本人学习进度或掌握。');
    if (!selection.chapter) { warnings.push('当前具体课次尚未确定；没有按历史模糊停点猜测下一课。'); return result; }
    try {
      const config = await this.#configuration();
      const courseRoot = await realpath(path.join(config.learning_root, '课程', COURSES[selection.id]));
      if (!inside(courseRoot, config.learning_root)) throw new Error('课程目录越出已确认学习范围。');
      const matches = (await readdir(courseRoot)).filter(name => new RegExp(`^${String(selection.chapter).padStart(2, '0')} - 第.+课.+\\.md$`).test(name)
        && !/历史|备份|旧稿|总结|summary|backup/i.test(name));
      if (matches.length !== 1) throw new Error('该课次尚不能唯一定位到新版正式课级正文。');
      const filename = await realpath(path.join(courseRoot, matches[0]));
      if (!inside(filename, courseRoot) || !(await stat(filename)).isFile() || (await stat(filename)).size > 512 * 1024) throw new Error('课文身份或大小不符合受控读取范围。');
      const raw = await readFile(filename); const markdown = raw.toString('utf8').replace(/^\uFEFF/, ''); const documentHash = digest(raw);
      const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown)?.[1] ?? '';
      if (!/^类型:\s*分集笔记\s*$/m.test(frontmatter) || !/^材料类型:\s*Bilibili课级笔记\s*$/m.test(frontmatter)
        || !frontmatter.includes(`课程: ${COURSES[selection.id]}`) || /^状态:\s*(?:撤回|已撤回|停用|已失效)\s*$/m.test(frontmatter)) throw new Error('目标不是当前有效的正式课级笔记。');
      const scriptRoot = path.join(config.skills_root, 'apply-film-knowledge', 'scripts');
      let retrieval;
      try { retrieval = await this.#json(path.join(scriptRoot, 'retrieve_knowledge.py'), ['--config', config.config_path,
        '--query', String(message || `${COURSES[selection.id]} 第${selection.chapter}课的原理、方法与适用条件`), '--include-path', filename, '--no-cache', '--limit', '3'], { configPath: config.config_path }); }
      catch (error) { warnings.push(error.message); }
      const card = [...(retrieval?.candidates ?? []), ...(retrieval?.source_candidates ?? [])].find(item => typeof item.path === 'string'
        && samePath(path.isAbsolute(item.path) ? item.path : path.join(config.vault, item.path), filename));
      if (retrieval && !card) warnings.push('检索未返回所选正式课文的直接命中；默认创作区结果未作为本课依据。');
      const all = sections(markdown);
      const chosen = chooseSections(all, String(message), card, selection);
      const scope = retrieval?.scope ?? { kind: 'explicit_course_document', include_paths: [path.relative(config.vault, filename).split(path.sep).join('/')] };
      const snapshot = retrieval?.snapshot ?? `document:${documentHash}`;
      const title = /^# (.+)$/m.exec(markdown)?.[1]?.trim() || matches[0].replace(/\.md$/, '');
      const limitations = ['只读本地正式课文，不等于本次核验了外部原视频。', '用户所学课程版本仍未核实；未据资料数量推断本人进度或掌握。'];
      const reliability = /^完整程度:\s*(.+)$/m.exec(frontmatter)?.[1]?.trim(); if (reliability) limitations.push(`课文披露：${reliability}`);
      const make = (content, coverage, heading, lineStart, lineEnd, extra = []) => ({ id: `course:${selection.id}:${selection.chapter}${heading ? `:${digest(heading).slice(0, 12)}` : ''}`,
        title, path: filename, heading, lineStart, lineEnd, documentHash, snapshot, scope, content, coverage, sourceKind: 'course_note', limitations: [...limitations, ...extra] });
      if ((selection.heading || selection.sectionId) && !chosen.length) { warnings.push('所选章节不存在或不唯一，未用同名片段猜测替代。'); return result; }
      if (!chosen.length || chosen.some(item => item.content.length > MAX_DOCUMENT) || !retrieval) {
        if (markdown.length <= MAX_DOCUMENT) sources.push(make(markdown, 'document', null, 1, markdown.split('\n').length, ['采用已唯一定位的完整课文作为受控后备；没有将检索摘要视为全文。']));
        else warnings.push('指定课文超出完整后备预算，当前未取得可交付的完整方法章节；需缩小到一个具体章节。');
        if (digest(await readFile(filename)) !== documentHash) { result.sources = sources.filter(item => item.sourceKind !== 'course_note'); warnings.push('读取期间课文版本变化，已撤回本次课程依据；需要重新读取。'); }
        return result;
      }
      let used = 0;
      for (const item of chosen) {
        if (used + item.content.length > MAX_DOCUMENT) { warnings.push(`“${item.heading}”完整章节超出本次资料预算，未提供该章，不声称已经完整读取全课。`); continue; }
        let content = item.content; let chapterScope = scope; let chapterSnapshot = snapshot;
        try {
          const read = await this.#json(path.join(scriptRoot, 'read_knowledge_section.py'), ['--config', config.config_path, '--path', filename,
            '--heading', item.heading, '--include-path', filename, '--max-chars', String(MAX_DOCUMENT)], { configPath: config.config_path });
          if (typeof read.path !== 'string' || !samePath(read.path, filename) || read.document_hash !== documentHash || read.heading !== item.heading || read.truncated || read.read_required
            || typeof read.content !== 'string' || read.content.replaceAll('\r\n', '\n').trim() !== item.content.replace(/^## .+\n/, '').replaceAll('\r\n', '\n').trim()) throw new Error('章节读取身份、范围或版本与当前课文不一致。');
          chapterScope = read.scope; chapterSnapshot = read.snapshot;
        } catch (error) { warnings.push(`${item.heading}：${error.message} 已按同一课文文件核对完整章节，未采用截断摘要。`); }
        sources.push({ ...make(content, 'section', item.heading, item.lineStart, item.lineEnd), scope: chapterScope, snapshot: chapterSnapshot });
        used += content.length;
      }
      const finalRaw = await readFile(filename); if (digest(finalRaw) !== documentHash) {
        result.sources = sources.filter(item => item.sourceKind !== 'course_note'); warnings.push('读取期间课文版本变化，已撤回本次课程依据；需要重新读取。');
      }
    } catch (error) { warnings.push(`课程取材缺口：${error.message}`); }
    return result;
  }
}
