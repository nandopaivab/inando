/* Reports and BI View */
window.views = window.views || {};

window.views.reports = {
  performanceChart: null,
  brandChart: null,

  async render(container) {
    const user = window.app.currentUser;
    if (user && user.role === 'seller') {
      container.innerHTML = `
        <div class="empty-state">
          <h3>Acesso Negado</h3>
          <p>Seu perfil de Vendedor não tem permissão para acessar os relatórios e métricas de BI.</p>
        </div>
      `;
      return;
    }

    // Default dates: 1st of current month to today
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);

    container.innerHTML = `
      <!-- Filtros de Data -->
      <div style="display: flex; gap: 16px; margin-bottom: 20px; align-items: flex-end; background: rgba(255, 255, 255, 0.01); padding: 16px; border-radius: var(--border-radius-md); border: 1px solid var(--border-color);">
        <div class="form-group" style="margin: 0; flex: 1;">
          <label style="font-size: 11px; margin-bottom: 4px; color: var(--text-secondary);">Data Inicial</label>
          <input type="date" id="reports-start-date" value="${firstDay}" style="margin: 0;">
        </div>
        <div class="form-group" style="margin: 0; flex: 1;">
          <label style="font-size: 11px; margin-bottom: 4px; color: var(--text-secondary);">Data Final</label>
          <input type="date" id="reports-end-date" value="${today}" style="margin: 0;">
        </div>
        <button id="btn-reports-filter" class="btn btn-primary" style="padding: 10px 24px; font-weight: 600; cursor: pointer;">
          🔍 Filtrar
        </button>
      </div>

      <div class="dashboard-grid" style="grid-template-columns: 1fr 1fr; margin-bottom: 24px; display: grid; gap: 20px;">
        <div class="chart-card">
          <h3>Ranking de Vendas por Vendedor (Faturamento)</h3>
          <div class="chart-container" style="height: 250px; position: relative;">
            <canvas id="sellerPerformanceChart"></canvas>
          </div>
        </div>
        
        <div class="chart-card">
          <h3>Distribuição de Valor Físico de Estoque por Marca</h3>
          <div class="chart-container" style="height: 250px; position: relative;">
            <canvas id="brandStockChart"></canvas>
          </div>
        </div>
      </div>

      <!-- Relatório de Estoque -->
      <div class="card-list" style="margin-bottom: 24px; background: var(--bg-secondary); padding: 20px; border-radius: var(--border-radius-md); border: 1px solid var(--border-color);">
        <h3 style="margin-top: 0; margin-bottom: 16px; font-weight: 700; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">📊 Resumo de Desempenho do Inventário</h3>
        <div class="table-responsive">
          <table id="reports-stock-summary">
            <thead>
              <tr>
                <th>Marca</th>
                <th>Categoria</th>
                <th>Aparelhos em Estoque</th>
                <th>Custo Total</th>
                <th>Preço de Venda Total</th>
                <th>Lucro Estimado</th>
              </tr>
            </thead>
            <tbody>
              <!-- Injected dynamically -->
            </tbody>
          </table>
        </div>
      </div>

      <!-- Relatório de Comissões -->
      <div class="card-list" style="margin-bottom: 24px; background: var(--bg-secondary); padding: 20px; border-radius: var(--border-radius-md); border: 1px solid var(--border-color);">
        <h3 style="margin-top: 0; margin-bottom: 16px; font-weight: 700; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">💰 Relatório Detalhado de Comissões por Vendedor</h3>
        <div class="table-responsive">
          <table id="reports-commissions-table">
            <thead>
              <tr>
                <th>Vendedor</th>
                <th>E-mail</th>
                <th style="text-align: center;">Qtd Vendas</th>
                <th>Faturamento Total</th>
                <th>Comissão Gerada</th>
              </tr>
            </thead>
            <tbody>
              <!-- Injected dynamically -->
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Bind filter button
    document.getElementById('btn-reports-filter').addEventListener('click', () => {
      this.loadData();
    });

    await this.loadData();
  },

  async loadData() {
    const startDate = document.getElementById('reports-start-date').value;
    const endDate = document.getElementById('reports-end-date').value;

    try {
      // Fetch datasets
      const products = await window.api.products.list({ status: 'disponivel' });
      const commissions = await window.api.reports.getCommissions(startDate, endDate);

      // 1. Render Inventory Table
      const stockSummary = {};
      products.forEach(p => {
        const key = `${p.brand}-${p.category}`;
        if (!stockSummary[key]) {
          stockSummary[key] = {
            brand: p.brand,
            category: p.category,
            count: 0,
            cost: 0,
            selling: 0
          };
        }
        stockSummary[key].count += 1;
        stockSummary[key].cost += p.purchase_price;
        stockSummary[key].selling += p.selling_price;
      });

      const stockTbody = document.querySelector('#reports-stock-summary tbody');
      const stockKeys = Object.keys(stockSummary);
      if (stockKeys.length === 0) {
        stockTbody.innerHTML = `<tr><td colspan="6" class="empty-state">Nenhum produto em estoque.</td></tr>`;
      } else {
        stockTbody.innerHTML = stockKeys.map(k => {
          const item = stockSummary[k];
          const profit = item.selling - item.cost;
          return `
            <tr>
              <td><strong>${item.brand}</strong></td>
              <td><span class="badge badge-info">${item.category.toUpperCase()}</span></td>
              <td>${item.count} un</td>
              <td>R$ ${item.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              <td class="text-primary font-semibold">R$ ${item.selling.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              <td class="text-success font-semibold">R$ ${profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            </tr>
          `;
        }).join('');
      }

      // 2. Render Commissions Table
      const commTbody = document.querySelector('#reports-commissions-table tbody');
      if (commissions.length === 0) {
        commTbody.innerHTML = `<tr><td colspan="5" class="empty-state">Nenhuma comissão registrada no período.</td></tr>`;
      } else {
        commTbody.innerHTML = commissions.map(c => `
          <tr>
            <td><strong>${c.seller_name}</strong></td>
            <td class="text-muted">${c.seller_email}</td>
            <td style="text-align: center;">${c.sales_count}</td>
            <td class="text-primary font-semibold">R$ ${c.total_sales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            <td class="text-success font-semibold">R$ ${c.total_commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
          </tr>
        `).join('');
      }

      // 3. Render Charts
      this.renderCharts(commissions, products);

    } catch (err) {
      console.error("Error loading reports:", err);
      window.app.showToast('Erro ao carregar dados dos relatórios', 'danger');
    }
  },

  renderCharts(commissions, products) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#94a3b8' : '#475569';

    // Destroy existing chart instances if they exist
    if (this.performanceChart) this.performanceChart.destroy();
    if (this.brandChart) this.brandChart.destroy();

    // 1. Seller Performance Bar Chart (Faturamento por Vendedor)
    const sellers = commissions.map(c => c.seller_name);
    const sellerTotals = commissions.map(c => c.total_sales);

    const sellerCtx = document.getElementById('sellerPerformanceChart').getContext('2d');
    this.performanceChart = new Chart(sellerCtx, {
      type: 'bar',
      data: {
        labels: sellers.length > 0 ? sellers : ['Sem dados'],
        datasets: [{
          label: 'Faturamento (R$)',
          data: sellerTotals.length > 0 ? sellerTotals : [0],
          backgroundColor: '#a855f7',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: textColor } }
        },
        scales: {
          x: { ticks: { color: textColor } },
          y: { ticks: { color: textColor } }
        }
      }
    });

    // 2. Brand Stock Distribution Chart
    const brandStock = {};
    products.forEach(p => {
      const brand = p.brand;
      if (!brandStock[brand]) {
        brandStock[brand] = 0;
      }
      brandStock[brand] += p.purchase_price;
    });

    const brands = Object.keys(brandStock);
    const brandValues = brands.map(k => brandStock[k]);

    const brandCtx = document.getElementById('brandStockChart').getContext('2d');
    this.brandChart = new Chart(brandCtx, {
      type: 'doughnut',
      data: {
        labels: brands.length > 0 ? brands : ['Sem dados'],
        datasets: [{
          data: brandValues.length > 0 ? brandValues : [0],
          backgroundColor: brands.length > 0 ? ['#6366f1', '#06b6d4', '#ef4444', '#f59e0b', '#10b981'] : ['#475569'],
          borderColor: isDark ? '#1e293b' : '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: textColor }
          }
        }
      }
    });
  }
};
