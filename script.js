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
  { label: '기타',   symbols: ['>>', '♪', '♡', '♥', '✦', '✧', '〃', '〜', '∥', '／', '＼'] },
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
        <span class="post-num">${getStartNum() + i}</span>
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
        <span class="pnum">${getStartNum() + i}</span>：<span class="pname">${esc(p.name)}</span>${p.date ? '：' + esc(p.date) : ''}
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
      const start = getStartNum();
      const header = p.date ? `${start + i} ：${p.name} ：${p.date}` : `${start + i} ：${p.name}`;
      return `${header}\n${p.content}`;
    }).join('\n\n');
  } else {
    out = title + '\n' + '─'.repeat(40) + '\n\n' + posts.map((p, i) => {
      const header = p.date ? `[${getStartNum() + i}] ${p.name} ${p.date}` : `[${getStartNum() + i}] ${p.name}`;
      return `${header}\n${p.content}`;
    }).join('\n\n');
  }
  document.getElementById('exportOutput').value = out;
}

// ── PNG 저장 ──────────────────────────────────────────
function exportPng() {
  if (!posts.length) { showToast('레스가 없습니다'); return; }
 
  const title = document.getElementById('threadTitle').value.replace(/[\/:*?"<>|]/g, '_').slice(0, 40) || '스레드';
  const threadTitle = document.getElementById('threadTitle').value;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const SCALE = 3;
  const WIDTH = 390;
  const PADDING = 12;
  const BG = '#e8e8df';
  const POST_BG = '#ffffff';
  const HEADER_BG = '#e8e0d0';
  const TITLE_BG = '#8b0000';
  const BORDER = '#cccccc';
  const RED = '#8b0000';
  const BLUE = '#00008b';
  const GRAY = '#666666';
 
  showToast('PNG 생성 중...');
 
  setTimeout(() => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
 
      // 폰트 설정
      const fontBase = "'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif";
      const monoBase = "'MS Gothic', 'Meiryo', monospace";
 
      // 높이 계산 (먼저 dry-run)
      function measureHeight() {
        let y = PADDING;
        // 제목
        y += 34; // title bar
        y += 8;
        posts.forEach((p, i) => {
          y += 26; // header
          // 본문 줄 수 계산
          const lines = wrapText(ctx, p.content, WIDTH - PADDING * 2 - 24, 13);
          y += lines.length * 22 + 14;
          y += 6;
        });
        y += PADDING;
        return y;
      }
 
      function wrapText(ctx, text, maxWidth, fontSize) {
        function cw(ch) {
          const code = ch.charCodeAt(0);
          if (
            (code >= 0xAC00 && code <= 0xD7A3) ||
            (code >= 0x3040 && code <= 0x30FF) ||
            (code >= 0x4E00 && code <= 0x9FFF) ||
            (code >= 0xFF00 && code <= 0xFFEF)
          ) return fontSize;
          return fontSize * 0.6;
        }
        function lw(str) { let w = 0; for (const ch of str) w += cw(ch); return w; }
        const paragraphs = text.split('\n');
        const result = [];
        paragraphs.forEach(para => {
          if (para === '') { result.push(''); return; }
          let line = '';
          for (const ch of para) {
            const test = line + ch;
            if (lw(test) > maxWidth && line !== '') {
              result.push(line); line = ch;
            } else { line = test; }
          }
          if (line !== '') result.push(line);
        });
        return result;
      }
 
      // 임시 canvas로 높이 측정
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      tempCanvas.width = WIDTH * SCALE;
      const totalHeight = measureHeight.call({ ctx: tempCtx });
 
      canvas.width = WIDTH * SCALE;
      canvas.height = totalHeight * SCALE;
      ctx.scale(SCALE, SCALE);
 
      // 배경
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, WIDTH, totalHeight);
 
      let y = PADDING;
 
      // 스레드 제목 바
      ctx.fillStyle = TITLE_BG;
      ctx.fillRect(PADDING, y, WIDTH - PADDING * 2, 28);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 14px ${fontBase}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(threadTitle, PADDING + 10, y + 14);
      y += 34;
 
      // 레스 목록
      posts.forEach((p, i) => {
        const postX = PADDING;
        const postW = WIDTH - PADDING * 2;
 
        // 헤더
        ctx.fillStyle = HEADER_BG;
        ctx.fillRect(postX, y, postW, 22);
        ctx.strokeStyle = BORDER;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(postX, y, postW, 22);
 
        ctx.textBaseline = 'middle';
        let hx = postX + 8;
 
        ctx.fillStyle = RED;
        ctx.font = `bold 11px ${fontBase}`;
        const postNum = String(getStartNum() + i);
        ctx.fillText(String(i + 1), hx, y + 11);
        hx += ctx.measureText(String(i + 1)).width + 4;
 
        ctx.fillStyle = GRAY;
        ctx.font = `11px ${fontBase}`;
        ctx.fillText('：', hx, y + 11);
        hx += ctx.measureText('：').width;
 
        ctx.fillStyle = BLUE;
        ctx.font = `bold 11px ${fontBase}`;
        ctx.fillText(p.name || '', hx, y + 11);
        hx += ctx.measureText(p.name || '').width;
 
        if (p.date) {
          ctx.fillStyle = GRAY;
          ctx.font = `11px ${fontBase}`;
          ctx.fillText('：' + p.date, hx, y + 11);
        }
        y += 22;
 
        // 본문
        const lines = wrapText(ctx, p.content, postW - 24, 13);
        const bodyH = lines.length * 22 + 14;
        ctx.fillStyle = POST_BG;
        ctx.fillRect(postX, y, postW, bodyH);
        ctx.strokeStyle = BORDER;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(postX, y, postW, bodyH);
 
        ctx.fillStyle = '#222222';
        ctx.font = `13px ${monoBase}`;
        ctx.textBaseline = 'top';
        lines.forEach((line, li) => {
          ctx.fillText(line, postX + 12, y + 7 + li * 22);
        });
        y += bodyH + 6;
      });
 
      const dataUrl = canvas.toDataURL('image/png');
 
      if (isMobile) {
        const win = window.open('', '_blank');
        win.document.write(
          '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title +
          '</title><style>body{margin:0;background:#111;display:flex;flex-direction:column;align-items:center;padding:16px}' +
          'img{max-width:100%;height:auto;border-radius:4px}p{color:#fff;font-size:13px;margin:0 0 12px;font-family:sans-serif;text-align:center}</style></head>' +
          '<body><p>이미지를 길게 눌러 저장하세요</p><img src="' + dataUrl + '"></body></html>'
        );
        win.document.close();
      } else {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = title + '.png';
        a.click();
      }
 
      showToast('PNG 생성 완료!');
    } catch(e) {
      console.error(e);
      showToast('PNG 생성에 실패했습니다');
    }
  }, 100);
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

// 시작 번호

function getStartNum() {
  return parseInt(document.getElementById('startNum')?.value || '1', 10) || 1;
}

// ── 로컬 저장 ─────────────────────────────────────────────────
function collectState() {
  return {
    posts, nicks,
    title: document.getElementById('threadTitle').value,
    defaultName: document.getElementById('defaultName').value,
    startNum: document.getElementById('startNum').value,
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
    if (data.startNum !== undefined) document.getElementById('startNum').value = data.startNum;
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
