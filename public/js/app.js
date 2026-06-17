/* iNando Store ERP Core Application Controller */

window.app = {
  currentUser: null,
  activeView: 'dashboard',
  notifications: [],

  init() {
    this.bindEvents();
    this.checkAuth();
    this.initTheme();
  },

  bindEvents() {
    // Auth Panel Forms toggles
    document.getElementById('btn-show-recovery').addEventListener('click', (e) => {
      e.preventDefault();
      this.switchAuthForm('recovery-form');
    });

    document.getElementById('btn-cancel-recovery').addEventListener('click', () => {
      this.switchAuthForm('login-form');
    });

    // Form Submissions
    document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
    document.getElementById('recovery-form').addEventListener('submit', (e) => this.handleRecovery(e));

    // Sidebar navigation clicks
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.getAttribute('data-view');
        this.navigateTo(view);
      });
    });

    // Logout click
    document.getElementById('btn-logout').addEventListener('click', () => this.handleLogout());

    // Theme toggler click
    document.getElementById('btn-theme-toggle').addEventListener('click', () => this.toggleTheme());

    // Notification center click
    const bellBtn = document.getElementById('btn-notification-bell');
    const panel = document.getElementById('notification-panel');
    bellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.classList.toggle('active');
    });

    document.addEventListener('click', () => {
      panel.classList.remove('active');
    });

    panel.addEventListener('click', (e) => e.stopPropagation());

    document.getElementById('btn-clear-notifications').addEventListener('click', () => {
      this.notifications = [];
      this.renderNotifications();
      this.showToast('Notificações limpas!', 'success');
    });

    // Modal Close
    document.getElementById('btn-close-modal').addEventListener('click', () => this.closeModal());
    document.getElementById('modal-container').addEventListener('click', (e) => {
      if (e.target.id === 'modal-container') this.closeModal();
    });

    // Global unauthorized API redirect
    window.addEventListener('unauthorized', () => {
      this.showAuthPanel();
    });
  },

  initTheme() {
    const savedTheme = localStorage.getItem('erp_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeTogglerIcons(savedTheme);
  },

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('erp_theme', nextTheme);
    this.updateThemeTogglerIcons(nextTheme);
    
    // Rerender current view if active (to adapt charts colors instantly)
    if (this.currentUser) {
      this.navigateTo(this.activeView);
    }
  },

  updateThemeTogglerIcons(theme) {
    const sun = document.getElementById('theme-sun-icon');
    const moon = document.getElementById('theme-moon-icon');
    if (theme === 'dark') {
      sun.classList.remove('hidden');
      moon.classList.add('hidden');
    } else {
      sun.classList.add('hidden');
      moon.classList.remove('hidden');
    }
  },

  switchAuthForm(formId) {
    document.querySelectorAll('.auth-form').forEach(form => {
      form.classList.remove('active');
    });
    document.getElementById(formId).classList.add('active');
  },

  async checkAuth() {
    const token = window.api.getToken();
    if (!token) {
      this.showAuthPanel();
      return;
    }

    try {
      this.showLoading(true);
      const user = await window.api.auth.getMe();
      this.currentUser = user;
      this.showAppLayout();
      this.navigateTo('dashboard');
      this.startBackgroundChecks();
    } catch (err) {
      this.showAuthPanel();
    } finally {
      this.showLoading(false);
    }
  },

  showAuthPanel() {
    this.currentUser = null;
    document.getElementById('app-layout').classList.add('hidden');
    document.getElementById('auth-panel').classList.remove('hidden');
    this.switchAuthForm('login-form');
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
  },

  showAppLayout() {
    document.getElementById('auth-panel').classList.add('hidden');
    document.getElementById('app-layout').classList.remove('hidden');
    
    // Set Sidebar User brief details
    document.getElementById('user-display-name').textContent = this.currentUser.name;
    document.getElementById('user-display-role').textContent = this.currentUser.role.toUpperCase();
    document.getElementById('sidebar-role-badge').textContent = this.currentUser.role;
    
    // initials for avatar
    const parts = this.currentUser.name.split(' ');
    const initials = parts.map(p => p[0]).join('').slice(0, 2).toUpperCase();
    document.getElementById('user-avatar-initials').textContent = initials;
  },

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      this.showLoading(true);
      const res = await window.api.auth.login(email, password);
      
      // Direct Login
      this.currentUser = res.user;
      this.showAppLayout();
      this.navigateTo('dashboard');
      this.startBackgroundChecks();
    } catch (err) {
      this.showToast(err.message || 'Credenciais inválidas', 'danger');
    } finally {
      this.showLoading(false);
    }
  },

  handleRecovery(e) {
    e.preventDefault();
    const email = document.getElementById('recovery-email').value;
    this.showToast(`E-mail de recuperação enviado para ${email}!`, 'success');
    this.switchAuthForm('login-form');
  },

  async handleLogout() {
    if (confirm('Deseja realmente sair do sistema ERP?')) {
      this.showLoading(true);
      await window.api.auth.logout();
      this.showAuthPanel();
      this.showLoading(false);
    }
  },

  navigateTo(viewName) {
    this.activeView = viewName;
    
    // Update active nav links style
    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.getAttribute('data-view') === viewName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update Header view title
    const formattedTitle = viewName === 'sales' ? 'Vendas (Ponto de Venda)' : viewName.charAt(0).toUpperCase() + viewName.slice(1);
    document.getElementById('view-title').textContent = formattedTitle;
    document.getElementById('view-subtitle').textContent = `Módulo de controle integrado: ${formattedTitle}`;

    // Render viewport view script
    const container = document.getElementById('viewport');
    
    if (window.views[viewName] && typeof window.views[viewName].render === 'function') {
      window.views[viewName].render(container);
    } else {
      container.innerHTML = `<p class="empty-state">Módulo [${viewName}] em desenvolvimento.</p>`;
    }
  },

  startBackgroundChecks() {
    // Run initial checks for low stock or due accounts and load alerts
    this.runSystemChecks();
    // Check every 30 seconds
    setInterval(() => this.runSystemChecks(), 30000);
  },

  async runSystemChecks() {
    try {
      const dbInfo = await window.api.dashboard.getSummary();
      
      // Clear current stock warnings
      this.notifications = [];

      // Check low stock
      if (dbInfo.low_stock && dbInfo.low_stock.length > 0) {
        dbInfo.low_stock.forEach(item => {
          this.addNotification({
            type: 'estoque',
            message: `Alerta: Produto ${item.brand} ${item.model} está com estoque baixo (${item.stock_count} un).`
          });
        });
      }

      // Check simulated accounts payable/receivable (e.g. check unpaid items due soon)
      const txs = await window.api.finance.listTransactions({ status: 'pendente' });
      const today = new Date().toISOString().split('T')[0];
      txs.forEach(t => {
        if (t.due_date && t.due_date < today) {
          this.addNotification({
            type: 'financeiro',
            message: `Aviso: Lançamento de ${t.category.toUpperCase()} no valor de R$ ${t.amount.toFixed(2)} está vencido (${t.due_date}).`
          });
        }
      });

      this.renderNotifications();

    } catch (e) {
      console.warn("Background check error:", e);
    }
  },

  addNotification(item) {
    // Avoid duplicates
    if (this.notifications.some(n => n.message === item.message)) return;

    this.notifications.push({
      id: Date.now() + Math.random(),
      timestamp: new Date(),
      read: false,
      ...item
    });

    // Trigger toast alerts
    this.showToast(item.message, item.type === 'estoque' ? 'warning' : 'danger');
  },

  renderNotifications() {
    const list = document.getElementById('notification-list');
    const badge = document.getElementById('notification-count');
    
    if (this.notifications.length === 0) {
      list.innerHTML = `<p class="empty-state">Nenhuma notificação pendente.</p>`;
      badge.classList.add('hidden');
      return;
    }

    badge.classList.remove('hidden');
    list.innerHTML = this.notifications.map(n => `
      <div class="notification-item">
        <strong>${n.type === 'estoque' ? '📦 ESTOQUE' : '💳 FINANCEIRO'}</strong>
        <p style="margin-top: 4px;">${n.message}</p>
        <span class="time">${new Date(n.timestamp).toLocaleTimeString('pt-BR')}</span>
      </div>
    `).join('');
  },

  // Toast System
  showToast(message, type = 'primary') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '🔔';
    if (type === 'success') icon = '✅';
    else if (type === 'warning') icon = '⚠️';
    else if (type === 'danger') icon = '❌';

    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-content">
        <h4>${type.toUpperCase()}</h4>
        <p>${message}</p>
      </div>
    `;

    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards';
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 4500);
  },

  // Modal helpers
  showModal(title, contentHTML, isLarge = false) {
    const overlay = document.getElementById('modal-container');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modal = overlay.querySelector('.modal-card');

    if (isLarge) {
      modal.classList.add('large');
    } else {
      modal.classList.remove('large');
    }

    modalTitle.textContent = title;
    modalBody.innerHTML = contentHTML;
    overlay.classList.remove('hidden');
  },

  closeModal() {
    document.getElementById('modal-container').classList.add('hidden');
  },

  showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (show) {
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
    }
  }
};

// Start application
window.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
