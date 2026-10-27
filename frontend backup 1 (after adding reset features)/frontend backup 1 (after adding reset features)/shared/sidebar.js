/* Collapsible left navigation for Campus Portal */
(function () {
  function initSidebar() {
    const nav = document.querySelector('.portal-nav');
    if (!nav || document.querySelector('.app-sidebar')) return;
    const sidebar = document.createElement('aside');
    sidebar.className = 'app-sidebar';
    sidebar.id = 'appSidebar';
    const brand = document.createElement('div');
    brand.className = 'sidebar-brand';
    brand.innerHTML = '<span class="sidebar-brand-mark">CP</span><span class="sidebar-brand-name">Campus Portal</span>';
    const toggle = document.createElement('button');
    toggle.className = 'sidebar-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', 'Collapse navigation');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.innerHTML = '<span aria-hidden="true">‹</span>';
    const head = document.createElement('div');
    head.className = 'sidebar-head';
    head.append(brand, toggle);
    sidebar.append(head);
    nav.classList.add('sidebar-nav');
    nav.setAttribute('aria-label', 'Main navigation');
    sidebar.append(nav);
    document.body.classList.add('has-sidebar');
    document.body.insertBefore(sidebar, document.body.firstChild);
    const overlay = document.createElement('button');
    overlay.type = 'button'; overlay.className = 'sidebar-overlay';
    overlay.setAttribute('aria-label', 'Close navigation');
    document.body.append(overlay);
    const mobile = document.createElement('button');
    mobile.type = 'button'; mobile.className = 'mobile-nav-toggle';
    mobile.setAttribute('aria-label', 'Open navigation');
    mobile.innerHTML = '<span></span><span></span><span></span>';
    const topbar = document.querySelector('.topbar');
    if (topbar) topbar.insertBefore(mobile, topbar.firstChild);
    const setCollapsed = (collapsed) => {
      document.body.classList.toggle('sidebar-collapsed', collapsed);
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.setAttribute('aria-label', collapsed ? 'Expand navigation' : 'Collapse navigation');
      toggle.innerHTML = '<span aria-hidden="true">' + (collapsed ? '›' : '‹') + '</span>';
      try { localStorage.setItem('campusSidebarCollapsed', collapsed ? '1' : '0'); } catch (_) {}
    };
    toggle.addEventListener('click', () => setCollapsed(!document.body.classList.contains('sidebar-collapsed')));
    mobile.addEventListener('click', () => document.body.classList.toggle('sidebar-mobile-open'));
    overlay.addEventListener('click', () => document.body.classList.remove('sidebar-mobile-open'));
    try { setCollapsed(localStorage.getItem('campusSidebarCollapsed') === '1'); } catch (_) {}
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSidebar);
  else initSidebar();
})();
