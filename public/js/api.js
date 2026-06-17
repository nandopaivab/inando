/* iNando Store ERP API Client SDK */

const API_BASE = '/api';

const api = {
  getToken() {
    return sessionStorage.getItem('session_token');
  },
  
  setToken(token) {
    if (token) {
      sessionStorage.setItem('session_token', token);
    } else {
      sessionStorage.removeItem('session_token');
    }
  },

  async request(path, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(`${API_BASE}${path}`, config);
      const contentType = response.headers.get('content-type');
      
      let data = {};
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = { text: await response.text() };
      }

      if (!response.ok) {
        // Handle 401 Unauthorized globally
        if (response.status === 401 && path !== '/login') {
          this.setToken(null);
          window.dispatchEvent(new Event('unauthorized'));
        }
        throw new Error(data.error || 'Erro na requisição ao servidor');
      }

      return data;
    } catch (error) {
      console.error(`API Error on ${path}:`, error);
      throw error;
    }
  },

  // Auth Operations
  auth: {
    async login(email, password) {
      const res = await api.request('/login', {
        method: 'POST',
        body: { email, password }
      });
      if (res.token) {
        api.setToken(res.token);
      }
      return res;
    },

    async logout() {
      try {
        await api.request('/logout', { method: 'POST' });
      } catch (e) {
        // proceed anyway
      }
      api.setToken(null);
    },

    async getMe() {
      return await api.request('/auth/me');
    }
  },

  // Dashboard Metrics
  dashboard: {
    async getSummary() {
      return await api.request('/dashboard');
    }
  },

  // Products CRUD
  products: {
    async list(filters = {}) {
      const query = new URLSearchParams(filters).toString();
      return await api.request(`/products?${query}`);
    },

    async get(id) {
      return await api.request(`/products/${id}`);
    },

    async create(data) {
      return await api.request('/products', {
        method: 'POST',
        body: data
      });
    },

    async update(id, data) {
      return await api.request(`/products/${id}`, {
        method: 'PUT',
        body: data
      });
    },

    async delete(id) {
      return await api.request(`/products/${id}`, {
        method: 'DELETE'
      });
    }
  },

  // Stock Adjustments
  stock: {
    async getHistory() {
      return await api.request('/stock/history');
    },

    async adjust(data) {
      return await api.request('/stock/adjust', {
        method: 'POST',
        body: data
      });
    }
  },

  // Clients CRM CRUD
  clients: {
    async list(q = '') {
      return await api.request(`/clients?q=${encodeURIComponent(q)}`);
    },

    async create(data) {
      return await api.request('/clients', {
        method: 'POST',
        body: data
      });
    },

    async update(id, data) {
      return await api.request(`/clients/${id}`, {
        method: 'PUT',
        body: data
      });
    },

    async delete(id) {
      return await api.request(`/clients/${id}`, {
        method: 'DELETE'
      });
    },

    async getSalesHistory(id) {
      return await api.request(`/clients/sales/${id}`);
    }
  },

  // Sales (POS)
  sales: {
    async list() {
      return await api.request('/sales');
    },

    async create(data) {
      return await api.request('/sales', {
        method: 'POST',
        body: data
      });
    },

    async getReceipt(id) {
      return await api.request(`/sales/${id}`);
    },

    async cancel(id) {
      return await api.request(`/sales/${id}`, {
        method: 'DELETE'
      });
    }
  },

  // Finance Transactions & Reports
  finance: {
    async listTransactions(filters = {}) {
      const query = new URLSearchParams(filters).toString();
      return await api.request(`/finance/transactions?${query}`);
    },

    async createTransaction(data) {
      return await api.request('/finance/transactions', {
        method: 'POST',
        body: data
      });
    },

    async payTransaction(id) {
      return await api.request(`/finance/transactions/${id}/pay`, {
        method: 'PUT'
      });
    },

    async deleteTransaction(id) {
      return await api.request(`/finance/transactions/${id}`, {
        method: 'DELETE'
      });
    },

    async getDRE(start, end) {
      return await api.request(`/finance/dre?start=${start}&end=${end}`);
    },

    async getKPIs() {
      return await api.request('/finance/kpis');
    }
  },

  // Users (Admin management)
  users: {
    async list() {
      return await api.request('/users');
    },

    async create(data) {
      return await api.request('/users', {
        method: 'POST',
        body: data
      });
    },

    async update(id, data) {
      return await api.request(`/users/${id}`, {
        method: 'PUT',
        body: data
      });
    },

    async delete(id) {
      return await api.request(`/users/${id}`, {
        method: 'DELETE'
      });
    },

    async changePassword(current_password, new_password) {
      return await api.request('/users/change-password', {
        method: 'PUT',
        body: { current_password, new_password }
      });
    }
  },

  // Settings
  settings: {
    async get() {
      return await api.request('/settings');
    },

    async update(data) {
      return await api.request('/settings', {
        method: 'PUT',
        body: data
      });
    }
  },

  // Product Models
  productModels: {
    async list() {
      return await api.request('/product-models');
    },
    async create(data) {
      return await api.request('/product-models', {
        method: 'POST',
        body: data
      });
    }
  }
};
window.api = api;
