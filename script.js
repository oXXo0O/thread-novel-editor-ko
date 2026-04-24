// ── 상태 ──────────────────────────────────────────────────────
let posts = [];
let nicks = [];
let editingPostId = null;
let editingNickId = null;

// ── 초기화 ────────────────────────────────────────────────────
 
// ── 기호 팔레트 ──────────────────────────────────────────────
const SYMBOL_GROUPS = [
  { label: '괄호',   symbols: ['【】', '〔〕', '《》', '〈〉', '「」', '『』', '［］', '（）'] },
  { label: '구분',   symbols: ['━', '─', '―', '·', '…', '※', '◆', '■', '▼', '▲', '★', '☆'] },
  { label: '숫자',   symbols: ['①②③', '❶❷❸', 'Ⅰ Ⅱ Ⅲ'] },
  { label: '기타',   symbols: ['>>', '♪', '♡', '♥', '✦', '✧', '〃', '々', '〜', '∥', '／', '＼'] },
];
 
let customSymbols = [];
let paletteOpen = true;
let lastFocused = null; // 마지막으로 포커스된 입력란
 
// 포커스 추적
function trackFocus(el) { lastFocused = el; }
 
function initPalette() {
  // 저장된 커스텀 기호 불러오기
  try {
    const saved = localStorage.getItem('thread-custom-symbols');
    if (saved) customSymbols = JSON.parse(saved);
  } catch(e) {}
 
  // 모든 입력란에 포커스 추적 추가
  ['newName','newDate','newContent'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('focus', () => trackFocus(el));
  });
 
  // 팔레트 상태 복원
  try {
    const state = localStorage.getItem('thread-palette-open');
    if (state === 'false') { paletteOpen = false; document.getElementById('symbolPalette').classList.add('closed'); }
  } catch(e) {}
 
  renderPalette();
}
 
function togglePalette() {
  paletteOpen = !paletteOpen;
  document.getElementById('symbolPalette').classList.toggle('closed', !paletteOpen);
  try { localStorage.setItem('thread-palette-open', paletteOpen); } catch(e) {}
}
 
function insertSymbol(sym) {
  // 포커스된 입력란이 없으면 기본적으로 내용 textarea에 삽입
  const target = lastFocused || document.getElementById('newContent');
  const start = target.selectionStart ?? target.value.length;
  const end = target.selectionEnd ?? target.value.length;
  target.value = target.value.slice(0, start) + sym + target.value.slice(end);
  const pos = start + sym.length;
  target.setSelectionRange(pos, pos);
  target.focus();
  // 글자수 업데이트
  if (target.id === 'newContent') updateCharCount();
}
 
function addCustomSymbol() {
  const input = document.getElementById('customSymbol');
  const sym = input.value.trim();
  if (!sym) return;
  if (customSymbols.includes(sym)) { showToast('이미 추가된 기호예요'); return; }
  customSymbols.push(sym);
  input.value = '';
  try { localStorage.setItem('thread-custom-symbols', JSON.stringify(customSymbols)); } catch(e) {}
  renderPalette();
}
 
function deleteCustomSymbol(sym) {
  customSymbols = customSymbols.filter(s => s !== sym);
  try { localStorage.setItem('thread-custom-symbols', JSON.stringify(customSymbols)); } catch(e) {}
  renderPalette();
}
 
function renderPalette() {
  const container = document.getElementById('symbolGroups');
  let html = SYMBOL_GROUPS.map(g => `
    <div class="symbol-group">
      <span class="symbol-group-label">${g.label}</span>
      <div class="symbol-group-btns">
        ${g.symbols.map(s =>
          `<button class="sym-btn" onclick="insertSymbol('${s.replace(/'/g, "\'")}')">${s}</button>`
        ).join('')}
      </div>
    </div>
  `).join('');
 
  if (customSymbols.length) {
    html += `<div class="symbol-group">
      <span class="symbol-group-label">커스텀</span>
      <div class="symbol-group-btns">
        ${customSymbols.map(s =>
          `<button class="sym-btn custom" onclick="insertSymbol('${s.replace(/'/g, "\'")}')">
            ${esc(s)}<span class="sym-del" onclick="event.stopPropagation();deleteCustomSymbol('${s.replace(/'/g, "\'")}')">×</span>
          </button>`
        ).join('')}
      </div>
    </div>`;
  }
  container.innerHTML = html;
}
 
document.addEventListener('DOMContentLoaded', () => {
  loadLocal();
  initPalette();
 
  document.getElementById('newContent').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); addPost(); }
  });
 
  document.addEventListener('keydown', e => {
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault(); saveLocal(); showToast('저장되었습니다');
    }
  });
});

// ── 날짜 ──────────────────────────────────────────────────────
function onDateModeChange() {
  const mode = document.querySelector('input[name="dateMode"]:checked').value;
  document.getElementById('dateFormatWrap').style.display = mode === 'auto' ? 'flex' : 'none';
  document.getElementById('dateFixedWrap').style.display = mode === 'fixed' ? 'flex' : 'none';
  saveLocal();
}

function getDefaultDate() {
  const mode = document.querySelector('input[name="dateMode"]:checked').value;
  if (mode === 'none') return '';
  if (mode === 'fixed') return document.getElementById('dateFixed').value.trim();
  const fmt = document.getElementById('dateFormat').value;
  const now = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const pad = n => String(n).padStart(2, '0');
  if (fmt === '2ch') {
    return `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())}(${days[now.getDay()]}) ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  } else if (fmt === 'short') {
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  } else {
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
}

// ── 고정닉 ────────────────────────────────────────────────────
function addNick() {
  const nameEl = document.getElementById('addNickName');
  const memoEl = document.getElementById('addNickMemo');
  const name = nameEl.value.trim();
  if (!name) { showToast('닉네임을 입력해주세요'); return; }
  nicks.push({ id: Date.now(), name, memo: memoEl.value.trim() });
  nameEl.value = ''; memoEl.value = '';
  renderNicks(); saveLocal();
}

function deleteNick(id) {
  nicks = nicks.filter(n => n.id !== id);
  renderNicks(); saveLocal();
}

function startEditNick(id) { editingNickId = id; renderNicks(); }

function saveEditNick(id) {
  const nameEl = document.getElementById('enick-name-' + id);
  const memoEl = document.getElementById('enick-memo-' + id);
  const nick = nicks.find(n => n.id === id);
  if (nick && nameEl) {
    nick.name = nameEl.value.trim() || nick.name;
    nick.memo = memoEl ? memoEl.value.trim() : nick.memo;
  }
  editingNickId = null; renderNicks(); saveLocal();
}

function useNick(name) {
  document.getElementById('newName').value = name;
  if (!document.getElementById('panel-editor').classList.contains('active')) {
    document.querySelectorAll('.tab')[0].click();
  }
  showToast(`"${name}" 입력됨`);
  document.getElementById('newContent').focus();
}

function renderNicks() {
  const list = document.getElementById('nickList');
  if (!nicks.length) {
    list.innerHTML = '<div class="nick-empty">닉네임을 추가해보세요</div>';
    renderNickHint(); return;
  }
  list.innerHTML = nicks.map(n => {
    if (editingNickId === n.id) {
      return `<div class="nick-item editing">
        <div class="nick-edit-row">
          <input id="enick-name-${n.id}" value="${esc(n.name)}" placeholder="닉네임" onkeydown="if(event.key==='Enter')saveEditNick(${n.id})">
          <input id="enick-memo-${n.id}" value="${esc(n.memo)}" placeholder="메모" onkeydown="if(event.key==='Enter')saveEditNick(${n.id})">
          <button onclick="editingNickId=null;renderNicks()">취소</button>
          <button onclick="saveEditNick(${n.id})" class="primary">저장</button>
        </div>
      </div>`;
    }
    return `<div class="nick-item" onclick="useNick('${esc(n.name)}')">
      <span class="nick-name">${esc(n.name)}</span>
      <span class="nick-memo">${n.memo ? esc(n.memo) : '<span style="opacity:0.45">메모 없음</span>'}</span>
      <span class="nick-actions" onclick="event.stopPropagation()">
        <button onclick="startEditNick(${n.id})">편집</button>
        <button onclick="deleteNick(${n.id})" class="danger">삭제</button>
      </span>
    </div>`;
  }).join('');
  renderNickHint();
}

function renderNickHint() {
  const hint = document.getElementById('nickHint');
  if (!nicks.length) { hint.style.display = 'none'; return; }
  hint.style.display = 'flex';
  hint.innerHTML = '<span>빠른입력:</span>' +
    nicks.map(n => `<span class="nick-chip" onclick="useNick('${esc(n.name)}')">${esc(n.name)}</span>`).join('');
}

// ── 레스 ──────────────────────────────────────────────────────
function addPost() {
  const content = document.getElementById('newContent').value.trim();
  if (!content) { showToast('내용을 입력해주세요'); return; }
  const defName = document.getElementById('defaultName').value || '';
  posts.push({
    id: Date.now(),
    name: document.getElementById('newName').value.trim() || defName,
    date: document.getElementById('newDate').value.trim() || getDefaultDate(),
    content
  });
  document.getElementById('newContent').value = '';
  document.getElementById('newName').value = '';
  document.getElementById('newDate').value = '';
  document.getElementById('charCount').textContent = '0자';
  renderEditor(); saveLocal(); showToast('레스가 추가되었습니다');
  setTimeout(() => {
    const list = document.getElementById('postList');
    list.lastElementChild && list.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, 50);
}

function deletePost(id) { posts = posts.filter(p => p.id !== id); renderEditor(); saveLocal(); }
function startEditPost(id) { editingPostId = id; renderEditor(); }

function saveEditPost(id) {
  const contentEl = document.getElementById('edit-' + id);
  const dateEl = document.getElementById('edit-date-' + id);
  const post = posts.find(p => p.id === id);
  if (post && contentEl) {
    post.content = contentEl.value;
    if (dateEl) post.date = dateEl.value.trim();
  }
  editingPostId = null; renderEditor(); saveLocal();
}

function movePost(id, dir) {
  const idx = posts.findIndex(p => p.id === id);
  if (dir === -1 && idx === 0) return;
  if (dir === 1 && idx === posts.length - 1) return;
  [posts[idx], posts[idx + dir]] = [posts[idx + dir], posts[idx]];
  renderEditor(); saveLocal();
}

function clearAll() {
  if (!confirm('모든 레스를 삭제하시겠습니까?\n(고정닉 목록은 유지됩니다)')) return;
  posts = []; renderEditor(); saveLocal();
}

function updateCharCount() {
  document.getElementById('charCount').textContent = document.getElementById('newContent').value.length + '자';
}

// ── 렌더링 ────────────────────────────────────────────────────
function renderEditor() {
  const list = document.getElementById('postList');
  if (!posts.length) {
    list.innerHTML = '<div class="empty-state">아직 레스가 없습니다.<br>위에서 첫 번째 레스를 작성해보세요.</div>';
    return;
  }
  list.innerHTML = posts.map((p, i) => `
    <div class="post-item">
      <div class="post-header">
        <span class="post-num">${i + 1}</span>
        <span class="post-name">${esc(p.name)}</span>
        ${p.date ? `<span>${esc(p.date)}</span>` : ''}
        <span class="post-header-actions">
          ${i > 0 ? `<button onclick="movePost(${p.id},-1)" title="위로">▲</button>` : ''}
          ${i < posts.length - 1 ? `<button onclick="movePost(${p.id},1)" title="아래로">▼</button>` : ''}
          <button onclick="startEditPost(${p.id})">편집</button>
          <button onclick="deletePost(${p.id})" class="danger">삭제</button>
        </span>
      </div>
      ${editingPostId === p.id
        ? `<div class="post-body-edit">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
              <label style="font-size:11px;color:var(--text2);min-width:30px;font-weight:500;">날짜</label>
              <input id="edit-date-${p.id}" value="${esc(p.date)}" placeholder="날짜 (비워두면 표시 안함)"
                style="flex:1;font-size:12px;padding:4px 8px;border-radius:4px;border:1px solid var(--border);background:#fff;color:var(--text);font-family:var(--mono);">
            </div>
            <textarea id="edit-${p.id}">${esc(p.content)}</textarea>
            <div class="post-body-edit-actions">
              <button onclick="editingPostId=null;renderEditor()">취소</button>
              <button onclick="saveEditPost(${p.id})" class="primary">저장</button>
            </div>
           </div>`
        : `<div class="post-body">${esc(p.content)}</div>`}
    </div>
  `).join('');
}

function renderPreview() {
  document.getElementById('previewTitle').textContent = document.getElementById('threadTitle').value;
  const list = document.getElementById('previewList');
  if (!posts.length) {
    list.innerHTML = '<div style="padding:24px;text-align:center;color:#888;font-size:12px;">레스가 없습니다</div>';
    return;
  }
  list.innerHTML = posts.map((p, i) => `
    <div class="preview-post">
      <div class="preview-post-header">
        <span class="pnum">${i + 1}</span>：<span class="pname">${esc(p.name)}</span>${p.date ? '：' + esc(p.date) : ''}
      </div>
      <div class="preview-post-body">${esc(p.content)}</div>
    </div>
  `).join('');
}

function renderExport() {
  const fmt = document.querySelector('input[name="fmt"]:checked')?.value || '2ch';
  const title = document.getElementById('threadTitle').value;
  let out = '';
  if (fmt === '2ch') {
    out = title + '\n\n' + posts.map((p, i) => {
      const header = p.date ? `${i + 1} ：${p.name} ：${p.date}` : `${i + 1} ：${p.name}`;
      return `${header}\n${p.content}`;
    }).join('\n\n');
  } else {
    out = title + '\n' + '─'.repeat(40) + '\n\n' + posts.map((p, i) => {
      const header = p.date ? `[${i + 1}] ${p.name} ${p.date}` : `[${i + 1}] ${p.name}`;
      return `${header}\n${p.content}`;
    }).join('\n\n');
  }
  document.getElementById('exportOutput').value = out;
}

function copyExport() {
  const el = document.getElementById('exportOutput');
  if (!el.value) { showToast('내보낼 내용이 없습니다'); return; }
  navigator.clipboard.writeText(el.value)
    .then(() => showToast('클립보드에 복사되었습니다!'))
    .catch(() => { el.select(); document.execCommand('copy'); showToast('복사되었습니다!'); });
}

function switchTab(name, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('panel-' + name).classList.add('active');
  if (name === 'preview') renderPreview();
  if (name === 'export') renderExport();
}

// ── 파일 저장/불러오기 ────────────────────────────────────────
function exportFile() {
  const data = collectState();
  const title = data.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40) || '스레드';
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = title + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('파일로 저장되었습니다');
}

function importFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.posts)) { showToast('올바른 파일이 아닙니다'); return; }
      if (posts.length > 0 && !confirm('현재 작업 내용이 덮어씌워집니다. 계속할까요?')) return;
      applyState(data);
      saveLocal();
      showToast('불러오기 완료!');
    } catch (err) {
      showToast('파일을 읽을 수 없습니다');
    }
  };
  reader.readAsText(file, 'UTF-8');
  input.value = '';
}

// ── 로컬 저장 ─────────────────────────────────────────────────
function collectState() {
  return {
    posts, nicks,
    title: document.getElementById('threadTitle').value,
    defaultName: document.getElementById('defaultName').value,
    dateMode: document.querySelector('input[name="dateMode"]:checked').value,
    dateFormat: document.getElementById('dateFormat').value,
    dateFixed: document.getElementById('dateFixed').value,
  };
}

function applyState(data) {
  posts = data.posts || [];
  nicks = data.nicks || [];
  if (data.title !== undefined) document.getElementById('threadTitle').value = data.title;
  if (data.defaultName !== undefined) document.getElementById('defaultName').value = data.defaultName;
  if (data.dateMode) {
    const radio = document.querySelector(`input[name="dateMode"][value="${data.dateMode}"]`);
    if (radio) { radio.checked = true; onDateModeChange(); }
  }
  if (data.dateFormat) document.getElementById('dateFormat').value = data.dateFormat;
  if (data.dateFixed) document.getElementById('dateFixed').value = data.dateFixed;
  renderEditor(); renderNicks();
}

function saveLocal() {
  try {
    localStorage.setItem('thread-novel-editor', JSON.stringify(collectState()));
  } catch (e) { console.error('저장 실패:', e); }
}

function loadLocal() {
  try {
    const raw = localStorage.getItem('thread-novel-editor');
    if (!raw) return;
    applyState(JSON.parse(raw));
  } catch (e) { console.error('불러오기 실패:', e); }
}

// ── 유틸 ──────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
