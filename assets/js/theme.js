// ===== THEME SYSTEM =====
(function() {
  const saved = localStorage.getItem('sc-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
})();

document.addEventListener('DOMContentLoaded', function() {
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;

  function updateIcon(theme) {
    toggle.textContent = theme === 'dark' ? '🌙' : '☀️';
  }

  updateIcon(document.documentElement.getAttribute('data-theme'));

  toggle.addEventListener('click', function() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('sc-theme', next);
    updateIcon(next);
  });
});
