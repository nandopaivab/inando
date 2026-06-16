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
        <div class="form-grid-2">
          <div class="form-group">
            <label for="prod-brand">Marca *</label>
            <input type="text" id="prod-brand" required placeholder="Ex: Apple, Samsung" value="${prod ? prod.brand : ''}">
          </div>
          <div class="form-group">
            <label for="prod-model">Modelo *</label>
            <input type="text" id="prod-model" required placeholder="Ex: iPhone 14 Pro, Galaxy S23" value="${prod ? prod.model : ''}">
          </div>
        </div>

        <div class="form-grid-3">
          <div class="form-group">
            <label for="prod-category">Categoria *</label>
            <select id="prod-category" required>
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
            <input type="text" id="prod-color" placeholder="Ex: Space Black" value="${prod ? prod.color : ''}">
          </div>
        </div>

        <div class="form-grid-3 hardware-specs">
          <div class="form-group">
            <label for="prod-capacity">Capacidade (Armazenamento)</label>
            <input type="text" id="prod-capacity" placeholder="Ex: 128GB, 256GB" value="${prod ? prod.capacity : ''}">
          </div>
          <div class="form-group">
            <label for="prod-ram">Memória RAM</label>
            <input type="text" id="prod-ram" placeholder="Ex: 6GB, 8GB" value="${prod ? prod.ram : ''}">
          </div>
          <div class="form-group">
            <label for="prod-min-stock">Estoque Mínimo (Alerta)</label>
            <input type="number" id="prod-min-stock" min="1" value="${prod ? prod.min_stock_alert : 2}">
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
    categorySelect.addEventListener('change', toggleFields);
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

      const payload = {
        brand: document.getElementById('prod-brand').value,
        model: document.getElementById('prod-model').value,
        category: categorySelect.value,
        state: document.getElementById('prod-state').value,
        color: document.getElementById('prod-color').value,
        capacity: document.getElementById('prod-capacity').value,
        ram: document.getElementById('prod-ram').value,
        min_stock_alert: parseInt(document.getElementById('prod-min-stock').value),
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
