"""Bounded local evidence extraction. No install, OCR, ASR or remote service."""
import argparse
import hashlib
import importlib.util
import importlib.metadata
import json
import math
import re
import shutil
import subprocess
import sys
from pathlib import Path
from fractions import Fraction


def sha256(file):
    digest = hashlib.sha256()
    with file.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def local_path(value):
    path = Path(value)
    name = str(path)
    if not path.is_absolute() or name.startswith(('\\\\', '//')) or any(ord(c) < 32 for c in name):
        raise ValueError('必须是绝对普通本地路径，不接受 URL/UNC/设备路径。')
    if sys.platform == 'win32' and (not re.fullmatch(r'[A-Za-z]:', path.drive) or ':' in name[len(path.drive):]):
        raise ValueError('不接受 Windows 设备路径或备用数据流。')
    return path


def local_file(value):
    file = local_path(value)
    if file.is_symlink() or not file.is_file():
        raise ValueError('file 必须是存在的普通文件。')
    return local_path(file.resolve(strict=True))


def call(arguments, timeout=60):
    result = subprocess.run(arguments, stdin=subprocess.DEVNULL, capture_output=True, text=True,
                            encoding='utf-8', errors='replace', timeout=timeout,
                            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    if result.returncode:
        raise RuntimeError('本地工具未成功：' + result.stderr[-1800:])
    return result


def capabilities():
    distributions = {'fitz': 'PyMuPDF', 'PIL': 'Pillow', 'scenedetect': 'scenedetect',
                     'faster_whisper': 'faster-whisper', 'whisper': 'openai-whisper', 'docling': 'docling'}
    modules = {}
    for module, distribution in distributions.items():
        present = bool(importlib.util.find_spec(module))
        try:
            version = importlib.metadata.version(distribution) if present else None
        except importlib.metadata.PackageNotFoundError:
            version = 'metadata unavailable'
        modules[module] = {'available': present, 'version': version, 'executed': False}
    commands = {}
    for name in ['ffmpeg', 'ffprobe']:
        binary = shutil.which(name)
        commands[name] = {'available': bool(binary), 'path': binary,
                          'version': call([binary, '-version'], timeout=10).stdout.splitlines()[0] if binary else None}
    return {'python': sys.version.split()[0], 'modules': modules, 'commands': commands,
            'automaticInstallation': False, 'automaticModelDownload': False,
            'semanticReadOrListeningPerformed': False}


def page_numbers(value, total):
    selected = []
    for part in value.split(','):
        match = re.fullmatch(r'(\d+)(?:-(\d+))?', part.strip())
        if not match:
            raise ValueError('pages 使用1起的逗号列表/页段，如1,3-4。')
        start, end = int(match[1]), int(match[2] or match[1])
        if not 1 <= start <= end <= total:
            raise ValueError('pages 超出真实页数或倒序。')
        selected.extend(range(start, end + 1))
    return sorted(set(selected))


def read_text(args, source, output):
    value = source.read_text(encoding=args.encoding, errors='strict')
    lines = value.splitlines()
    first, last = 1, len(lines)
    if args.lines:
        match = re.fullmatch(r'(\d+):(\d+)', args.lines)
        if not match:
            raise ValueError('lines 使用从1起的起止行，如251:255。')
        first, last = int(match[1]), int(match[2])
    if not lines or not 1 <= first <= last <= len(lines):
        raise ValueError('文本为空或行范围越界。')
    excerpt = '\n'.join(f'{i}\t{lines[i-1]}' for i in range(first, last + 1))
    (output / '定位文本.txt').write_text(excerpt + '\n', encoding='utf-8')
    return {'engine': 'Python strict text read', 'encoding': args.encoding, 'totalLines': len(lines),
            'readLines': [first, last], 'excerpt': '定位文本.txt', 'replacementCharacters': value.count('\ufffd'),
            'limits': ['电子转录行号不是古籍原页；需要原页影像核字时另查。']}


def read_pdf(args, source, output):
    import fitz
    with fitz.open(source) as document:
        if document.needs_pass:
            raise ValueError('加密PDF需要授权解密后再读取，本脚本不猜密码。')
        selected = page_numbers(args.pages, len(document))
        pages = []
        for number in selected:
            page = document[number - 1]
            text = page.get_text('text', sort=False)
            text_name, image_name = f'page-{number:04}.txt', f'page-{number:04}.png'
            (output / text_name).write_text(text, encoding='utf-8')
            page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False).save(output / image_name)
            suspect = not text.strip() or '\ufffd' in text
            pages.append({'page': number, 'text': text_name, 'image': image_name,
                          'characters': len(text), 'requiresVisualReview': True,
                          'suspectExtraction': suspect, 'ocrPerformed': False})
        return {'engine': 'existing PyMuPDF', 'pageCount': len(document), 'pages': pages,
                'limits': ['原页图需实际查看；文字顺序/断栏/字形不由提取成功证明。', '未运行OCR或外部解析模型。']}


def seconds(value):
    result = float(value)
    if not math.isfinite(result) or result < 0:
        raise ValueError('时间必须是有限非负秒数。')
    return result


def read_video(args, source, output):
    ffprobe, ffmpeg = shutil.which('ffprobe'), shutil.which('ffmpeg')
    if not ffprobe or not ffmpeg:
        raise ValueError('缺少本机 FFmpeg/FFprobe；未安装或替换环境。')
    demux = {'.mp4': 'mov', '.webm': 'matroska', '.mp3': 'mp3', '.wav': 'wav'}.get(source.suffix.lower())
    if not demux:
        raise ValueError('媒体读取限定现有支持的MP4/WebM/MP3/WAV，不解析播放清单或远程引用。')
    input_args = ['-protocol_whitelist', 'file,pipe', '-f', demux, '-i', str(source)]
    probed = call([ffprobe, '-v', 'error', '-protocol_whitelist', 'file,pipe', '-f', demux,
                   '-show_format', '-show_streams', '-of', 'json', str(source)])
    metadata = json.loads(probed.stdout)
    (output / 'ffprobe.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')
    videos = [s for s in metadata['streams'] if s['codec_type'] == 'video']
    audios = [s for s in metadata['streams'] if s['codec_type'] == 'audio']
    duration = float(metadata.get('format', {}).get('duration') or (videos[0].get('duration', 0) if videos else audios[0].get('duration', 0) if audios else 0))
    start = seconds(args.start or 0)
    end = seconds(args.end) if args.end is not None else None
    if start >= duration or (end is not None and not start < end <= duration + 0.001):
        raise ValueError('读取范围超出时长或为空。')
    selected = [seconds(v.strip()) for v in args.frames.split(',')] if args.frames else []
    if len(selected) > 20 or any(v >= duration for v in selected):
        raise ValueError('最多抽20个定位帧，时间不能超出视频时长。')
    if selected and not videos:
        raise ValueError('原件无视频轨。')
    if any(v < start or (end is not None and v >= end) for v in selected):
        raise ValueError('定位帧请求须位于读取范围 [start, end)，末点不包含。')
    stream_start = float(videos[0].get('start_time') or 0) if videos else 0
    frames = []
    for index, requested in enumerate(selected):
        file = output / f'frame-{index:03}.png'
        target = requested + stream_start
        result = call([ffmpeg, '-hide_banner', '-nostdin', '-loglevel', 'info', '-copyts', *input_args,
                       '-map', '0:v:0', '-vf', f'select=gte(t\\,{target:.9f}),showinfo',
                       '-frames:v', '1', '-fps_mode', 'passthrough', '-n', str(file)])
        match = re.search(r'\bn:\s*0\s+pts:\s*(-?\d+)\s+pts_time:([0-9.eE+-]+)', result.stderr)
        time_base = re.search(r'config in time_base:\s*(\d+/\d+)', result.stderr)
        if not file.is_file() or not match or not time_base:
            raise ValueError('没有提取可验证PTS的定位帧，不能只按平均fps补时间码。')
        pts = float(int(match[1]) * Fraction(time_base[1]))
        relative = pts - stream_start
        if relative < start or (end is not None and relative >= end):
            raise ValueError(f'请求 {requested} 秒后的实际帧位于 {relative} 秒，越出读取范围；该帧不作为范围内依据。')
        frames.append({'file': file.name, 'requestedRelativeSeconds': requested, 'decodedPTS': pts,
                       'rawPTS': int(match[1]), 'timeBase': time_base[1], 'relativeSeconds': relative,
                       'sha256': sha256(file), 'actuallyViewed': False})
    audio = None
    if end is not None and audios:
        file = output / '原声范围.wav'
        call([ffmpeg, '-hide_banner', '-nostdin', '-loglevel', 'error', *input_args,
              '-ss', str(start), '-t', str(end - start), '-map', '0:a:0', '-c:a', 'pcm_s16le', '-n', str(file)])
        audio = {'file': file.name, 'rangeSeconds': [start, end], 'sourceSampleRate': audios[0].get('sample_rate'),
                 'sourceChannels': audios[0].get('channels'), 'sha256': sha256(file), 'actuallyListened': False}
    return {'engine': 'existing FFmpeg/FFprobe', 'durationSeconds': duration, 'streamStartPTS': stream_start,
            'frames': frames, 'audio': audio, 'metadata': 'ffprobe.json',
            'limits': ['抽帧不表示连续审看；PCM提取/ASR不表示实际听音。', '本脚本未判断镜头意义、人物心理、声音质感或作者意图。']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='mode', required=True)
    sub.add_parser('probe')
    for mode in ['text', 'pdf', 'video']:
        item = sub.add_parser(mode)
        item.add_argument('--file', required=True)
        item.add_argument('--output', required=True)
        if mode == 'text':
            item.add_argument('--encoding', default='utf-8'); item.add_argument('--lines')
        elif mode == 'pdf':
            item.add_argument('--pages', required=True)
        else:
            item.add_argument('--start', type=seconds); item.add_argument('--end', type=seconds); item.add_argument('--frames')
    args = parser.parse_args()
    if args.mode == 'probe':
        print(json.dumps(capabilities(), ensure_ascii=False)); return
    source = local_file(args.file)
    output = local_path(local_path(args.output).resolve(strict=False))
    if output.exists():
        raise ValueError('output 必须是新的绝对本地目录，不覆盖旧产物。')
    before = source.stat(); digest = sha256(source)
    output.mkdir(parents=True, exist_ok=False)
    try:
        result = {'text': read_text, 'pdf': read_pdf, 'video': read_video}[args.mode](args, source, output)
        after = source.stat()
        if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns) or sha256(source) != digest:
            raise ValueError('原件在读取期间改变，产物不作为可靠依据。')
        report = {'source': str(source), 'sourceSha256': digest, 'byteLength': before.st_size,
                  'status': 'extracted_not_semantically_verified', 'mode': args.mode, 'result': result}
        (output / 'manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps(report, ensure_ascii=False))
    except Exception as error:
        (output / '读取失败.json').write_text(json.dumps({'status': 'failed', 'error': str(error), 'source': str(source)}, ensure_ascii=False), encoding='utf-8')
        raise


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'ok': False, 'error': str(error)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
