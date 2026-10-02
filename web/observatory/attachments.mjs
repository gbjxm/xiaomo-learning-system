import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { fail, newId, hash, id } from './model.mjs';

export const UPLOAD_LIMITS = Object.freeze({ image: 20 * 1024 ** 2, video: 250 * 1024 ** 2, audio: 50 * 1024 ** 2, text: 5 * 1024 ** 2, pdf: 20 * 1024 ** 2 });
const TYPES = {
  '.png': ['image/png', 'image'], '.jpg': ['image/jpeg', 'image'], '.jpeg': ['image/jpeg', 'image'],
  '.webp': ['image/webp', 'image'], '.gif': ['image/gif', 'image'], '.mp4': ['video/mp4', 'video'],
  '.webm': ['video/webm', 'video'], '.mp3': ['audio/mpeg', 'audio'], '.wav': ['audio/wav', 'audio'],
  '.txt': ['text/plain', 'text'], '.md': ['text/markdown', 'text'], '.pdf': ['application/pdf', 'pdf']
};
const inspectionCache = new Map();
let mediaQueue = Promise.resolve(); let queuedMedia = 0;
function inside(child, parent) { const r = path.relative(parent, child); return !!r && r !== '..' && !r.startsWith(`..${path.sep}`) && !path.isAbsolute(r); }
export function validateFilename(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > 240 || /[\\/:\x00-\x1f\x7f]/.test(raw) || raw === '.' || raw === '..' || /[. ]$/.test(raw))
    fail('INVALID_FILENAME', '文件名必须是普通名称，不能包含路径、控制字符或末尾的点/空格。');
  const ext = path.extname(raw).toLowerCase(); const type = TYPES[ext];
  if (!type) fail('UNSUPPORTED_FILE_TYPE', '仅支持 PNG/JPEG/WebP/GIF、MP4/WebM、MP3/WAV、TXT/MD 和 PDF；不接收 HTML、SVG 或可执行文件。', { extension: ext });
  return { filename: raw, extension: ext, mimeType: type[0], kind: type[1], limit: UPLOAD_LIMITS[type[1]] };
}
export function attachmentRoot(identity) { return path.join(path.dirname(path.dirname(identity.canonicalDbPath)), 'attachments'); }
export async function hashFile(filename) {
  const digest = createHash('sha256'); for await (const chunk of fs.createReadStream(filename)) digest.update(chunk); return digest.digest('hex');
}
async function trustedDirectory(dir, parent) {
  await fsp.mkdir(dir, { recursive: true });
  const actual = await fsp.realpath(dir); const canonicalParent = await fsp.realpath(parent);
  if (!inside(actual, canonicalParent) || (await fsp.lstat(dir)).isSymbolicLink()) fail('UNSAFE_FILE_PATH', '附件目录指向受控目录外，停止读写。');
  return actual;
}
export async function safeRegisteredFile(store, attachmentId) {
  id(attachmentId, 'attachmentId'); const { identity, record } = await store.readAttachment(attachmentId);
  const spec = validateFilename(record.originalFilename);
  if (record.mimeType !== spec.mimeType) fail('ATTACHMENT_UNAVAILABLE', '登记类型与白名单文件名不一致，拒绝把任意 MIME 当作附件响应。', { attachmentId });
  const root = attachmentRoot(identity); const relative = record.relativePath;
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || relative.split('/').some(p => !p || p === '..' || p === '.') || /[:\x00-\x1f]/.test(relative))
    fail('UNSAFE_FILE_PATH', '附件登记路径不合法。', { attachmentId });
  const requested = path.resolve(root, relative);
  if (!inside(requested, root) || record.status !== 'registered') fail('ATTACHMENT_UNAVAILABLE', '附件没有有效登记。', { attachmentId });
  let stats, canonical, canonicalRoot;
  try { stats = await fsp.lstat(requested); canonical = await fsp.realpath(requested); canonicalRoot = await fsp.realpath(root); }
  catch { fail('ATTACHMENT_UNAVAILABLE', '原始附件丢失；记录仍保留，不能报告可预览或下载。', { attachmentId }); }
  const moduleRoot = await fsp.realpath(path.dirname(root));
  if (!stats.isFile() || stats.isSymbolicLink() || !inside(canonicalRoot, moduleRoot) || !inside(canonical, canonicalRoot) || stats.size !== record.byteLength || await hashFile(canonical) !== record.sha256)
    fail('ATTACHMENT_UNAVAILABLE', '附件路径、大小或 SHA-256 不符；拒绝读取，保留登记记录以便恢复。', { attachmentId });
  return { identity, record, filename: canonical, stats };
}
function signature(prefix, spec) {
  switch (spec.mimeType) {
    case 'image/png': return prefix.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    case 'image/jpeg': return prefix[0] === 255 && prefix[1] === 216 && prefix[2] === 255;
    case 'image/gif': return ['GIF87a', 'GIF89a'].includes(prefix.subarray(0, 6).toString('ascii'));
    case 'image/webp': return prefix.subarray(0, 4).toString('ascii') === 'RIFF' && prefix.subarray(8, 12).toString('ascii') === 'WEBP';
    case 'video/mp4': return prefix.length >= 12 && prefix.subarray(4, 8).toString('ascii') === 'ftyp';
    case 'video/webm': return prefix.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]));
    case 'audio/wav': return prefix.subarray(0, 4).toString('ascii') === 'RIFF' && prefix.subarray(8, 12).toString('ascii') === 'WAVE';
    case 'audio/mpeg': return prefix.subarray(0, 3).toString('ascii') === 'ID3' || (prefix[0] === 255 && (prefix[1] & 224) === 224);
    case 'application/pdf': return prefix.subarray(0, 5).toString('ascii') === '%PDF-';
    default: return true;
  }
}
export function localCommand(command, args, { timeoutMs = 90_000, outputLimit = 1024 * 1024, input } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }); let out = '', err = '', over = false;
    const timer = setTimeout(() => { over = true; child.kill(); }, timeoutMs);
    child.stdout.on('data', b => { out += b.toString('utf8'); if (out.length > outputLimit) { over = true; child.kill(); } });
    child.stderr.on('data', b => { err += b.toString('utf8'); if (err.length > outputLimit) { over = true; child.kill(); } });
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', code => { clearTimeout(timer); resolve({ code, stdout: out, stderr: err, limited: over }); });
    child.stdin.on('error', () => {}); child.stdin.end(input === undefined ? undefined : input);
  });
}
// Local decoding checks file integrity, never the meaning of the image, motion or sound.
export function inspectAttachment(filename, originalFilename) {
  const spec = validateFilename(originalFilename);
  if (['text', 'pdf'].includes(spec.kind)) return inspectAttachmentUnlocked(filename, originalFilename);
  if (queuedMedia >= 10) fail('MEDIA_CHECK_BUSY', '本地媒体检查正在排队，请稍后重试；没有自动增加并行进程。', {}, true);
  queuedMedia++; const job = mediaQueue.then(() => inspectAttachmentUnlocked(filename, originalFilename));
  mediaQueue = job.catch(() => {}).finally(() => { queuedMedia--; }); return job;
}
async function inspectAttachmentUnlocked(filename, originalFilename) {
  const spec = validateFilename(originalFilename); const stat = await fsp.stat(filename);
  if (!stat.size || stat.size > spec.limit) fail('UPLOAD_TOO_LARGE', '文件为空或超过该类型大小限制。', { byteLength: stat.size, limit: spec.limit, kind: spec.kind });
  const handle = await fsp.open(filename, 'r'); const prefix = Buffer.alloc(32); let bytesRead;
  try { ({ bytesRead } = await handle.read(prefix, 0, prefix.length, 0)); } finally { await handle.close(); }
  if (!signature(prefix.subarray(0, bytesRead), spec)) fail('FILE_TYPE_MISMATCH', '文件内容签名与扩展名不一致；未登记或引用这个文件。', { filename: originalFilename });
  const base = { saved: true, accessible: true, preview: false, previewKind: 'download', read: false, researched: false, integrity: 'signature_checked',
    inspectionScope: 'file_integrity_only', researchReadingScope: 'see_topic_sources.verificationScope', limitations: [] };
  if (spec.kind === 'text') {
    const raw = await fsp.readFile(filename); let decoded;
    try { decoded = new TextDecoder('utf-8', { fatal: true }).decode(raw); } catch { fail('INVALID_TEXT_ENCODING', '文字附件需要 UTF-8 编码；无法安全解码，未保存为文字附件。'); }
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(decoded)) fail('FILE_TYPE_MISMATCH', '文字附件包含二进制控制字符，拒绝将它当作文字保存。');
    return { ...base, preview: true, previewKind: 'text', integrity: 'utf8_checked', limitations: ['可查看文本不代表已完成内容研究。'] };
  }
  if (spec.kind === 'pdf') {
    // PDF may contain active actions; offer an original download, never inject it in the page.
    const h = await fsp.open(filename, 'r'); const tail = Buffer.alloc(Math.min(2048, stat.size));
    try { await h.read(tail, 0, tail.length, stat.size - tail.length); } finally { await h.close(); }
    if (!tail.includes(Buffer.from('%%EOF'))) fail('DAMAGED_FILE', 'PDF 缺少结束标记，文件可能截断；未登记。');
    return { ...base, limitations: ['仅检查 PDF 文件头与结束标记；提供下载，不声明结构完整、正文已读取或网页可预览。'] };
  }
  let probe;
  try { probe = await localCommand('ffprobe', ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_entries', 'stream=index,codec_name,codec_type,width,height,pix_fmt:format=duration,format_name', '-of', 'json', filename], { timeoutMs: 30_000 }); }
  catch (error) {
    if (error.code === 'ENOENT') return { ...base, limitations: ['本机 FFprobe 不可用；仅签名检查，保留原文件供下载，预览能力未确认。'] };
    throw error;
  }
  if (probe.limited) return { ...base, limitations: ['本地格式探测超时；保留原文件供下载，预览和完整性未确认。'] };
  if (probe.code !== 0) fail('DAMAGED_FILE', '本地格式探测无法读取这个文件；可能损坏或不支持该编码，未登记。', { detail: probe.stderr.slice(0, 500) });
  let parsed; try { parsed = JSON.parse(probe.stdout); } catch { fail('MEDIA_PROBE_FAILED', '本地媒体探测结果不是合法 JSON。'); }
  const videos = parsed.streams?.filter(s => s.codec_type === 'video') ?? []; const audios = parsed.streams?.filter(s => s.codec_type === 'audio') ?? [];
  if ((['image', 'video'].includes(spec.kind) && !videos.length) || (spec.kind === 'audio' && !audios.length)) fail('FILE_TYPE_MISMATCH', '容器中没有对应的图像或声音内容。');
  if (videos.some(s => !s.width || !s.height)) fail('DAMAGED_FILE', '图像或视频没有有效尺寸，可能损坏，未登记。');
  if (videos.some(s => s.width * s.height > 80_000_000)) fail('UNSUPPORTED_MEDIA_DIMENSIONS', '图像超过第一版 8000 万像素限制。');
  const fmt = parsed.format?.format_name ?? '';
  if (spec.mimeType === 'video/webm' && !/webm/.test(fmt)) fail('FILE_TYPE_MISMATCH', '扩展名为 WebM，但探测结果不是 WebM 容器。');
  let decode;
  try { decode = await localCommand('ffmpeg', ['-nostdin', '-v', 'error', '-xerror', '-threads', '1', '-protocol_whitelist', 'file,pipe', '-i', filename, '-threads', '1', '-f', 'null', '-'], { timeoutMs: 90_000 }); }
  catch (error) {
    if (error.code === 'ENOENT') return { ...base, integrity: 'container_checked', limitations: ['本机 FFmpeg 不可用；仅容器探测，保留下载，完整解码未确认。'] };
    throw error;
  }
  if (decode.limited) return { ...base, integrity: 'container_checked', limitations: ['本地完整解码校验超过时间或输出限制；文件已保存供下载，完整性与浏览器预览未确认。'] };
  if (decode.code !== 0) fail('DAMAGED_FILE', '本地解码校验失败；可能损坏或本机无法解码，未登记。', { detail: decode.stderr.slice(0, 500) });
  const videoCodec = videos[0]?.codec_name; const audioCodecs = audios.map(s => s.codec_name);
  const canPlayVideo = spec.mimeType === 'video/mp4' ? videoCodec === 'h264' && videos[0]?.pix_fmt === 'yuv420p' && audioCodecs.every(c => ['aac', 'mp3'].includes(c))
    : ['vp8', 'vp9', 'av1'].includes(videoCodec) && audioCodecs.every(c => ['opus', 'vorbis'].includes(c));
  const canPlayAudio = spec.mimeType === 'audio/mpeg' ? audioCodecs.every(c => c === 'mp3') : audioCodecs.every(c => ['pcm_s16le', 'pcm_u8', 'pcm_f32le'].includes(c));
  const preview = spec.kind === 'image' || (spec.kind === 'audio' && canPlayAudio) || (spec.kind === 'video' && canPlayVideo);
  return { ...base, preview, previewKind: preview ? spec.kind : 'download', integrity: 'local_decode_checked',
    ...(Number.isFinite(Number(parsed.format?.duration)) ? { durationSeconds: Number(parsed.format.duration) } : {}),
    ...(videos[0] ? { width: videos[0].width, height: videos[0].height, codec: videoCodec } : {}),
    limitations: [preview ? '本机格式与解码检查通过；是否在当前浏览器播放仍以实际播放结果为准。' : '原文件已保存；当前编码未列为网页可播放格式，请下载原文件。', '格式及解码校验不代表已观察、理解或研究声画内容。'] };
}
async function capabilitiesFor(filename, record, stat) {
  const key = `${filename}:${stat.size}:${stat.mtimeMs}:${record.sha256}`;
  if (inspectionCache.has(key)) return inspectionCache.get(key);
  const capabilities = await inspectAttachment(filename, record.originalFilename); if (inspectionCache.size > 100) inspectionCache.clear(); inspectionCache.set(key, capabilities); return capabilities;
}
export async function getAttachmentInfo(store, attachmentId) {
  const file = await safeRegisteredFile(store, attachmentId);
  return { identity: file.identity, record: file.record, capabilities: await capabilitiesFor(file.filename, file.record, file.stats) };
}
export async function receiveUpload(req, store, { identity, submissionId, permissionStatus = 'unknown' } = {}) {
  const actual = await store.identity();
  if (hash(actual) !== hash(identity)) fail('STORE_IDENTITY_MISMATCH', '上传目标身份不符，未接收附件。');
  id(submissionId, 'submissionId');
  let name; try { name = decodeURIComponent(req.headers['x-file-name'] ?? ''); } catch { fail('INVALID_FILENAME', '上传文件名编码不合法。'); }
  const spec = validateFilename(name); const headerMime = (req.headers['content-type'] ?? '').split(';')[0].toLowerCase();
  if (headerMime && headerMime !== 'application/octet-stream' && headerMime !== spec.mimeType && !(spec.kind === 'text' && headerMime === 'text/plain') && !(spec.extension === '.wav' && ['audio/x-wav', 'audio/wave'].includes(headerMime)))
    fail('FILE_TYPE_MISMATCH', '上传 Content-Type 与扩展名不一致；内容仍须经过签名和格式检查。');
  const length = req.headers['content-length'];
  if (length !== undefined && (!/^\d+$/.test(length) || Number(length) > spec.limit || Number(length) < 1)) fail('UPLOAD_TOO_LARGE', '文件为空或超过该类型限制。', { kind: spec.kind, limit: spec.limit });
  const root = await trustedDirectory(attachmentRoot(identity), path.dirname(path.dirname(identity.canonicalDbPath)));
  const tempRoot = await trustedDirectory(path.join(root, '.incoming'), root); const temp = path.join(tempRoot, `${newId('upload')}.part`);
  let moved = false; let finalPath; let received = 0; const digest = createHash('sha256');
  try {
    const counter = new Transform({ transform(chunk, _encoding, cb) { received += chunk.length; if (received > spec.limit) { cb(Object.assign(new Error('超过文件大小限制'), { code: 'UPLOAD_TOO_LARGE' })); return; } digest.update(chunk); cb(null, chunk); } });
    try { await pipeline(req, counter, fs.createWriteStream(temp, { flags: 'wx' })); }
    catch (error) { if (error.code === 'UPLOAD_TOO_LARGE') fail('UPLOAD_TOO_LARGE', '上传超过该类型限制；临时文件已清理，没有登记附件。', { kind: spec.kind, limit: spec.limit }); fail('UPLOAD_INTERRUPTED', '上传中断或写入失败；没有登记附件，可重新选择文件。', { cause: error.message }, true); }
    if (req.aborted || !received || (length !== undefined && received !== Number(length))) fail('UPLOAD_INTERRUPTED', '上传未完整结束，没有登记附件。', {}, true);
    const durable = await fsp.open(temp, 'r+'); try { await durable.sync(); } finally { await durable.close(); }
    const sha256 = digest.digest('hex'); if (await hashFile(temp) !== sha256) fail('UPLOAD_INTEGRITY_FAILED', '落盘文件 SHA-256 与上传流不符，未登记。');
    const capabilities = await inspectAttachment(temp, name);
    // A submission determines the ID, so an identical network retry registers no second attachment.
    const attachmentId = `att_${hash({ storeId: identity.storeId, submissionId }).slice(0, 40)}`;
    const relativePath = `${attachmentId}-${sha256}${spec.extension}`; finalPath = path.join(root, relativePath);
    try { await fsp.link(temp, finalPath); moved = true; }
    catch (error) { if (error.code !== 'EEXIST') throw error; const st = await fsp.lstat(finalPath); if (!st.isFile() || st.isSymbolicLink() || st.size !== received || await hashFile(finalPath) !== sha256) fail('ATTACHMENT_COLLISION', '附件目标文件已存在但内容不同，停止登记。'); }
    await fsp.unlink(temp);
    const attachment = { attachmentId, originalFilename: name, relativePath, mimeType: spec.mimeType, byteLength: received, sha256, permissionStatus };
    try {
      const result = await store.registerAttachment({ identity, submissionId, attachment });
      const check = await safeRegisteredFile(store, attachmentId); const key = `${check.filename}:${check.stats.size}:${check.stats.mtimeMs}:${sha256}`; inspectionCache.set(key, capabilities);
      return { ...result, attachment: check.record, capabilities };
    } catch (error) {
      // Keep the complete original for safe replay: registration may have committed before its verification failed.
      error.details = { ...(error.details ?? {}), recovery: '原件已完整归位；保留相同 submissionId、文件名及文件内容重试。未显示登记成功，不自动删除可能已引用的原件。', storedFile: path.basename(finalPath), sha256, createdOriginal: moved };
      throw error;
    }
  } finally { try { await fsp.unlink(temp); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
}
function disposition(name, download) { return `${download ? 'attachment' : 'inline'}; filename="attachment${path.extname(name).replace(/[^.a-z0-9]/gi, '')}"; filename*=UTF-8''${encodeURIComponent(name).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`; }
export async function sendFileResponse(req, res, filename, { mimeType = 'application/octet-stream', originalFilename = path.basename(filename), download = true, sha256 } = {}) {
  const size = (await fsp.stat(filename)).size; let start = 0, end = size - 1, partial = false;
  const range = req.headers.range;
  if (range !== undefined) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range); let valid = !!match && (!!match[1] || !!match[2]);
    if (valid) {
      if (!match[1]) { const suffix = Number(match[2]); valid = Number.isSafeInteger(suffix) && suffix > 0; start = Math.max(0, size - suffix); }
      else { start = Number(match[1]); end = match[2] ? Number(match[2]) : size - 1; valid = Number.isSafeInteger(start) && Number.isSafeInteger(end) && start < size && end >= start; end = Math.min(end, size - 1); }
    }
    if (!valid || size === 0) { res.writeHead(416, { 'Content-Range': `bytes */${size}`, 'Content-Length': '0', 'X-Content-Type-Options': 'nosniff' }); res.end(); return; }
    partial = true;
  }
  res.writeHead(partial ? 206 : 200, { 'Content-Type': mimeType, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes',
    'Content-Disposition': disposition(originalFilename, download), 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; sandbox", ...(sha256 ? { ETag: `"${sha256}"` } : {}), ...(partial ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}) });
  if (req.method === 'HEAD') { res.end(); return; }
  try { await pipeline(fs.createReadStream(filename, { start, end }), res); } catch (error) { if (!res.destroyed) res.destroy(error); }
}
export async function attachmentResponse(req, res, store, attachmentId, { download = false } = {}) {
  const file = await safeRegisteredFile(store, attachmentId); const spec = validateFilename(file.record.originalFilename);
  // PDFs and unverified codecs remain downloads; text is plain text, never HTML.
  const info = await capabilitiesFor(file.filename, file.record, file.stats);
  return sendFileResponse(req, res, file.filename, { mimeType: spec.kind === 'text' ? 'text/plain; charset=utf-8' : spec.mimeType,
    originalFilename: file.record.originalFilename, download: download || !info.preview, sha256: file.record.sha256 });
}
