/* Settings View */
window.views = window.views || {};

window.views.settings = {
  async render(container) {
    const user = window.app.currentUser;
    const isAdmin = user && user.role === 'admin';

    container.innerHTML = `
      <div style="position: relative; max-width: 700px; margin: 0 auto; background: var(--bg-secondary); border: 1px solid var(--border-color); padding: 32px; border-radius: var(--border-radius-lg); box-shadow: var(--shadow-md);">
        <button type="button" id="btn-close-settings" style="position: absolute; top: 16px; right: 16px; background: transparent; border: none; font-size: 20px; color: var(--text-secondary); cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; transition: var(--transition-fast);" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">❌</button>
        <h3 style="font-size: 16px; font-weight:700; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 24px;">Configurações Gerais do ERP</h3>
        
        <form id="settings-form">
          <div class="form-group">
            <label for="set-company">Razão Social (Nome da Empresa) *</label>
            <input type="text" id="set-company" required placeholder="Ex: iNando Store Ltda" ${!isAdmin ? 'disabled' : ''}>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label for="set-cnpj">CNPJ Fiscais *</label>
              <input type="text" id="set-cnpj" required placeholder="00.000.000/0000-00" ${!isAdmin ? 'disabled' : ''}>
            </div>
            <div class="form-group">
              <label for="set-tax">Alíquota ICMS/Simples Nacional (%) *</label>
              <input type="number" id="set-tax" step="0.01" min="0" required placeholder="Ex: 6.5" ${!isAdmin ? 'disabled' : ''}>
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label for="set-phone">Telefone de Contato *</label>
              <input type="text" id="set-phone" required placeholder="(11) 99999-8888" ${!isAdmin ? 'disabled' : ''}>
            </div>
            <div class="form-group">
              <label for="set-email">E-mail de Suporte Comercial *</label>
              <input type="email" id="set-email" required placeholder="suporte@inandostore.com" ${!isAdmin ? 'disabled' : ''}>
            </div>
          </div>

          <div class="form-group">
            <label for="set-address">Endereço Físico Principal *</label>
            <input type="text" id="set-address" required placeholder="Rua, Número, Cidade/UF" ${!isAdmin ? 'disabled' : ''}>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label for="set-backup-freq">Frequência de Backup Automático</label>
              <select id="set-backup-freq" ${!isAdmin ? 'disabled' : ''}>
                <option value="diario">Diário (Recomendado)</option>
                <option value="semanal">Semanal</option>
                <option value="mensal">Mensal</option>
              </select>
            </div>
            <div class="form-group">
              <label for="set-theme-default">Tema Padrão do ERP</label>
              <select id="set-theme-default" ${!isAdmin ? 'disabled' : ''}>
                <option value="dark">Modo Escuro (Dark Mode)</option>
                <option value="light">Modo Claro (Light Mode)</option>
              </select>
            </div>
          </div>

          ${isAdmin ? `<button type="submit" class="btn btn-primary" style="margin-top: 20px;">Salvar Configurações</button>` : ''}
        </form>

        <div style="margin-top: 32px; border-top: 1px solid var(--border-color); padding-top: 24px;">
          <h4 style="font-weight: 700; margin-bottom: 12px;">🔑 Alterar Minha Senha de Acesso</h4>
          <form id="change-password-form">
            <div class="form-group">
              <label for="pwd-current">Senha Atual *</label>
              <input type="password" id="pwd-current" required placeholder="Digite sua senha atual">
            </div>
            <div class="form-grid-2">
              <div class="form-group">
                <label for="pwd-new">Nova Senha *</label>
                <input type="password" id="pwd-new" required placeholder="Nova senha (min. 6 caracteres)">
              </div>
              <div class="form-group">
                <label for="pwd-confirm">Confirmar Nova Senha *</label>
                <input type="password" id="pwd-confirm" required placeholder="Repita a nova senha">
              </div>
            </div>
            <button type="submit" class="btn btn-secondary" style="margin-top: 12px;">Atualizar Minha Senha</button>
          </form>
        </div>

        <div style="margin-top: 32px; border-top: 1px solid var(--border-color); padding-top: 24px;">
          <h4 style="font-weight: 700; margin-bottom: 12px;">🛡️ Cópia de Segurança e Nuvem</h4>
          <p class="text-muted" style="font-size: 13px; line-height: 1.5; margin-bottom: 16px;">
            O sistema faz backups criptografados automáticos na nuvem de acordo com a frequência configurada. Você também pode disparar uma sincronização completa agora.
          </p>
          <div id="backup-progress-container" class="hidden" style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
              <span>Compactando tabelas e gerando dump SQL...</span>
              <span id="backup-percentage">0%</span>
            </div>
            <div style="width: 100%; height: 8px; background: var(--bg-primary); border-radius: 4px; overflow: hidden; border: 1px solid var(--border-color);">
              <div id="backup-progress-bar" style="width: 0%; height: 100%; background: var(--primary); transition: width 0.1s;"></div>
            </div>
          </div>
          <button id="btn-trigger-backup" class="btn btn-secondary">⚡ Sincronizar Nuvem Agora</button>
        </div>
      </div>
    `;

    try {
      const config = await window.api.settings.get();
      
      document.getElementById('set-company').value = config.company_name || '';
      document.getElementById('set-cnpj').value = config.company_cnpj || '';
      document.getElementById('set-tax').value = config.default_tax || '';
      document.getElementById('set-phone').value = config.company_phone || '';
      document.getElementById('set-email').value = config.company_email || '';
      document.getElementById('set-address').value = config.company_address || '';
      document.getElementById('set-backup-freq').value = config.backup_frequency || 'diario';
      document.getElementById('set-theme-default').value = config.theme || 'dark';

    } catch (err) {
      window.app.showToast('Erro ao carregar configurações', 'danger');
    }

    if (isAdmin) {
      document.getElementById('settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
          company_name: document.getElementById('set-company').value,
          company_cnpj: document.getElementById('set-cnpj').value,
          default_tax: document.getElementById('set-tax').value,
          company_phone: document.getElementById('set-phone').value,
          company_email: document.getElementById('set-email').value,
          company_address: document.getElementById('set-address').value,
          backup_frequency: document.getElementById('set-backup-freq').value,
          theme: document.getElementById('set-theme-default').value
        };

        try {
          await window.api.settings.update(payload);
          window.app.showToast('Configurações salvas no banco de dados!', 'success');
        } catch (err) {
          window.app.showToast(err.message, 'danger');
        }
      });
    }

    // Listener para o formulario de alteracao de senha
    document.getElementById('change-password-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const current = document.getElementById('pwd-current').value;
      const newPw = document.getElementById('pwd-new').value;
      const confirmPw = document.getElementById('pwd-confirm').value;

      if (newPw.length < 6) {
        return window.app.showToast('A nova senha deve ter no minimo 6 caracteres.', 'danger');
      }
      if (newPw !== confirmPw) {
        return window.app.showToast('As senhas digitadas nao conferem.', 'danger');
      }

      try {
        await window.api.users.changePassword(current, newPw);
        window.app.showToast('Sua senha foi atualizada com sucesso!', 'success');
        document.getElementById('change-password-form').reset();
      } catch (err) {
        window.app.showToast(err.message, 'danger');
      }
    });

    // Close settings click listener
    document.getElementById('btn-close-settings').addEventListener('click', () => {
      window.app.navigateTo('dashboard');
    });

    // Backup simulation click
    document.getElementById('btn-trigger-backup').addEventListener('click', () => this.runSimulatedBackup());
  },

  runSimulatedBackup() {
    const btn = document.getElementById('btn-trigger-backup');
    const progressContainer = document.getElementById('backup-progress-container');
    const progressBar = document.getElementById('backup-progress-bar');
    const percentText = document.getElementById('backup-percentage');

    btn.disabled = true;
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';
    percentText.textContent = '0%';

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 15) + 5;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        
        setTimeout(() => {
          progressContainer.classList.add('hidden');
          btn.disabled = false;
          window.app.showToast('Backup criptografado enviado com sucesso para a Nuvem AWS S3!', 'success');
        }, 800);
      }
      progressBar.style.width = `${progress}%`;
      percentText.textContent = `${progress}%`;
    }, 200);
  }
};
