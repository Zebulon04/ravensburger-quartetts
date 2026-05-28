// ── REPORT BUG ────────────────────────────────────────────
const REPORT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwKtvF0IIkeV-8NudAqt3uGOiL78ji60hd9iwUj-LRbZ7Pw_yonlwIrWe8lBF4kunxU/exec';

function _reportStep(step) {
  document.getElementById('rStepForm').classList.toggle('active', step === 'form');
  document.getElementById('rStepReview').classList.toggle('active', step === 'review');
}

function openReportModal() {
  // Reset form
  document.getElementById('rDesc').value = '';
  document.getElementById('rReporter').value = '';
  document.getElementById('rType').selectedIndex = 0;
  document.getElementById('rScope').selectedIndex = 0;
  document.getElementById('rStatus').textContent = '';
  document.getElementById('rStatus').style.color = '';
  document.getElementById('rSendBtn').disabled = false;
  _reportStep('form');
  document.getElementById('reportModal').classList.add('open');
}

function closeReportModal() { document.getElementById('reportModal').classList.remove('open'); }
function closeReportOuter(e) { if (e.target.id === 'reportModal') closeReportModal(); }
function backToReportForm() { _reportStep('form'); }

function showReportReview() {
  const desc = document.getElementById('rDesc').value.trim();
  if (!desc) {
    // Flash the textarea border instead of navigating away
    const ta = document.getElementById('rDesc');
    ta.style.borderColor = 'var(--accent-gold)';
    ta.focus();
    setTimeout(() => ta.style.borderColor = '', 1400);
    return;
  }

  const card = _modalCards[_modalIdx] || {};
  const set  = _modalSet || {};
  const scope = document.getElementById('rScope').value;
  const isEntireSet = scope === 'entire_set';
  const reporter = document.getElementById('rReporter').value.trim() || 'Anonymous';
  const type = document.getElementById('rType').value;

  const rows = [
    { k: 'Type',        v: type.charAt(0).toUpperCase() + type.slice(1) },
    { k: 'Scope',       v: isEntireSet ? 'Entire set' : 'Current card' },
    ...(!isEntireSet && card.card ? [{ k: 'Card', v: `${card.card} · ${card.name || ''}` }] : []),
    { k: 'Collection',  v: `${set.year || currentYear || '—'} · ${set.collection || currentColl || '—'}` },
    { k: 'Reporter',    v: reporter },
    { k: 'Description', v: desc, desc: true },
  ];

  document.getElementById('rReviewContent').innerHTML = rows.map(r =>
    `<div class="report-review-row">
      <span class="rr-key">${r.k}</span>
      <span class="rr-val${r.desc ? ' rr-desc' : ''}">${r.v}</span>
    </div>`
  ).join('');

  _reportStep('review');
}

async function sendReport() {
  const btn    = document.getElementById('rSendBtn');
  const status = document.getElementById('rStatus');

  btn.disabled = true;
  status.style.color = 'var(--text-secondary)';
  status.textContent = t('reportSending');

  const card    = _modalCards[_modalIdx] || {};
  const set     = _modalSet || {};
  const repoUrl = document.getElementById('githubRepoUrl')?.value || '';
  const scope   = document.getElementById('rScope').value;
  const isEntireSet = scope === 'entire_set';

  const report = {
    type:           document.getElementById('rType').value,
    description:    document.getElementById('rDesc').value.trim(),
    cards_affected: scope,
    collection:     set.collection || currentColl || '—',
    year:           set.year       || currentYear || '—',
    card_id:        isEntireSet ? '—' : (card.card || '—'),
    card_name:      isEntireSet ? '—' : (card.name || '—'),
    reporter:       document.getElementById('rReporter').value.trim() || 'Anonymous',
    github_source:  repoUrl,
    page_url:       window.location.href,
    timestamp:      new Date().toISOString()
  };

  try {
    await fetch(REPORT_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report)
    });
    status.style.color = 'var(--accent-cyan)';
    status.textContent = t('reportSuccess');
    setTimeout(closeReportModal, 1800);
  } catch (err) {
    status.style.color = 'var(--accent-purple)';
    status.textContent = t('reportFailed');
    btn.disabled = false;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  // Restore saved token
  const savedToken = localStorage.getItem('qGhToken');
  if (savedToken) {
    const tokenInput = document.getElementById('githubToken');
    if (tokenInput) tokenInput.value = savedToken;
  }
  // 3. Always clear cache on page load so data is always fresh
  Object.keys(localStorage).filter(k => k.startsWith(CACHE_KEY_PREFIX)).forEach(k => localStorage.removeItem(k));
  // Auto-load
  const repoUrl = document.getElementById('githubRepoUrl').value;
  if (repoUrl) loadEntireRepo();

  // #5 — Show report bug button only when scrolled to bottom OR modal is open
  const bugBtn = document.getElementById('reportBugBtn');
  const checkScroll = () => {
    const modalOpen = document.getElementById('cardModal').classList.contains('open');
    const atBottom = (window.innerHeight + window.scrollY) >= document.body.scrollHeight - 60;
    bugBtn?.classList.toggle('visible', atBottom || modalOpen);
  };
  window.addEventListener('scroll', checkScroll, { passive: true });
  checkScroll();
});
