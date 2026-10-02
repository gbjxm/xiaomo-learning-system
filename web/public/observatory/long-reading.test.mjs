import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const helpers = source.split('// BEGIN OBSERVATORY_READING_HELPERS')[1].split('// END OBSERVATORY_READING_HELPERS')[0];
const { readingProfile, readingPreview, readingInlineImages, partitionLongBody } = new Function(helpers + '\nreturn { readingProfile, readingPreview, readingInlineImages, partitionLongBody };')();
const esc = new Function(source.split('  const esc = ')[1].split('\n')[0].replace(/;\s*$/, '').replace(/^/, 'return '))();
const topUrl = id => '#topic/' + encodeURIComponent(id), matUrl = id => '#material/' + encodeURIComponent(id);
const kinds = { source_fact:'来源事实', direct_observation:'直接观察', ai_hypothesis:'AI 分析 / 假设', unknown:'未知 / 待核查' };
const paragraphSource = source.slice(source.indexOf('  function longParagraph('), source.indexOf('  function renderLongStage('));
const longParagraph = new Function('readingInlineImages','esc','basisKinds','topUrl','attachmentCard',paragraphSource+'\nreturn longParagraph;')(
  readingInlineImages,esc,kinds,topUrl,(id,_remove,compact)=>`<figure data-file="${esc(id)}" data-compact="${!!compact}"></figure>`);
const base = { attachmentIds:[], sourceRefs:[{sourceId:'src',locator:'原文第3行',note:'支持这一叙述'}], basisKind:'source_fact' };
const preview = {...base,paragraphId:'preview',heading:'收藏预览',markdown:'一只鸟反复衔来木石填海。这里还有第二句预览，不应被首句算法截掉。'};
const overview = {...base,paragraphId:'original-intro',heading:'内容概要',markdown:'先介绍这个故事中的人物与事件。\n\n再说明已知的经过和没有写出的结局。\n\n读完这一段无需立即去查技术资料。'};
const body = {...base,paragraphId:'original-text',heading:'原文与白话',markdown:'> 原文。\n\n白话解释。'};
const continuation = {...base,paragraphId:'continuation',heading:'',markdown:'这一段继续原章节，不需要新造一个“研究段落”标题。'};
const stage = { paragraphs:[preview,overview,body,continuation], sources:[{sourceId:'src',kind:'external',uri:'https://example.test/original',title:'原始来源',verificationScope:'只读相关段落',licenseStatus:'unknown'}], unknown:['声音未审听'],limitations:['未连续合看'],materialVersions:[] };
const topic = { topicId:'topic_test' };
const profile = readingProfile(stage);

test('card preview and self-contained overview use independent saved paragraphs, without truncation or mutation',()=>{
  const before=structuredClone(stage);
  assert.equal(profile.kind,'long'); assert.equal(profile.preview,preview); assert.equal(profile.overview,overview);
  assert.equal(readingPreview(profile),preview.markdown); assert.notEqual(readingPreview(profile),overview.markdown);
  assert.deepEqual(profile.body,[body,continuation]); assert.deepEqual(stage,before);
});
test('v3 saved introductions and older unstructured research retain their supported fallback',()=>{
  const old={paragraphs:[{...overview,heading:'这份素材讲什么',markdown:'旧简介第一句。旧简介继续。'},body]};
  const fallback=readingProfile(old); assert.equal(fallback.kind,'v3'); assert.equal(readingPreview(fallback),'旧简介第一句。');
  assert.equal(readingProfile({paragraphs:[body]}),null);
  assert.equal(readingProfile({paragraphs:[overview,preview]}),null);
  assert.equal(readingProfile({paragraphs:[preview,{...overview,markdown:' '}]}),null);
});
test('empty natural chapter headings preserve paragraph identity and evidence without inventing a new heading or card',()=>{
  const html=longParagraph(continuation,topic,stage);
  assert.match(html,/id="paragraph-continuation"/); assert.doesNotMatch(html,/<h2>|研究段落|<article|<details/);
  assert.match(html,/来源事实/); assert.match(html,/#topic\/topic_test\/source\/src/);
});
test('AI and unknown basis are visible and source links preserve locator information and stable IDs',()=>{
  const html=longParagraph({...body,heading:'<unsafe>',basisKind:'ai_hypothesis'},topic,stage);
  assert.match(html,/AI 分析 \/ 假设/); assert.match(html,/&lt;unsafe&gt;/); assert.doesNotMatch(html,/<unsafe>/);
  assert.match(html,/原文第3行 · 支持这一叙述/); assert.match(html,/来源 1/);
  assert.match(longParagraph({...continuation,basisKind:'unknown'},topic,stage),/未知 \/ 待核查/);
});
test('new article omits the card preview, keeps full overview and all body IDs, and preserves accessible reading boundaries',()=>{
  const fn=source.slice(source.indexOf('  function renderLongStage('),source.indexOf('  function renderLongTopic('));
  const render=new Function('mat','longParagraph','list','readingStageRecord','readingSources','partitionLongBody',fn+'\nreturn renderLongStage;')(
    ()=>({revision:1}),longParagraph,items=>`<ul>${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`,()=>'<details id="stageSection"></details>',()=>'<details id="sourceSection"></details>',partitionLongBody);
  const html=render(stage,topic,0,profile);
  assert.equal((html.match(/<article/g)||[]).length,1); assert.doesNotMatch(html,/paragraph-preview|data-paragraph="preview"/);
  for (const id of ['original-intro','original-text','continuation']) assert.match(html,new RegExp('id="paragraph-'+id+'"'));
  assert.ok(html.indexOf('paragraph-original-intro')<html.indexOf('reportSection'));
  assert.match(html,/声音未审听/); assert.match(html,/未连续合看/);
});
test('source linkage for the separate preview points to the real collection, while overview and body keep paragraph links',()=>{
  const fn=source.slice(source.indexOf('  function readingSources('),source.indexOf('  function readingStageRecord('));
  const render=new Function('esc','readingProfile','topUrl','matUrl','externalLink','API',fn+'\nreturn readingSources;')(
    esc,readingProfile,topUrl,matUrl,uri=>esc(uri),'/api/observatory');
  const html=render(stage,topic);
  assert.match(html,/<a href="#collection">收藏预览<\/a>/);
  assert.match(html,/#topic\/topic_test\/paragraph\/original-intro/); assert.match(html,/#topic\/topic_test\/paragraph\/continuation/);
  assert.doesNotMatch(html,/paragraph\/preview/);
});
test('only the explicit optional method-tail marker groups methods; technical words and missing markers keep all main content open',()=>{
  const method={...base,paragraphId:'method',heading:'方法与读取记录',markdown:'工具运行范围与原始输出。'};
  const methodContinuation={...base,paragraphId:'method-next',heading:'',markdown:'后续读取过程。'};
  const technical={...body,heading:'工具与判断也可能是主体关注点'};
  assert.deepEqual(partitionLongBody([body,technical]),{main:[body,technical],methods:[]});
  assert.deepEqual(partitionLongBody([body,{...method,heading:'方法与读取记录（候选）'}]).methods,[]);
  const before=structuredClone([body,continuation,method,methodContinuation]);
  const parts=partitionLongBody(before);assert.deepEqual(parts.main,[body,continuation]);assert.deepEqual(parts.methods,[method,methodContinuation]);
  assert.deepEqual(before,[body,continuation,method,methodContinuation]);
});
test('method disclosure preserves all original paragraph IDs and references, while core and important unknowns remain outside it',()=>{
  const method={...base,paragraphId:'method-original-id',heading:'方法与读取记录',markdown:'工具与读取细节。'};
  const changed={...stage,paragraphs:[...stage.paragraphs,method]};
  const fn=source.slice(source.indexOf('  function renderLongStage('),source.indexOf('  function renderLongTopic('));
  const render=new Function('mat','longParagraph','list','readingStageRecord','readingSources','partitionLongBody',fn+'\nreturn renderLongStage;')(
    ()=>({revision:1}),longParagraph,items=>items.map(esc).join('；'),()=>'',()=>'',partitionLongBody);
  const html=render(changed,topic,0,readingProfile(changed));
  assert.ok(html.indexOf('paragraph-original-text')<html.indexOf('id="methodSection"'));
  assert.ok(html.indexOf('声音未审听')<html.indexOf('id="methodSection"'));
  assert.ok(html.indexOf('paragraph-method-original-id')>html.indexOf('id="methodSection"'));
  assert.match(html,/<details class="long-methods" id="methodSection" data-reading-disclosure><summary>方法与读取记录/);
  assert.match(html,/#topic\/topic_test\/source\/src/);
});
