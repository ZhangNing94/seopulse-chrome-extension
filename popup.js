/* SEOPulse - Popup Script */

document.addEventListener('DOMContentLoaded', async () => {
  // Pro section refs
  const proFree = document.getElementById('proFree');
  const proActive = document.getElementById('proActive');
  const upgradeProBtn = document.getElementById('upgradeProBtn');
  const activateBtn = document.getElementById('activateBtn');
  const licenseInput = document.getElementById('licenseInput');
  const licenseMsg = document.getElementById('licenseMsg');
  const usageDisplay = document.getElementById('usageDisplay');
  const upgradeModal = document.getElementById('upgradeModal');
  const getProBtn = document.getElementById('getProBtn');
  const upgradeCloseBtn = document.getElementById('upgradeCloseBtn');

  // Init: check Pro status and update UI
  await checkProAndShowUI();

  // Pro button handlers
  upgradeProBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'getGumroadUrl' }, resp => {
      if (resp && resp.url) chrome.tabs.create({ url: resp.url });
    });
  });

  activateBtn.addEventListener('click', async () => {
    const code = licenseInput.value.trim().toUpperCase();
    if (!code) {
      showLicenseMsg('Please enter your license key.', 'error');
      return;
    }
    activateBtn.disabled = true;
    activateBtn.textContent = 'Checking...';
    try {
      const resp = await chrome.runtime.sendMessage({ action: 'verifyLicense', code });
      if (resp && resp.success) {
        showLicenseMsg(' Pro activated! Unlimited audits unlocked.', 'success');
        setTimeout(() => checkProAndShowUI(), 800);
      } else {
        showLicenseMsg(resp.error || 'Invalid license key.', 'error');
        activateBtn.disabled = false;
        activateBtn.textContent = 'Activate';
      }
    } catch (e) {
      showLicenseMsg('Error: ' + e.message, 'error');
      activateBtn.disabled = false;
      activateBtn.textContent = 'Activate';
    }
  });

  // Upgrade modal handlers
  getProBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'getGumroadUrl' }, resp => {
      if (resp && resp.url) chrome.tabs.create({ url: resp.url });
    });
  });
  upgradeCloseBtn.addEventListener('click', () => upgradeModal.classList.add('hidden'));

  // Now run the audit
  const loading = document.getElementById('loading');
  const results = document.getElementById('results');
  const error = document.getElementById('error');
  const scoreBadge = document.getElementById('scoreBadge');

  try {
    // Check usage limit before auditing
    const usageResp = await chrome.runtime.sendMessage({ action: 'getUsage' });
    if (usageResp && !usageResp.isPro && usageResp.usage >= usageResp.limit) {
      loading.classList.add('hidden');
      upgradeModal.classList.remove('hidden');
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      showError();
      return;
    }

    const injection = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: analyzeDOM,
    });

    const data = injection[0]?.result;
    if (!data) { showError(); return; }

    // Increment usage counter
    chrome.runtime.sendMessage({ action: 'checkCanAudit' });
    await checkProAndShowUI();

    renderResults(data, tab.url);
  } catch (e) {
    console.error('SEOPulse error:', e);
    showError();
  }

  function showError() {
    loading.classList.add('hidden');
    error.classList.remove('hidden');
  }
});

/* License message helper */
function showLicenseMsg(msg, type) {
  const el = document.getElementById('licenseMsg');
  el.textContent = msg;
  el.className = 'license-msg ' + type;
  setTimeout(() => { el.textContent = ''; el.className = 'license-msg'; }, 4000);
}

/* Check Pro status and update UI */
async function checkProAndShowUI() {
  const proFree = document.getElementById('proFree');
  const proActive = document.getElementById('proActive');
  const usageDisplay = document.getElementById('usageDisplay');

  return new Promise(resolve => {
    chrome.storage.local.get(['isPro', 'usageCount', 'usageDate'], data => {
      const today = new Date().toDateString();
      const usage = data.usageDate === today ? (data.usageCount || 0) : 0;

      if (data.isPro) {
        proFree.classList.add('hidden');
        proActive.classList.remove('hidden');
      } else {
        proFree.classList.remove('hidden');
        proActive.classList.add('hidden');
        const left = Math.max(0, 3 - usage);
        usageDisplay.textContent = left + ' free audit' + (left !== 1 ? 's' : '') + ' today';
      }
      resolve();
    });
  });
}

function analyzeDOM() {
  const r = {};

  r.title = ((t = document.querySelector('title')) => ({
    value: t ? t.textContent.trim() : '',
    status: !t ? 'error' : t.textContent.trim().length < 10 ? 'warn' : t.textContent.trim().length > 70 ? 'warn' : 'ok',
    msg: !t ? 'Missing' : t.textContent.trim().length < 10 ? 'Too short <10' : t.textContent.trim().length > 70 ? 'Too long >70' : `OK (${t.textContent.trim().length}ch)`
  }))();

  r.metaDesc = ((m = document.querySelector('meta[name="description"]')) => {
    const d = m ? m.getAttribute('content') || '' : '';
    return { value: d, status: !d ? 'error' : d.length < 50 ? 'warn' : d.length > 160 ? 'warn' : 'ok', msg: !d ? 'Missing' : d.length < 50 ? 'Too short <50' : d.length > 160 ? 'Too long >160' : `OK (${d.length}ch)` };
  })();

  r.canonical = ((c = document.querySelector('link[rel="canonical"]')) => ({ status: c ? 'ok' : 'warn', msg: c ? 'Present' : 'Missing' }))();

  const h1s = document.querySelectorAll('h1');
  r.h1 = { values: Array.from(h1s).map(h => h.textContent.trim()).filter(Boolean), count: h1s.length, status: h1s.length === 0 ? 'error' : h1s.length > 1 ? 'warn' : 'ok', msg: h1s.length === 0 ? 'Missing' : h1s.length > 1 ? `${h1s.length} H1s` : 'OK' };

  ['h2','h3','h4','h5','h6'].forEach(t => { r[t+'c'] = document.querySelectorAll(t).length; });

  const imgs = document.querySelectorAll('img');
  const noAlt = Array.from(imgs).filter(i => !i.getAttribute('alt') || !i.getAttribute('alt').trim()).length;
  r.images = { total: imgs.length, noAlt, status: imgs.length === 0 ? 'warn' : noAlt === 0 ? 'ok' : 'warn', msg: imgs.length === 0 ? 'No images' : noAlt === 0 ? 'All OK' : `${noAlt}/${imgs.length} no alt` };

  const og = ['og:title','og:description','og:image','og:url','og:type','og:site_name'].reduce((a,k) => { const m = document.querySelector(`meta[property="${k}"]`); a[k.split(':')[1]] = m ? m.getAttribute('content') || '' : ''; return a; }, {});
  r.og = { ...og, count: [og.title,og.description,og.image].filter(Boolean).length, status: og.title && og.description ? 'ok' : og.title ? 'warn' : 'error', msg: og.title && og.description ? 'Complete' : og.title ? 'Partial' : 'Missing' };

  const tw = { card: '', title: '', description: '', image: '' };
  ['twitter:card','twitter:title','twitter:description','twitter:image'].forEach(k => { const m = document.querySelector(`meta[name="${k}"]`); tw[k.split(':')[1]] = m ? m.getAttribute('content') || '' : ''; });
  r.tw = { ...tw, count: [tw.card,tw.title,tw.description,tw.image].filter(Boolean).length, status: tw.card ? 'ok' : 'error', msg: tw.card ? 'Present' : 'Missing' };

  const schemas = document.querySelectorAll('script[type="application/ld+json"]');
  const st = [];
  schemas.forEach(s => { try { const d = JSON.parse(s.textContent); st.push(d['@type'] || (Array.isArray(d) ? d[0]?.['@type'] : 'Unknown')); } catch(e) {} });
  r.schema = { count: schemas.length, types: st, status: schemas.length > 0 ? 'ok' : 'warn', msg: schemas.length > 0 ? `${schemas.length} found` : 'Missing' };

  const robots = document.querySelector('meta[name="robots"]');
  r.robots = { value: robots ? robots.getAttribute('content') || '' : '', status: robots ? 'ok' : 'warn', msg: robots ? robots.getAttribute('content') : 'Missing' };
  if (robots && robots.getAttribute('content').toLowerCase().includes('noindex')) r.robots.warn = 'noindex!';

  r.viewport = { status: document.querySelector('meta[name="viewport"]') ? 'ok' : 'warn', msg: document.querySelector('meta[name="viewport"]') ? 'OK' : 'Missing' };
  r.lang = { value: document.documentElement.lang || '', status: document.documentElement.lang ? 'ok' : 'warn', msg: document.documentElement.lang || 'Missing' };
  r.favicon = { status: document.querySelector('link[rel="icon"], link[rel="shortcut icon"]') ? 'ok' : 'warn', msg: document.querySelector('link[rel="icon"], link[rel="shortcut icon"]') ? 'OK' : 'Missing' };

  const text = document.body ? document.body.innerText || '' : '';
  const wc = text.trim().split(/\s+/).filter(w => w.length > 0).length;
  r.wordCount = { value: wc, status: wc < 100 ? 'warn' : 'ok', msg: wc < 100 ? `Low (${wc})` : `${wc} words` };
  r.https = { status: location.protocol === 'https:' ? 'ok' : 'error', msg: location.protocol === 'https:' ? 'HTTPS' : 'NOT HTTPS!' };

  const links = document.querySelectorAll('a[href]');
  let internal = 0, external = 0;
  links.forEach(a => { try { const u = new URL(a.href, location.origin); u.hostname === location.hostname || u.hostname === '' ? internal++ : external++; } catch(e) { internal++; } });
  r.links = { internal, external, total: internal + external };

  const nav = performance.getEntriesByType('navigation')[0];
  r.loadTime = nav ? Math.round(nav.domContentLoadedEventEnd - nav.fetchStart) : 0;

  const checks = [r.title, r.metaDesc, r.h1, r.canonical, r.og, r.tw, r.schema, r.robots, r.viewport, r.lang];
  const errs = checks.filter(c => c && c.status === 'error').length;
  const warns = checks.filter(c => c && c.status === 'warn').length;
  const oks = checks.filter(c => c && c.status === 'ok').length;
  r.score = { total: checks.length, ok: oks, warn: warns, error: errs, pct: Math.round((oks / checks.length) * 100) };

  return r;
}

function showToast(message, duration = 2000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => { toast.classList.remove('show'); }, duration);
}

function renderResults(data, url) {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('results').classList.remove('hidden');

  const pct = data.score.pct;
  document.getElementById('scoreBadge').textContent = pct + '%';
  const fill = document.getElementById('scorebarFill');
  fill.style.width = pct + '%';
  fill.style.background = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--primary)' : pct >= 30 ? 'var(--warning)' : 'var(--error)';

  document.getElementById('wordCount').textContent = data.wordCount.value + ' words';
  document.getElementById('links').textContent = data.links.total + ' (' + data.links.internal + ' in / ' + data.links.external + ' ex)';
  document.getElementById('language').textContent = data.lang.value || 'Not set';
  document.getElementById('h1Count').textContent = data.h1.count;
  document.getElementById('h2Count').textContent = data.h2c;
  document.getElementById('h3Count').textContent = data.h3c;
  document.getElementById('h4Count').textContent = data.h4c;
  document.getElementById('h5Count').textContent = data.h5c;
  document.getElementById('h6Count').textContent = data.h6c;

  const items = [
    { name: 'Title Tag', ...data.title },
    { name: 'Meta Description', ...data.metaDesc },
    { name: 'H1 Tag', ...data.h1 },
    { name: 'Canonical URL', ...data.canonical },
    { name: 'Open Graph', ...data.og },
    { name: 'Twitter Card', ...data.tw },
    { name: 'Schema.org', ...data.schema },
    { name: 'Robots Meta', ...data.robots },
    { name: 'Viewport', ...data.viewport },
    { name: 'Language', ...data.lang },
    { name: 'Favicon', ...data.favicon },
    { name: 'HTTPS', ...data.https },
    { name: 'Images Alt', ...data.images },
  ];

  const iconMap = { ok: '\u2713', warn: '!', error: '\u2717' };
  const list = document.getElementById('checksList');
  list.innerHTML = items.map(item => `
    <div class="check-item" tabindex="0">
      <div class="check-icon ${item.status}">${iconMap[item.status]}</div>
      <span class="check-name">${item.name}</span>
      <span class="check-msg">${item.msg}</span>
    </div>
  `).join('');

  if (data.robots.warn) {
    list.insertAdjacentHTML('beforeend', `<div class="check-item" tabindex="0" style="color:var(--error);font-size:12px;">
      <span class="check-icon error">\u26A0</span>
      <span class="check-name">Robots Warning</span>
      <span class="check-msg">${data.robots.warn}</span>
    </div>`);
  }

  document.getElementById('gpUrl').textContent = url.replace(/^https?:\/\//, '');
  document.getElementById('gpTitle').textContent = data.title.value || 'No title';
  document.getElementById('gpDesc').textContent = data.metaDesc.value || 'No description';

  document.getElementById('twTitle').textContent = data.tw.title || data.og.title || 'No title';
  document.getElementById('twDesc').textContent = data.tw.description || data.og.description || 'No description';
  document.getElementById('twUrl').textContent = url.replace(/^https?:\/\//, '');
  const twImg = document.getElementById('twImg');
  if (data.tw.image || data.og.image) {
    twImg.innerHTML = `<img src="${data.tw.image || data.og.image}" alt="Preview" onerror="this.parentElement.innerHTML='<span>Image unavailable</span>'">`;
  }

  document.querySelectorAll('.social-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.social-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const type = btn.dataset.preview;
      document.getElementById('googlePreview').classList.toggle('hidden', type !== 'google');
      document.getElementById('twitterPreview').classList.toggle('hidden', type !== 'twitter');
    });
  });

  document.getElementById('copyReport').addEventListener('click', () => {
    const lines = ['SEOPulse Audit Report', '='.repeat(30), '', `URL: ${url}`, `Score: ${pct}%`, ''];
    lines.push('--- Checks ---');
    items.forEach(i => lines.push(`[${i.status.toUpperCase()}] ${i.name}: ${i.msg}`));
    lines.push('', '--- Content ---');
    lines.push(`Words: ${data.wordCount.value}`);
    lines.push(`Links: ${data.links.total} (${data.links.internal} internal, ${data.links.external} external)`);
    lines.push(`Language: ${data.lang.value || 'N/A'}`);
    lines.push(`HTTPS: ${data.https.msg}`);
    lines.push('', '--- Headings ---');
    lines.push(`H1: ${data.h1.count}  H2: ${data.h2c}  H3: ${data.h3c}  H4: ${data.h4c}  H5: ${data.h5c}  H6: ${data.h6c}`);
    lines.push('', '--- Social ---');
    lines.push(`OG: ${data.og.title ? data.og.title : 'N/A'} | Image: ${data.og.image ? '\u2713' : '\u2717'}`);
    lines.push(`Twitter: ${data.tw.card || 'N/A'} | Image: ${data.tw.image ? '\u2713' : '\u2717'}`);
    lines.push('', 'Generated by SEOPulse');
    const report = lines.join('\n');
    navigator.clipboard.writeText(report).then(() => {
      showToast('\u2713 Report copied!');
    });
  });
}