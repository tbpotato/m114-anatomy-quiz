/* 題庫問題回報：上方「回報問題」按鈕＋彈窗；每張小卡顯示同學對該題的回報。
   資料存在 Google 試算表（Apps Script 網頁應用程式），送出後所有人重新整理就看得到。 */
(() => {
  const API = 'https://script.google.com/macros/s/AKfycby2gtRnaQXhoA5PJOvIoo-povb7IHdkw18YEnSbbVfQl3BhFRexF7c5d6ns8eJYNtGWSw/exec';
  const BANK = (location.pathname.match(/\/(e_[a-z0-9]+)\//) || [])[1];
  // 每日瀏覽統計（只記在試算表，網頁上不顯示）：同一個瀏覽器每天第一次開這頁算 1 人
  try {
    const page = BANK || 'home', day = new Date().toLocaleDateString('sv', { timeZone: 'Asia/Taipei' });
    let isNew = true;
    try { isNew = localStorage.getItem('rpSeen:' + page) !== day; localStorage.setItem('rpSeen:' + page, day); } catch (e) {}
    fetch(API, { method: 'POST', body: JSON.stringify({ action: 'hit', page, isNew }), keepalive: true }).catch(() => {});
  } catch (e) {}
  if (!BANK) return;
  const TYPES = ['答案有誤', '網頁異常', '其他建議'];
  const STATUS = { '': ['待確認', 'pend'], '已修正': ['已修正', 'done'], '不是錯誤': ['不是錯誤', 'no'] };
  const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
               set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (s, r = document) => r.querySelector(s);
  // 支持（upvote）：每個瀏覽器一個隨機 ID，後端用它記誰按過，才能正確收回
  let uid = ls.get('rpUid');
  if (!uid) { uid = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)); ls.set('rpUid', uid); }
  let voteOn = ls.get('rpVoteOn') === '1';  // 後端支援投票（GET 回傳 vote: true）才顯示按鈕
  const UP_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3 4.6 13A4.6 4.6 0 0 1 11.1 6.5l.9.9.9-.9A4.6 4.6 0 0 1 19.4 13z"/></svg>';

  const css = `
  .rp-open{position:absolute;top:14px;right:28px;padding:0!important;border:0!important;background:none!important;font-size:14px!important;color:#526b64;text-decoration:underline;cursor:pointer}
  @media(max-width:600px){header{position:relative!important}.rp-open{top:8px;right:16px}}
  .rp-only.on{background:#8a4b0f!important;color:#fff!important;border-color:#8a4b0f!important}
  .rp-chip{margin-left:6px;color:inherit;font:inherit}
  .rp-card{margin-top:10px;font-size:13px;color:#526b64;background:none;border:0;padding:4px 0;cursor:pointer;text-decoration:underline}
  .rp-box{margin-top:12px;font-size:14px;line-height:1.6;color:#526b64}
  .rp-box b{color:#8a4b0f}.rp-item{margin-top:6px}.rp-item+.rp-item{border-top:1px dashed #ecd3b0;padding-top:6px}
  .rp-meta{color:#7a8a85;font-size:12px}.rp-del{margin:0;line-height:20px;padding:0;border:0;background:none;color:#b3261e;font-size:12px;cursor:pointer;text-decoration:underline}.rp-del:disabled{color:#999;cursor:wait}.rp-sug{font-weight:600;color:#152a26}
  .rp-st{display:inline-block;padding:0 6px;border-radius:4px;font-size:12px;margin-right:4px}
  .rp-st.pend{background:#fdecc8;color:#8a4b0f}.rp-st.done{background:#d7f0e0;color:#1d6b3c}.rp-st.no{background:#e6e9e8;color:#526b64}
  .rp-flash{animation:rpf 1.6s ease}@keyframes rpf{0%,40%{box-shadow:0 0 0 4px #d9822b}100%{box-shadow:none}}
  #rpDlg{border:0;border-radius:14px;padding:0;width:min(460px,calc(100vw - 32px));box-shadow:0 10px 40px rgba(0,0,0,.25);color:#183b35}
  #rpDlg::backdrop{background:rgba(0,0,0,.35)}
  #rpDlg form{padding:20px 22px;display:grid;gap:12px}
  #rpDlg h3{margin:0;font-size:20px}#rpDlg .sub{margin:-6px 0 0;font-size:13px;color:#526b64}
  #rpDlg label{display:grid;gap:4px;font-size:14px;font-weight:600}
  #rpDlg label small{font-weight:400;color:#7a8a85}
  #rpDlg input,#rpDlg select,#rpDlg textarea{font:inherit;font-size:16px;padding:8px 10px;border:1px solid #aaa;border-radius:6px;background:#fff;color:inherit;width:100%;box-sizing:border-box}
  #rpDlg textarea{min-height:90px;resize:vertical}
  #rpDlg .prev{font-size:13px;font-weight:400;color:#526b64;background:#f3f6f5;border-radius:6px;padding:6px 8px}
  #rpDlg .prev.bad{color:#b3261e;background:#fdeceb}
  #rpDlg .row{display:flex;gap:8px;justify-content:flex-end;align-items:center}
  #rpDlg .msg{flex:1;font-size:13px}#rpDlg .msg.err{color:#b3261e}#rpDlg .msg.ok{color:#1d6b3c}
  #rpDlg button{font:inherit;padding:8px 16px;border-radius:6px;border:1px solid #aaa;background:#fff;cursor:pointer}
  #rpDlg button[type=submit]{background:#183b35;color:#fff;border-color:#183b35}
  #rpDlg button:disabled{opacity:.5;cursor:wait}
  #rpDlg .hp{position:absolute;left:-9999px}
  .rp-row{display:flex;flex-wrap:wrap;align-items:center;column-gap:8px}
  .rp-up{box-sizing:border-box;height:20px;margin:0;padding:0 7px;border:1px solid #222;border-radius:999px;background:#fff;color:#111;font:600 12px/1 system-ui;display:inline-flex;align-items:center;gap:3px;cursor:pointer}
  .rp-up svg{display:block;width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linejoin:round}
  .rp-up.on{background:#111;color:#fff;border-color:#111}.rp-up.on svg{fill:currentColor}.rp-up:disabled{cursor:wait}`;
  document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);

  const cards = [...document.querySelectorAll('article')];
  const byNo = new Map(cards.map(c => [parseInt(c.dataset.order, 10), c]));
  const byKey = new Map(cards.map(c => [String(c.dataset.original), c]));

  // ---- 上方按鈕 ----
  const nav = $('header nav');
  nav.insertAdjacentHTML('beforeend',
    '<button type="button" class="rp-only" hidden>可能有錯的題目</button>');
  $('header').insertAdjacentHTML('beforeend', '<button type="button" class="rp-open">回報問題</button>');
  const onlyBtn = $('.rp-only', nav);
  let onlyOn = false;
  const recount = () => {
    if (!onlyOn) return;
    cards.forEach(c => { if (!c.dataset.rp) c.hidden = true; });
    $('#count').textContent = '顯示 ' + cards.filter(c => !c.hidden).length + ' 題（可能有錯的題目）';
  };
  onlyBtn.onclick = () => {
    onlyOn = !onlyOn;
    onlyBtn.classList.toggle('on', onlyOn);
    $('#search').dispatchEvent(new Event('input'));
    recount();
  };
  nav.addEventListener('click', e => { if (e.target.dataset.filter) setTimeout(recount); });
  $('#search').addEventListener('input', () => setTimeout(recount));

  // ---- 每張卡片的「回報此題」 ----
  cards.forEach(c => {
    c.insertAdjacentHTML('beforeend', '<button type="button" class="rp-card">我覺得這題答案有誤</button>');
    $('.rp-card', c).onclick = () => openDlg('答案有誤', parseInt(c.dataset.order, 10));
  });

  // ---- 彈窗 ----
  document.body.insertAdjacentHTML('beforeend', `
  <dialog id="rpDlg"><form method="dialog" novalidate>
    <h3>回報問題</h3>
    <label>暱稱<input name="name" maxlength="20" autocomplete="nickname"></label>
    <label class="f-type">問題類型<select name="type"><option value="" disabled>請選擇</option>${TYPES.map(t => `<option>${t}</option>`).join('')}</select></label>
    <label class="f-q">題號<input name="q" type="number" inputmode="numeric" min="1" max="${cards.length}"><span class="prev" hidden></span></label>
    <label class="f-sug">建議的正確答案<input name="suggest" maxlength="120" placeholder="送出後會公開顯示在該題的正解下方(可自行刪除)" autocapitalize="off" spellcheck="false"></label>
    <label class="f-desc">問題說明<textarea name="desc" maxlength="600" required></textarea></label>
    <input class="hp" name="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
    <div class="row"><span class="msg"></span><button type="button" value="cancel">取消</button><button type="submit">送出</button></div>
  </form></dialog>`);
  const dlg = $('#rpDlg'), form = $('form', dlg), f = form.elements, msg = $('.msg', dlg), prev = $('.prev', dlg);
  const setMsg = (t, cls = '') => { msg.textContent = t; msg.className = 'msg ' + cls; };
  const sync = () => {
    const isAns = f.type.value === '答案有誤';
    $('.f-q', dlg).hidden = !isAns;
    $('.f-sug', dlg).hidden = !isAns;
    $('.f-desc', dlg).hidden = isAns;
    showPrev();
  };
  const showPrev = () => {
    const n = parseInt(f.q.value, 10), c = byNo.get(n);
    if (!f.q.value) { prev.hidden = true; return; }
    prev.hidden = false;
    if (!c) { prev.textContent = `沒有第 ${f.q.value} 題（這個題庫是 1–${cards.length}）`; prev.classList.add('bad'); return; }
    prev.classList.remove('bad');
    const ans = [...c.querySelectorAll('details pre')].map(p => p.textContent).join(' / ');
    prev.textContent = `第 ${n} 題 · ${c.dataset.category} · ${c.dataset.region}｜目前正解：${ans}`;
  };
  f.type.onchange = sync;
  f.q.oninput = showPrev;
  $('button[value=cancel]', dlg).onclick = () => dlg.close();
  // 從卡片開：固定「答案有誤」、帶入題號、不顯示類型選單；從上方開：類型不預設
  function openDlg(type = '', q = '') {
    form.reset();
    f.name.value = ls.get('rpName') || '';
    f.type.value = type;
    f.q.value = q || '';
    $('.f-type', dlg).hidden = !!q;
    $('h3', dlg).textContent = q ? `回報第 ${q} 題答案有誤` : '回報問題';
    setMsg('');
    sync();
    dlg.showModal();
    (q ? f.suggest : (f.name.value ? f.type : f.name)).focus();
  }
  $('.rp-open').onclick = () => openDlg();

  form.onsubmit = async e => {
    e.preventDefault();
    const type = f.type.value, n = parseInt(f.q.value, 10), c = byNo.get(n);
    if (!type) { setMsg('請選擇問題類型', 'err'); f.type.focus(); return; }
    if (type === '答案有誤' && !c) { setMsg('請填正確的題號', 'err'); f.q.focus(); return; }
    if (type === '答案有誤' && !f.suggest.value.trim()) { setMsg('請填建議的正確答案', 'err'); f.suggest.focus(); return; }
    if (type !== '答案有誤' && f.desc.value.trim().length < 2) { setMsg('請寫問題說明', 'err'); f.desc.focus(); return; }
    const p = { bank: BANK, type, name: f.name.value.trim(), desc: type === '答案有誤' ? '' : f.desc.value.trim(), hp: f.hp.value,
                q: type === '答案有誤' ? String(n) : '', key: type === '答案有誤' ? c.dataset.original : '',
                suggest: type === '答案有誤' ? f.suggest.value.trim() : '', page: location.href.slice(0, 200) };
    ls.set('rpName', p.name);
    const btn = $('button[type=submit]', dlg);
    btn.disabled = true; setMsg('送出中…');
    try {
      const r = await (await fetch(API, { method: 'POST', body: JSON.stringify(p) })).json();
      if (!r.ok) throw new Error(r.error || '送出失敗');
      setMsg('已送出，謝謝！', 'ok');
      if (type === '答案有誤') {
        reports.push({ id: r.id, t: new Date().toISOString(), key: p.key, q: p.q, name: p.name || '匿名', suggest: p.suggest, desc: p.desc, status: '' });
        render();
        setTimeout(() => { dlg.close(); c.scrollIntoView({ behavior: 'smooth', block: 'center' }); c.classList.add('rp-flash');
                           setTimeout(() => c.classList.remove('rp-flash'), 1700); }, 700);
      } else setTimeout(() => dlg.close(), 900);
    } catch (err) {
      setMsg('送出失敗：' + err.message + '，請稍後再試', 'err');
    } finally { btn.disabled = false; }
  };

  // ---- 顯示回報 ----
  let reports = [];
  const fmt = t => { const d = new Date(t); return isNaN(d) ? '' : `${d.getMonth() + 1}/${d.getDate()}`; };
  function render() {
    const group = new Map();
    for (const r of reports) {
      const c = byKey.get(String(r.key)) || byNo.get(parseInt(r.q, 10));
      if (!c) continue;
      if (!group.has(c)) group.set(c, []);
      group.get(c).push(r);
    }
    cards.forEach(c => {
      const list = group.get(c) || [];
      c.querySelector('.rp-box')?.remove();
      c.querySelector('.rp-chip')?.remove();
      if (!list.length) { delete c.dataset.rp; return; }
      c.dataset.rp = list.length;
      const open = list.filter(r => r.status !== '已修正' && r.status !== '不是錯誤').length;
      if (open) c.querySelector('h2').insertAdjacentHTML('beforeend', `<span class="rp-chip" title="${open} 則回報">⚠</span>`);
      const items = list.map(r =>
        `<div class="rp-row"><span>${esc(r.name || '匿名')} 覺得答案是 <b>${esc(r.suggest || r.desc)}</b> (${fmt(r.t)})</span>` +
        (r.id ? `<button type="button" class="rp-del" data-id="${esc(r.id)}">刪除</button>` : '') + '</div>').join('');
      const box = `<div class="rp-box">錯誤回報：${items}</div>`;
      (c.querySelector('details') || c).insertAdjacentHTML('beforeend', box);
      c.querySelectorAll('.rp-del').forEach(b => b.onclick = () => delReport(b));
      c.querySelectorAll('.rp-up').forEach(b => b.onclick = () => vote(b));
    });
    const n = cards.filter(c => c.dataset.rp).length;
    onlyBtn.hidden = !n;
    onlyBtn.textContent = '可能有錯的題目';
    recount();
  }
  const paintVote = (b, r) => {
    b.classList.toggle('on', !!r.mine);
    b.setAttribute('aria-pressed', !!r.mine);
    b.title = r.mine ? '收回支持' : '支持這個回報';
    $('span', b).textContent = r.votes || 0;
  };
  // 先在畫面上切換，後端回來再用它的數字；失敗就改回去。送出中按鈕停用，避免連點把數字弄亂
  async function vote(b) {
    const r = reports.find(x => x.id === b.dataset.id);
    if (!r || b.disabled) return;
    const up = !r.mine;
    r.mine = up; r.votes = Math.max(0, (r.votes || 0) + (up ? 1 : -1));
    paintVote(b, r); b.disabled = true;
    try {
      const res = await (await fetch(API, { method: 'POST', body: JSON.stringify({ action: 'vote', id: r.id, uid, up }) })).json();
      if (!res.ok) throw new Error(res.error || '失敗');
      r.votes = res.votes; r.mine = res.voted;
    } catch (err) {
      r.mine = !up; r.votes = Math.max(0, r.votes + (up ? -1 : 1));
      alert((up ? '支持' : '收回') + '失敗：' + err.message + '，請稍後再試');
    } finally {
      b.disabled = false; paintVote(b, r);
      ls.set(cacheKey, JSON.stringify(reports));
    }
  }
  async function delReport(b) {
    if (!confirm('確定要刪除這則回報嗎？刪除後所有人都看不到。')) return;
    b.disabled = true; b.textContent = '刪除中…';
    try {
      const r = await (await fetch(API, { method: 'POST', body: JSON.stringify({ action: 'delete', id: b.dataset.id }) })).json();
      if (!r.ok) throw new Error(r.error || '刪除失敗');
      reports = reports.filter(x => x.id !== b.dataset.id);
      ls.set(cacheKey, JSON.stringify(reports));
      render();
    } catch (err) {
      alert('刪除失敗：' + err.message + '，請稍後再試');
      b.disabled = false; b.textContent = '刪除';
    }
  }
  const cacheKey = 'rpCache:' + BANK;
  try { reports = JSON.parse(ls.get(cacheKey) || '[]'); render(); } catch (e) {}
  fetch(API + '?bank=' + BANK + '&uid=' + encodeURIComponent(uid)).then(r => r.json()).then(d => {
    if (!d.ok) return;
    reports = d.reports;
    voteOn = d.vote === true;
    ls.set('rpVoteOn', voteOn ? '1' : '');
    ls.set(cacheKey, JSON.stringify(reports));
    render();
  }).catch(() => {});
})();

/* 圖片放大檢視：點題目圖片 → 接近全螢幕顯示。
   關閉：右上角 ✕、Esc、點黑色背景、手機往下滑、手機「返回」。
   換題：← → 鍵／左右滑／兩側箭頭（只在目前篩選看得到的題目間切換）。
   縮放：手機雙指縮放、點兩下放大／還原，放大後單指拖曳；電腦點圖片放大／還原、滾輪縮放、拖曳移動。 */
(() => {
  if (!document.querySelector('article img')) return;
  document.head.insertAdjacentHTML('beforeend', `<style>
  article img{cursor:zoom-in}
  #lb{position:fixed;inset:0;z-index:9999;background:rgba(10,14,13,.97);display:none;touch-action:none;user-select:none;-webkit-user-select:none;overscroll-behavior:contain}
  #lb.on{display:block}
  #lb .lb-stage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:56px 64px 48px;box-sizing:border-box;overflow:hidden}
  #lb .lb-stage img{max-width:100%;max-height:100%;object-fit:contain;cursor:zoom-in;border-radius:4px;background:#fff;transform-origin:50% 50%;will-change:transform;-webkit-user-drag:none}
  #lb.zoom .lb-stage img{cursor:grab;border-radius:0}
  #lb button{position:absolute;border:0;background:rgba(255,255,255,.12);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font:400 26px/1 system-ui;border-radius:999px;z-index:2}
  #lb button:hover{background:rgba(255,255,255,.25)}
  #lb .lb-x{top:10px;right:12px;width:44px;height:44px}
  #lb .lb-p,#lb .lb-n{top:50%;width:44px;height:64px;margin-top:-32px;border-radius:10px;font-size:30px}
  #lb .lb-p{left:10px}#lb .lb-n{right:10px}
  #lb .lb-cap{position:absolute;left:0;right:0;bottom:0;padding:12px 16px;color:#e8efed;font:14px/1.4 system-ui;text-align:center;pointer-events:none}
  #lb .lb-top{position:absolute;left:16px;top:20px;color:#b9c7c3;font:13px system-ui;pointer-events:none}
  #lb.zoom .lb-p,#lb.zoom .lb-n,#lb.zoom .lb-cap,#lb.zoom .lb-top{display:none}
  @media(max-width:600px){#lb .lb-stage{padding:56px 8px 52px}#lb .lb-p,#lb .lb-n{display:none}}
  </style>`);
  document.body.insertAdjacentHTML('beforeend', `<div id="lb" role="dialog" aria-modal="true" aria-label="圖片放大">
    <div class="lb-stage"><img alt="" draggable="false"></div>
    <span class="lb-top"></span>
    <button type="button" class="lb-p" aria-label="上一題">‹</button>
    <button type="button" class="lb-n" aria-label="下一題">›</button>
    <button type="button" class="lb-x" aria-label="關閉">✕</button>
    <div class="lb-cap"></div></div>`);
  const lb = document.getElementById('lb'), stage = lb.querySelector('.lb-stage'), big = stage.querySelector('img');
  let list = [], i = 0, open = false;

  // ---- 縮放狀態：translate(x,y) scale(s)，以圖片中心為原點 ----
  let s = 1, x = 0, y = 0;
  const MAX = 6;
  const center = () => [big.offsetLeft + big.offsetWidth / 2, big.offsetTop + big.offsetHeight / 2];
  const clamp = () => {
    if (s <= 1) { x = 0; y = 0; return; }
    const [cx, cy] = center(), W = stage.clientWidth, H = stage.clientHeight;
    const bx = Math.max(0, (big.offsetWidth * s - W) / 2), by = Math.max(0, (big.offsetHeight * s - H) / 2);
    const ox = W / 2 - cx, oy = H / 2 - cy;   // 放大後以畫面中心為準
    x = Math.min(ox + bx, Math.max(ox - bx, x));
    y = Math.min(oy + by, Math.max(oy - by, y));
  };
  const apply = anim => {
    big.style.transition = anim ? 'transform .22s ease' : 'none';
    big.style.transform = `translate(${x}px,${y}px) scale(${s})`;
    lb.classList.toggle('zoom', s > 1.01);
  };
  // 以畫面上的點 (px,py) 為中心縮放到 ns
  const zoomAt = (ns, px, py, anim) => {
    ns = Math.min(MAX, Math.max(1, ns));
    const [cx, cy] = center();
    x = px - cx - (px - cx - x) * ns / s;
    y = py - cy - (py - cy - y) * ns / s;
    s = ns; clamp(); apply(anim);
  };
  const reset = anim => { s = 1; x = 0; y = 0; apply(anim); };
  const zoomStep = () => Math.min(MAX, Math.max(2.5, big.naturalWidth / big.offsetWidth));
  const toggleAt = (px, py) => s > 1.01 ? reset(true) : zoomAt(zoomStep(), px, py, true);

  const visible = () => [...document.querySelectorAll('article')].filter(a => !a.hidden && a.offsetParent !== null && a.querySelector('img'));
  const show = n => {
    i = (n + list.length) % list.length;
    const a = list[i], im = a.querySelector('img');
    reset(false);
    big.src = im.currentSrc || im.src;
    big.alt = im.alt;
    const h = a.querySelector('h2'), reg = a.querySelector('.region');
    lb.querySelector('.lb-cap').textContent = [h && h.firstChild.textContent.trim(), reg && reg.textContent].filter(Boolean).join('　');
    lb.querySelector('.lb-top').textContent = list.length > 1 ? `${i + 1} / ${list.length}` : '';
    [i - 1, i + 1].forEach(k => { const z = list[(k + list.length) % list.length]; if (z) new Image().src = z.querySelector('img').src; });
  };
  const openAt = art => {
    list = visible(); if (!list.includes(art)) list = [art];
    show(list.indexOf(art));
    lb.classList.add('on'); document.documentElement.style.overflow = 'hidden'; open = true;
    history.pushState({ lb: 1 }, '');
  };
  const doClose = () => {
    if (!open) return; open = false;
    lb.classList.remove('on', 'zoom'); lb.style.opacity = ''; document.documentElement.style.overflow = '';
    list[i] && list[i].scrollIntoView({ block: 'nearest' });
  };
  const close = () => { if (history.state && history.state.lb) history.back(); else doClose(); };
  addEventListener('popstate', doClose);
  document.addEventListener('click', e => {
    const im = e.target.closest('article img');
    if (im && !lb.contains(im)) openAt(im.closest('article'));
  });
  lb.querySelector('.lb-x').onclick = close;
  lb.querySelector('.lb-p').onclick = () => show(i - 1);
  lb.querySelector('.lb-n').onclick = () => show(i + 1);
  addEventListener('resize', () => { if (open) { clamp(); apply(false); } });

  // ---- 滑鼠（電腦）；手機的點擊由下面的觸控處理 ----
  let lastTouch = 0, moved = false;
  stage.addEventListener('click', e => {
    if (Date.now() - lastTouch < 700 || moved) return;
    if (e.target === big) toggleAt(e.clientX, e.clientY);
    else if (s <= 1.01) close();
    else reset(true);
  });
  stage.addEventListener('wheel', e => { e.preventDefault(); zoomAt(s * Math.exp(-e.deltaY / 300), e.clientX, e.clientY, false); }, { passive: false });
  let drag = null;
  stage.addEventListener('mousedown', e => { if (s > 1.01 && e.button === 0) { drag = [e.clientX, e.clientY, x, y]; moved = false; e.preventDefault(); } });
  addEventListener('mousemove', e => {
    if (!drag) return;
    const dx = e.clientX - drag[0], dy = e.clientY - drag[1];
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    x = drag[2] + dx; y = drag[3] + dy; clamp(); apply(false);
  });
  addEventListener('mouseup', () => { drag = null; setTimeout(() => { moved = false; }); });

  // ---- 觸控：雙指縮放、放大後單指拖曳、左右滑換題、往下滑關閉、點兩下放大／還原 ----
  let g = null, lastTap = 0, lastTapXY = [0, 0];
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const mid = t => [(t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2];
  const one = (t, mv) => ({ pinch: false, p0: [t.clientX, t.clientY], x0: x, y0: y, s0: s, move: mv });
  lb.addEventListener('touchstart', e => {
    lastTouch = Date.now();
    if (e.target.closest('button')) { g = null; return; }
    const t = e.touches;
    if (t.length === 2) g = { pinch: true, d0: dist(t), s0: s, m0: mid(t), x0: x, y0: y };
    else if (t.length === 1) { g = one(t[0], false); g.onImg = e.target === big; }
  }, { passive: true });
  lb.addEventListener('touchmove', e => {
    if (!g) return;
    e.preventDefault();
    const t = e.touches;
    if (g.pinch && t.length === 2) {
      const ns = Math.min(MAX, Math.max(1, g.s0 * dist(t) / g.d0)), m = mid(t), [cx, cy] = center();
      // 兩指中點下的那一點固定不動，同時跟著中點平移
      x = m[0] - cx - (g.m0[0] - cx - g.x0) * ns / g.s0;
      y = m[1] - cy - (g.m0[1] - cy - g.y0) * ns / g.s0;
      s = ns; clamp(); apply(false);
    } else if (!g.pinch && t.length === 1) {
      const dx = t[0].clientX - g.p0[0], dy = t[0].clientY - g.p0[1];
      if (Math.abs(dx) + Math.abs(dy) > 8) g.move = true;
      if (g.s0 > 1.01) { x = g.x0 + dx; y = g.y0 + dy; clamp(); apply(false); }
      else if (dy > 0 && dy > Math.abs(dx)) { big.style.transition = 'none'; big.style.transform = `translateY(${dy}px)`; lb.style.opacity = Math.max(.4, 1 - dy / 400); }
    }
  }, { passive: false });
  lb.addEventListener('touchend', e => {
    lastTouch = Date.now();
    if (!g) return;
    if (g.pinch) {
      if (e.touches.length === 1) g = one(e.touches[0], true);   // 放開一指 → 改成單指拖曳
      else { if (s < 1.05) reset(true); g = null; }
      return;
    }
    if (e.touches.length) return;
    const t = e.changedTouches[0], dx = t.clientX - g.p0[0], dy = t.clientY - g.p0[1];
    lb.style.opacity = '';
    if (!g.move) {                                   // 點一下
      const now = Date.now();
      if (now - lastTap < 300 && Math.hypot(t.clientX - lastTapXY[0], t.clientY - lastTapXY[1]) < 40) {
        lastTap = 0; toggleAt(t.clientX, t.clientY);
      } else {
        lastTap = now; lastTapXY = [t.clientX, t.clientY];
        if (!g.onImg && s <= 1.01) setTimeout(() => { if (lastTap === now) close(); }, 300);   // 點背景關閉（先確認不是點兩下）
      }
    } else if (g.s0 <= 1.01) {                       // 沒放大時的滑動
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(i + (dx < 0 ? 1 : -1));
      else if (dy > 90 && dy > Math.abs(dx)) close();
      else reset(true);
    }
    g = null;
  });
  addEventListener('keydown', e => {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowLeft') show(i - 1);
    else if (e.key === 'ArrowRight') show(i + 1);
    else if (e.key === '+' || e.key === '=') zoomAt(s * 1.5, innerWidth / 2, innerHeight / 2, true);
    else if (e.key === '-') zoomAt(s / 1.5, innerWidth / 2, innerHeight / 2, true);
  });
})();
