/* Clients CRM View */
window.views = window.views || {};

window.views.clients = {
  clients: [],

  async render(container) {
    const user = window.app.currentUser;
    const canManage = user && (user.role === 'admin' || user.role === 'manager');

    container.innerHTML = `
      <div class="table-header-row">
        <div class="search-bar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" id="client-search" placeholder="Pesquisar clientes por nome, documento ou telefone...">
        </div>
        
        <div class="filters-row">
          <button id="btn-add-client" class="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Novo Cliente
          </button>
        </div>
      </div>

      <div class="table-responsive">
        <table id="clients-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nome</th>
              <th>Documento</th>
              <th>Contato</th>
              <th>Endereço</th>
              <th>Aniversário</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="7" class="empty-state">Carregando carteira de clientes...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('client-search').addEventListener('input', () => this.loadClients());
    document.getElementById('btn-add-client').addEventListener('click', () => this.showClientModal());

    await this.loadClients();
  },

  async loadClients() {
    const query = document.getElementById('client-search').value;
    const user = window.app.currentUser;
    const canManage = user && (user.role === 'admin' || user.role === 'manager');

    try {
      const data = await window.api.clients.list(query);
      this.clients = data;

      const tbody = document.querySelector('#clients-table tbody');
      if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Nenhum cliente cadastrado.</td></tr>`;
        return;
      }

      const todayStr = new Date().toISOString().slice(5, 10); // MM-DD

      tbody.innerHTML = data.map(c => {
        let isBirthdayToday = false;
        if (c.birthday) {
          // birthday format is YYYY-MM-DD
          const bParts = c.birthday.split('-');
          if (bParts.length === 3 && `${bParts[1]}-${bParts[2]}` === todayStr) {
            isBirthdayToday = true;
          }
        }

        return `
          <tr data-id="${c.id}">
            <td>#${c.id}</td>
            <td>
              <strong>${c.name}</strong> 
              ${isBirthdayToday ? '<span class="badge badge-warning" title="Faz aniversário hoje!">🎂 PARABÉNS</span>' : ''}
            </td>
            <td>${c.document || 'N/A'}</td>
            <td>
              📞 ${c.phone}<br>
              ✉️ <small>${c.email}</small>
            </td>
            <td><small>${c.address || '-'}</small></td>
            <td>${c.birthday ? new Date(c.birthday + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '-'}</td>
            <td>
              <div class="flex-actions" style="display: flex; gap: 6px;">
                <button class="btn btn-ghost btn-sm btn-profile">📋 Histórico</button>
                <button class="btn btn-ghost btn-sm btn-edit-cli">✏️</button>
                ${canManage ? `<button class="btn btn-ghost btn-sm btn-delete-cli text-danger">🗑️</button>` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.btn-profile').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = parseInt(e.target.closest('tr').dataset.id);
          this.showClientProfile(id);
        });
      });

      tbody.querySelectorAll('.btn-edit-cli').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = parseInt(e.target.closest('tr').dataset.id);
          this.showClientModal(id);
        });
      });

      tbody.querySelectorAll('.btn-delete-cli').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = parseInt(e.target.closest('tr').dataset.id);
          this.deleteClient(id);
        });
      });

    } catch (e) {
      console.error(e);
      window.app.showToast('Erro ao carregar clientes', 'danger');
    }
  },

  showClientModal(clientId = null) {
    const isEdit = clientId !== null;
    const cli = isEdit ? this.clients.find(c => c.id === clientId) : null;

    const modalTitle = isEdit ? 'Editar Cliente' : 'Cadastrar Novo Cliente';

    const content = `
      <form id="client-form">
        <div class="form-group">
          <label for="cli-name">Nome Completo *</label>
          <input type="text" id="cli-name" required placeholder="Nome do cliente" value="${cli ? cli.name : ''}">
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label for="cli-doc">CPF ou CNPJ</label>
            <input type="text" id="cli-doc" placeholder="Ex: 000.000.000-00" value="${cli ? (cli.document || '') : ''}">
          </div>
          <div class="form-group">
            <label for="cli-birthday">Data de Nascimento</label>
            <input type="date" id="cli-birthday" value="${cli ? (cli.birthday || '') : ''}">
          </div>
        </div>

        <div class="form-grid-3">
          <div class="form-group">
            <label for="cli-phone">Telefone Fixo *</label>
            <input type="text" id="cli-phone" required placeholder="(11) 5555-5555" value="${cli ? cli.phone : ''}">
          </div>
          <div class="form-group">
            <label for="cli-whatsapp">WhatsApp (Celular)</label>
            <input type="text" id="cli-whatsapp" placeholder="(11) 99999-9999" value="${cli ? cli.whatsapp : ''}">
          </div>
          <div class="form-group">
            <label for="cli-email">E-mail corporativo *</label>
            <input type="email" id="cli-email" required placeholder="email@cliente.com" value="${cli ? cli.email : ''}">
          </div>
        </div>

        <div class="form-group">
          <label for="cli-address">Endereço de Faturamento / Entrega</label>
          <input type="text" id="cli-address" placeholder="Rua, Número, Bairro, Cidade/UF" value="${cli ? (cli.address || '') : ''}">
        </div>

        <div class="form-group">
          <label for="cli-notes">Observações do Perfil CRM</label>
          <textarea id="cli-notes" placeholder="Preferências do cliente, restrições financeiras, etc..." rows="3">${cli ? (cli.notes || '') : ''}</textarea>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
          <button type="button" class="btn btn-secondary" onclick="window.app.closeModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar Ficha</button>
        </div>
      </form>
    `;

    window.app.showModal(modalTitle, content);

    document.getElementById('client-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      const payload = {
        name: document.getElementById('cli-name').value,
        document: document.getElementById('cli-doc').value || null,
        phone: document.getElementById('cli-phone').value,
        whatsapp: document.getElementById('cli-whatsapp').value || document.getElementById('cli-phone').value,
        email: document.getElementById('cli-email').value,
        address: document.getElementById('cli-address').value || null,
        birthday: document.getElementById('cli-birthday').value || null,
        notes: document.getElementById('cli-notes').value || null
      };

      try {
        if (isEdit) {
          await window.api.clients.update(clientId, payload);
          window.app.showToast('Cadastro de cliente atualizado!', 'success');
        } else {
          await window.api.clients.create(payload);
          window.app.showToast('Cliente cadastrado com sucesso!', 'success');
        }
        window.app.closeModal();
        this.loadClients();
      } catch (err) {
        window.app.showToast(err.message, 'danger');
      }
    });
  },

  async showClientProfile(id) {
    const cli = this.clients.find(c => c.id === id);
    if (!cli) return;

    try {
      const salesHistory = await window.api.clients.getSalesHistory(id);
      
      const modalTitle = `Ficha CRM: ${cli.name}`;
      const content = `
        <div class="dashboard-grid" style="grid-template-columns: 1fr 1fr; margin-bottom: 20px;">
          <div>
            <h4 style="font-weight:700; margin-bottom:10px;">Dados Básicos</h4>
            <p><strong>CPF/CNPJ:</strong> ${cli.document || 'Não informado'}</p>
            <p><strong>Telefone:</strong> ${cli.phone}</p>
            <p><strong>WhatsApp:</strong> ${cli.whatsapp || 'N/A'}</p>
            <p><strong>E-mail:</strong> ${cli.email}</p>
            <p><strong>Endereço:</strong> ${cli.address || 'Não cadastrado'}</p>
            <p><strong>Nascimento:</strong> ${cli.birthday ? new Date(cli.birthday + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</p>
          </div>
          <div>
            <h4 style="font-weight:700; margin-bottom:10px;">Ficha & Preferências</h4>
            <p style="background: var(--bg-primary); padding: 12px; border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); font-style: italic; min-height: 100px;">
              ${cli.notes || 'Nenhuma observação cadastrada no CRM.'}
            </p>
          </div>
        </div>

        <h3 style="font-size: 15px; font-weight:700; margin-bottom:12px;">Histórico de Compras</h3>
        <div class="table-responsive" style="max-height: 250px;">
          <table style="font-size: 12px;">
            <thead>
              <tr>
                <th>Cód Venda</th>
                <th>Data</th>
                <th>Vendedor</th>
                <th>Forma Pagto</th>
                <th>Total Final</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${salesHistory.length === 0 ? `<tr><td colspan="6" class="empty-state">Este cliente ainda não realizou compras.</td></tr>` : 
                salesHistory.map(s => `
                  <tr>
                    <td>#${s.id}</td>
                    <td>${new Date(s.sale_date).toLocaleString('pt-BR')}</td>
                    <td>${s.seller_name}</td>
                    <td>${s.payment_method}</td>
                    <td class="font-semibold text-primary">R$ ${s.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td><span class="badge ${s.status === 'concluida' ? 'badge-success' : 'badge-danger'}">${s.status.toUpperCase()}</span></td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>
        </div>

        <div style="display: flex; justify-content: flex-end; margin-top: 24px;">
          <button class="btn btn-primary" onclick="window.app.closeModal()">Fechar</button>
        </div>
      `;

      window.app.showModal(modalTitle, content);

    } catch (err) {
      window.app.showToast('Erro ao carregar histórico do cliente', 'danger');
    }
  },

  async deleteClient(id) {
    if (confirm('Deseja realmente excluir este cliente?')) {
      try {
        await window.api.clients.delete(id);
        window.app.showToast('Cliente removido com sucesso!', 'success');
        this.loadClients();
      } catch (err) {
        window.app.showToast(err.message, 'danger');
      }
    }
  }
};
