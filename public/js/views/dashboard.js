/* Dashboard View */
window.views = window.views || {};

window.views.dashboard = {
  async render(container) {
    container.innerHTML = `
      <div class="dashboard-grid">
        <div class="metric-card">
          <div class="metric-info">
            <h3>Faturamento (Mês)</h3>
            <div class="val text-success" id="dash-revenue">R$ 0,00</div>
          </div>
          <div class="metric-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-info">
            <h3>Lucro Líquido (Mês)</h3>
            <div class="val text-primary" id="dash-profit">R$ 0,00</div>
          </div>
          <div class="metric-icon" style="background: rgba(99, 102, 241, 0.15); color: var(--primary);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-info">
            <h3>Valor em Estoque</h3>
            <div class="val text-warning" id="dash-stock-value">R$ 0,00</div>
          </div>
          <div class="metric-icon" style="background: rgba(245, 158, 11, 0.15); color: var(--warning);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-info">
            <h3>Vendas Realizadas</h3>
            <div class="val text-danger" id="dash-units-sold">0 un</div>
          </div>
          <div class="metric-icon" style="background: rgba(239, 68, 68, 0.15); color: var(--danger);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
          </div>
        </div>
      </div>

      <div class="charts-grid">
        <div class="chart-card">
          <h3>Faturamento vs Despesas (Últimos Meses)</h3>
          <div class="chart-container">
            <canvas id="salesChart"></canvas>
          </div>
        </div>
        <div class="chart-card">
          <h3>Vendas por Categoria</h3>
          <div class="chart-container">
            <canvas id="categoryChart"></canvas>
          </div>
        </div>
      </div>

      <div class="dashboard-columns">
        <!-- Low stock notifications -->
        <div class="card-list">
          <h3>⚠️ Alerta de Estoque Baixo</h3>
          <div class="table-responsive">
            <table id="dash-low-stock-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th>Qtd Estoque</th>
                  <th>Mínimo</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colspan="4" class="empty-state">Carregando dados...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Recent activities -->
        <div class="card-list">
          <h3>📝 Histórico de Atividades Recentes</h3>
          <div class="activity-list" id="dash-logs-list">
            <p class="empty-state">Carregando logs...</p>
          </div>
        </div>
      </div>
    `;

    try {
      const data = await window.api.dashboard.getSummary();
      
      // Populate KPIs
      document.getElementById('dash-revenue').textContent = `R$ ${data.revenue_month.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      document.getElementById('dash-stock-value').textContent = `R$ ${data.stock_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      document.getElementById('dash-units-sold').textContent = `${data.units_sold} un`;
      
      const profitEl = document.getElementById('dash-profit');
      profitEl.textContent = `R$ ${data.net_profit_month.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      if (data.net_profit_month < 0) {
        profitEl.className = 'val text-danger';
      } else {
        profitEl.className = 'val text-success';
      }

      // Populate Low Stock table
      const lowStockBody = document.querySelector('#dash-low-stock-table tbody');
      if (data.low_stock.length === 0) {
        lowStockBody.innerHTML = `<tr><td colspan="4" class="empty-state text-success">🎉 Todos os produtos estão com estoque ideal!</td></tr>`;
      } else {
        lowStockBody.innerHTML = data.low_stock.map(item => `
          <tr>
            <td><strong>${item.brand}</strong> ${item.model}</td>
            <td><span class="badge badge-info">${item.category.toUpperCase()}</span></td>
            <td class="text-danger font-semibold">${item.stock_count} un</td>
            <td class="text-muted">${item.min_stock_alert} un</td>
          </tr>
        `).join('');
      }

      // Populate Activity Logs
      const logsList = document.getElementById('dash-logs-list');
      if (data.recent_logs.length === 0) {
        logsList.innerHTML = `<p class="empty-state">Nenhuma atividade registrada.</p>`;
      } else {
        logsList.innerHTML = data.recent_logs.map(log => `
          <div class="activity-card">
            <div class="activity-card-header">
              <span>👤 ${log.user_name || 'Sistema'}</span>
              <span>🕒 ${new Date(log.timestamp).toLocaleString('pt-BR')}</span>
            </div>
            <div><strong>${log.action.toUpperCase()}</strong>: ${log.details || ''}</div>
          </div>
        `).join('');
      }

      // Render Charts using Chart.js
      this.renderCharts(data);

    } catch (error) {
      console.error(error);
      window.app.showToast('Erro ao carregar dados do painel', 'danger');
    }
  },

  renderCharts(data) {
    // 1. Sales vs Expenses chart
    const salesCtx = document.getElementById('salesChart').getContext('2d');
    
    // Check theme to color charts
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#94a3b8' : '#475569';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    new Chart(salesCtx, {
      type: 'bar',
      data: {
        labels: ['Faturamento Atual'],
        datasets: [
          {
            label: 'Faturamento',
            data: [data.revenue_month],
            backgroundColor: '#6366f1',
            borderRadius: 6,
          },
          {
            label: 'Custo + Despesas',
            data: [data.revenue_month - data.net_profit_month],
            backgroundColor: '#ef4444',
            borderRadius: 6,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: textColor }
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor }
          },
          y: {
            grid: { color: gridColor },
            ticks: { color: textColor }
          }
        }
      }
    });

    // 2. Category Pie Chart
    const catCtx = document.getElementById('categoryChart').getContext('2d');
    
    // Count categories sold or represented in top products
    const categoriesMap = { 'celular': 0, 'tablet': 0, 'smartwatch': 0, 'acessorios': 0 };
    if (data.best_sellers && data.best_sellers.length > 0) {
      data.best_sellers.forEach(item => {
        if (categoriesMap[item.category] !== undefined) {
          categoriesMap[item.category] += item.qty;
        }
      });
    } else {
      categoriesMap['celular'] = 0;
      categoriesMap['tablet'] = 0;
      categoriesMap['smartwatch'] = 0;
      categoriesMap['acessorios'] = 0;
    }

    new Chart(catCtx, {
      type: 'doughnut',
      data: {
        labels: ['Celular', 'Tablet', 'Smartwatch', 'Acessórios'],
        datasets: [{
          data: [categoriesMap['celular'] || 0, categoriesMap['tablet'] || 0, categoriesMap['smartwatch'] || 0, categoriesMap['acessorios'] || 0],
          backgroundColor: ['#6366f1', '#06b6d4', '#a855f7', '#f59e0b'],
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
