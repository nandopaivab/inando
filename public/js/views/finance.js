/* Finance Management View */
window.views = window.views || {};

window.views.finance = {
  activeSubTab: 'cashflow', // 'cashflow', 'dre', 'kpis'
  transactions: [],

  async render(container) {
    const user = window.app.currentUser;
    if (user && user.role === 'seller') {
      container.innerHTML = `
        <div class="empty-state">
          <h3>Acesso Negado</h3>
          <p>Seu perfil de Vendedor não tem permissão para acessar os dados financeiros da empresa.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="display: flex; gap: 16px; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
        <button id="subtab-cashflow" class="btn ${this.activeSubTab === 'cashflow' ? 'btn-primary' : 'btn-secondary'} btn-sm">💵 Fluxo de Caixa / Contas</button>
        <button id="subtab-dre" class="btn ${this.activeSubTab === 'dre' ? 'btn-primary' : 'btn-secondary'} btn-sm">📊 Demonstrativo DRE</button>
        <button id="subtab-kpis" class="btn ${this.activeSubTab === 'kpis' ? 'btn-primary' : 'btn-secondary'} btn-sm">📈 Indicadores BI</button>
      </div>
      <div id="finance-view-content"></div>
    `;

    document.getElementById('subtab-cashflow').addEventListener('click', () => {
      this.activeSubTab = 'cashflow';
      this.render(container);
    });
    document.getElementById('subtab-dre').addEventListener('click', () => {
      this.activeSubTab = 'dre';
      this.render(container);
    });
    document.getElementById('subtab-kpis').addEventListener('click', () => {
      this.activeSubTab = 'kpis';
      this.render(container);
    });

    if (this.activeSubTab === 'cashflow') {
      await this.renderCashFlow();
    } else if (this.activeSubTab === 'dre') {
      await this.renderDRE();
    } else {
      await this.renderKPIs();
    }
  },

  async renderCashFlow() {
    const viewport = document.getElementById('finance-view-content');
    const user = window.app.currentUser;
    const isAdmin = user && user.role === 'admin';

    viewport.innerHTML = `
      <div class="table-header-row">
        <div class="filters-row">
          <select id="finance-type-filter" style="width: 140px;">
            <option value="">Todas Transações</option>
            <option value="receita">Receitas (Receber)</option>
            <option value="despesa">Despesas (Pagar)</option>
          </select>
          <select id="finance-status-filter" style="width: 140px;">
            <option value="">Todos Status</option>
            <option value="pago">Pagas / Recebidas</option>
            <option value="pendente">Pendentes</option>
          </select>
          <button id="btn-export-csv" class="btn btn-secondary">📥 Exportar Planilha (CSV)</button>
        </div>

        <button id="btn-add-tx" class="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Lançar Despesa/Receita
        </button>
      </div>

      <div class="table-responsive">
        <table id="finance-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Vencimento</th>
              <th>Pagamento</th>
              <th>Categoria</th>
              <th>Descrição</th>
              <th>Tipo</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="9" class="empty-state">Buscando transações financeiras...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('finance-type-filter').addEventListener('change', () => this.loadTransactions());
    document.getElementById('finance-status-filter').addEventListener('change', () => this.loadTransactions());
    document.getElementById('btn-add-tx').addEventListener('click', () => this.showTxModal());
    document.getElementById('btn-export-csv').addEventListener('click', () => this.exportCSV());

    await this.loadTransactions();
  },

  async loadTransactions() {
    const type = document.getElementById('finance-type-filter').value;
    const status = document.getElementById('finance-status-filter').value;
    const user = window.app.currentUser;
    const isAdmin = user && user.role === 'admin';

    try {
      const data = await window.api.finance.listTransactions({ type, status });
      this.transactions = data;

      const tbody = document.querySelector('#finance-table tbody');
      if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="empty-state">Nenhum lançamento financeiro encontrado.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.map(t => {
        let typeBadge = t.type === 'receita' ? `<span class="badge badge-success">Receita</span>` : `<span class="badge badge-danger">Despesa</span>`;
        let statusBadge = '';
        if (t.status === 'pago') statusBadge = `<span class="badge badge-success">Quitado</span>`;
        else if (t.status === 'pendente') statusBadge = `<span class="badge badge-warning">Pendente</span>`;
        else statusBadge = `<span class="badge badge-danger">Atrasado</span>`;

        return `
          <tr data-id="${t.id}">
            <td>#${t.id}</td>
            <td>${t.due_date ? new Date(t.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
            <td>${t.payment_date ? new Date(t.payment_date + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
            <td><strong>${t.category.toUpperCase()}</strong></td>
            <td><small>${t.description || '-'}</small></td>
            <td>${typeBadge}</td>
            <td class="font-semibold ${t.type === 'receita' ? 'text-success' : 'text-danger'}">
              R$ ${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </td>
            <td>${statusBadge}</td>
            <td>
              <div style="display:flex; gap: 4px;">
                ${t.status === 'pendente' ? `<button class="btn btn-ghost btn-sm btn-pay-tx text-success">Confirmar Baixa ✔️</button>` : ''}
                ${isAdmin ? `<button class="btn btn-ghost btn-sm btn-delete-tx text-danger">🗑️</button>` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.btn-pay-tx').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = parseInt(e.target.closest('tr').dataset.id);
          this.settleTransaction(id);
        });
      });

      tbody.querySelectorAll('.btn-delete-tx').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = parseInt(e.target.closest('tr').dataset.id);
          this.deleteTransaction(id);
        });
      });

    } catch (e) {
      window.app.showToast('Erro ao carregar lançamentos', 'danger');
    }
  },

  async settleTransaction(id) {
    if (confirm('Confirmar recebimento / pagamento desta parcela?')) {
      try {
        await window.api.finance.payTransaction(id);
        window.app.showToast('Transação baixada com sucesso!', 'success');
        this.loadTransactions();
      } catch (err) {
        window.app.showToast(err.message, 'danger');
      }
    }
  },

  async deleteTransaction(id) {
    if (confirm('Deseja excluir permanentemente este lançamento financeiro?')) {
      try {
        await window.api.finance.deleteTransaction(id);
        window.app.showToast('Lançamento financeiro removido!', 'success');
        this.loadTransactions();
      } catch (err) {
        window.app.showToast(err.message, 'danger');
      }
    }
  },

  showTxModal() {
    const content = `
      <form id="finance-tx-form">
        <div class="form-grid-2">
          <div class="form-group">
            <label for="tx-type">Tipo de Lançamento *</label>
            <select id="tx-type" required>
              <option value="despesa">Despesa (Contas a Pagar)</option>
              <option value="receita">Receita (Contas a Receber)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="tx-category">Categoria *</label>
            <select id="tx-category" required>
              <option value="fornecedor">Fornecedor (Estoque)</option>
              <option value="aluguel">Aluguel / Condomínio</option>
              <option value="energia">Energia Elétrica / Água</option>
              <option value="pro-labore">Pro-Labore / Sócios</option>
              <option value="marketing">Marketing / Anúncios</option>
              <option value="comissao">Comissões Vendedores</option>
              <option value="outros">Outros Ajustes</option>
            </select>
          </div>
        </div>

        <div class="form-grid-3">
          <div class="form-group">
            <label for="tx-amount">Valor Financeiro (R$) *</label>
            <input type="number" id="tx-amount" step="0.01" min="0.01" required placeholder="0.00">
          </div>
          <div class="form-group">
            <label for="tx-due">Data de Vencimento *</label>
            <input type="date" id="tx-due" required value="${new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label for="tx-status">Situação Inicial</label>
            <select id="tx-status" required>
              <option value="pendente">Pendente (Aberto)</option>
              <option value="pago">Pago / Recebido (Quitado)</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="tx-desc">Descrição / Histórico</label>
          <input type="text" id="tx-desc" placeholder="Ex: Pagamento da conta de energia de Junho/2026">
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
          <button type="button" class="btn btn-secondary" onclick="window.app.closeModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar Lançamento</button>
        </div>
      </form>
    `;

    window.app.showModal('Lançar Contas Financeiras', content);

    document.getElementById('finance-tx-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      const payload = {
        type: document.getElementById('tx-type').value,
        category: document.getElementById('tx-category').value,
        amount: parseFloat(document.getElementById('tx-amount').value),
        due_date: document.getElementById('tx-due').value,
        status: document.getElementById('tx-status').value,
        description: document.getElementById('tx-desc').value
      };

      try {
        await window.api.finance.createTransaction(payload);
        window.app.showToast('Lançamento financeiro gravado!', 'success');
        window.app.closeModal();
        this.loadTransactions();
      } catch (err) {
        window.app.showToast(err.message, 'danger');
      }
    });
  },

  exportCSV() {
    if (this.transactions.length === 0) {
      window.app.showToast('Nenhum dado para exportar.', 'warning');
      return;
    }

    // Compose CSV Content
    let csvContent = '\uFEFF'; // UTF-8 BOM
    csvContent += 'ID;Vencimento;Pagamento;Categoria;Descrição;Tipo;Valor;Status\n';

    this.transactions.forEach(t => {
      csvContent += `${t.id};${t.due_date || ''};${t.payment_date || ''};${t.category.toUpperCase()};${t.description || ''};${t.type};${t.amount.toFixed(2)};${t.status}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `financeiro_inandostore_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.app.showToast('Relatório CSV exportado!', 'success');
  },

  // DRE Sheet Render
  async renderDRE() {
    const viewport = document.getElementById('finance-view-content');

    const defaultStart = '2026-05-01';
    const defaultEnd = new Date().toISOString().split('T')[0];

    viewport.innerHTML = `
      <div class="table-header-row" style="background: var(--bg-secondary); padding: 16px; border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); margin-bottom: 24px;">
        <div class="filters-row" style="align-items: center; gap: 12px; width: 100%;">
          <div style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-size: 11px; color: var(--text-secondary);">Período Início</label>
            <input type="date" id="dre-start-date" value="${defaultStart}">
          </div>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-size: 11px; color: var(--text-secondary);">Período Fim</label>
            <input type="date" id="dre-end-date" value="${defaultEnd}">
          </div>
          <button id="btn-calculate-dre" class="btn btn-primary" style="margin-top: 15px;">Gerar Relatório DRE</button>
          <button id="btn-print-dre" class="btn btn-secondary" style="margin-top: 15px;">🖨️ Imprimir DRE</button>
        </div>
      </div>

      <div id="dre-result-container">
        <p class="empty-state">Clique em Gerar Relatório para visualizar o DRE do período.</p>
      </div>
    `;

    const calcBtn = document.getElementById('btn-calculate-dre');
    calcBtn.addEventListener('click', () => this.calculateDRE());
    document.getElementById('btn-print-dre').addEventListener('click', () => window.print());

    await this.calculateDRE();
  },

  async calculateDRE() {
    const start = document.getElementById('dre-start-date').value;
    const end = document.getElementById('dre-end-date').value;
    const resultBox = document.getElementById('dre-result-container');

    try {
      const data = await window.api.finance.getDRE(start, end);
      
      let expLines = data.expenses_breakdown.map(e => `
        <div class="dre-row indent">
          <span>(-) Despesa Operacional: ${e.category.toUpperCase()}</span>
          <span class="text-danger">R$ ${e.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
      `).join('');

      resultBox.innerHTML = `
        <div class="dre-table">
          <div class="dre-row total-line">
            <span>RECEITA BRUTA DE VENDAS</span>
            <span class="text-success">R$ ${data.gross_revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div class="dre-row indent">
            <span>(-) Deduções e Descontos Concedidos</span>
            <span class="text-danger">R$ ${data.discounts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          
          <div class="dre-row total-line">
            <span>RECEITA LÍQUIDA DA OPERAÇÃO</span>
            <span>R$ ${(data.gross_revenue - data.discounts).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>

          <div class="dre-row indent">
            <span>(-) Custo de Mercadorias Vendidas (CMV)</span>
            <span class="text-danger">R$ ${data.cmv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>

          <div class="dre-row total-line">
            <span>RESULTADO OPERACIONAL BRUTO (Lucro Bruto)</span>
            <span>R$ ${(data.gross_revenue - data.discounts - data.cmv).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>

          <div class="dre-row indent">
            <span>(-) Comissões de Vendas Pagas</span>
            <span class="text-danger">R$ ${data.commissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>

          ${expLines || `
            <div class="dre-row indent">
              <span>(-) Despesas Fixas e Variáveis</span>
              <span>R$ 0,00</span>
            </div>
          `}

          <div class="dre-row net-profit">
            <span>RESULTADO LÍQUIDO DO EXERCÍCIO (Lucro Líquido)</span>
            <span>R$ ${data.net_profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      `;

    } catch (e) {
      window.app.showToast('Erro ao compilar DRE', 'danger');
    }
  },

  // BI KPIs Page
  async renderKPIs() {
    const viewport = document.getElementById('finance-view-content');

    viewport.innerHTML = `
      <div class="dashboard-grid" style="grid-template-columns: repeat(3, 1fr);">
        <div class="metric-card">
          <div class="metric-info">
            <h3>Ticket Médio Venda</h3>
            <div class="val text-primary" id="kpi-ticket">R$ 0,00</div>
            <p style="font-size:11px; color:var(--text-muted); margin-top:8px;">Valor médio faturado por venda</p>
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-info">
            <h3>Margem de Lucro Média</h3>
            <div class="val text-success" id="kpi-margin">0,0%</div>
            <p style="font-size:11px; color:var(--text-muted); margin-top:8px;">Rentabilidade sobre preço de venda</p>
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-info">
            <h3>Retorno sobre Investimento (ROI)</h3>
            <div class="val text-warning" id="kpi-roi">0,0%</div>
            <p style="font-size:11px; color:var(--text-muted); margin-top:8px;">Retorno do capital investido em estoque</p>
          </div>
        </div>
      </div>
    `;

    try {
      const kpis = await window.api.finance.getKPIs();
      document.getElementById('kpi-ticket').textContent = `R$ ${kpis.ticket_medio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      document.getElementById('kpi-margin').textContent = `${kpis.average_margin.toFixed(1)}%`;
      document.getElementById('kpi-roi').textContent = `${kpis.roi.toFixed(1)}%`;
    } catch (e) {
      window.app.showToast('Erro ao carregar KPIs', 'danger');
    }
  }
};
