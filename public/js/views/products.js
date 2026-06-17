/* Products View */
window.views = window.views || {};

window.views.products = {
  products: [],

  async render(container) {
    const user = window.app.currentUser;
    const canManage = user && (user.role === 'admin' || user.role === 'manager');
    const isSeller = user && user.role === 'seller';

    container.innerHTML = `
      <div class="table-header-row">
        <div class="search-bar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" id="prod-search" placeholder="Buscar por marca, modelo, IMEI ou serial...">
        </div>
        
        <div class="filters-row">
          <select id="filter-category" style="width: 150px;">
            <option value="">Todas Categorias</option>
            <option value="celular">Celular</option>
            <option value="tablet">Tablet</option>
            <option value="smartwatch">Smartwatch</option>
            <option value="acessorios">Acessórios</option>
          </select>
          
          <select id="filter-status" style="width: 140px;">
            <option value="">Todos Status</option>
            <option value="disponivel">Disponível</option>
            <option value="vendido">Vendido</option>
            <option value="reservado">Reservado</option>
          </select>

          ${canManage || isSeller ? `<button id="btn-add-product" class="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Novo Produto
          </button>` : ''}
        </div>
      </div>

      <div class="table-responsive">
        <table id="products-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Aparelho</th>
              <th>Categoria</th>
              <th>Especificações</th>
              <th>Identificação (IMEI/Serial)</th>
              ${!isSeller ? '<th>Custo</th>' : ''}
              <th>Preço Venda</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="${!isSeller ? '9' : '8'}" class="empty-state">Buscando produtos...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    // Add Listeners
    document.getElementById('prod-search').addEventListener('input', () => this.loadProducts());
    document.getElementById('filter-category').addEventListener('change', () => this.loadProducts());
    document.getElementById('filter-status').addEventListener('change', () => this.loadProducts());
    
    const addBtn = document.getElementById('btn-add-product');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.showProductModal());
    }

    await this.loadProducts();
  },

  async loadProducts() {
    const search = document.getElementById('prod-search').value;
    const cat = document.getElementById('filter-category').value;
    const status = document.getElementById('filter-status').value;
    const user = window.app.currentUser;
    const isSeller = user && user.role === 'seller';
    const canManage = user && (user.role === 'admin' || user.role === 'manager');

    try {
      const data = await window.api.products.list({ q: search, category: cat, status: status });
      this.products = data;
      
      const tbody = document.querySelector('#products-table tbody');
      if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${!isSeller ? '9' : '8'}" class="empty-state">Nenhum produto cadastrado.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.map(p => {
        let specs = '-';
        if (p.category !== 'acessorios') {
          specs = `${p.color || 'N/A'} | ${p.capacity || 'N/A'} | ${p.ram || 'N/A'} RAM | <small>${p.state.toUpperCase()}</small>`;
        }

        let ident = '';
        if (p.imei_1) ident += `IMEI1: ${p.imei_1}<br>`;
        if (p.imei_2) ident += `IMEI2: ${p.imei_2}<br>`;
        if (p.serial_number) ident += `Serial: ${p.serial_number}`;
        if (!ident) ident = 'N/A';

        let statusBadge = '';
        if (p.status === 'disponivel') statusBadge = `<span class="badge badge-success">Disponível</span>`;
        else if (p.status === 'vendido') statusBadge = `<span class="badge badge-danger">Vendido</span>`;
        else if (p.status === 'reservado') statusBadge = `<span class="badge badge-warning">Reservado</span>`;

        return `
          <tr data-id="${p.id}">
            <td>#${p.id}</td>
            <td><strong>${p.brand}</strong> ${p.model}</td>
            <td><span class="badge badge-info">${p.category.toUpperCase()}</span></td>
            <td>${specs}</td>
            <td><small>${ident}</small></td>
            ${!isSeller ? `<td>R$ ${p.purchase_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>` : ''}
            <td class="font-semibold text-primary">R$ ${p.selling_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            <td>${statusBadge}</td>
            <td>
              <div class="flex-actions" style="display: flex; gap: 6px;">
                <button class="btn btn-ghost btn-sm btn-qr" title="Gerar QR Code">📱 QR</button>
                ${p.imei_1 ? `<button class="btn btn-ghost btn-sm btn-imei" title="Consultar IMEI Blacklist">🔍 IMEI</button>` : ''}
                ${(p.brand && p.brand.toLowerCase() === 'apple' && p.serial_number) ? `<button class="btn btn-ghost btn-sm btn-serial" title="Consultar Cobertura Apple" style="color: var(--danger);">🍎 Serial</button>` : ''}
                ${canManage ? `
                  <button class="btn btn-ghost btn-sm btn-edit" title="Editar">✏️</button>
                  ${p.status !== 'vendido' ? `<button class="btn btn-ghost btn-sm btn-delete text-danger" title="Excluir">🗑️</button>` : ''}
                ` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');

      // Actions Listeners
      tbody.querySelectorAll('.btn-qr').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = parseInt(e.target.closest('tr').dataset.id);
          this.showQRModal(id);
        });
      });

      tbody.querySelectorAll('.btn-imei').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = parseInt(e.target.closest('tr').dataset.id);
          this.showIMEICheckModal(id);
        });
      });

      tbody.querySelectorAll('.btn-serial').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = parseInt(e.target.closest('tr').dataset.id);
          this.showAppleCoverageModal(id);
        });
      });

      tbody.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = parseInt(e.target.closest('tr').dataset.id);
          this.showProductModal(id);
        });
      });

      tbody.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = parseInt(e.target.closest('tr').dataset.id);
          this.deleteProduct(id);
        });
      });

    } catch (e) {
      console.error(e);
      window.app.showToast('Erro ao carregar estoque', 'danger');
    }
  },

  showProductModal(productId = null) {
    const isEdit = productId !== null;
    const prod = isEdit ? this.products.find(p => p.id === productId) : null;
    const user = window.app.currentUser;
    const isSeller = user && user.role === 'seller';

    const modalTitle = isEdit ? 'Editar Produto' : 'Cadastrar Novo Aparelho';
    
    // Base64 Images list simulation
    let base64Images = prod && prod.images ? JSON.parse(prod.images) : [];

    const content = `
      <form id="product-form">
        <div class="form-group" style="margin-bottom: 20px;">
          <label for="prod-model-select">Selecione o Modelo do Aparelho *</label>
          <div style="display: flex; gap: 8px;">
            <select id="prod-model-select" style="flex: 1;">
              <option value="">-- Selecione ou clique ao lado para criar um modelo --</option>
            </select>
            <button type="button" class="btn btn-secondary" id="btn-new-model-modal" style="padding: 0 16px;">➕ Novo Modelo</button>
          </div>
        </div>

        <!-- Hidden inputs that populate based on selected model -->
        <input type="hidden" id="prod-brand" value="${prod ? prod.brand : ''}">
        <input type="hidden" id="prod-model" value="${prod ? prod.model : ''}">

        <div class="form-grid-3">
          <div class="form-group">
            <label for="prod-category">Categoria *</label>
            <select id="prod-category" disabled>
              <option value="celular" ${prod && prod.category === 'celular' ? 'selected' : ''}>Celular</option>
              <option value="tablet" ${prod && prod.category === 'tablet' ? 'selected' : ''}>Tablet</option>
              <option value="smartwatch" ${prod && prod.category === 'smartwatch' ? 'selected' : ''}>Smartwatch</option>
              <option value="acessorios" ${prod && prod.category === 'acessorios' ? 'selected' : ''}>Acessórios</option>
            </select>
          </div>
          <div class="form-group">
            <label for="prod-state">Estado *</label>
            <select id="prod-state" required>
              <option value="novo" ${prod && prod.state === 'novo' ? 'selected' : ''}>Novo</option>
              <option value="seminovo" ${prod && prod.state === 'seminovo' ? 'selected' : ''}>Seminovo</option>
              <option value="usado" ${prod && prod.state === 'usado' ? 'selected' : ''}>Usado</option>
              <option value="recondicionado" ${prod && prod.state === 'recondicionado' ? 'selected' : ''}>Recondicionado</option>
            </select>
          </div>
          <div class="form-group">
            <label for="prod-color">Cor</label>
            <input type="text" id="prod-color" placeholder="Ex: Space Black" disabled value="${prod ? prod.color : ''}">
          </div>
        </div>

        <div class="form-grid-3 hardware-specs">
          <div class="form-group">
            <label for="prod-capacity">Capacidade (Armazenamento)</label>
            <input type="text" id="prod-capacity" placeholder="Ex: 128GB, 256GB" disabled value="${prod ? prod.capacity : ''}">
          </div>
          <div class="form-group">
            <label for="prod-ram">Memória RAM</label>
            <input type="text" id="prod-ram" placeholder="Ex: 6GB, 8GB" disabled value="${prod ? prod.ram : ''}">
          </div>
          <div class="form-group" style="display:none;">
            <label for="prod-min-stock">Estoque Mínimo (Alerta)</label>
            <input type="number" id="prod-min-stock" min="0" value="${prod ? prod.min_stock_alert : 0}">
          </div>
        </div>

        <div class="form-grid-3 serial-specs">
          <div class="form-group">
            <label for="prod-imei1">IMEI 1</label>
            <input type="text" id="prod-imei1" placeholder="IMEI de 15 dígitos" value="${prod ? (prod.imei_1 || '') : ''}">
          </div>
          <div class="form-group">
            <label for="prod-imei2">IMEI 2</label>
            <input type="text" id="prod-imei2" placeholder="IMEI secundário" value="${prod ? (prod.imei_2 || '') : ''}">
          </div>
          <div class="form-group">
            <label for="prod-serial">Número de Série</label>
            <input type="text" id="prod-serial" placeholder="N/S do fabricante" value="${prod ? (prod.serial_number || '') : ''}">
          </div>
        </div>

        <div class="form-grid-3">
          <div class="form-group">
            <label for="prod-supplier">Fornecedor</label>
            <input type="text" id="prod-supplier" placeholder="Fornecedor do item" value="${prod ? prod.supplier : ''}">
          </div>
          <div class="form-group">
            <label for="prod-purchase-date">Data da Compra</label>
            <input type="date" id="prod-purchase-date" value="${prod ? prod.purchase_date : new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label for="prod-commission">Comissão Vendedor (%)</label>
            <input type="number" id="prod-commission" step="0.1" min="0" value="${prod ? prod.commission_percent : 2.0}">
          </div>
        </div>

        <div class="form-grid-3">
          <div class="form-group">
            <label for="prod-cost">Preço de Custo (Compra) *</label>
            <input type="number" id="prod-cost" step="0.01" min="0.01" required value="${prod ? prod.purchase_price : ''}" ${isSeller ? 'disabled' : ''}>
          </div>
          <div class="form-group">
            <label for="prod-selling">Preço de Venda *</label>
            <input type="number" id="prod-selling" step="0.01" min="0.01" required value="${prod ? prod.selling_price : ''}">
          </div>
          <div class="form-group">
            <label>Margem de Lucro Bruto (%)</label>
            <input type="text" id="prod-margin" readonly placeholder="Auto calculada" style="background: var(--bg-primary); border-style: dashed;">
          </div>
        </div>

        <!-- Multiple Image upload -->
        <div class="form-group">
          <label>Fotos do Aparelho (Upload Múltiplo)</label>
          <div class="image-uploader-box" id="image-dropzone">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 8px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            <p>Clique ou arraste imagens aqui (Simulado)</p>
            <input type="file" id="prod-images-input" multiple accept="image/*" style="display: none;">
          </div>
          <div class="image-previews" id="image-previews-container">
            ${base64Images.map(img => `<img src="${img}" class="img-preview-item">`).join('')}
          </div>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-prod-modal">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar Alterações</button>
        </div>
      </form>
    `;

    window.app.showModal(modalTitle, content);

    // Margin calculator hooks
    const costInput = document.getElementById('prod-cost');
    const sellingInput = document.getElementById('prod-selling');
    const marginInput = document.getElementById('prod-margin');

    const updateMargin = () => {
      const cost = parseFloat(costInput.value);
      const selling = parseFloat(sellingInput.value);
      if (cost > 0 && selling > 0) {
        const margin = ((selling - cost) / selling) * 100;
        marginInput.value = `${margin.toFixed(1)}%`;
        if (margin < 10) marginInput.style.color = 'var(--danger)';
        else if (margin < 25) marginInput.style.color = 'var(--warning)';
        else marginInput.style.color = 'var(--success)';
      } else {
        marginInput.value = '';
      }
    };

    costInput.addEventListener('input', updateMargin);
    sellingInput.addEventListener('input', updateMargin);
    
    // Bi-directional hook: if cost is set and they input a margin value, set selling price!
    marginInput.removeAttribute('readonly');
    marginInput.addEventListener('input', () => {
      const cost = parseFloat(costInput.value);
      const margin = parseFloat(marginInput.value);
      if (cost > 0 && margin > 0 && margin < 100) {
        const selling = cost / (1 - (margin / 100));
        sellingInput.value = selling.toFixed(2);
      }
    });

    if (isEdit) updateMargin();

    // Populate Models Select and bind handlers
    const modelSelect = document.getElementById('prod-model-select');
    const brandInput = document.getElementById('prod-brand');
    const modelInput = document.getElementById('prod-model');
    const capacityInput = document.getElementById('prod-capacity');
    const ramInput = document.getElementById('prod-ram');
    const colorInput = document.getElementById('prod-color');
    const minStockInput = document.getElementById('prod-min-stock');

    let allModels = [];

    const loadModelsDropdown = async (selectId = null) => {
      try {
        allModels = await window.api.productModels.list();
        modelSelect.innerHTML = `<option value="">-- Selecione ou clique ao lado para criar um modelo --</option>` +
          allModels.map(m => `<option value="${m.id}" ${selectId == m.id ? 'selected' : ''}>${m.brand} ${m.model} (${m.capacity} | ${m.color})</option>`).join('');
      } catch (err) {
        window.app.showToast('Erro ao carregar modelos', 'danger');
      }
    };

    loadModelsDropdown(prod ? prod.model_id : null);

    modelSelect.addEventListener('change', () => {
      const selectedId = parseInt(modelSelect.value);
      const m = allModels.find(item => item.id === selectedId);
      if (m) {
        brandInput.value = m.brand;
        modelInput.value = m.model;
        categorySelect.value = m.category;
        colorInput.value = m.color;
        capacityInput.value = m.capacity;
        ramInput.value = m.ram;
        minStockInput.value = m.min_stock_alert;
      } else {
        brandInput.value = '';
        modelInput.value = '';
        colorInput.value = '';
        capacityInput.value = '';
        ramInput.value = '';
      }
      toggleFields();
    });

    document.getElementById('btn-new-model-modal').addEventListener('click', () => {
      const modalContent = `
        <form id="new-model-form">
          <div class="form-grid-2">
            <div class="form-group">
              <label for="new-model-brand">Marca *</label>
              <input type="text" id="new-model-brand" required placeholder="Ex: Apple">
            </div>
            <div class="form-group">
              <label for="new-model-model">Modelo *</label>
              <input type="text" id="new-model-model" required placeholder="Ex: iPhone 17 Pro Max">
            </div>
          </div>
          <div class="form-grid-3">
            <div class="form-group">
              <label for="new-model-category">Categoria *</label>
              <select id="new-model-category" required>
                <option value="celular">Celular</option>
                <option value="tablet">Tablet</option>
                <option value="smartwatch">Smartwatch</option>
                <option value="acessorios">Acessórios</option>
              </select>
            </div>
            <div class="form-group">
              <label for="new-model-color">Cor *</label>
              <input type="text" id="new-model-color" required placeholder="Ex: Space Black">
            </div>
            <div class="form-group">
              <label for="new-model-capacity">Capacidade *</label>
              <input type="text" id="new-model-capacity" required placeholder="Ex: 256GB">
            </div>
          </div>
          <div class="form-grid-2">
            <div class="form-group">
              <label for="new-model-ram">RAM</label>
              <input type="text" id="new-model-ram" placeholder="Ex: 8GB">
            </div>
            <div class="form-group">
              <label for="new-model-min-stock">Estoque Mínimo (Alerta) *</label>
              <input type="number" id="new-model-min-stock" min="0" value="0" required>
            </div>
          </div>
          <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-model-submodal">Cancelar</button>
            <button type="submit" class="btn btn-primary">Adicionar Modelo</button>
          </div>
        </form>
      `;
      // Render as submodal or replace (we'll do temporary secondary popup modal by overriding modal container or injecting alert overlay)
      const popup = document.createElement('div');
      popup.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:9999;";
      popup.innerHTML = `
        <div style="background:var(--bg-secondary); padding:24px; border-radius:var(--border-radius-lg); width:100%; max-width:550px; border:1px solid var(--border-color);">
          <h3 style="margin-bottom: 20px;">Cadastrar Novo Modelo de Referência</h3>
          ${modalContent}
        </div>
      `;
      document.body.appendChild(popup);

      document.getElementById('btn-cancel-model-submodal').addEventListener('click', () => popup.remove());
      
      document.getElementById('new-model-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const dataModel = {
          brand: document.getElementById('new-model-brand').value,
          model: document.getElementById('new-model-model').value,
          category: document.getElementById('new-model-category').value,
          color: document.getElementById('new-model-color').value,
          capacity: document.getElementById('new-model-capacity').value,
          ram: document.getElementById('new-model-ram').value || 'N/A',
          min_stock_alert: parseInt(document.getElementById('new-model-min-stock').value)
        };
        try {
          const created = await window.api.productModels.create(dataModel);
          window.app.showToast('Modelo de referência cadastrado com sucesso!', 'success');
          popup.remove();
          await loadModelsDropdown(created.id);
          // Auto fill fields
          brandInput.value = created.brand;
          modelInput.value = created.model;
          categorySelect.value = created.category;
          colorInput.value = created.color;
          capacityInput.value = created.capacity;
          ramInput.value = created.ram;
          minStockInput.value = created.min_stock_alert;
          toggleFields();
        } catch (err) {
          window.app.showToast(err.message, 'danger');
        }
      });
    });

    // Toggle hardware fields based on category
    const categorySelect = document.getElementById('prod-category');
    const toggleFields = () => {
      const cat = categorySelect.value;
      const specsBlock = document.querySelector('.hardware-specs');
      const serialBlock = document.querySelector('.serial-specs');
      if (cat === 'acessorios') {
        specsBlock.style.display = 'none';
        serialBlock.style.display = 'none';
      } else {
        specsBlock.style.display = 'grid';
        serialBlock.style.display = 'grid';
      }
    };
    toggleFields();

    // Image Upload trigger simulation
    const dropzone = document.getElementById('image-dropzone');
    const fileInput = document.getElementById('prod-images-input');
    const previews = document.getElementById('image-previews-container');

    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      // simulate uploading and convert to placeholder base64 tags
      const files = fileInput.files;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        reader.onload = (e) => {
          base64Images.push(e.target.result);
          const img = document.createElement('img');
          img.src = e.target.result;
          img.className = 'img-preview-item';
          previews.appendChild(img);
        };
        reader.readAsDataURL(file);
      }
    });

    // Form submit
    document.getElementById('product-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!modelSelect.value) {
        return window.app.showToast('Você deve selecionar um Modelo de Referência para cadastrar um aparelho.', 'danger');
      }

      const payload = {
        model_id: parseInt(modelSelect.value),
        state: document.getElementById('prod-state').value,
        imei_1: document.getElementById('prod-imei1').value || null,
        imei_2: document.getElementById('prod-imei2').value || null,
        serial_number: document.getElementById('prod-serial').value || null,
        supplier: document.getElementById('prod-supplier').value,
        purchase_date: document.getElementById('prod-purchase-date').value,
        commission_percent: parseFloat(document.getElementById('prod-commission').value),
        purchase_price: parseFloat(costInput.value),
        selling_price: parseFloat(sellingInput.value),
        images: base64Images
      };

      try {
        if (isEdit) {
          await window.api.products.update(productId, payload);
          window.app.showToast('Produto atualizado com sucesso!', 'success');
        } else {
          await window.api.products.create(payload);
          window.app.showToast('Produto cadastrado com sucesso!', 'success');
        }
        window.app.closeModal();
        this.loadProducts();
      } catch (err) {
        window.app.showToast(err.message, 'danger');
      }
    });

    document.getElementById('btn-cancel-prod-modal').addEventListener('click', () => window.app.closeModal());
  },

  showIMEICheckModal(id) {
    const prod = this.products.find(p => p.id === id);
    if (!prod || !prod.imei_1) return;

    const modalTitle = `Consulta de Blacklist IMEI: ${prod.brand} ${prod.model}`;
    const optionsHtml = `
      <option value="${prod.imei_1}">IMEI 1: ${prod.imei_1}</option>
      ${prod.imei_2 ? `<option value="${prod.imei_2}">IMEI 2: ${prod.imei_2}</option>` : ''}
    `;

    const content = `
      <div id="imei-checker-container" style="padding: 10px 0;">
        <p style="font-size: 14px; margin-bottom: 16px; color: var(--text-secondary);">
          Verifique se o aparelho possui alguma restrição por perda, roubo ou furto cadastrado nos órgãos de segurança pública ou banco de dados global (GSMA).
        </p>

        <div class="form-group" style="margin-bottom: 20px;">
          <label for="imei-select">Selecione o IMEI para consulta</label>
          <div style="display: flex; gap: 8px;">
            <select id="imei-select" style="flex: 1;">
              ${optionsHtml}
            </select>
            <button type="button" class="btn btn-secondary" id="btn-copy-imei" style="padding: 0 16px;">📋 Copiar</button>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;">
          <button type="button" class="btn btn-primary w-100" id="btn-run-check" style="justify-content: center; width: 100%;">
            📡 Consultar Banco de Dados Integrado (GSMA / ANATEL)
          </button>
          
          <button type="button" class="btn btn-secondary w-100" id="btn-anatel-link" style="justify-content: center; width: 100%; display: flex; align-items: center; gap: 6px;">
            🔗 Abrir Consulta Oficial Anatel (Celular Legal) 
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </button>
        </div>

        <div id="imei-check-result" style="border: 1px solid var(--border-color); border-radius: var(--border-radius); padding: 16px; min-height: 80px; display: flex; align-items: center; justify-content: center; background: var(--bg-primary);">
          <div style="text-align: center; color: var(--text-secondary); font-size: 14px;">
            Aguardando início da consulta...
          </div>
        </div>
      </div>
      <div style="display: flex; justify-content: flex-end; margin-top: 24px; border-top: 1px solid var(--border-color); padding-top: 16px;">
        <button class="btn btn-secondary" onclick="window.app.closeModal()">Fechar</button>
      </div>
    `;

    window.app.showModal(modalTitle, content);

    const getSelectedIMEI = () => document.getElementById('imei-select').value;

    document.getElementById('btn-copy-imei').addEventListener('click', () => {
      const imei = getSelectedIMEI();
      navigator.clipboard.writeText(imei);
      window.app.showToast(`IMEI ${imei} copiado para a área de transferência!`, 'success');
    });

    document.getElementById('btn-anatel-link').addEventListener('click', () => {
      const imei = getSelectedIMEI();
      navigator.clipboard.writeText(imei);
      window.app.showToast(`IMEI ${imei} copiado! Redirecionando para Anatel...`, 'info');
      setTimeout(() => {
        window.open('https://www.anatel.gov.br/celularlegal/consulte-sua-situacao', '_blank');
      }, 800);
    });

    document.getElementById('btn-run-check').addEventListener('click', async () => {
      const imei = getSelectedIMEI();
      const resultDiv = document.getElementById('imei-check-result');
      
      if (!document.getElementById('spinner-style')) {
        const style = document.createElement('style');
        style.id = 'spinner-style';
        style.innerHTML = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
        document.head.appendChild(style);
      }

      resultDiv.innerHTML = `
        <div style="text-align: center; width: 100%; padding: 12px 0;">
          <div class="spinner" style="margin: 0 auto 12px auto; width: 30px; height: 30px; border: 3px solid var(--border-color); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">Acessando servidores integrados...</div>
          <div style="font-size: 12px; color: var(--text-secondary);">Consultando base CEM Anatel & GSMA Registry para IMEI: <strong>${imei}</strong></div>
        </div>
      `;

      try {
        const res = await fetch(`/api/imei-check/${imei}`, {
          headers: {
            'Authorization': `Bearer ${window.api.getToken()}`
          }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro na consulta do IMEI');

        if (data.status === 'blocked') {
          resultDiv.innerHTML = `
            <div style="width: 100%;">
              <div style="display: flex; align-items: center; gap: 8px; color: var(--danger); font-weight: 700; font-size: 16px; margin-bottom: 12px;">
                <span>⚠️ APARELHO IMPEDIDO (BLACKLIST)</span>
              </div>
              <p style="font-size: 14px; line-height: 1.5; margin-bottom: 12px; color: var(--text-primary); font-weight: 500;">
                ${data.message}
              </p>
              <table style="width: 100%; font-size: 13px; border-collapse: collapse; margin-top: 8px;">
                <tr style="border-bottom: 1px solid var(--border-color);"><td style="padding: 6px 0; font-weight: 600; color: var(--text-secondary);">Marca / Modelo:</td><td style="padding: 6px 0; text-align: right;">${data.details.brand} ${data.details.model}</td></tr>
                <tr style="border-bottom: 1px solid var(--border-color);"><td style="padding: 6px 0; font-weight: 600; color: var(--text-secondary);">Data do Bloqueio:</td><td style="padding: 6px 0; text-align: right;">${new Date(data.details.block_date).toLocaleDateString('pt-BR')}</td></tr>
                <tr style="border-bottom: 1px solid var(--border-color);"><td style="padding: 6px 0; font-weight: 600; color: var(--text-secondary);">Motivo do Bloqueio:</td><td style="padding: 6px 0; text-align: right; color: var(--danger); font-weight: 600;">${data.details.block_reason}</td></tr>
                <tr style="border-bottom: 1px solid var(--border-color);"><td style="padding: 6px 0; font-weight: 600; color: var(--text-secondary);">Boletim de Ocorrência:</td><td style="padding: 6px 0; text-align: right;">${data.details.police_report}</td></tr>
                <tr style="border-bottom: 1px solid var(--border-color);"><td style="padding: 6px 0; font-weight: 600; color: var(--text-secondary);">Solicitante:</td><td style="padding: 6px 0; text-align: right;">${data.details.requesting_carrier}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: 600; color: var(--text-secondary);">Base de Dados:</td><td style="padding: 6px 0; text-align: right; font-style: italic;">${data.details.blacklist_source}</td></tr>
              </table>
              <div style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid var(--danger); padding: 10px; margin-top: 14px; font-size: 12px; border-radius: 4px; color: var(--text-primary);">
                <strong>Atenção:</strong> Aparelhos com bloqueio de IMEI na blacklist nacional não se conectarão a nenhuma rede celular móvel e sua comercialização pode configurar crime de receptação.
              </div>
            </div>
          `;
        } else {
          resultDiv.innerHTML = `
            <div style="width: 100%;">
              <div style="display: flex; align-items: center; gap: 8px; color: var(--success); font-weight: 700; font-size: 16px; margin-bottom: 12px;">
                <span>✅ APARELHO REGULAR (CLEAN)</span>
              </div>
              <p style="font-size: 14px; line-height: 1.5; margin-bottom: 12px; color: var(--text-primary);">
                ${data.message}
              </p>
              <table style="width: 100%; font-size: 13px; border-collapse: collapse; margin-top: 8px;">
                <tr style="border-bottom: 1px solid var(--border-color);"><td style="padding: 6px 0; font-weight: 600; color: var(--text-secondary);">Identificação Modelos:</td><td style="padding: 6px 0; text-align: right;">${data.details.brand} ${data.details.model}</td></tr>
                <tr style="border-bottom: 1px solid var(--border-color);"><td style="padding: 6px 0; font-weight: 600; color: var(--text-secondary);">Homologação:</td><td style="padding: 6px 0; text-align: right; color: var(--success); font-weight: 600;">${data.details.certification_status} (${data.details.certification_body})</td></tr>
                <tr><td style="padding: 6px 0; font-weight: 600; color: var(--text-secondary);">Fonte de Consulta:</td><td style="padding: 6px 0; text-align: right; font-style: italic;">${data.details.blacklist_source}</td></tr>
              </table>
              <div style="background: rgba(16, 185, 129, 0.1); border-left: 4px solid var(--success); padding: 10px; margin-top: 14px; font-size: 12px; border-radius: 4px; color: var(--text-primary);">
                <strong>Observação:</strong> Este aparelho está apto para comercialização e uso regular nas redes móveis em território nacional e internacional.
              </div>
            </div>
          `;
        }
      } catch (err) {
        resultDiv.innerHTML = `
          <div style="text-align: center; color: var(--danger); font-size: 14px; padding: 12px 0;">
            ❌ Erro ao consultar IMEI: ${err.message}
          </div>
        `;
      }
    });
  },

  showAppleCoverageModal(id) {
    const prod = this.products.find(p => p.id === id);
    if (!prod || !prod.serial_number) return;

    const modalTitle = `Consulta de Garantia Apple: ${prod.brand} ${prod.model}`;
    const serial = prod.serial_number;

    const content = `
      <div id="apple-coverage-container" style="padding: 10px 0;">
        <p style="font-size: 14px; margin-bottom: 16px; color: var(--text-secondary);">
          Consulte o status de ativação, validade da garantia e suporte técnico oficial deste dispositivo Apple.
        </p>

        <div class="form-group" style="margin-bottom: 20px;">
          <label for="apple-serial-input">Número de Série para Consulta</label>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="apple-serial-input" value="${serial}" readonly style="flex: 1; font-family: monospace; font-weight: bold; background: var(--bg-secondary);">
            <button type="button" class="btn btn-secondary" id="btn-copy-serial" style="padding: 0 16px;">📋 Copiar</button>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;">
          <button type="button" class="btn btn-primary w-100" id="btn-run-apple-check" style="justify-content: center; width: 100%; font-weight: 600; display: flex; align-items: center; gap: 8px;">
            🍎 Consultar Garantia e Ativação
          </button>
          
          <button type="button" class="btn btn-secondary w-100" id="btn-apple-link" style="justify-content: center; width: 100%; display: flex; align-items: center; gap: 6px;">
            🔗 Abrir Site Oficial de Cobertura Apple
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </button>
        </div>

        <div id="apple-coverage-result" style="border: 1px solid var(--border-color); border-radius: var(--border-radius); padding: 18px; min-height: 80px; display: flex; align-items: center; justify-content: center; background: var(--bg-primary);">
          <div style="text-align: center; color: var(--text-secondary); font-size: 14px;">
            Aguardando início da consulta...
          </div>
        </div>
      </div>
      <div style="display: flex; justify-content: flex-end; margin-top: 24px; border-top: 1px solid var(--border-color); padding-top: 16px;">
        <button class="btn btn-secondary" onclick="window.app.closeModal()">Fechar</button>
      </div>
    `;

    window.app.showModal(modalTitle, content);

    document.getElementById('btn-copy-serial').addEventListener('click', () => {
      navigator.clipboard.writeText(serial);
      window.app.showToast(`Número de série ${serial} copiado!`, 'success');
    });

    document.getElementById('btn-apple-link').addEventListener('click', () => {
      navigator.clipboard.writeText(serial);
      window.app.showToast(`Número de série ${serial} copiado! Redirecionando para o site de suporte da Apple...`, 'info');
      setTimeout(() => {
        window.open('https://checkcoverage.apple.com/?locale=pt_BR', '_blank');
      }, 800);
    });

    document.getElementById('btn-run-apple-check').addEventListener('click', async () => {
      const resultDiv = document.getElementById('apple-coverage-result');
      
      if (!document.getElementById('spinner-style')) {
        const style = document.createElement('style');
        style.id = 'spinner-style';
        style.innerHTML = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
        document.head.appendChild(style);
      }

      resultDiv.innerHTML = `
        <div style="text-align: center; width: 100%; padding: 12px 0;">
          <div class="spinner" style="margin: 0 auto 12px auto; width: 30px; height: 30px; border: 3px solid var(--border-color); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">Consultando servidores Apple...</div>
          <div style="font-size: 12px; color: var(--text-secondary);">Verificando cobertura de garantia para: <strong>${serial}</strong></div>
        </div>
      `;

      try {
        const res = await fetch(`/api/apple/coverage?serial=${encodeURIComponent(serial)}`, {
          headers: {
            'Authorization': `Bearer ${window.api.getToken()}`
          }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro na consulta de garantia Apple');

        if (!data.valid) {
          resultDiv.innerHTML = `
            <div style="width: 100%;">
              <div style="display: flex; align-items: center; gap: 8px; color: var(--danger); font-weight: 700; font-size: 16px; margin-bottom: 12px;">
                <span>❌ DISPOSITIVO NÃO ELEGÍVEL</span>
              </div>
              <p style="font-size: 14px; line-height: 1.5; color: var(--text-primary);">
                ${data.info}
              </p>
            </div>
          `;
          return;
        }

        const actBadge = data.activated 
          ? \`<span class="badge badge-success" style="font-size: 11px;">Ativado</span>\` 
          : \`<span class="badge badge-warning" style="font-size: 11px;">Não Ativado</span>\`;

        const warBadge = data.warrantyActive 
          ? \`<span class="badge badge-success" style="font-size: 11px;">Ativa</span>\` 
          : \`<span class="badge badge-danger" style="font-size: 11px;">Expirada</span>\`;

        const supBadge = data.supportActive 
          ? \`<span class="badge badge-success" style="font-size: 11px;">Ativo</span>\` 
          : \`<span class="badge badge-danger" style="font-size: 11px;">Expirado</span>\`;

        resultDiv.innerHTML = \`
          <div style="width: 100%;">
            <div style="display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 14px; margin-bottom: 14px;">
              <span style="font-size: 36px;">\${data.image || '📱'}</span>
              <div>
                <h4 style="font-weight: 700; margin: 0; font-size: 16px; color: var(--text-primary);">\${data.brand} \${data.model}</h4>
                <p style="margin: 2px 0 0 0; font-size: 12px; color: var(--text-secondary); font-family: monospace;">S/N: \${data.serial}</p>
                <p style="margin: 2px 0 0 0; font-size: 12px; color: var(--text-secondary);">\${data.color || ''} | \${data.capacity || ''}</p>
              </div>
            </div>

            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 8px 0; font-weight: 600; color: var(--text-secondary);">Status de Ativação:</td>
                <td style="padding: 8px 0; text-align: right;">\${actBadge}</td>
              </tr>
              <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 8px 0; font-weight: 600; color: var(--text-secondary);">Data da Compra:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 500;">\${data.purchaseDate}</td>
              </tr>
              <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 8px 0; font-weight: 600; color: var(--text-secondary);">Suporte Telefônico:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 500;">
                  \${supBadge}
                  <div style="font-size: 10px; color: var(--text-secondary); margin-top: 2px;">Vence em: \${data.supportEndDate}</div>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600; color: var(--text-secondary);">Cobertura de Reparos (Garantia):</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 500;">
                  \${warBadge}
                  <div style="font-size: 10px; color: var(--text-secondary); margin-top: 2px;">Vence em: \${data.warrantyEndDate}</div>
                </td>
              </tr>
            </table>

            <div style="background: rgba(var(--primary-rgb, 59, 130, 246), 0.08); border-left: 4px solid var(--primary); padding: 10px; margin-top: 16px; font-size: 11px; border-radius: 4px; color: var(--text-secondary); line-height: 1.4;">
              💡 <strong>Dica:</strong> Se precisar de cobertura oficial detalhada ou assistência direta, você pode abrir o site oficial de cobertura e colar o número de série pré-copiado.
            </div>
            <div style="font-size: 9px; color: var(--text-secondary); text-align: center; margin-top: 10px; font-style: italic;">
              \${data.info}
            </div>
          </div>
        \`;
      } catch (err) {
        resultDiv.innerHTML = \`
          <div style="text-align: center; color: var(--danger); font-size: 14px; padding: 12px 0;">
            ❌ Erro ao consultar cobertura: \${err.message}
          </div>
        \`;
      }
    });
  },

  showQRModal(id) {
    const prod = this.products.find(p => p.id === id);
    if (!prod) return;

    const qrValue = prod.qr_code || `PROD-#${prod.id}-${prod.brand}-${prod.model}`;
    const modalTitle = `QR Code: ${prod.brand} ${prod.model}`;
    
    const content = `
      <div class="qr-card">
        <canvas id="qr-canvas"></canvas>
        <div style="text-align: center; margin-top: 8px;">
          <h4 style="font-weight: 700;">${prod.brand} ${prod.model}</h4>
          <p style="font-size: 12px; color: #64748b; margin-top: 4px;">Cod: ${qrValue}</p>
        </div>
      </div>
      <div style="display: flex; gap: 12px; justify-content: center; margin-top: 24px;">
        <button class="btn btn-secondary" onclick="window.print()">Imprimir Etiquetas</button>
        <button class="btn btn-primary" onclick="window.app.closeModal()">Fechar</button>
      </div>
    `;
    
    window.app.showModal(modalTitle, content);

    // Draw Simulated Blocky QR Code on Canvas
    const canvas = document.getElementById('qr-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 150;
    canvas.height = 150;

    // Fill white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 150, 150);

    // Draw border block finders
    ctx.fillStyle = '#0f172a';
    
    // Top-Left Finder
    ctx.fillRect(10, 10, 35, 35);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(15, 15, 25, 25);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(20, 20, 15, 15);

    // Top-Right Finder
    ctx.fillRect(105, 10, 35, 35);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(110, 15, 25, 25);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(115, 20, 15, 15);

    // Bottom-Left Finder
    ctx.fillRect(10, 105, 35, 35);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(15, 110, 25, 25);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(20, 115, 15, 15);

    // Generate simulated binary grid representing code data
    ctx.fillStyle = '#0f172a';
    for (let r = 0; r < 20; r++) {
      for (let c = 0; c < 20; c++) {
        // skip finder patterns areas
        if ((r < 7 && c < 7) || (r < 7 && c > 12) || (r > 12 && c < 7)) continue;
        
        // Pseudo-random based on characters to keep code persistent
        const charCode = qrValue.charCodeAt((r + c) % qrValue.length) || 45;
        if ((charCode * (r * 3 + c * 7)) % 2 === 0) {
          ctx.fillRect(10 + c * 6.5, 10 + r * 6.5, 6, 6);
        }
      }
    }
  },

  async deleteProduct(id) {
    if (confirm('Deseja realmente excluir este produto?')) {
      try {
        await window.api.products.delete(id);
        window.app.showToast('Produto excluído do estoque!', 'success');
        this.loadProducts();
      } catch (err) {
        window.app.showToast(err.message, 'danger');
      }
    }
  }
};
