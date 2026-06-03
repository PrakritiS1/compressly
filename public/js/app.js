/* ─── COMPRESSLY FRONTEND ─── */

// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ── Sliders ───────────────────────────────────────────────────────────────────
function bindSlider(id, displayId) {
  const slider = document.getElementById(id);
  const display = document.getElementById(displayId);
  if (!slider || !display) return;
  slider.addEventListener('input', () => { display.textContent = slider.value; });
}
bindSlider('img-quality', 'img-quality-val');
bindSlider('jpg-quality', 'jpg-quality-val');
bindSlider('zip-level', 'zip-level-val');
bindSlider('folder-level', 'folder-level-val');

// ── Format buttons ─────────────────────────────────────────────────────────────
document.querySelectorAll('.btn-group').forEach(group => {
  group.querySelectorAll('.opt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      group.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}
function getFileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const map = {
    pdf: 'fa-file-pdf', jpg: 'fa-file-image', jpeg: 'fa-file-image',
    png: 'fa-file-image', gif: 'fa-file-image', webp: 'fa-file-image',
    zip: 'fa-file-zipper', mp4: 'fa-file-video', mp3: 'fa-file-audio',
    doc: 'fa-file-word', docx: 'fa-file-word', txt: 'fa-file-lines',
    xlsx: 'fa-file-excel', pptx: 'fa-file-powerpoint', js: 'fa-file-code',
    html: 'fa-file-code', css: 'fa-file-code', json: 'fa-file-code'
  };
  return 'fa-solid ' + (map[ext] || 'fa-file');
}
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

// ── Progress overlay ──────────────────────────────────────────────────────────
function showProgress(title = 'Compressing...') {
  const overlay = document.getElementById('progress-overlay');
  document.getElementById('progress-title').textContent = title;
  document.getElementById('progress-bar').style.animation = 'none';
  document.getElementById('progress-bar').offsetHeight; // reflow
  document.getElementById('progress-bar').style.animation = '';
  overlay.style.display = 'flex';
}
function hideProgress() {
  document.getElementById('progress-overlay').style.display = 'none';
}

// ── Drop Zone Setup ───────────────────────────────────────────────────────────
function setupDropZone(dropId, inputId, onFilesSelected) {
  const drop = document.getElementById(dropId);
  const input = document.getElementById(inputId);
  if (!drop || !input) return;

  drop.addEventListener('click', () => input.click());
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length) onFilesSelected(files);
  });
  input.addEventListener('change', () => {
    if (input.files.length) onFilesSelected(input.files);
  });
}

// ── Result Renderer ───────────────────────────────────────────────────────────
function renderResult(containerId, data) {
  const box = document.getElementById(containerId);
  const pct = parseFloat(data.savedPercent);
  const improved = pct > 0;
  box.innerHTML = `
    <div class="result-header">
      <div class="result-icon"><i class="fa-solid fa-circle-check"></i></div>
      <div>
        <div class="result-title">Compression Complete!</div>
        <div class="result-sub">${data.filename || 'Compressed file'}</div>
      </div>
    </div>
    <div class="result-metrics">
      <div class="metric-card">
        <div class="metric-val">${data.originalSizeFormatted}</div>
        <div class="metric-label">Original</div>
      </div>
      <div class="metric-card">
        <div class="metric-val accent">${data.compressedSizeFormatted}</div>
        <div class="metric-label">Compressed</div>
      </div>
      <div class="metric-card">
        <div class="metric-val ${improved ? 'green' : ''}">${improved ? '-' + pct + '%' : '~' + Math.abs(pct) + '%'}</div>
        <div class="metric-label">${improved ? 'Saved' : 'Difference'}</div>
      </div>
    </div>
    <div class="saving-bar-wrap">
      <div class="saving-bar-label">
        <span>Space saved: ${formatBytes(Math.max(0, data.savedBytes || 0))}</span>
        <span>${pct}%</span>
      </div>
      <div class="saving-bar-bg">
        <div class="saving-bar-fill" id="sbar-${containerId}" style="width:0%"></div>
      </div>
    </div>
    <a href="${data.downloadUrl}" download="${data.filename}" class="download-btn">
      <i class="fa-solid fa-download"></i> Download Compressed File
    </a>
  `;
  box.style.display = 'block';
  setTimeout(() => {
    const fill = document.getElementById('sbar-' + containerId);
    if (fill) fill.style.width = Math.min(100, Math.max(0, pct)) + '%';
  }, 100);
  loadStats();
}

// ── API Call ──────────────────────────────────────────────────────────────────
async function compressFile(endpoint, formData, resultId, progressTitle) {
  showProgress(progressTitle);
  try {
    const res = await fetch('/api/compress/' + endpoint, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    hideProgress();
    if (!res.ok || !data.success) {
      alert('Error: ' + (data.error || 'Compression failed'));
      return;
    }
    renderResult(resultId, data);
  } catch (err) {
    hideProgress();
    alert('Network error: ' + err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── IMAGE TOOL ────────────────────────────────────────────────────────────────
let imageFile = null;

setupDropZone('drop-image', 'input-image', files => {
  imageFile = files[0];
  showImagePreview(imageFile);
  document.getElementById('btn-image').disabled = false;
});

function showImagePreview(file) {
  const preview = document.getElementById('preview-image');
  const reader = new FileReader();
  reader.onload = e => {
    preview.innerHTML = `
      <img src="${e.target.result}" alt="preview" />
      <div class="file-info">
        <div class="file-name">${file.name}</div>
        <div class="file-size">${formatBytes(file.size)}</div>
      </div>
      <button class="file-remove" onclick="clearImageFile()"><i class="fa-solid fa-xmark"></i></button>
    `;
    preview.style.display = 'flex';
  };
  reader.readAsDataURL(file);
}

window.clearImageFile = () => {
  imageFile = null;
  document.getElementById('preview-image').style.display = 'none';
  document.getElementById('btn-image').disabled = true;
  document.getElementById('input-image').value = '';
};

document.getElementById('btn-image').addEventListener('click', () => {
  if (!imageFile) return;
  const format = document.querySelector('#img-format-group .opt-btn.active')?.dataset.val || 'jpeg';
  const quality = document.getElementById('img-quality').value;
  const fd = new FormData();
  fd.append('file', imageFile);
  fd.append('format', format);
  fd.append('quality', quality);
  compressFile('image', fd, 'result-image', 'Compressing image...');
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── JPG TOOL ──────────────────────────────────────────────────────────────────
let jpgFile = null;

setupDropZone('drop-jpg', 'input-jpg', files => {
  jpgFile = files[0];
  const preview = document.getElementById('preview-jpg');
  const reader = new FileReader();
  reader.onload = e => {
    preview.innerHTML = `
      <img src="${e.target.result}" alt="preview" />
      <div class="file-info">
        <div class="file-name">${jpgFile.name}</div>
        <div class="file-size">${formatBytes(jpgFile.size)}</div>
      </div>
      <button class="file-remove" onclick="clearJpgFile()"><i class="fa-solid fa-xmark"></i></button>
    `;
    preview.style.display = 'flex';
  };
  reader.readAsDataURL(jpgFile);
  document.getElementById('btn-jpg').disabled = false;
});

window.clearJpgFile = () => {
  jpgFile = null;
  document.getElementById('preview-jpg').style.display = 'none';
  document.getElementById('btn-jpg').disabled = true;
};

document.getElementById('btn-jpg').addEventListener('click', () => {
  if (!jpgFile) return;
  const quality = document.getElementById('jpg-quality').value;
  const fd = new FormData();
  fd.append('file', jpgFile);
  fd.append('format', 'jpeg');
  fd.append('quality', quality);
  compressFile('image', fd, 'result-jpg', 'Compressing JPG...');
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── PDF TOOL ──────────────────────────────────────────────────────────────────
let pdfFile = null;

setupDropZone('drop-pdf', 'input-pdf', files => {
  pdfFile = files[0];
  const preview = document.getElementById('preview-pdf');
  preview.innerHTML = `
    <div style="font-size:36px;color:#ff5252"><i class="fa-solid fa-file-pdf"></i></div>
    <div class="file-info">
      <div class="file-name">${pdfFile.name}</div>
      <div class="file-size">${formatBytes(pdfFile.size)}</div>
    </div>
    <button class="file-remove" onclick="clearPdfFile()"><i class="fa-solid fa-xmark"></i></button>
  `;
  preview.style.display = 'flex';
  document.getElementById('btn-pdf').disabled = false;
});

window.clearPdfFile = () => {
  pdfFile = null;
  document.getElementById('preview-pdf').style.display = 'none';
  document.getElementById('btn-pdf').disabled = true;
};

document.getElementById('btn-pdf').addEventListener('click', () => {
  if (!pdfFile) return;
  const fd = new FormData();
  fd.append('file', pdfFile);
  compressFile('pdf', fd, 'result-pdf', 'Compressing PDF...');
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── ZIP TOOL ──────────────────────────────────────────────────────────────────
let zipFiles = [];

setupDropZone('drop-zip', 'input-zip', files => {
  zipFiles = [...zipFiles, ...Array.from(files)];
  renderZipList();
  document.getElementById('btn-zip').disabled = zipFiles.length === 0;
});

function renderZipList() {
  const list = document.getElementById('list-zip');
  if (zipFiles.length === 0) { list.innerHTML = ''; return; }
  const display = zipFiles.slice(0, 10);
  list.innerHTML = display.map((f, i) => `
    <div class="file-list-item">
      <i class="${getFileIcon(f.name)}"></i>
      <span class="fn">${f.name}</span>
      <span class="fs">${formatBytes(f.size)}</span>
      <button onclick="removeZipFile(${i})" style="background:none;border:none;color:var(--text2);cursor:pointer;padding:2px 6px"><i class="fa-solid fa-xmark"></i></button>
    </div>
  `).join('') + (zipFiles.length > 10 ? `<div class="file-list-summary">+${zipFiles.length - 10} more files (${formatBytes(zipFiles.reduce((s,f)=>s+f.size,0))} total)</div>` : `<div class="file-list-summary">${zipFiles.length} file${zipFiles.length>1?'s':''} · ${formatBytes(zipFiles.reduce((s,f)=>s+f.size,0))} total</div>`);
}

window.removeZipFile = (i) => {
  zipFiles.splice(i, 1);
  renderZipList();
  document.getElementById('btn-zip').disabled = zipFiles.length === 0;
};

document.getElementById('btn-zip').addEventListener('click', () => {
  if (zipFiles.length === 0) return;
  const level = document.getElementById('zip-level').value;
  const zipName = document.getElementById('zip-name').value || 'compressed';
  const fd = new FormData();
  zipFiles.forEach(f => fd.append('files', f));
  fd.append('level', level);
  fd.append('zipName', zipName);
  compressFile('zip', fd, 'result-zip', 'Creating ZIP archive...');
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── FOLDER TOOL ───────────────────────────────────────────────────────────────
let folderFiles = [];
let relativePaths = [];

setupDropZone('drop-folder', 'input-folder', files => {
  folderFiles = Array.from(files);
  relativePaths = folderFiles.map(f => f.webkitRelativePath || f.name);
  const folderRoot = relativePaths[0] ? relativePaths[0].split('/')[0] : 'folder';
  document.getElementById('folder-name').value = folderRoot;
  renderFolderList();
  document.getElementById('btn-folder').disabled = false;
});

// Also handle folder drag-over with dataTransfer.items
document.getElementById('drop-folder').addEventListener('drop', async (e) => {
  e.preventDefault();
  document.getElementById('drop-folder').classList.remove('drag-over');
  const items = e.dataTransfer.items;
  const collected = [];
  const paths = [];

  async function processEntry(entry, path) {
    if (entry.isFile) {
      return new Promise(resolve => {
        entry.file(file => {
          collected.push(file);
          paths.push(path + file.name);
          resolve();
        });
      });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      return new Promise(resolve => {
        reader.readEntries(async entries => {
          for (const e of entries) await processEntry(e, path + entry.name + '/');
          resolve();
        });
      });
    }
  }

  if (items) {
    for (const item of Array.from(items)) {
      const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
      if (entry) await processEntry(entry, '');
    }
  }

  if (collected.length) {
    folderFiles = collected;
    relativePaths = paths;
    const firstPath = paths[0] || '';
    const rootFolder = firstPath.split('/')[0] || 'folder';
    document.getElementById('folder-name').value = rootFolder;
    renderFolderList();
    document.getElementById('btn-folder').disabled = false;
  }
});

function renderFolderList() {
  const list = document.getElementById('list-folder');
  if (folderFiles.length === 0) { list.innerHTML = ''; return; }
  const totalSize = folderFiles.reduce((s, f) => s + f.size, 0);
  const display = folderFiles.slice(0, 8);
  list.innerHTML = display.map((f, i) => `
    <div class="file-list-item">
      <i class="${getFileIcon(f.name)}"></i>
      <span class="fn">${relativePaths[i] || f.name}</span>
      <span class="fs">${formatBytes(f.size)}</span>
    </div>
  `).join('') + `<div class="file-list-summary">${folderFiles.length} file${folderFiles.length>1?'s':''} · ${formatBytes(totalSize)} total${folderFiles.length > 8 ? ` (showing 8 of ${folderFiles.length})` : ''}</div>`;
}

document.getElementById('btn-folder').addEventListener('click', () => {
  if (folderFiles.length === 0) return;
  const level = document.getElementById('folder-level').value;
  const folderName = document.getElementById('folder-name').value || 'folder';
  const fd = new FormData();
  folderFiles.forEach(f => fd.append('files', f));
  fd.append('level', level);
  fd.append('folderName', folderName);
  fd.append('relativePaths', JSON.stringify(relativePaths));
  compressFile('folder', fd, 'result-folder', 'Compressing folder...');
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── STATS & HISTORY ───────────────────────────────────────────────────────────
async function loadStats() {
  try {
    const res = await fetch('/api/compress/stats');
    const data = await res.json();

    // Hero
    document.querySelector('#hero-totalFiles span').textContent = data.totalFiles.toLocaleString();
    document.querySelector('#hero-totalSaved span').textContent = data.totalSavedFormatted;

    // Stats section
    document.getElementById('stat-total-files').textContent = data.totalFiles.toLocaleString();
    document.getElementById('stat-total-saved').textContent = data.totalSavedFormatted;
    document.getElementById('stat-img-count').textContent = (data.byType.image?.count || 0).toLocaleString();
    document.getElementById('stat-pdf-count').textContent = (data.byType.pdf?.count || 0).toLocaleString();
    document.getElementById('stat-zip-count').textContent = (data.byType.zip?.count || 0).toLocaleString();
    document.getElementById('stat-folder-count').textContent = (data.byType.folder?.count || 0).toLocaleString();

    // History
    const tbody = document.getElementById('history-body');
    if (data.recent && data.recent.length > 0) {
      tbody.innerHTML = data.recent.map(r => `
        <tr>
          <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.originalName}</td>
          <td><span class="type-badge type-${r.type === 'image' ? 'image' : r.type}">${r.type}</span></td>
          <td>${formatBytes(r.originalSize)}</td>
          <td>${formatBytes(r.compressedSize)}</td>
          <td class="saved-pct">${r.savedPercent > 0 ? '-' + r.savedPercent + '%' : r.savedPercent + '%'}</td>
          <td>${timeAgo(r.createdAt)}</td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="6"><i class="fa-solid fa-inbox"></i> No compressions yet</td></tr>`;
    }
  } catch (e) {
    console.error('Stats load failed', e);
  }
}

// Load stats on page load
loadStats();
// Refresh stats every 30 seconds
setInterval(loadStats, 30000);
