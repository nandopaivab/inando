/* Stock View */
window.views = window.views || {};

window.views.stock = {
  movements: [],

  async render(container) {
    const user = window.app.currentUser;
    const canManage = user && (user.role === 'admin' || user.role === 'manager');

    container.innerHTML = `
      <div class="table-header-row">
        <div class="search-bar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" id="stock-imei-search" placeholder="Pesquisar histórico por IMEI ou Serial...">
        </div>
        
        <div class="filters-row">
          ${canManage ? `
            <button id="btn-adjust-stock" class="btn btn-secondary">
              🔧 Ajustar Estoque
            </button>
          ` : ''}
        </div>
      </div>

      <div class="table-responsive">
        <table id="stock-movements-table">
          <thead>
            <tr>
              <th>ID Mov.</th>
              <th>Data/Hora</th>
              <th>Aparelho</th>
              <th>Identificadores</th>
              <th>Tipo Movimentação</th>
              <th>Qtd</th>
              <th>Operador</th>
              <th>Observações</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="8" class="empty-state">Buscando histórico de estoque...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('stock-imei-search').addEventListener('input', (e) => this.filterMovements(e.target.value));

    const adjustBtn = document.getElementById('btn-adjust-stock');
    if (adjustBtn) {
      adjustBtn.addEventListener('click', () => this.showAdjustModal());
    }

    await this.loadMovements();
  },

  async loadMovements() {
    try {
      const data = await window.api.stock.getHistory();
      this.movements = data;
      this.renderMovementsTable(data);
    } catch (e) {
      console.error(e);
      window.app.showToast('Erro ao carregar movimentações de estoque', 'danger');
    }
  },

  renderMovementsTable(data) {
    const tbody = document.querySelector('#stock-movements-table tbody');
    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state">Nenhuma movimentação registrada.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(m => {
      let typeBadge = '';
      if (m.type === 'entrada') typeBadge = `<span class="badge badge-success">Entrada</span>`;
      else if (m.type === 'saida_venda') typeBadge = `<span class="badge badge-danger">Saída Venda</span>`;
      else if (m.type === 'ajuste') typeBadge = `<span class="badge badge-warning">Ajuste</span>`;
      else if (m.type === 'reserva') typeBadge = `<span class="badge badge-info">Reserva</span>`;

      let ident = '';
      if (m.imei_1) ident += `IMEI1: ${m.imei_1}<br>`;
      if (m.serial_number) ident += `Serial: ${m.serial_number}`;
      if (!ident) ident = 'N/A';

      return `
        <tr>
          <td>#${m.id}</td>
          <td>${new Date(m.timestamp).toLocaleString('pt-BR')}</td>
          <td><strong>${m.brand}</strong> ${m.model}</td>
          <td><small>${ident}</small></td>
          <td>${typeBadge}</td>
          <td class="font-semibold">${m.quantity > 0 ? '+' : ''}${m.quantity}</td>
          <td>${m.user_name || 'Sistema'}</td>
          <td><small>${m.notes || '-'}</small></td>
        </tr>
      `;
    }).join('');
  },

  filterMovements(query) {
    if (!query) {
      this.renderMovementsTable(this.movements);
      return;
    }
    const q = query.toLowerCase();
    const filtered = this.movements.filter(m => 
      (m.brand && m.brand.toLowerCase().includes(q)) ||
      (m.model && m.model.toLowerCase().includes(q)) ||
      (m.imei_1 && m.imei_1.includes(q)) ||
      (m.serial_number && m.serial_number.toLowerCase().includes(q))
    );
    this.renderMovementsTable(filtered);
  },

  async showAdjustModal() {
    // We need to fetch available products list to adjust
    try {
      const prods = await window.api.products.list({ status: 'disponivel' });
      
      const content = `
        <form id="stock-adjust-form">
          <div class="form-group">
            <label for="adjust-prod-id">Selecionar Aparelho (Estoque)</label>
            <select id="adjust-prod-id" required>
              <option value="">Selecione o produto...</option>
              ${prods.map(p => `<option value="${p.id}">${p.brand} ${p.model} (${p.imei_1 || p.serial_number || 'Sem IMEI'})</option>`).join('')}
            </select>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label for="adjust-type">Tipo de Ajuste</label>
              <select id="adjust-type" required>
                <option value="ajuste">Ajuste de Balanço (Inventário)</option>
                <option value="entrada">Entrada Manual Extra</option>
              </select>
            </div>
            <div class="form-group">
              <label for="adjust-qty">Quantidade</label>
              <input type="number" id="adjust-qty" min="1" max="1" value="1" readonly style="background: var(--bg-primary);">
              <small class="text-muted">Aparelhos com IMEI/Serial são ajustados unitariamente.</small>
            </div>
          </div>

          <div class="form-group">
            <label for="adjust-notes">Motivo / Justificativa *</label>
            <textarea id="adjust-notes" required placeholder="Escreva o motivo do ajuste físico no estoque..." rows="3"></textarea>
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
            <button type="button" class="btn btn-secondary" onclick="window.app.closeModal()">Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar Ajuste</button>
          </div>
        </form>
      `;

      window.app.showModal('Ajuste de Inventário Físico', content);

      document.getElementById('stock-adjust-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
          product_id: parseInt(document.getElementById('adjust-prod-id').value),
          type: document.getElementById('adjust-type').value,
          notes: document.getElementById('adjust-notes').value
        };

        try {
          await window.api.stock.adjust(payload);
          window.app.showToast('Estoque ajustado com sucesso!', 'success');
          window.app.closeModal();
          this.loadMovements();
        } catch (err) {
          window.app.showToast(err.message, 'danger');
        }
      });

    } catch (err) {
      window.app.showToast('Erro ao carregar aparelhos disponíveis', 'danger');
    }
  }
};
