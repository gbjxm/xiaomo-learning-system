"""Evidence-aware search and saved-view regressions; isolated SQLite only."""
import base64
import shutil
import subprocess
import unittest
from pathlib import Path

from helpers import ScopedTemp
from opportunities.evidence import EvidenceManager
from opportunities.model import empty_document, json_text, utcnow
from opportunities.searching import SearchService, query_terms, validate_record
from opportunities.storage import Store


ROOT = Path(__file__).resolve().parents[1]


def doc(number=1):
    value = empty_document("libtv", "AI电影征集" + str(number), "LibTV", "https://www.liblib.tv/activity/" + str(number), "2026")
    value.update(summary="关于家庭与未来的故事", eligibility=["高校学生或个人团队"], work_requirements=["时长至少2分钟"])
    return value


def filters(**overrides):
    return {"view": "opportunities", "kind": "all", "search": "", "platform": "all", "status": "all", "reward": "all",
            "sort": "validity", "fit": "all", "include_history": False, **overrides}


class SearchTests(unittest.TestCase):
    def setUp(self):
        self.temp = ScopedTemp(ROOT / "output", "test-search-")
        self.store = Store(ROOT, Path(self.temp.name) / "search.sqlite3", seed=False)
        self.service = SearchService(self.store)
        self.original = doc()
        self.store.upsert(self.original, "测试版本")
        self.item = self.store.items()[0]

    def tearDown(self):
        self.temp.cleanup()

    def attachment(self, **overrides):
        filename = overrides.get("filename", "官方章程.pdf")
        if overrides.get("text_state") == "plain_text":
            filename, content = "官方章程.txt", overrides.get("text", "").encode("utf-8")
        elif filename.endswith(".png"):
            content = next((ROOT / "static" / "media").glob("*.png")).read_bytes()
        else:
            content = b"%PDF-1.7\nMinimal isolated fixture\n%%EOF"
        return EvidenceManager(self.store).import_file({"item_id": self.item["id"], "name": filename,
                "content_base64": base64.b64encode(content).decode("ascii"), "source_url": self.item["official_url"],
                "observed_at": utcnow(), "verification": overrides.get("verification", "unverified"),
                "note": overrides.get("note"), "text": overrides.get("text")})

    def ids(self, result):
        return [item["id"] for item in result["items"]]

    def test_current_cross_field_multiword_and_has_readable_labels(self):
        result = self.service.search("高校 2分钟")
        self.assertEqual(self.ids(result), [self.item["id"]])
        labels = [value["label"] for value in result["items"][0]["matches"]]
        self.assertIn("当前记录 · 参与资格", labels)
        self.assertIn("当前记录 · 作品要求", labels)
        self.assertFalse(result["items"][0]["historical_only"])

    def test_saves_notes_as_personal_context_not_official_fact(self):
        self.store.preference(self.item["id"], note="准备给作品加字幕")
        hit = self.service.search("加字幕")["items"][0]["matches"][0]
        self.assertEqual(hit["kind"], "note")
        self.assertIn("不属于官方规则", hit["label"])

    def test_machine_body_searches_exact_bound_url_only(self):
        self.store.observe("libtv", self.item["official_url"], "官方原文含独家许可", "a" * 64, "test", "partial")
        self.store.observe("libtv", "https://www.liblib.tv/activity/999", "跨页面禁止错误关联", "b" * 64, "test", "complete")
        self.assertEqual(self.ids(self.service.search("独家许可")), [self.item["id"]])
        self.assertEqual(self.service.search("错误关联")["items"], [])
        hit = self.service.search("独家许可")["items"][0]["matches"][0]
        self.assertIn("机器提取", hit["label"])

    def test_latest_body_excludes_old_capture_without_history(self):
        self.store.observe("libtv", self.item["official_url"], "旧抓取稀有内容", "a" * 64, "test", "partial")
        self.store.observe("libtv", self.item["official_url"], "新抓取独立规则", "b" * 64, "test", "complete")
        self.assertFalse(self.service.search("稀有内容")["items"])
        historical = self.service.search("稀有内容", True)["items"][0]
        self.assertTrue(historical["historical_only"])
        self.assertTrue(historical["matches"][0]["historical"])
        self.assertEqual(self.ids(self.service.search("独立规则")), [self.item["id"]])

    def test_revisited_old_hash_is_latest_body_not_arbitrary_version_id(self):
        self.store.observe("libtv", self.item["official_url"], "页面版本甲", "a" * 64, "test", "partial")
        self.store.observe("libtv", self.item["official_url"], "页面版本乙", "b" * 64, "test", "partial")
        with self.store.connection() as conn:
            conn.execute("UPDATE observations SET last_seen_at='2026-01-01T00:00:00+00:00' WHERE body='页面版本乙'")
            conn.execute("UPDATE observations SET last_seen_at='2026-09-30T12:00:00+00:00' WHERE body='页面版本甲'")
        self.assertTrue(self.service.search("版本甲")["items"])
        self.assertFalse(self.service.search("版本乙")["items"])

    def test_explicit_evidence_url_links_a_second_source_but_not_homepage_guess(self):
        updated = dict(self.original)
        updated["evidence"] = [{"url": "https://www.bilibili.com/opus/888", "excerpt": "公开出处"}]
        self.store.upsert(updated)
        self.store.observe("bilibili", "https://www.bilibili.com/opus/888", "特殊备案要求", "b" * 64, "test", "complete")
        self.assertTrue(self.service.search("备案要求")["items"])

    def test_complete_older_document_only_with_explicit_history(self):
        updated = dict(self.original)
        updated["work_requirements"] = ["新规则至少五分钟"]
        self.store.upsert(updated)
        self.assertFalse(self.service.search("2分钟")["items"])
        item = self.service.search("2分钟", True)["items"][0]
        self.assertTrue(item["historical_only"])
        self.assertEqual(item["matches"][0]["version"], 1)
        self.assertIn("旧版记录", item["matches"][0]["label"])

    def test_manual_evidence_excerpt_is_searchable(self):
        updated = dict(self.original)
        updated["evidence"] = [{"url": self.item["official_url"], "excerpt": "作者保留所有权利", "origin": "manual_review"}]
        self.store.upsert(updated)
        self.assertIn("人工整理", self.service.search("所有权利")["items"][0]["matches"][0]["label"])

    def test_text_attachment_and_user_transcript_have_distinct_labels(self):
        self.attachment(text="PDF用户手动转录了七工作日结算", text_state="user_supplied")
        hit = self.service.search("七工作日")["items"][0]["matches"][0]
        self.assertEqual(hit["kind"], "attachment")
        self.assertIn("个人转录", hit["label"])
        self.assertIn("待核", hit["label"])

    def test_no_text_attachment_is_counted_and_only_name_note_searchable(self):
        self.attachment(filename="章程截图.png", note="可读文字尚未转录")
        result = self.service.search("章程截图")
        self.assertEqual(result["counts"]["attachments_without_text"], 1)
        self.assertIn("没有可检索正文", result["attachment_notice"])
        self.assertTrue(result["items"])
        self.assertFalse(self.service.search("截图中的隐藏金额")["items"])

    def test_old_attachment_is_not_assumed_current_after_rules_change(self):
        self.attachment(text="旧版权全文独特词语", text_state="plain_text")
        updated = dict(self.original, summary="规则有新版本")
        self.store.upsert(updated)
        self.assertFalse(self.service.search("独特词语")["items"])
        self.assertTrue(self.service.search("独特词语", True)["items"][0]["historical_only"])

    def test_field_evidence_has_field_page_and_review_state(self):
        EvidenceManager(self.store).save_field({"item_id": self.item["id"], "field": "risks", "excerpt": "永久无偿授权", "source_url": self.item["official_url"], "page": "第3页", "status": "unverified", "note": "需复核"})
        hit = self.service.search("永久无偿")["items"][0]["matches"][0]
        self.assertIn("第3页", hit["label"])
        self.assertIn("待核", hit["label"])

    def test_snippets_are_bounded_and_near_matching_text(self):
        self.store.observe("libtv", self.item["official_url"], "无关内容" * 1000 + "少见匹配关键词" + "附加文字" * 1000, "a" * 64, "test", "partial")
        snippet = self.service.search("匹配关键词")["items"][0]["matches"][0]["text"]
        self.assertIn("匹配关键词", snippet)
        self.assertLessEqual(len(snippet), 262)

    def test_markup_is_returned_as_data_never_executed(self):
        self.store.preference(self.item["id"], note='<img src=x onerror="alert(1)">')
        self.assertIn("onerror", self.service.search("onerror")["items"][0]["matches"][0]["text"])

    def test_search_is_read_only_and_stable(self):
        with self.store.connection() as conn:
            before = {name: [tuple(row) for row in conn.execute('SELECT * FROM "' + name + '"')] for name in ("opportunities", "versions", "settings")}
        one = self.service.search("AI")
        two = self.service.search("AI")
        self.assertEqual(one, two)
        with self.store.connection() as conn:
            after = {name: [tuple(row) for row in conn.execute('SELECT * FROM "' + name + '"')] for name in before}
        self.assertEqual(before, after)

    def test_query_and_history_validation(self):
        for value in (None, 1, "a" * 241, "\x00", "\ud800"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.service.search(value)
        with self.assertRaises(ValueError):
            self.service.search("x", 1)
        with self.assertRaises(ValueError):
            query_terms(" ".join(str(number) for number in range(13)))
        self.assertEqual(self.service.search("   ")["items"], [])

    def test_view_is_dynamic_and_does_not_copy_opportunities(self):
        view = self.service.save_view({"name": "学校比赛", "filters": filters(search="高校", kind="competition")})
        self.assertEqual(len(self.store.items()), 1)
        self.assertEqual(view["data"]["filters"]["search"], "高校")
        self.store.upsert(doc(2))
        self.assertEqual(len(self.service.search(view["data"]["filters"]["search"])["items"]), 2)
        self.assertEqual(len(self.service.list_views()), 1)

    def test_view_update_and_delete_require_matching_revision(self):
        view = self.service.save_view({"name": "视图甲", "filters": filters()})
        updated = self.service.save_view({"name": "视图乙", "filters": filters(reward="cash")}, view["id"], view["revision"])
        self.assertEqual(updated["revision"], view["revision"] + 1)
        with self.assertRaises(ValueError):
            self.service.save_view({"name": "过期改名", "filters": filters()}, view["id"], view["revision"])
        with self.assertRaises(ValueError):
            self.service.remove_view(view["id"], view["revision"])
        self.service.remove_view(view["id"], updated["revision"])
        self.assertEqual(self.service.list_views(), [])
        self.assertEqual(len(self.store.items()), 1)

    def test_view_name_duplicates_are_not_silently_overwritten(self):
        self.service.save_view({"name": "AI比赛", "filters": filters()})
        with self.assertRaises(ValueError):
            self.service.save_view({"name": "ai比赛", "filters": filters(search="另一条件")})

    def test_saved_view_import_validation_rejects_unknown_or_improper_fields(self):
        valid = {"name": "常用视图", "filters": filters()}
        self.assertEqual(validate_record(valid), valid)
        invalid = [dict(valid, surprise="x"), dict(valid, name=" "), dict(valid, filters=filters(view="sources")),
                   dict(valid, filters=filters(include_history=1)), dict(valid, filters=filters(kind="fake")),
                   dict(valid, filters=filters(platform="")), dict(valid, filters=filters(search="x" * 241))]
        for value in invalid:
            with self.subTest(value=value), self.assertRaises(ValueError):
                validate_record(value)

    def test_blind_view_updates_and_boolean_revisions_rejected(self):
        view = self.service.save_view({"name": "视图", "filters": filters()})
        for revision in (None, 0, True, False):
            with self.subTest(revision=revision), self.assertRaises(ValueError):
                self.service.save_view({"name": "覆盖", "filters": filters()}, view["id"], revision)
        with self.assertRaises(ValueError):
            self.service.save_view({"name": "错误新建", "filters": filters()}, expected_revision=False)

    def test_merged_source_hit_is_linked_to_primary_without_changing_original(self):
        from opportunities.merging import MergeService
        secondary = doc(2)
        secondary.update(source_id="bilibili", official_url="https://www.bilibili.com/opus/12345")
        self.store.upsert(secondary)
        source = next(item for item in self.store.items() if item["source_id"] == "bilibili")
        self.store.observe("bilibili", source["official_url"], "跨来源独有证据文本", "a" * 64, "test", "partial")
        service = MergeService(self.store)
        comparison = service.compare(self.item["id"], source["id"])
        preview = service.preview(self.item["id"], source["id"], {field["field"]: "target" for field in comparison["fields"]})
        receipt = service.confirm(preview["confirm_token"], "a" * 32, same_entity=True)
        result = self.service.search("独有证据")
        self.assertEqual(set(self.ids(result)), {source["id"], self.item["id"]})
        primary = next(item for item in result["items"] if item["id"] == self.item["id"])
        self.assertTrue(primary["linked_source_match"])
        self.assertEqual(primary["matches"][0]["related_item_id"], source["id"])
        self.assertIn("不替代统一现行条款", primary["matches"][0]["label"])
        self.assertEqual(len(self.store.items()), 2)
        undo = service.undo_preview(receipt["group_id"])
        service.undo(undo["confirm_token"], "b" * 32, confirmed=True)
        self.assertEqual(self.ids(self.service.search("独有证据")), [source["id"]])

    @unittest.skipUnless(shutil.which("node"), "Node 不可用；浏览器验收仍需执行")
    def test_frontend_latest_request_errors_clear_and_view_save_races(self):
        script = r'''
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const ids=new Map(),all=[],pending=[];let checks=0;
const ok=(condition,message)=>{assert(condition,message);checks++;};
class Element{
  constructor(tag,cls='',text=''){this.tagName=tag.toUpperCase();this.className=cls||'';this.textContent=text||'';this.children=[];this.listeners={};this.value='';this.hidden=false;this.disabled=false;this.open=false;this.checked=false;this.dataset={};this.attributes={};all.push(this);this.classList={toggle:(name,on)=>{const values=new Set(this.className.split(' ').filter(Boolean));if(on)values.add(name);else values.delete(name);this.className=[...values].join(' ');}};}
  set id(value){this._id=value;ids.set(value,this);}get id(){return this._id;}
  append(...nodes){this.children.push(...nodes);for(const node of nodes)if(node&&typeof node==='object')node.parentNode=this;}
  replaceChildren(...nodes){this.children=[];this.textContent='';this.append(...nodes);}
  setAttribute(key,value){this.attributes[key]=value;}
  addEventListener(kind,handler){(this.listeners[kind]||=[]).push(handler);}
  fire(kind){for(const callback of this.listeners[kind]||[])callback({target:this,stopPropagation(){}});}
  querySelector(selector){const matches=node=>selector==='strong'?node.tagName==='STRONG':selector.startsWith('.')?node.className.split(' ').includes(selector.slice(1)):false;for(const child of this.children){if(typeof child!=='object')continue;if(matches(child))return child;const deeper=child.querySelector?.(selector);if(deeper)return deeper;}return null;}
  focus(){this.focused=true;}
  get options(){return this.children;}
}
global.el=(tag,cls,text)=>new Element(tag,cls,text);global.add=(parent,...children)=>{parent.append(...children.filter(value=>value!=null));return parent;};
global.button=(text,cls,action)=>{const node=el('button',cls,text);node.addEventListener('click',action);return node;};
global.$=id=>ids.get(id);global.document={querySelectorAll:()=>[],querySelector:()=>null};global.window={};
global.sessionStorage={data:new Map(),getItem(key){return this.data.get(key)||null;},setItem(key,value){this.data.set(key,value);}};
global.state={data:null,view:'opportunities',kind:'all',search:'',platform:'all',status:'all',reward:'all',sort:'validity',fit:'all',stopped:false};
global.toast=()=>{};global.syncFilters=()=>{};global.persistUI=()=>{};global.setView=value=>{state.view=value;};global.openDetail=async()=>{};global.fmt=value=>value;
global.api=(path,body,signal)=>new Promise((resolve,reject)=>pending.push({path,body,signal,resolve,reject}));
global.renderList=()=>window.librarySearch.onRendered();
for(const id of ['opportunity-tools','search','clear-search','content','detail','platform']){const element=el(id==='platform'?'select':'div');element.id=id;}
$('platform').append(Object.assign(el('option'),{value:'all'}));const empty=el('div','empty');empty.append(el('strong',null,'没有符合条件的内容'),el('div',null,'没有内容'));$('content').append(empty);
vm.runInThisContext(fs.readFileSync(process.argv[1],'utf8'));
const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
const result=(query,history,id='one')=>({query,include_history:history,items:[{id,title:'机会',matches:[{kind:'record',label:'当前',text:query,historical:false}],historical_only:false}],counts:{items:1,historical_only:0},attachment_notice:'无缺失文本'});
const take=(prefix)=>{const index=pending.findIndex(value=>value.path.startsWith(prefix));assert(index>=0,prefix+' request missing');return pending.splice(index,1)[0];};
const click=text=>{const node=all.find(value=>value.tagName==='BUTTON'&&value.textContent===text);assert(node,text+' button missing');node.fire('click');return node;};
(async()=>{
state.data={items:[{id:'one',title:'机会',summary:'乙'}]};state.search='甲';window.librarySearch.schedule(true);await tick();const old=take('/api/search');
ok(window.librarySearch.ids()===null,'pending search must not claim complete zero');ok(empty.children[0].textContent==='没有符合条件的内容','empty rewrite happens only after list render');window.librarySearch.onRendered();ok(empty.children[0].textContent.includes('仍在搜索'),'pending empty state must be honest');
state.search='乙';window.librarySearch.schedule(true);await tick();const latest=take('/api/search');ok(old.signal.aborted,'old request aborted');
old.resolve(result('甲',false,'old'));await tick();ok(window.librarySearch.ids()===null,'late old response cannot finish latest request');
latest.resolve(result('乙',false));await tick();ok(window.librarySearch.ids().has('one'),'latest response accepted');ok(!window.librarySearch.ids().has('old'),'old result excluded');
state.search='丙';window.librarySearch.schedule(true);await tick();const failing=take('/api/search');failing.reject(new Error('服务断连'));await tick();
ok($('search-result-status').textContent.includes('不能据此判断'),'failure visible outside collapsed tools');ok(empty.children[0].textContent.includes('尚未完成'),'failure cannot pretend zero matches');
window.librarySearch.schedule(true);await tick();const retry=take('/api/search');state.search='';window.librarySearch.schedule();retry.resolve(result('丙',false));await tick();ok(window.librarySearch.ids()===null,'cleared query ignores late reply');ok($('search-result-status').hidden,'no query hides result status');
state.search='旧版';$('search-history').checked=true;$('search-history').fire('change');await tick();const history=take('/api/search');ok(history.path.endsWith('history=1'),'explicit history request');history.resolve(result('旧版',true));await tick();ok(window.librarySearch.includeHistory(),'history selection retained');
window.librarySearch.loadViews();const listing=take('/api/saved-views');listing.resolve({views:[]});await tick();
$('saved-view-name').value='我的筛选';$('saved-view-name').fire('input');const saveButton=click('保存当前筛选');saveButton.fire('click');const save=take('/api/saved-views');
ok(!pending.some(value=>value.body),'duplicate save does not submit twice');ok(save.body.expected_revision===0,'new view must require absent ID');ok(save.body.data.filters.include_history,'saved view stores search history condition');ok(save.body.data.filters.view==='opportunities','saved view retains list context');ok(window.librarySearch.pending(),'backup guard sees pending view mutation');
save.reject(new Error('断连'));await tick();ok($('saved-view-name').value==='我的筛选','save failure keeps name draft');ok(sessionStorage.getItem('xiaomo-search-view-draft-v1').includes('我的筛选'),'draft survives refresh');ok(!window.librarySearch.pending(),'failed mutation releases backup guard');
// A late list read must not overwrite a view successfully saved afterwards.
window.librarySearch.loadViews();const staleListing=take('/api/saved-views');click('保存当前筛选');const saving=take('/api/saved-views');
const record={id:'b'.repeat(32),revision:1,data:saving.body.data};saving.resolve(record);await tick();staleListing.resolve({views:[]});await tick();
ok($('saved-view-select').value===record.id,'stale GET cannot discard saved view');ok(all.some(value=>value.tagName==='BUTTON'&&value.textContent==='更新所选视图'),'saved selection retains explicit update action');
console.log('search-ui regression checks: '+checks);
})().catch(error=>{console.error(error);process.exitCode=1;});
'''
        result = subprocess.run(["node", "-e", script, str(ROOT / "static" / "search-ui.js")], capture_output=True, text=True, encoding="utf-8", timeout=20)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("search-ui regression checks: 23", result.stdout)


if __name__ == "__main__":
    unittest.main()
