/* Users Management View */
window.views = window.views || {};

window.views.users = {
  users: [],

  async render(container) {
    const user = window.app.currentUser;
    if (user && user.role !== 'admin') {
      container.innerHTML = `
        <div class="empty-state">
          <h3>Acesso Negado</h3>
          <p>Somente o Administrador do sistema possui permissão para acessar a área de controle de usuários.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="table-header-row">
        <div>
          <p class="text-muted">Gerenciamento de credenciais, perfis de acesso e logs de segurança.</p>
        </div>
        
        <button id="btn-add-user" class="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Adicionar Usuário
        </button>
      </div>

      <div class="table-responsive">
        <table id="users-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Perfil / Nível</th>
              <th>Autenticação 2FA</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="7" class="empty-state">Buscando usuários...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('btn-add-user').addEventListener('click', () => this.showUserModal());

    await this.loadUsers();
  },

  async loadUsers() {
    try {
      const data = await window.api.users.list();
      this.users = data;

      const tbody = document.querySelector('#users-table tbody');
      if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Nenhum usuário cadastrado.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.map(u => {
        let statusBadge = u.is_active ? `<span class="badge badge-success">Ativo</span>` : `<span class="badge badge-danger">Bloqueado</span>`;
        let roleName = '';
        if (u.role === 'admin') roleName = '⭐ Administrador';
        else if (u.role === 'manager') roleName = '💼 Gerente';
        else if (u.role === 'seller') roleName = '🏷️ Vendedor';
        else if (u.role === 'financial') roleName = '💵 Financeiro';

        let twoFactorBadge = u.two_factor_enabled ? 
          `<span class="badge badge-success">Ativado</span>` : 
          `<span class="badge badge-warning">Desativado</span>`;

        return `
          <tr data-id="${u.id}">
            <td>#${u.id}</td>
            <td><strong>${u.name}</strong></td>
            <td>${u.email}</td>
            <td>${roleName}</td>
            <td>${twoFactorBadge}</td>
            <td>${statusBadge}</td>
            <td>
              <div style="display:flex; gap: 6px;">
                <button class="btn btn-ghost btn-sm btn-edit-user">Editar Perfil</button>
                ${u.id !== window.app.currentUser.id ? `<button class="btn btn-ghost btn-sm btn-delete-user text-danger">🗑️</button>` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.btn-edit-user').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = parseInt(e.target.closest('tr').dataset.id);
          this.showUserModal(id);
        });
      });

      tbody.querySelectorAll('.btn-delete-user').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = parseInt(e.target.closest('tr').dataset.id);
          this.deleteUser(id);
        });
      });

    } catch (e) {
      window.app.showToast('Erro ao carregar lista de usuários', 'danger');
    }
  },

  showUserModal(userId = null) {
    const isEdit = userId !== null;
    const u = isEdit ? this.users.find(usr => usr.id === userId) : null;
    const modalTitle = isEdit ? 'Editar Perfil de Usuário' : 'Novo Usuário do Sistema';

    const content = `
      <form id="user-manage-form">
        <div class="form-group">
          <label for="usr-name">Nome Completo *</label>
          <input type="text" id="usr-name" required placeholder="Ex: Fernando Paiva" value="${u ? u.name : ''}">
        </div>

        <div class="form-group">
          <label for="usr-email">E-mail corporativo (Login) *</label>
          <input type="email" id="usr-email" required placeholder="email@inandostore.com" value="${u ? u.email : ''}" ${isEdit ? 'disabled' : ''}>
        </div>

        ${!isEdit ? `
          <div class="form-group">
            <label for="usr-pw">Senha Temporária *</label>
            <input type="password" id="usr-pw" required placeholder="Mínimo 6 caracteres">
          </div>
        ` : ''}

        <div class="form-grid-3">
          <div class="form-group">
            <label for="usr-role">Nível de Permissão *</label>
            <select id="usr-role" required>
              <option value="seller" ${u && u.role === 'seller' ? 'selected' : ''}>Vendedor (Leitura + POS)</option>
              <option value="financial" ${u && u.role === 'financial' ? 'selected' : ''}>Financeiro (Contas + DRE)</option>
              <option value="manager" ${u && u.role === 'manager' ? 'selected' : ''}>Gerente (Estoque + CRM)</option>
              <option value="admin" ${u && u.role === 'admin' ? 'selected' : ''}>Administrador (Controle Total)</option>
            </select>
          </div>

          <div class="form-group">
            <label for="usr-active">Status de Acesso</label>
            <select id="usr-active" required>
              <option value="1" ${u && u.is_active === 1 ? 'selected' : ''}>Ativo (Liberado)</option>
              <option value="0" ${u && u.is_active === 0 ? 'selected' : ''}>Bloqueado (Inativo)</option>
            </select>
          </div>

          <div class="form-group">
            <label for="usr-2fa">Exigir 2FA</label>
            <select id="usr-2fa" required>
              <option value="0" ${u && u.two_factor_enabled === 0 ? 'selected' : ''}>Não (Somente senha)</option>
              <option value="1" ${u && u.two_factor_enabled === 1 ? 'selected' : ''}>Sim (Google Authenticator)</option>
            </select>
          </div>
        </div>

        <div class="auth-footer-info" style="margin-top: 12px; text-align: left;">
          <strong>Níveis de Permissões:</strong>
          <ul>
            <li><strong>Administrador:</strong> Acesso irrestrito a configurações, DRE, usuários e reversões.</li>
            <li><strong>Gerente:</strong> Controle completo de produtos, estoque e clientes. Não exclui vendas/usuários.</li>
            <li><strong>Vendedor:</strong> Cadastro de clientes, consulta de estoque e realização de vendas (PDV).</li>
            <li><strong>Financeiro:</strong> Fluxo de caixa, DRE, contas a pagar e receber. Sem alteração de estoque.</li>
          </ul>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
          <button type="button" class="btn btn-secondary" onclick="window.app.closeModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar Perfil</button>
        </div>
      </form>
    `;

    window.app.showModal(modalTitle, content);

    document.getElementById('user-manage-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      try {
        if (isEdit) {
          const payload = {
            name: document.getElementById('usr-name').value,
            role: document.getElementById('usr-role').value,
            is_active: parseInt(document.getElementById('usr-active').value),
            two_factor_enabled: parseInt(document.getElementById('usr-2fa').value)
          };
          await window.api.users.update(userId, payload);
          window.app.showToast('Usuário atualizado com sucesso!', 'success');
        } else {
          const payload = {
            name: document.getElementById('usr-name').value,
            email: document.getElementById('usr-email').value,
            password: document.getElementById('usr-pw').value,
            role: document.getElementById('usr-role').value
          };
          await window.api.users.create(payload);
          window.app.showToast('Novo usuário cadastrado!', 'success');
        }
        window.app.closeModal();
        this.loadUsers();
      } catch (err) {
        window.app.showToast(err.message, 'danger');
      }
    });
  },

  async deleteUser(id) {
    if (confirm('Deseja realmente excluir este usuário?')) {
      try {
        await window.api.users.delete(id);
        window.app.showToast('Usuário removido do sistema!', 'success');
        this.loadUsers();
      } catch (err) {
        window.app.showToast(err.message, 'danger');
      }
    }
  }
};
