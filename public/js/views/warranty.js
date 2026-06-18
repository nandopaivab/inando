/* Warranty View */
window.views = window.views || {};

window.views.warranty = {
  async render(container) {
    container.innerHTML = `
      <div class="warranty-view" style="display: flex; flex-direction: column; gap: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-secondary); border: 1px solid var(--border-color); padding: 16px 20px; border-radius: var(--border-radius-md); box-shadow: var(--shadow-sm);">
          <div>
            <h3 style="font-size: 16px; font-weight:700; margin: 0; color: var(--text-primary);">Garantia de Aparelhos Usados, Seminovos e Recondicionados</h3>
            <p class="text-muted" style="font-size: 12px; margin: 4px 0 0 0;">Controle do prazo de garantia de 90 dias a contar da data de compra</p>
          </div>
          <div style="position: relative; width: 250px;">
            <input type="text" id="warranty-search" placeholder="Buscar modelo, IMEI ou cliente..." style="width: 100%; padding: 8px 12px 8px 30px; font-size: 13px; border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary);">
            <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-secondary); font-size: 12px;">🔍</span>
          </div>
        </div>

        <div class="table-responsive" style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--border-radius-md); padding: 16px; box-shadow: var(--shadow-md);">
          <table id="warranty-table" style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border-color); font-size: 12px; color: var(--text-secondary);">
                <th style="padding: 12px 8px;">Aparelho</th>
                <th style="padding: 12px 8px;">Identificador</th>
                <th style="padding: 12px 8px;">Cliente</th>
                <th style="padding: 12px 8px;">Telefone</th>
                <th style="padding: 12px 8px;">E-mail</th>
                <th style="padding: 12px 8px;">Data da Venda</th>
                <th style="padding: 12px 8px;">Status da Garantia</th>
              </tr>
            </thead>
            <tbody id="warranty-list-body">
              <tr>
                <td colspan="7" class="empty-state" style="text-align: center; padding: 40px; color: var(--text-muted);">Buscando informações de garantia...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    const searchInput = document.getElementById('warranty-search');
    searchInput.addEventListener('input', () => this.filterTable());

    await this.loadWarrantyData();
  },

  async loadWarrantyData() {
    try {
      this.items = await window.api.warranty.getUsedWarrantyList();
      this.filterTable();
    } catch (err) {
      window.app.showToast('Erro ao carregar garantias', 'danger');
      const tbody = document.getElementById('warranty-list-body');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state" style="text-align: center; padding: 40px; color: var(--danger);">Erro ao carregar dados do servidor.</td></tr>`;
      }
    }
  },

  filterTable() {
    const tbody = document.getElementById('warranty-list-body');
    if (!tbody) return;

    const query = (document.getElementById('warranty-search')?.value || '').toLowerCase().trim();
    
    const filtered = (this.items || []).filter(item => {
      const model = `${item.brand} ${item.model}`.toLowerCase();
      const imei = (item.imei_1 || '').toLowerCase();
      const serial = (item.serial_number || '').toLowerCase();
      const client = (item.client_name || 'Consumidor Final').toLowerCase();
      const email = (item.client_email || '').toLowerCase();
      const phone = (item.client_phone || '').toLowerCase();
      
      return model.includes(query) || imei.includes(query) || serial.includes(query) || client.includes(query) || email.includes(query) || phone.includes(query);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state" style="text-align: center; padding: 40px; color: var(--text-muted);">Nenhum aparelho usado, seminovo ou recondicionado vendido localizado.</td></tr>`;
      return;
    }

    const now = new Date();

    tbody.innerHTML = filtered.map(item => {
      const saleDate = new Date(item.sale_date);
      const expirationDate = new Date(saleDate.getTime() + (90 * 24 * 60 * 60 * 1000));
      
      // Calculate remaining days
      const msDiff = expirationDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(msDiff / (1000 * 60 * 60 * 24));
      
      let badge = '';
      let progressPercent = 0;
      let progressBarColor = 'var(--success)';

      if (daysRemaining <= 0) {
        badge = `<span class="badge badge-danger" style="background: rgba(239, 68, 68, 0.1); color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.2); font-size: 11px; padding: 4px 8px;">Expirada 🚫</span>`;
        progressPercent = 0;
      } else {
        progressPercent = Math.min(100, Math.max(0, (daysRemaining / 90) * 100));
        
        if (daysRemaining > 30) {
          badge = `<span class="badge badge-success" style="background: rgba(16, 185, 129, 0.1); color: var(--success); border: 1px solid rgba(16, 185, 129, 0.2); font-size: 11px; padding: 4px 8px;">Ativa | ${daysRemaining} dias restantes</span>`;
          progressBarColor = 'var(--success)';
        } else if (daysRemaining > 10) {
          badge = `<span class="badge badge-warning" style="background: rgba(245, 158, 11, 0.1); color: var(--warning); border: 1px solid rgba(245, 158, 11, 0.2); font-size: 11px; padding: 4px 8px;">Atenção | ${daysRemaining} dias restantes</span>`;
          progressBarColor = 'var(--warning)';
        } else {
          badge = `<span class="badge badge-danger" style="background: rgba(239, 68, 68, 0.1); color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.2); font-size: 11px; padding: 4px 8px;">Crítico | ${daysRemaining} dias restantes</span>`;
          progressBarColor = 'var(--danger)';
        }
      }

      return `
        <tr style="border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-primary);">
          <td style="padding: 12px 8px; font-weight: 600;">
            ${item.brand} ${item.model}
            <div style="font-size: 11px; color: var(--text-secondary); font-weight: normal; margin-top: 2px;">
              ${item.color} | ${item.capacity}
            </div>
          </td>
          <td style="padding: 12px 8px;">
            <div style="font-size: 12px; font-family: monospace;">
              ${item.imei_1 ? `IMEI: ${item.imei_1}` : ''}
              ${item.serial_number ? `<br>Série: ${item.serial_number}` : ''}
            </div>
          </td>
          <td style="padding: 12px 8px; font-weight: 600;">
            ${item.client_name || 'Consumidor Final'}
          </td>
          <td style="padding: 12px 8px; color: var(--text-secondary);">
            ${item.client_phone || 'N/A'}
          </td>
          <td style="padding: 12px 8px; color: var(--text-secondary);">
            ${item.client_email || 'N/A'}
          </td>
          <td style="padding: 12px 8px;">
            ${saleDate.toLocaleDateString('pt-BR')}
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
              Expira: ${expirationDate.toLocaleDateString('pt-BR')}
            </div>
          </td>
          <td style="padding: 12px 8px; width: 220px;">
            <div style="margin-bottom: 6px;">${badge}</div>
            ${daysRemaining > 0 ? `
              <div style="width: 100%; height: 6px; background: var(--bg-primary); border-radius: 3px; overflow: hidden; border: 1px solid var(--border-color);">
                <div style="width: ${progressPercent}%; height: 100%; background: ${progressBarColor}; border-radius: 3px;"></div>
              </div>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');
  }
};
