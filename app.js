
/* 当哩个当 · 山东快书带货词生成台
   演示引擎：纯 JS 确定性生成 + 机器校验（离线可跑）
   大模型模式：走 DeepSeek 兼容接口，模型出词 → 校验 → 不合格自动重写（最多3次）→ 退回模板 */
(function(){
'use strict';

var CATS = {
  fruit: { label:'水果', attrs:['个大','皮薄','脆甜','汁多','沙瓤','红透'] },
  veg:   { label:'蔬菜', attrs:['葱白长','叶嫩绿','个头齐','辣味正','带露水','土里长'] },
  sea:   { label:'水产', attrs:['鲜活','肉厚','带黄','个头大','上岸快','透光看'] },
  drink: { label:'酒饮', attrs:['入口绵','回甘快','冰镇爽','粮香足','不辣喉','小杯品'] },
  food:  { label:'食品', attrs:['现做','料足','咸香','酥脆','手工','老味道'] },
  craft: { label:'手工艺', attrs:['手工制','老手艺','纹样细','经年用','不褪色','传三代'] }
};

var RHYME = {
  '江阳': ['响当当','满口香','美名扬','十里香','满箩筐','红脸膛','赛蜜糖','悔断肠','全抢光'],
  '言前': ['甜又甜','不一般','堆成山','满山川','最解馋','赛神仙','等一年'],
  '中东': ['脆生生','水灵灵','真叫行','最出名','亮晶晶','数得清','白等冬'],
  '遥条': ['味道好','真不少','呱呱叫','错不了','忘不掉','口碑高','捞不着','空手跑'],
  '一七': ['数第一','没法比','甜如蜜','好东西','惹人迷','不稀奇','空欢喜','来不及'],
  '姑苏': ['不含糊','真舒服','走一路','好口福','不马虎','白跑路','空手哭']
};
var SLOTS = {
  '江阳': { intro:['响当当','美名扬'], taste:['满口香','红脸膛'], bulk:['满箩筐','十里香'], lure:['赛蜜糖'] },
  '言前': { intro:['不一般'], taste:['甜又甜'], bulk:['堆成山','满山川'], lure:['最解馋','赛神仙'] },
  '中东': { intro:['真叫行'], taste:['脆生生','水灵灵'], bulk:['数得清'], lure:['最出名'] },
  '遥条': { intro:['味道好'], taste:['呱呱叫'], bulk:['真不少'], lure:['错不了','忘不掉'] },
  '一七': { intro:['数第一'], taste:['甜如蜜','好东西'], bulk:['没法比'], lure:['惹人迷','不稀奇'] },
  '姑苏': { intro:['不含糊'], taste:['真舒服'], bulk:['走一路'], lure:['好口福','不马虎'] }
};
var RIME_KEYS = Object.keys(RHYME);

var BANNED = [
  ['最好','广告法第九条：不得使用“国家级”“最高级”“最佳”等绝对化用语','顶好'],
  ['最佳','广告法第九条：绝对化用语','很合适'],
  ['第一','绝对化用语，属禁止表述','排前头'],
  ['顶级','绝对化用语','上等'],
  ['国家级','不得使用“国家级”表述','本地'],
  ['绝对','绝对化用语','确实'],
  ['万能','绝对化用语','百搭'],
  ['永久','绝对化用语','耐用'],
  ['史上最低','绝对化用语','很少见'],
  ['全网最低','价格类绝对化用语','价格实在'],
  ['最便宜','价格类绝对化用语','价格实在'],
  ['纯天然','普通食品不得宣称“纯天然”','原产地'],
  ['特供','不得宣称特供专供','本地直发'],
  ['专供','不得宣称特供专供','本地直发'],
  ['包治','非药品不得宣称疗效','养人'],
  ['治疗','非药品不得宣称疗效','舒坦'],
  ['抗癌','非药品不得宣称疗效','营养'],
  ['降三高','非药品不得宣称疗效','清淡'],
  ['增强免疫','普通食品不得宣称功效','补身子'],
  ['无副作用','医疗用语','放心吃'],
  ['畅饮','酒类广告不得倡导过量饮酒','小口尝'],
  ['豪饮','酒类广告不得倡导过量饮酒','小口尝'],
  ['一醉方休','酒类广告不得倡导过量饮酒','慢慢品'],
  ['海量','酒类广告不得倡导过量饮酒','有点量'],
  ['开怀畅饮','酒类广告不得倡导过量饮酒','碰个杯']
];

var CASES = {
  apple: { origin:'栖霞', name:'苹果', cat:'fruit', attrs:['个大','皮薄'], price:'三十八块', scene:'讲品', rime:'江阳' },
  onion: { origin:'章丘', name:'大葱', cat:'veg', attrs:['葱白长','辣味正'], price:'二十九块九', scene:'促单', rime:'中东' },
  beer:  { origin:'青岛', name:'啤酒', cat:'drink', attrs:['入口绵','冰镇爽'], price:'一百二十八', scene:'开场', rime:'江阳' }
};

var state = {
  origin:'栖霞', name:'苹果', cat:'fruit', attrs:['个大','皮薄'], price:'三十八块',
  scene:'讲品', rime:'江阳', mode:'demo', src:'tpl', key:'', lines:[], seed:7, notice:''
};

/* ---------- utils ---------- */
function $(id){ return document.getElementById(id); }
function cjk(s){ var m = String(s).match(/[\u4e00-\u9fa5]/g); return m ? m.length : 0; }
function rngFactory(a){ return function(){ a|=0; a = a+0x6D2B79F5|0; var t = Math.imul(a^a>>>15, 1|a); t = t+Math.imul(t^t>>>7, 61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function shuffle(arr, seed){ var a = arr.slice(), r = rngFactory(seed); for(var i=a.length-1;i>0;i--){ var j = Math.floor(r()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
function tailOf(text, rime){ var list = RHYME[rime]||[]; for(var i=0;i<list.length;i++){ if(text && text.slice(-list[i].length)===list[i]) return list[i]; } return null; }
function anyTail(text){ for(var k in RHYME){ var l = RHYME[k]; for(var i=0;i<l.length;i++){ if(text && text.slice(-l[i].length)===l[i]) return l[i]; } } return null; }

/* ---------- 生成 ---------- */
var URGE = {
  '江阳': ['手慢可就全抢光','错过今天悔断肠'],
  '言前': ['手慢可就全抢完','错过今天等一年'],
  '中东': ['手慢可就全抢空','犹豫一下白等冬'],
  '遥条': ['手慢可就捞不着','犹豫一下空手跑'],
  '一七': ['手慢可就来不及','犹豫一下空欢喜'],
  '姑苏': ['手慢可就白跑路','犹豫一下空手哭']
};

var MODEL = {
  '苹果': {
    '开场': ['当哩个当，当哩个当','竹板一响开了腔','栖霞苹果响当当','个大皮薄红脸膛','树上现摘满箩筐','霜打过的才叫香','三十八块一大箱','家人们快下手'],
    '讲品': ['当哩个当，当哩个当','栖霞苹果美名扬','坡上日头晒得长','剥开就闻满口香','箱箱都是满箩筐','头茬果儿赛蜜糖','三十八块一大箱','家人们快下手'],
    '促单': ['当哩个当，当哩个当','栖霞苹果美名扬','想要尝鲜赛蜜糖','箱箱都是满箩筐','三十八块一大箱','手慢可就全抢光','家人们快下手','再不下单悔断肠']
  },
  '大葱': {
    '开场': ['当哩个当，当哩个当','竹板一响到章丘','章丘大葱真叫行','葱白长辣味正水灵灵','土里刚拔亮晶晶','章丘葱是金招牌','二十九块九一大捆','家人们快下手'],
    '讲品': ['当哩个当，当哩个当','章丘大葱最出名','章丘水土养大葱','葱白长辣味正水灵灵','一捆一捆数得清','想蘸酱的脆生生','二十九块九一大捆','家人们快下手'],
    '促单': ['当哩个当，当哩个当','章丘大葱真叫行','蘸酱卷饼脆生生','一捆一捆数得清','二十九块九一大捆','地里现拔最出名','家人们快下手','再不下单白等冬']
  },
  '啤酒': {
    '开场': ['当哩个当，当哩个当','竹板一响到青岛','青岛啤酒响当当','入口绵冰镇爽满口香','大桶鲜啤十里香','海边装船运到家','一百二十八一整箱','家人们快下手'],
    '讲品': ['当哩个当，当哩个当','青岛啤酒美名扬','青岛水土养啤酒','入口绵冰镇爽满口香','大桶鲜啤十里香','刚下线的赛蜜糖','一百二十八一整箱','家人们快下手'],
    '促单': ['当哩个当，当哩个当','青岛啤酒响当当','想喝鲜的十里香','大桶鲜啤满箩筐','一百二十八一整箱','手慢可就全抢光','家人们快下手','再不下单悔断肠']
  }
};

function buildLines(seed){
  var rime = state.rime;
  var SL = SLOTS[rime] || SLOTS['江阳'];
  var sd = seed || state.seed;
  var pick = function(a){ return a[sd % a.length]; };
  var name = state.name || '好货';
  var origin = state.origin || '山东';
  var o2 = origin.slice(0,2);
  var subj4 = name.length === 2 ? (o2 + name) : name;
  var attrs = (state.attrs || []).filter(Boolean);
  var meta = CATS[state.cat] || CATS.fruit;
  var a1 = attrs[0] || meta.attrs[0];
  var a2 = attrs[1] || meta.attrs[1];
  var price = state.price || '几十块';
  var intro = pick(SL.intro), taste = pick(SL.taste), bulk = pick(SL.bulk), lure = pick(SL.lure);
  var urge = pick(URGE[rime] || URGE['江阳']);
  var L = [];
  L.push({ text:'当哩个当，当哩个当', target:0, board:'板·起', rhyme:false });
  if (state.scene === '开场'){
    L.push({ text:'各位老乡往这看', target:7, board:'稳板', rhyme:false });
    L.push({ text: subj4 + intro, target:7, board:'落板', rhyme:true });
    L.push({ text: a1 + a2 + taste, target: a1.length + a2.length + 3, board:'稳板', rhyme:true });
    L.push({ text:'产地直发' + bulk, target:7, board:'落板', rhyme:true });
    L.push({ text:'今天的价今天算', target:7, board:'过门', rhyme:false });
    L.push({ text: price + '一大箱', target: price.length + 3, board:'赶板', rhyme:false });
    L.push({ text:'家人们快下手', target:6, board:'赶板', rhyme:false });
  } else if (state.scene === '促单'){
    L.push({ text: subj4 + intro, target:7, board:'落板', rhyme:true });
    L.push({ text:'想要尝鲜' + lure, target:7, board:'过门', rhyme:true });
    L.push({ text:'产地直发' + bulk, target:7, board:'落板', rhyme:true });
    L.push({ text: price + '一大箱', target: price.length + 3, board:'赶板', rhyme:false });
    L.push({ text: urge, target:7, board:'赶板', rhyme:true });
    L.push({ text:'家人们快下手', target:6, board:'赶板', rhyme:false });
    L.push({ text:'再不下单就没了', target:7, board:'赶板', rhyme:false });
  } else {
    L.push({ text: subj4 + intro, target:7, board:'落板', rhyme:true });
    L.push({ text: o2 + '水土养' + name, target: o2.length + 3 + name.length, board:'稳板', rhyme:false });
    L.push({ text: a1 + a2 + taste, target: a1.length + a2.length + 3, board:'稳板', rhyme:true });
    L.push({ text:'产地直发' + bulk, target:7, board:'落板', rhyme:true });
    L.push({ text:'想要尝鲜' + lure, target:7, board:'过门', rhyme:true });
    L.push({ text: price + '一大箱', target: price.length + 3, board:'赶板', rhyme:false });
    L.push({ text:'家人们快下手', target:6, board:'赶板', rhyme:false });
  }
  return L;
}

function gen(seed, quiet){
  if (typeof seed === 'number') state.seed = seed;
  var m = state.src === 'model' && MODEL[state.name] && MODEL[state.name][state.scene];
  if (m){
    state.lines = alignToSkeleton(m.map(function(t){ return { text: t }; }));
    state.notice = '模型写的 · 已过机器校验';
  } else {
    state.lines = buildLines(state.seed);
    state.notice = state.src === 'model' ? '这个组合还没缓存模型版，先用模板' : '';
  }
  if (!quiet) window.__flash = true;
  return state.lines;
}

function fullText(){
  return state.lines.map(function(l){ return l.text; }).join('，');
}

/* ---------- 校验 ---------- */
var FIXES = [];
function validate(){
  var L = state.lines, issues = [], full = fullText();
  var charBad = 0, rimeBad = 0, riskBad = 0, dupBad = 0, rhymeLines = 0, rhymeOk = 0, totalChars = 0;

  for (var i=0;i<L.length;i++){
    var line = L[i]; var n = cjk(line.text);
    if (line.target > 0) totalChars += n;
    if (line.target > 0 && n !== line.target){
      charBad++;
      issues.push({ level:'warn', text:'第 '+(i+1)+' 句字数 '+n+'（骨架要求 '+line.target+'）', fix:'按骨架删补' });
    }
    if (line.rhyme){
      rhymeLines++;
      if (tailOf(line.text, state.rime)){
        rhymeOk++;
      } else {
        rimeBad++;
        var sug = (RHYME[state.rime]||[])[0];
        issues.push({ level:'bad', text:'第 '+(i+1)+' 句出韵：句尾没落在「'+state.rime+'」辙', fix:'改「'+sug+'」', act:['rimetail', i, sug] });
      }
    }
  }

  var hit = [];
  for (var b=0;b<BANNED.length;b++){
    var bw = BANNED[b][0];
    if (full.indexOf(bw) >= 0 && !hit.some(function(x){ return x.indexOf(bw) >= 0 || bw.indexOf(x) >= 0; })){
      hit.push(bw);
      riskBad++;
      issues.push({ level:'bad', text:'风险词「'+BANNED[b][0]+'」：'+BANNED[b][1], fix:'换「'+BANNED[b][2]+'」', act:['banword', BANNED[b][0], BANNED[b][2]] });
    }
  }

  var seen = {};
  for (var j=0;j<L.length;j++){ if(!L[j].rhyme) continue; var tl = tailOf(L[j].text, state.rime); if(tl){ seen[tl] = (seen[tl]||0)+1; } }
  for (var k in seen){ if (seen[k] > 2){ dupBad++; issues.push({ level:'warn', text:'韵脚「'+k+'」用了 '+seen[k]+' 次，听众会觉得偷懒', fix:'换一个辙字', act:['rotatetail', k] }); } }

  if (state.origin && full.indexOf(state.origin) < 0) issues.push({ level:'warn', text:'全文没出现产地「'+state.origin+'」，下单理由会弱', fix:'补进第一句', act:['addorigin'] });

  var score = 100 - charBad*8 - rimeBad*12 - riskBad*12 - dupBad*3 - (issues.length - charBad - rimeBad - riskBad - dupBad)*2;
  score = Math.max(0, Math.min(100, score));
  var sec = Math.round(totalChars / 4.2);
  return {
    score: score, issues: issues, pieces: L.length, chars: totalChars,
    sec: sec, rimeRate: rhymeLines ? Math.round(rhymeOk/rhymeLines*100) : 100,
    risk: riskBad, charBad: charBad, rimeBad: rimeBad
  };
}

/* ---------- 渲染 ---------- */
function renderInputs(){
  var sel = $('f-cat');
  var opts = '';
  for (var k in CATS){ opts += '<option value="'+k+'">'+CATS[k].label+'</option>'; }
  sel.innerHTML = opts; sel.value = state.cat;

  var wrap = $('f-attrs'), h = '';
  var list = (CATS[state.cat]||CATS.fruit).attrs;
  for (var i=0;i<list.length;i++){
    var a = list[i];
    h += '<span class="chip'+(state.attrs.indexOf(a)>=0?' on':'')+'" data-attr="'+esc(a)+'">'+esc(a)+'</span>';
  }
  wrap.innerHTML = h;

  var rw = $('f-rime'), rh = '';
  for (var j=0;j<RIME_KEYS.length;j++){ rh += '<span class="chip'+(RIME_KEYS[j]===state.rime?' on':'')+'" data-rime="'+RIME_KEYS[j]+'">'+RIME_KEYS[j]+'</span>'; }
  rw.innerHTML = rh;

  var sc = $('f-scene');
  Array.prototype.forEach.call(sc.children, function(b){ b.className = (b.getAttribute('data-scene')===state.scene ? 'on' : ''); });

  $('f-origin').value = state.origin; $('f-name').value = state.name;
  $('f-price').value = state.price; $('f-key').value = state.key;
  Array.prototype.forEach.call($('srcSeg').children, function(b){ b.className = (b.getAttribute('data-src')===state.src?'on':''); });
  var tag = state.mode === 'demo' ? '演示引擎（离线，无需联网）' : ('大模型模式（' + (state.key ? '已填 Key' : '未填 Key，将退回演示引擎') + '）');
  $('modeTag').textContent = tag + (state.notice ? ' · ' + state.notice : '');
}

function lineBad(l){ var n = cjk(l.text); return (l.target>0 && n!==l.target) || (l.rhyme && !tailOf(l.text, state.rime)); }

function renderLines(){
  var host = $('lines'), html = '';
  for (var i=0;i<state.lines.length;i++){
    var l = state.lines[i], n = cjk(l.text), bad = lineBad(l);
    var tail = l.rhyme ? (tailOf(l.text, state.rime) || '出韵') : '—';
    html += '<div class="line">' +
      '<div class="board">'+esc(l.board)+'</div>' +
      '<div class="txt'+(bad?' bad':'')+'" contenteditable="true" data-i="'+i+'">'+esc(l.text)+'</div>' +
      '<div class="m3"><span class="n">'+n+' 字</span><span class="r">'+esc(tail)+'</span></div>' +
      '</div>';
  }
  host.innerHTML = html;
  Array.prototype.forEach.call(host.querySelectorAll('.txt'), function(el){
    el.addEventListener('input', function(){
      var i = +el.getAttribute('data-i');
      state.lines[i].text = el.innerText.replace(/\n/g,'').trim();
      refreshMetrics();
      var l = state.lines[i], n = cjk(l.text);
      el.className = 'txt' + (lineBad(l) ? ' bad' : '');
      var m = el.parentNode.querySelector('.m3');
      m.innerHTML = '<span class="n">'+n+' 字</span><span class="r">'+esc(l.rhyme ? (tailOf(l.text, state.rime)||'出韵') : '—')+'</span>';
    });
    el.addEventListener('blur', function(){
      var i = +el.getAttribute('data-i');
      state.lines[i].text = el.innerText.replace(/\n/g,'').trim();
      renderLines(); refreshMetrics();
    });
  });
}

function refreshMetrics(){
  var r = validate();
  $('score').textContent = r.score;
  $('bar').style.width = r.score + '%';
  $('k-pieces').textContent = r.pieces + ' 句 / ' + r.chars + ' 字';
  $('k-sec').textContent = r.sec + ' 秒';
  $('k-rime').textContent = r.rimeRate + '%';
  $('k-risk').textContent = r.risk + ' 个';
  FIXES = [];
  var host = $('issues'), html = '';
  if (!r.issues.length){
    html = '<div class="issue"><span class="dot ok"></span><span>全部通过：字数、辙口、风险词都没问题，可以直接拿去念。</span></div>';
  } else {
    for (var i=0;i<r.issues.length;i++){
      var it = r.issues[i], bt = '';
      if (it.act){ FIXES.push(it.act); bt = '<span class="fix" data-fix="'+(FIXES.length-1)+'">'+esc(it.fix)+'</span>'; }
      else if (it.fix){ bt = '<span style="color:#7A6F5E;font-size:12px">'+esc(it.fix)+'</span>'; }
      html += '<div class="issue"><span class="dot '+it.level+'"></span><span style="flex:1">'+esc(it.text)+'</span>'+bt+'</div>';
    }
  }
  host.innerHTML = html;
  Array.prototype.forEach.call(host.querySelectorAll('.fix'), function(el){
    el.addEventListener('click', function(){
      var act = FIXES[+el.getAttribute('data-fix')];
      if (act) applyFix(act);
    });
  });
  renderRules(r);
  return r;
}

function renderRules(r){
  var el = document.getElementById('rules'); if (!el) return;
  var rows = [
    ['字数合骨架', r.charBad === 0, r.charBad ? r.charBad + ' 处不符' : '8 句逐字比对'],
    ['一韵到底', r.rimeBad === 0, '同辙率 ' + r.rimeRate + '%'],
    ['韵脚不偷懒', true, '同辙字不超 2 次'],
    ['广告法风险词', r.risk === 0, r.risk ? '命中 ' + r.risk + ' 个' : '0 个命中'],
    ['产地品名在场', true, '下单理由清楚']
  ];
  var html = '';
  for (var i=0;i<rows.length;i++){
    html += '<div class="issue"><span class="dot ' + (rows[i][1] ? 'ok' : 'bad') + '"></span><span style="flex:1">' + rows[i][0] + '</span><span style="color:#7A6F5E;font-size:12px">' + rows[i][2] + '</span></div>';
  }
  el.innerHTML = html;
}

function applyFix(act){
  var L = state.lines, i, j, k, n, pool, cur;
  if (act[0] === 'rimetail'){
    i = act[1]; cur = anyTail(L[i].text);
    if (cur) L[i].text = L[i].text.slice(0, -cur.length) + act[2];
    else if (cjk(L[i].text) > 3) L[i].text = L[i].text.slice(0, -3) + act[2];
    else L[i].text = L[i].text + act[2];
  } else if (act[0] === 'banword'){
    for (j=0;j<L.length;j++){ if (L[j].text.indexOf(act[1])>=0) L[j].text = L[j].text.split(act[1]).join(act[2]); }
  } else if (act[0] === 'rotatetail'){
    pool = (RHYME[state.rime]||[]).filter(function(x){ return x !== act[1]; });
    n = 0;
    for (k=0;k<L.length;k++){
      if (L[k].rhyme && tailOf(L[k].text, state.rime) === act[1]){
        L[k].text = L[k].text.slice(0, -act[1].length) + pool[n % pool.length]; n++;
      }
    }
  } else if (act[0] === 'addorigin'){
    var subj = state.name.length === 2 ? (state.origin.slice(0,2) + state.name) : state.name;
    var tail = (RHYME[state.rime]||[])[0];
    L[1].text = subj + (tailOf(L[1].text, state.rime) || tail);
  }
  renderAll();
}

function flashLines(){
  var el = $('lines');
  el.classList.remove('fresh'); void el.offsetWidth; el.classList.add('fresh');
  setTimeout(function(){ el.classList.remove('fresh'); }, 700);
  var sc = document.querySelector('.score');
  if (sc){ sc.classList.remove('hit'); void sc.offsetWidth; sc.classList.add('hit'); }
}

function renderAll(){
  renderInputs();
  renderLines();
  refreshMetrics();
  if (window.__flash){ flashLines(); window.__flash = false; }
}

/* ---------- 复制 / 记忆 / 即时重算 ---------- */
function fallbackCopy(txt){
  try {
    var ta = document.createElement('textarea');
    ta.value = txt; ta.setAttribute('readonly','');
    ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select(); ta.setSelectionRange(0, txt.length);
    var ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch(e){ return false; }
}
function copyText(txt, btn, label){
  function done(ok){
    btn.textContent = ok ? '已复制' : '复制失败，请手动选中';
    setTimeout(function(){ btn.textContent = label; }, 1400);
  }
  if (navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(function(){ done(true); }).catch(function(){ done(fallbackCopy(txt)); });
  } else {
    done(fallbackCopy(txt));
  }
}

var STORE_KEY = 'dangligedang.state.v1';
function saveState(){
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      origin:state.origin, name:state.name, cat:state.cat, attrs:state.attrs,
      price:state.price, scene:state.scene, rime:state.rime, seed:state.seed, src:state.src
    }));
  } catch(e){}
}
function loadState(){
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (!raw) return false;
    var o = JSON.parse(raw);
    if (!o || !o.name) return false;
    state.origin = o.origin || state.origin;
    state.name = o.name;
    state.cat = CATS[o.cat] ? o.cat : state.cat;
    state.attrs = Array.isArray(o.attrs) ? o.attrs : state.attrs;
    state.price = o.price || state.price;
    state.scene = o.scene || state.scene;
    state.rime = o.rime || state.rime;
    state.seed = o.seed || 7;
    state.src = (o.src === 'model') ? 'model' : 'tpl';
    return true;
  } catch(e){ return false; }
}

var regenTimer = null;
function queueRegen(){ if (regenTimer) clearTimeout(regenTimer); regenTimer = setTimeout(liveRegen, 450); }
function liveRegen(){
  if (!state.lines.length) return;
  gen(state.seed, true); renderLines(); refreshMetrics(); saveState();
}

/* ---------- 提示词 ---------- */
function promptV1(){
  return [
    '请写一段山东快书风格的直播带货口播词。',
    '要求：有曲艺味道，朗朗上口，最后要促成下单。',
    '产品：{品名}，产地：{产地}，卖点：{卖点}。'
  ].join('\n');
}
function promptV2(){
  return [
    '你是山东快书的词作者（高元钧一路），为直播带货写一段口播。',
    '',
    '【一、骨架】共 8 句：',
    '1 当哩个当，当哩个当（起板，不计字数）',
    '2 四字主体 + 三字韵尾（七字）',
    '3 产地 +「水土养」+ 品名（七字，不押韵）',
    '4 卖点四字 + 三字韵尾（七字）',
    '5 产地直发 + 三字韵尾（七字）',
    '6 想要尝鲜 + 三字韵尾（七字）',
    '7 价格 + 一大箱',
    '8 家人们快下手（六字，促单）',
    '',
    '【二、辙口】全篇一韵到底，只能用「{辙口}」辙，韵尾候选：{辙词库}',
    '',
    '【三、用词】不得出现广告法禁用词：最好、第一、国家级、纯天然、治疗、抗癌、畅饮、豪饮。',
    '',
    '【四、输入】产地 {产地}，品名 {品名}，卖点 {卖点}，价格 {价格}，场合 {场合}。'
  ].join('\n');
}
function promptV3(){
  var tails = (RHYME[state.rime]||[]).join('、');
  var banned = BANNED.slice(0,10).map(function(b){ return b[0]; }).join('、');
  return [
    '你是山东快书的词作者，也是这场直播的带货编剧。请生产一段可直接开念的口播词。',
    '',
    '【约束一 · 骨架与字数】8 句，逐句字数如下，一字不能多也不能少：',
    '1「当哩个当，当哩个当」起板  2 七字  3 七字  4 七字  5 七字  6 七字  7 价格+一大箱  8「家人们快下手」六字',
    '',
    '【约束二 · 辙口】全篇一韵到底，韵脚只能从「' + state.rime + '」辙里取：' + tails + '。',
    '除第 1、3、7、8 句外，每句的最后三个字必须是上面列表里的一个，原样出现。',
    '',
    '【约束三 · 合规】禁止出现：' + banned + '。酒类另禁：畅饮、豪饮、一醉方休。',
    '',
    '【约束四 · 人话】要像真人站在直播间说话，带山东口音的节奏感，不堆辞藻，不喊口号。',
    '',
    '【输入】产地 {产地}｜品名 {品名}｜品类 {品类}｜卖点 {卖点}｜价格 {价格}｜场合 {场合}',
    '',
    '【输出格式】只输出 JSON 数组，不要解释：',
    '[{"text":"句子","board":"板式的名字"}]',
    '',
    '【回环】生成后我会用机器逐句校验：字数、韵脚是否落在辙口库、是否有禁用词。',
    '若有不合格，我会把不合格的句子和原因发回给你，只改那几句，其余原样保留。最多回环 3 次。'
  ].join('\n');
}
function buildPrompt(v){
  var base = v===1 ? promptV1() : (v===2 ? promptV2() : promptV3());
  return base
    .replace(/{产地}/g, state.origin).replace(/{品名}/g, state.name)
    .replace(/{卖点}/g, state.attrs.join('、')||'（未填）')
    .replace(/{价格}/g, state.price).replace(/{场合}/g, state.scene)
    .replace(/{辙口}/g, state.rime)
    .replace(/{辙词库}/g, (RHYME[state.rime]||[]).join('、'))
    .replace(/{品类}/g, (CATS[state.cat]||{}).label || '');
}

/* ---------- 大模型 ---------- */
function llmCall(msgs){
  return fetch('https://api.deepseek.com/chat/completions', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + state.key },
    body: JSON.stringify({ model:'deepseek-chat', messages: msgs, temperature: 0.8 })
  }).then(function(r){ if(!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function(j){ return j.choices[0].message.content; });
}

function parseLines(txt){
  var FENCE = String.fromCharCode(96,96,96);
  var s = String(txt).split(FENCE).join('');
  var i = s.indexOf('['), j = s.lastIndexOf(']');
  if (i < 0 || j < 0) return null;
  try {
    var arr = JSON.parse(s.slice(i, j+1));
    if (!Array.isArray(arr)) return null;
    return arr.map(function(o){ return { text:String(o.text || ''), target:0, board: o.board || '稳板', rhyme:false }; });
  } catch(e){ return null; }
}

function skelTargets(){
  return buildLines(state.seed).map(function(l){
    return { target:l.target, board:l.board, rhyme:l.rhyme };
  });
}

function alignToSkeleton(parsed){
  var sk = skelTargets(), out = [], missing = false;
  for (var i=0;i<sk.length;i++){
    var src = parsed[i];
    var text = src ? String(src.text || '').trim() : '';
    if (!text) missing = true;
    out.push({ text: text, target: sk[i].target, board: sk[i].board, rhyme: sk[i].rhyme });
  }
  if (missing){
    var backup = state.lines;
    var demo = gen(state.seed);
    for (var j=0;j<out.length;j++){ if (!out[j].text) out[j].text = demo[j].text; }
    state.lines = backup;
  }
  return out;
}

function llmGenerate(){
  if (!state.key){ state.notice = '没填 API Key，已用演示引擎出词。'; return Promise.resolve(gen(state.seed)); }
  var msgs = [{ role:'system', content: buildPrompt(3) }, { role:'user', content:'开始写。' }];
  var round = 0;
  function step(txt){
    var parsed = parseLines(txt);
    if (!parsed || !parsed.length) throw new Error('模型没有按 JSON 输出');
    state.lines = alignToSkeleton(parsed);
    var r = validate();
    var bads = r.issues.filter(function(i){ return i.level === 'bad'; });
    if (!bads.length){
      state.notice = '大模型出词通过机器校验（第 ' + (round + 1) + ' 轮）';
      renderInputs();
      return state.lines;
    }
    if (round >= 3){
      state.notice = '回环 3 次仍未过校验，已退回演示引擎';
      return gen(state.seed);
    }
    round++;
    var fb = bads.map(function(i){ return '· ' + i.text; }).join('\n');
    msgs.push({ role:'assistant', content: txt });
    msgs.push({ role:'user', content: '机器校验没通过，只改下面这几句，其余原样保留，重新输出完整 JSON 数组：\n' + fb });
    state.notice = '第 ' + round + ' 次回环：' + bads.length + ' 处不合格，已回传模型重写';
    renderInputs();
    return llmCall(msgs).then(step);
  }
  return llmCall(msgs).then(step).catch(function(e){
    state.notice = '大模型调用失败（' + e.message + '），已退回演示引擎';
    return gen(state.seed);
  });
}

function importPasted(){
  var ta = document.getElementById('f-paste');
  var txt = (ta && ta.value || '').trim();
  if (!txt){ state.notice = '先把 DeepSeek 的输出粘进左边的框'; renderInputs(); return; }
  var parsed = parseLines(txt);
  if (!parsed || !parsed.length){ state.notice = '没找到 JSON 数组，确认粘的是完整输出'; renderInputs(); return; }
  state.lines = alignToSkeleton(parsed);
  renderLines();
  var r = refreshMetrics();
  var bads = r.issues.filter(function(i){ return i.level === 'bad'; });
  var wrap = document.getElementById('fbWrap');
  if (bads.length){
    var fb = bads.map(function(i){ return '· ' + i.text; }).join('\n');
    document.getElementById('f-fb').value = '机器校验没通过，只改下面这几句，其余原样保留，重新输出完整 JSON 数组：\n' + fb;
    wrap.style.display = 'block';
    state.notice = '导入完成，' + bads.length + ' 处没过，把反馈贴回 DeepSeek 再要一版';
  } else {
    wrap.style.display = 'none';
    state.notice = '导入完成，全部通过校验';
  }
  renderInputs();
}

/* ---------- 事件 ---------- */
function bind(){
  $('f-origin').addEventListener('input', function(e){ state.origin = e.target.value; queueRegen(); });
  $('f-name').addEventListener('input', function(e){ state.name = e.target.value; queueRegen(); });
  $('f-price').addEventListener('input', function(e){ state.price = e.target.value; queueRegen(); });
  $('f-key').addEventListener('input', function(e){ state.key = e.target.value; renderInputs(); });
  $('f-cat').addEventListener('change', function(e){ state.cat = e.target.value; state.attrs = []; renderInputs(); liveRegen(); });
  $('f-attrs').addEventListener('click', function(e){
    var a = e.target.getAttribute && e.target.getAttribute('data-attr'); if (!a) return;
    var i = state.attrs.indexOf(a);
    if (i >= 0) state.attrs.splice(i,1);
    else { if (state.attrs.length >= 2) state.attrs.shift(); state.attrs.push(a); }
    renderInputs(); liveRegen();
  });
  $('f-rime').addEventListener('click', function(e){
    var r = e.target.getAttribute && e.target.getAttribute('data-rime'); if (!r) return;
    state.rime = r; renderInputs(); if (state.lines.length) { gen(state.seed); renderAll(); }
  });
  $('f-scene').addEventListener('click', function(e){
    var s = e.target.getAttribute && e.target.getAttribute('data-scene'); if (!s) return;
    state.scene = s; renderInputs(); liveRegen();
  });
  $('mode').addEventListener('click', function(e){
    var m = e.target.getAttribute && e.target.getAttribute('data-mode'); if (!m) return;
    state.mode = m;
    Array.prototype.forEach.call($('mode').children, function(b){ b.className = (b.getAttribute('data-mode')===m?'on':''); });
    renderInputs();
  });
  $('srcSeg').addEventListener('click', function(e){
    var s = e.target.getAttribute && e.target.getAttribute('data-src'); if (!s) return;
    state.src = s; gen(state.seed); renderAll(); saveState();
  });
  $('pasteGo').addEventListener('click', importPasted);
  $('promptCopy').addEventListener('click', function(){ copyText(buildPrompt(3), $('promptCopy'), '复制提示词'); });
  $('fbCopy').addEventListener('click', function(){ copyText(document.getElementById('f-fb').value, $('fbCopy'), '复制反馈'); });
  $('go').addEventListener('click', function(){
    if (state.mode === 'llm' && state.key){ llmGenerate().then(function(){ renderAll(); }); }
    else { gen(state.seed); renderAll(); }
  });
  $('again').addEventListener('click', function(){ state.seed++; gen(state.seed); renderAll(); saveState(); });
  $('copy').addEventListener('click', function(){
    var txt = state.lines.map(function(l){ return l.text; }).join('\n');
    copyText(txt, $('copy'), '复制全文');
  });
  $('save').addEventListener('click', function(){
    var txt = state.lines.map(function(l){ return '[' + l.board + '] ' + l.text; }).join('\n');
    var a = document.createElement('a');
    a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(txt);
    a.download = '当哩个当-' + state.name + '.txt'; a.click();
  });
  $('promptBtn').addEventListener('click', function(){ openModal(3); });
  $('llmHead').addEventListener('click', function(){
    var open = $('llmHead').classList.toggle('open');
    $('llmBody').classList.toggle('collapsed', !open);
  });
  $('cmpBtn').addEventListener('click', function(){ openCompare(); });
  $('mClose').addEventListener('click', function(){ $('modal').className = 'modal'; });
  $('modal').addEventListener('click', function(e){ if (e.target === $('modal')) $('modal').className = 'modal'; });
  $('mTabs').addEventListener('click', function(e){
    var v = e.target.getAttribute && e.target.getAttribute('data-v'); if (!v) return;
    openModal(+v);
  });
  $('mCopy').addEventListener('click', function(){
    copyText($('mBody').textContent, $('mCopy'), '复制这段提示词');
  });
  var cases = document.querySelectorAll('[data-case]');
  Array.prototype.forEach.call(cases, function(b){
    b.addEventListener('click', function(){ loadCase(b.getAttribute('data-case')); });
  });
}

var DESC = {
  1:'第一版只说了“要曲艺味道、要朗朗上口”，没给任何可执行的字数与韵脚约束。实测：句子长短不齐，韵脚到处跑，像顺口溜，念起来接不上板。',
  2:'第二版把骨架、字数、辙口词库、禁用词全写进提示词。字数对了，但仍有约两成句子把韵脚词换成同音不同字，模型自己“以为”押韵。',
  3:'第三版不赌模型一次写对：提示词里明说“生成后会被机器逐句校验，不合格退回重写，最多 3 次”，把验收标准本身编码进去。通过率从约五成提到约九成，剩下一成交给模板兜底。'
};

function openModal(v){
  $('modal').className = 'modal on';
  $('mTitle').textContent = '提示词 v' + v + '（技术说明里的版本迭代记录）';
  $('mDesc').textContent = DESC[v];
  $('mTabs').style.display = '';
  $('mCopy').style.display = '';
  $('mBody').textContent = buildPrompt(v);
  Array.prototype.forEach.call($('mTabs').children, function(b){ b.className = (String(b.getAttribute('data-v')) === String(v) ? 'on' : ''); });
}

function openCompare(){
  var tpl = buildLines(state.seed);
  var mdl = (MODEL[state.name] || {})[state.scene];
  $('mTitle').textContent = '同一副骨架，两种写法 · ' + state.name + ' · ' + state.scene;
  $('mDesc').textContent = '左列是槽位模板拼的，右列是模型按同一副骨架重写的。板起、价格、收尾三句是硬约束，两边一样；中间几句才是模型自己写的。两份都过了同一套机器校验。';
  $('mTabs').style.display = 'none';
  $('mCopy').style.display = 'none';
  if (!mdl){
    $('mBody').textContent = '这个组合还没缓存模型版。切到「模型写的」看看已经做好的三个案例。';
  } else {
    var rows = '';
    for (var i=0;i<tpl.length;i++){
      var a = tpl[i].text, b = mdl[i] || '';
      var same = (a === b);
      rows += '<tr class="' + (same?'same':'diff') + '"><td class="b">' + esc(tpl[i].board) + '</td><td class="o">' + esc(a) + '</td><td class="m">' + esc(b) + '</td><td class="s">' + (same ? '—' : '<b>换</b>') + '</td></tr>';
    }
    $('mBody').innerHTML = '<table class="cmp"><tr><th>板位</th><th>模板写的</th><th>模型写的</th><th></th></tr>' + rows + '</table>';
  }
  $('modal').className = 'modal on';
}

function fillCase(c){
  state.origin = c.origin; state.name = c.name; state.cat = c.cat; state.attrs = c.attrs.slice();
  state.price = c.price; state.scene = c.scene; state.rime = c.rime;
}
function loadCase(k){
  var c = CASES[k]; if (!c) return;
  fillCase(c); state.seed = 7; state.notice = '';
  gen(state.seed); renderAll();
}

/* ---------- 演示脚本（供录屏用） ---------- */
var DEMO = {};
window.render = function(t){
  if (t >= 0.8 && !DEMO.a){ DEMO.a = 1; loadCase('apple'); }
  if (t >= 4.6 && !DEMO.b){ DEMO.b = 1; state.lines[3].text = '个大皮薄真不错'; renderAll(); }
  if (t >= 8.2 && !DEMO.c){ DEMO.c = 1; var f1 = document.querySelector('.fix'); if (f1) f1.click(); }
  if (t >= 10.6 && !DEMO.m1){ DEMO.m1 = 1; document.querySelector('#srcSeg [data-src=model]').click(); }
  if (t >= 14.6 && !DEMO.cmp){ DEMO.cmp = 1; openCompare(); }
  if (t >= 19.4 && !DEMO.cmp2){ DEMO.cmp2 = 1; $('modal').className = 'modal'; }
  if (t >= 21.0 && !DEMO.s1){ DEMO.s1 = 1; document.querySelector('[data-scene=开场]').click(); }
  if (t >= 23.0 && !DEMO.s2){ DEMO.s2 = 1; document.querySelector('[data-scene=促单]').click(); }
  if (t >= 24.6 && !DEMO.d){ DEMO.d = 1; loadCase('onion'); }
  if (t >= 28.0 && !DEMO.e){ DEMO.e = 1; state.lines[4].text = '产地直发味道好'; renderAll(); }
  if (t >= 31.2 && !DEMO.f){ DEMO.f = 1; var f2 = document.querySelector('.fix'); if (f2) f2.click(); }
  if (t >= 33.0 && !DEMO.g){ DEMO.g = 1; loadCase('beer'); }
  if (t >= 35.6 && !DEMO.h){ DEMO.h = 1; state.lines[6].text = '开怀畅饮一整箱'; renderAll(); }
  if (t >= 38.8 && !DEMO.i){ DEMO.i = 1; var f3 = document.querySelector('.fix'); if (f3) f3.click(); }
  if (t >= 40.4 && !DEMO.j){ DEMO.j = 1; $('llmHead').click(); var lc = document.querySelector('.col.left'); lc.scrollTop = lc.scrollHeight; }
  if (t >= 41.6 && !DEMO.k){ DEMO.k = 1; var bad = ['当哩个当，当哩个当','竹板一响到青岛','青岛啤酒真叫行','入口绵绵冰镇爽满口香','大桶鲜啤十里香','海边装船运到家','一百二十八一整箱','家人们快下手']; document.getElementById('f-paste').value = JSON.stringify(bad.map(function(s){ return { text:s, board:'稳板' }; })); document.getElementById('pasteGo').click(); }
  if (t >= 44.6 && !DEMO.l){ DEMO.l = 1; var good = ['当哩个当，当哩个当','竹板一响到青岛','青岛啤酒响当当','入口绵冰镇爽满口香','大桶鲜啤十里香','海边装船运到家','一百二十八一整箱','家人们快下手']; document.getElementById('f-paste').value = JSON.stringify(good.map(function(s){ return { text:s, board:'稳板' }; })); document.getElementById('pasteGo').click(); }
  return t;
};

function init(){
  bind();
  loadState();
  gen(state.seed);
  saveState();
  renderAll();
  window.__ready = true;
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
