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

  const css = `
  .rp-open{background:#fff4e5!important;border-color:#d9822b!important;color:#8a4b0f!important}
  .rp-only.on{background:#8a4b0f!important;color:#fff!important;border-color:#8a4b0f!important}
  .rp-chip{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:999px;background:#fdecc8;color:#8a4b0f;font-size:13px;font-weight:600;vertical-align:2px}
  .rp-card{margin-top:10px;font-size:13px;color:#526b64;background:none;border:0;padding:4px 0;cursor:pointer;text-decoration:underline}
  .rp-box{margin-top:12px;border-left:3px solid #d9822b;background:#fff8ee;border-radius:6px;padding:8px 12px;font-size:14px;line-height:1.55}
  .rp-box b{color:#8a4b0f}.rp-item{margin-top:6px}.rp-item+.rp-item{border-top:1px dashed #ecd3b0;padding-top:6px}
  .rp-meta{color:#7a8a85;font-size:12px}.rp-del{margin-left:8px;padding:0;border:0;background:none;color:#b3261e;font-size:12px;cursor:pointer;text-decoration:underline}.rp-del:disabled{color:#999;cursor:wait}.rp-sug{font-weight:600;color:#152a26}
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
  #rpDlg .hp{position:absolute;left:-9999px}`;
  document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);

  const cards = [...document.querySelectorAll('article')];
  const byNo = new Map(cards.map(c => [parseInt(c.dataset.order, 10), c]));
  const byKey = new Map(cards.map(c => [String(c.dataset.original), c]));

  // ---- 上方按鈕 ----
  const nav = $('header nav');
  nav.insertAdjacentHTML('beforeend',
    '<button type="button" class="rp-only" hidden>⚠ 只看有回報的題目</button><button type="button" class="rp-open">回報問題</button>');
  const onlyBtn = $('.rp-only', nav);
  let onlyOn = false;
  const recount = () => {
    if (!onlyOn) return;
    cards.forEach(c => { if (!c.dataset.rp) c.hidden = true; });
    $('#count').textContent = '顯示 ' + cards.filter(c => !c.hidden).length + ' 題（只看有回報的）';
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
    c.insertAdjacentHTML('beforeend', '<button type="button" class="rp-card">回報這題答案有誤</button>');
    $('.rp-card', c).onclick = () => openDlg('答案有誤', parseInt(c.dataset.order, 10));
  });

  // ---- 彈窗 ----
  document.body.insertAdjacentHTML('beforeend', `
  <dialog id="rpDlg"><form method="dialog" novalidate>
    <h3>回報問題</h3>
    <label>暱稱<input name="name" maxlength="20" autocomplete="nickname"></label>
    <label class="f-type">問題類型<select name="type"><option value="" disabled>請選擇</option>${TYPES.map(t => `<option>${t}</option>`).join('')}</select></label>
    <label class="f-q">題號<input name="q" type="number" inputmode="numeric" min="1" max="${cards.length}"><span class="prev" hidden></span></label>
    <label class="f-sug">建議的正確答案<input name="suggest" maxlength="120" placeholder="送出後會公開顯示在該題的正解下方" autocapitalize="off" spellcheck="false"></label>
    <label>問題說明<textarea name="desc" maxlength="600" required></textarea></label>
    <input class="hp" name="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
    <div class="row"><span class="msg"></span><button type="button" value="cancel">取消</button><button type="submit">送出</button></div>
  </form></dialog>`);
  const dlg = $('#rpDlg'), form = $('form', dlg), f = form.elements, msg = $('.msg', dlg), prev = $('.prev', dlg);
  const setMsg = (t, cls = '') => { msg.textContent = t; msg.className = 'msg ' + cls; };
  const sync = () => {
    const isAns = f.type.value === '答案有誤';
    $('.f-q', dlg).hidden = !isAns;
    $('.f-sug', dlg).hidden = !isAns;
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
    (q ? f.desc : (f.name.value ? f.type : f.name)).focus();
  }
  $('.rp-open', nav).onclick = () => openDlg();

  form.onsubmit = async e => {
    e.preventDefault();
    const type = f.type.value, n = parseInt(f.q.value, 10), c = byNo.get(n);
    if (!type) { setMsg('請選擇問題類型', 'err'); f.type.focus(); return; }
    if (type === '答案有誤' && !c) { setMsg('請填正確的題號', 'err'); f.q.focus(); return; }
    if (f.desc.value.trim().length < 2) { setMsg('請寫問題說明', 'err'); f.desc.focus(); return; }
    const p = { bank: BANK, type, name: f.name.value.trim(), desc: f.desc.value.trim(), hp: f.hp.value,
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
      if (open) c.querySelector('h2').insertAdjacentHTML('beforeend', `<span class="rp-chip">⚠ ${open} 則回報</span>`);
      const items = list.map(r => {
        const [st, cls] = STATUS[r.status] || [r.status, 'pend'];
        return `<div class="rp-item"><span class="rp-st ${cls}">${esc(st)}</span>` +
          (r.suggest ? `建議答案：<span class="rp-sug">${esc(r.suggest)}</span>　` : '') +
          `${esc(r.desc)}<div class="rp-meta">${esc(r.name || '匿名')} · ${fmt(r.t)}` +
          (r.id ? `<button type="button" class="rp-del" data-id="${esc(r.id)}">刪除</button>` : '') + '</div></div>';
      }).join('');
      const box = `<div class="rp-box"><b>同學回報（${list.length}）</b>${items}</div>`;
      (c.querySelector('details') || c).insertAdjacentHTML('beforeend', box);
      c.querySelectorAll('.rp-del').forEach(b => b.onclick = () => delReport(b));
    });
    const n = cards.filter(c => c.dataset.rp).length;
    onlyBtn.hidden = !n;
    onlyBtn.textContent = `⚠ 只看有回報的題目（${n}）`;
    recount();
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
  fetch(API + '?bank=' + BANK).then(r => r.json()).then(d => {
    if (!d.ok) return;
    reports = d.reports;
    ls.set(cacheKey, JSON.stringify(reports));
    render();
  }).catch(() => {});
})();
