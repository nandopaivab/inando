/* Reports and BI BI View */
window.views = window.views || {};

window.views.reports = {
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

    container.innerHTML = `
      <div class="dashboard-grid" style="grid-template-columns: 1fr 1fr; margin-bottom: 24px;">
        <div class="chart-card">
          <h3>Ranking de Vendas por Vendedor (Comissão Gerada)</h3>
          <div class="chart-container" style="height: 250px;">
            <canvas id="sellerPerformanceChart"></canvas>
          </div>
        </div>
        
        <div class="chart-card">
          <h3>Distribuição de Valor Físico de Estoque por Marca</h3>
          <div class="chart-container" style="height: 250px;">
            <canvas id="brandStockChart"></canvas>
          </div>
        </div>
      </div>

      <div class="card-list" style="margin-bottom: 24px;">
        <h3>📊 Resumo de Desempenho do Inventário</h3>
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
    `;

    try {
      // Fetch data for inventory summaries
      const products = await window.api.products.list({ status: 'disponivel' });
      const sales = await window.api.sales.list();

      // Aggregate stock by brand & category
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

      const tbody = document.querySelector('#reports-stock-summary tbody');
      const keys = Object.keys(stockSummary);
      if (keys.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Nenhum produto em estoque.</td></tr>`;
      } else {
        tbody.innerHTML = keys.map(k => {
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

      this.renderReportCharts(sales, products);

    } catch (err) {
      window.app.showToast('Erro ao carregar relatórios', 'danger');
    }
  },

  renderReportCharts(sales, products) {
    // 1. Seller performance (aggregate sales count and commission by seller name)
    const sellerSales = {};
    sales.forEach(s => {
      const name = s.seller_name || 'Desconhecido';
      if (!sellerSales[name]) {
        sellerSales[name] = 0;
      }
      sellerSales[name] += s.total;
    });

    const sellers = Object.keys(sellerSales);
    const sellerTotals = sellers.map(k => sellerSales[k]);

    const sellerCtx = document.getElementById('sellerPerformanceChart').getContext('2d');
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#94a3b8' : '#475569';

    new Chart(sellerCtx, {
      type: 'bar',
      data: {
        labels: sellers.length > 0 ? sellers : ['Sem dados'],
        datasets: [{
          label: 'Faturamento por Vendedor (R$)',
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

    // 2. Brand stock distribution
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
    new Chart(brandCtx, {
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
