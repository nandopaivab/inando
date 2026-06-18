/* Sales POS & Ledger View */
window.views = window.views || {};

window.views.sales = {
  cart: [],
  availableProducts: [],
  clients: [],
  activeTab: 'pdv', // 'pdv' or 'history'

  async render(container) {
    container.innerHTML = `
      <div style="display: flex; gap: 16px; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
        <button id="tab-pdv" class="btn ${this.activeTab === 'pdv' ? 'btn-primary' : 'btn-secondary'} btn-sm">🛒 Ponto de Venda (PDV)</button>
        <button id="tab-history" class="btn ${this.activeTab === 'history' ? 'btn-primary' : 'btn-secondary'} btn-sm">📜 Histórico de Caixa</button>
      </div>
      <div id="sales-view-content"></div>
    `;

    document.getElementById('tab-pdv').addEventListener('click', () => {
      this.activeTab = 'pdv';
      this.render(container);
    });
    document.getElementById('tab-history').addEventListener('click', () => {
      this.activeTab = 'history';
      this.render(container);
    });

    if (this.activeTab === 'pdv') {
      await this.renderPDV();
    } else {
      await this.renderHistory();
    }
  },

  async renderPDV() {
    const viewport = document.getElementById('sales-view-content');
    
    viewport.innerHTML = `
      <div class="pos-layout">
        <!-- Catalog & Cart -->
        <div class="pos-left" style="display: grid; grid-template-columns: 1.15fr 1fr; gap: 16px; height: 100%; overflow: hidden;">
          <!-- Catalog Column -->
          <div style="display: flex; flex-direction: column; gap: 12px; height: 100%; min-height: 0; overflow: hidden;">
            <div class="pos-search-box" style="padding: 10px; display: flex; flex-direction: column; gap: 6px;">
              <h4 style="font-weight: 700; margin: 0; font-size: 13px; color: var(--text-primary);">Catálogo de Aparelhos</h4>
              <div style="position: relative; display: flex; align-items: center;">
                <span style="position: absolute; left: 8px; color: var(--text-secondary); font-size: 12px;">🔍</span>
                <input type="text" id="catalog-search-input" placeholder="Buscar modelo, IMEI, cor..." style="width: 100%; padding: 6px 8px 6px 26px; font-size: 12px; border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary);">
              </div>
            </div>
            
            <div id="catalog-products-list" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;">
              <!-- Catalog items loaded dynamically -->
            </div>
          </div>

          <!-- Cart Column -->
          <div style="display: flex; flex-direction: column; gap: 12px; height: 100%; min-height: 0; overflow: hidden;">
            <div class="pos-search-box" style="padding: 10px;">
              <h4 style="font-weight: 700; margin-bottom: 6px; font-size: 13px; color: var(--text-primary);">Leitor Código de Barras / IMEI</h4>
              <div class="barcode-simulator" style="margin-top: 0; display: flex; align-items: center; gap: 8px;">
                <input type="text" id="pos-scan-input" placeholder="Digite IMEI/Série e tecle Enter..." style="width: 100%; padding: 6px 8px; font-size: 12px; border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary);">
              </div>
            </div>

            <!-- Cart Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
              <h4 style="font-weight: 700; margin: 0; font-size: 13px; color: var(--text-primary);">Aparelhos no Carrinho</h4>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-clear-cart" style="display: flex; align-items: center; gap: 4px; padding: 4px 10px; font-size: 11px; color: var(--danger); border-color: rgba(239, 68, 68, 0.2); background: transparent; cursor: pointer;">
                🗑️ Limpar
              </button>
            </div>

            <!-- Cart list -->
            <div class="pos-cart-list" id="pos-cart-items" style="flex: 1; overflow-y: auto; background: var(--bg-tertiary);">
              <p class="empty-state" style="font-size: 12px;">Carrinho vazio. Selecione aparelhos no catálogo ou use o scanner.</p>
            </div>
          </div>
        </div>

        <!-- Payment & Checkout -->
        <div class="pos-right">
          <div>
            <h3 style="font-size: 16px; font-weight:700; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-bottom: 16px;">Fechamento de Caixa</h3>
            
            <div class="form-group">
              <label for="pos-client-select">Cliente (CRM) *</label>
              <div style="display: flex; gap: 8px;">
                <select id="pos-client-select" required style="flex: 1;">
                  <option value="">Consumidor Final (Sem cadastro)</option>
                </select>
                <button type="button" class="btn btn-secondary btn-sm" id="btn-pos-add-client" title="Novo Cliente" style="padding: 10px;">➕</button>
              </div>
            </div>

            <div class="form-group">
              <label for="pos-payment">Forma de Pagamento *</label>
              <select id="pos-payment" required>
                <option value="PIX">Pix (Simulação Integrada QR)</option>
                <option value="Dinheiro">Dinheiro Físico</option>
                <option value="Debito">Cartão de Débito</option>
                <option value="Credito">Cartão de Crédito</option>
                <option value="Boleto">Boleto Bancário</option>
                <option value="Transferencia">Doc/Ted Bancário</option>
                <option value="Misto">Misto (Múltiplas Formas)</option>
              </select>
            </div>

            <div class="form-group hidden" id="pos-installments-group">
              <label for="pos-installments">Parcelas (Venda Parcelada)</label>
              <select id="pos-installments">
                <option value="1">1x sem juros</option>
                <option value="2">2x</option>
                <option value="3">3x</option>
                <option value="4">4x</option>
                <option value="5">5x</option>
                <option value="6">6x</option>
                <option value="10">10x</option>
                <option value="12">12x</option>
              </select>
            </div>

            <div class="form-group">
              <label for="pos-discount">Desconto (R$)</label>
              <input type="number" id="pos-discount" min="0" step="0.01" value="0.00">
            </div>

            <div class="form-group" style="margin-top: 16px; display: flex; align-items: center; gap: 8px;">
              <input type="checkbox" id="pos-trade-in-toggle" style="width: auto; margin: 0; cursor: pointer;">
              <label for="pos-trade-in-toggle" style="margin: 0; cursor: pointer; font-weight: 600; font-size: 13px;">Receber aparelho como parte do pagamento</label>
            </div>

            <div id="pos-trade-in-container" class="hidden" style="border: 1px solid var(--border-color); padding: 12px; border-radius: var(--border-radius-md); background: rgba(255, 255, 255, 0.02); margin-top: 12px; margin-bottom: 16px;">
              <h4 style="font-weight: 700; margin-bottom: 12px; font-size: 13px; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">Dados do Aparelho de Troca</h4>
              
              <div class="form-grid-2">
                <div class="form-group">
                  <label for="trade-brand">Marca *</label>
                  <input type="text" id="trade-brand" placeholder="Ex: Apple" value="Apple">
                </div>
                <div class="form-group">
                  <label for="trade-model">Modelo *</label>
                  <input type="text" id="trade-model" placeholder="Ex: iPhone 13 Pro">
                </div>
              </div>

              <div class="form-grid-2">
                <div class="form-group">
                  <label for="trade-color">Cor</label>
                  <input type="text" id="trade-color" placeholder="Ex: Azul Sierra">
                </div>
                <div class="form-group">
                  <label for="trade-capacity">Capacidade</label>
                  <input type="text" id="trade-capacity" placeholder="Ex: 128 GB">
                </div>
              </div>

              <div class="form-grid-2">
                <div class="form-group">
                  <label for="trade-ram">RAM</label>
                  <input type="text" id="trade-ram" placeholder="Ex: 6 GB">
                </div>
                <div class="form-group">
                  <label for="trade-state">Estado *</label>
                  <select id="trade-state">
                    <option value="novo">Novo</option>
                    <option value="seminovo">Seminovo</option>
                    <option value="usado" selected>Usado</option>
                    <option value="recondicionado">Recondicionado</option>
                  </select>
                </div>
              </div>

              <div class="form-grid-2">
                <div class="form-group">
                  <label for="trade-imei1">IMEI 1</label>
                  <input type="text" id="trade-imei1" placeholder="Ex: 35...">
                </div>
                <div class="form-group">
                  <label for="trade-imei2">IMEI 2</label>
                  <input type="text" id="trade-imei2" placeholder="Ex: 35...">
                </div>
              </div>

              <div class="form-grid-2">
                <div class="form-group">
                  <label for="trade-serial">Nº de Série</label>
                  <input type="text" id="trade-serial" placeholder="Ex: DX...">
                </div>
                <div class="form-group">
                  <label for="trade-valuation">Valor Avaliado *</label>
                  <input type="number" id="trade-valuation" min="0" step="0.01" value="0.00">
                </div>
              </div>
            </div>
          </div>

          <div>
            <div class="pos-summary">
              <div class="summary-row">
                <span>Subtotal</span>
                <span id="summary-subtotal">R$ 0,00</span>
              </div>
              <div class="summary-row">
                <span>Desconto</span>
                <span id="summary-discount" class="text-danger">R$ 0,00</span>
              </div>
              <div class="summary-row" id="summary-sale-total-row">
                <span>Total da Venda</span>
                <span id="summary-sale-total">R$ 0,00</span>
              </div>
              <div class="summary-row hidden" id="summary-trade-in-row">
                <span>Abatimento Troca</span>
                <span id="summary-trade-in" class="text-success">R$ 0,00</span>
              </div>
              <div class="summary-row total">
                <span id="summary-total-label">Total Final</span>
                <span id="summary-total">R$ 0,00</span>
              </div>
            </div>

            <button id="btn-checkout" class="btn btn-primary btn-block" style="margin-top: 16px; padding: 14px; font-weight:700; font-size:16px;">
              ⚡ Concluir Venda (F2)
            </button>
          </div>
        </div>
      </div>
    `;

    // Fetch lists
    try {
      this.availableProducts = await window.api.products.list({ status: 'disponivel' });
      this.clients = await window.api.clients.list();
      
      // Manual select removed

      // Populate Client select
      const clientSelect = document.getElementById('pos-client-select');
      clientSelect.innerHTML = `<option value="">Consumidor Final (Sem cadastro)</option>` + 
        this.clients.map(c => `<option value="${c.id}">${c.name} (${c.document || 'Sem doc'})</option>`).join('');

      this.renderCatalog();
    } catch (e) {
      window.app.showToast('Erro ao carregar dados do PDV', 'danger');
    }

    // Toggle installments dropdown based on payment choice
    const paymentSelect = document.getElementById('pos-payment');
    const installmentsGroup = document.getElementById('pos-installments-group');
    paymentSelect.addEventListener('change', () => {
      if (['Credito', 'Boleto'].includes(paymentSelect.value)) {
        installmentsGroup.classList.remove('hidden');
      } else {
        installmentsGroup.classList.add('hidden');
        document.getElementById('pos-installments').value = '1';
      }
    });

    // Scanner logic simulator
    const scanInput = document.getElementById('pos-scan-input');
    scanInput.focus();
    scanInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        const val = scanInput.value.trim();
        if (!val) return;
        
        // Find in available products
        const p = this.availableProducts.find(prod => 
          (prod.imei_1 && prod.imei_1 === val) || 
          (prod.imei_2 && prod.imei_2 === val) || 
          (prod.serial_number && prod.serial_number.toLowerCase() === val.toLowerCase()) ||
          (prod.qr_code && prod.qr_code.toLowerCase() === val.toLowerCase())
        );

        if (p) {
          this.addToCart(p);
          scanInput.value = '';
          window.app.showToast(`Adicionado: ${p.brand} ${p.model}`, 'success');
        } else {
          window.app.showToast('Identificador não localizado no estoque disponível.', 'warning');
        }
      }
    });

    // Manual select listener removed

    // Discount watcher
    const discInput = document.getElementById('pos-discount');
    discInput.addEventListener('input', () => this.updateTotals());

    // Catalog search input watcher
    const catalogSearchInput = document.getElementById('catalog-search-input');
    if (catalogSearchInput) {
      catalogSearchInput.addEventListener('input', () => this.renderCatalog());
    }

    // Trade-in watchers
    const tradeInToggle = document.getElementById('pos-trade-in-toggle');
    const tradeInContainer = document.getElementById('pos-trade-in-container');
    const tradeValuationInput = document.getElementById('trade-valuation');

    tradeInToggle.addEventListener('change', () => {
      if (tradeInToggle.checked) {
        tradeInContainer.classList.remove('hidden');
      } else {
        tradeInContainer.classList.add('hidden');
      }
      this.updateTotals();
    });

    tradeValuationInput.addEventListener('input', () => {
      this.updateTotals();
    });

    // CRM Quick button
    document.getElementById('btn-pos-add-client').addEventListener('click', () => {
      // Trigger CRM modal
      window.views.clients.showClientModal();
      // On close, refresh clients select list
      const closeChecker = setInterval(async () => {
        if (!document.getElementById('modal-container').classList.contains('hidden')) return;
        clearInterval(closeChecker);
        // reload clients list
        this.clients = await window.api.clients.list();
        clientSelect.innerHTML = `<option value="">Consumidor Final (Sem cadastro)</option>` + 
          this.clients.map(c => `<option value="${c.id}">${c.name} (${c.document || 'Sem doc'})</option>`).join('');
      }, 500);
    });

    // Clear cart listener
    document.getElementById('btn-clear-cart').addEventListener('click', () => this.clearCart());

    // Checkout execution
    document.getElementById('btn-checkout').addEventListener('click', () => this.checkout());

    // Global Key Listener for POS F2 checkout
    const keyHandler = (e) => {
      if (e.key === 'F2' && this.activeTab === 'pdv') {
        e.preventDefault();
        this.checkout();
      }
    };
    window.removeEventListener('keydown', keyHandler);
    window.addEventListener('keydown', keyHandler);

    this.updateTotals();
  },

  addToCart(product) {
    // Check if product is already in cart
    if (this.cart.some(item => Number(item.id) === Number(product.id))) {
      window.app.showToast('Aparelho ja inserido no carrinho', 'warning');
      return;
    }
    this.cart.push(product);
    this.renderCart();
    this.renderCatalog();
    this.updateTotals();
  },

  removeFromCart(id) {
    this.cart = this.cart.filter(item => Number(item.id) !== Number(id));
    this.renderCart();
    this.renderCatalog();
    this.updateTotals();
  },

  clearCart() {
    if (this.cart.length === 0) {
      window.app.showToast('O carrinho já está vazio!', 'warning');
      return;
    }
    if (confirm('Deseja realmente limpar todos os itens do carrinho?')) {
      this.cart = [];
      this.renderCart();
      this.renderCatalog();
      this.updateTotals();
      document.getElementById('pos-discount').value = '0.00';
      window.app.showToast('Carrinho limpo com sucesso!', 'success');
    }
  },

  renderCatalog() {
    const container = document.getElementById('catalog-products-list');
    if (!container) return;

    const query = (document.getElementById('catalog-search-input')?.value || '').toLowerCase().trim();

    // Filter available products
    const filtered = this.availableProducts.filter(p => {
      const brand = (p.brand || '').toLowerCase();
      const model = (p.model || '').toLowerCase();
      const color = (p.color || '').toLowerCase();
      const capacity = (p.capacity || '').toLowerCase();
      const imei1 = (p.imei_1 || '').toLowerCase();
      const imei2 = (p.imei_2 || '').toLowerCase();
      const serial = (p.serial_number || '').toLowerCase();
      
      return brand.includes(query) ||
             model.includes(query) ||
             color.includes(query) ||
             capacity.includes(query) ||
             imei1.includes(query) ||
             imei2.includes(query) ||
             serial.includes(query);
    });

    if (filtered.length === 0) {
      container.innerHTML = `<p class="empty-state" style="text-align: center; margin-top: 20px; font-size: 11px; color: var(--text-muted);">Nenhum aparelho encontrado.</p>`;
      return;
    }

    container.innerHTML = filtered.map(p => {
      const inCart = this.cart.some(item => Number(item.id) === Number(p.id));
      
      return `
        <div class="catalog-item" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-sm);
          padding: 8px 10px;
          transition: var(--transition-fast);
        ">
          <div class="catalog-item-info" style="display: flex; flex-direction: column; gap: 2px; text-align: left;">
            <h4 style="font-size: 12px; font-weight: 600; color: var(--text-primary); margin: 0;">${p.brand} ${p.model}</h4>
            <p style="font-size: 10px; color: var(--text-secondary); margin: 0;">
              ${p.color} | ${p.capacity}
            </p>
            <p style="font-size: 9px; color: var(--text-muted); margin: 0;">
              IMEI/Série: ${p.imei_1 || p.serial_number || 'N/A'}
            </p>
            <span style="font-size: 11px; font-weight: 700; color: var(--primary); margin-top: 2px;">
              R$ ${(p.selling_price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div class="catalog-item-action">
            ${inCart ? `
              <button class="btn btn-secondary btn-sm" disabled style="
                font-size: 10px;
                padding: 4px 8px;
                background: rgba(16, 185, 129, 0.1);
                color: var(--success);
                border-color: rgba(16, 185, 129, 0.2);
                cursor: not-allowed;
              ">✓ No Carrinho</button>
            ` : `
              <button class="btn btn-primary btn-sm" onclick="window.views.sales.addCatalogItemToCart(${p.id})" style="
                font-size: 10px;
                padding: 4px 8px;
              ">➕ Adicionar</button>
            `}
          </div>
        </div>
      `;
    }).join('');
  },

  addCatalogItemToCart(id) {
    const product = this.availableProducts.find(p => Number(p.id) === Number(id));
    if (product) {
      this.addToCart(product);
    }
  },

  renderCart() {
    const container = document.getElementById('pos-cart-items');
    if (this.cart.length === 0) {
      container.innerHTML = `<p class="empty-state" style="font-size: 12px;">Carrinho vazio. Selecione aparelhos no catálogo ou use o scanner.</p>`;
      return;
    }

    container.innerHTML = this.cart.map(p => `
      <div class="cart-item">
        <div class="cart-item-info">
          <h4>${p.brand} ${p.model}</h4>
          <p class="text-muted"><small>${p.color} | ${p.capacity} | imei: ${p.imei_1 || p.serial_number || 'Sem IMEI'}</small></p>
        </div>
        <div class="cart-item-price">
          <span>R$ ${p.selling_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          <button class="btn btn-icon text-danger" onclick="window.views.sales.removeFromCart(${p.id})">❌</button>
        </div>
      </div>
    `).join('');
  },

  updateTotals() {
    const subtotal = this.cart.reduce((sum, item) => sum + item.selling_price, 0);
    const disc = parseFloat(document.getElementById('pos-discount').value) || 0;
    const saleTotal = Math.max(0, subtotal - disc);

    document.getElementById('summary-subtotal').textContent = `R$ ${subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    document.getElementById('summary-discount').textContent = `- R$ ${disc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    document.getElementById('summary-sale-total').textContent = `R$ ${saleTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    const tradeInToggle = document.getElementById('pos-trade-in-toggle');
    const isTradeIn = tradeInToggle && tradeInToggle.checked;
    const tradeInValInput = document.getElementById('trade-valuation');
    const tradeInVal = isTradeIn && tradeInValInput ? parseFloat(tradeInValInput.value) || 0 : 0;

    const tradeInRow = document.getElementById('summary-trade-in-row');
    const saleTotalRow = document.getElementById('summary-sale-total-row');
    const totalLabel = document.getElementById('summary-total-label');
    const totalSpan = document.getElementById('summary-total');

    if (isTradeIn) {
      if (tradeInRow) tradeInRow.classList.remove('hidden');
      if (saleTotalRow) saleTotalRow.classList.remove('hidden');
      const tradeInTextSpan = document.getElementById('summary-trade-in');
      if (tradeInTextSpan) tradeInTextSpan.textContent = `- R$ ${tradeInVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      if (totalLabel) totalLabel.textContent = 'Diferença a Pagar';
      const difference = Math.max(0, saleTotal - tradeInVal);
      if (totalSpan) totalSpan.textContent = `R$ ${difference.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    } else {
      if (tradeInRow) tradeInRow.classList.add('hidden');
      if (saleTotalRow) saleTotalRow.classList.add('hidden');
      if (totalLabel) totalLabel.textContent = 'Total Final';
      if (totalSpan) totalSpan.textContent = `R$ ${saleTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    }
  },

  async checkout() {
    try {
      if (this.cart.length === 0) {
        window.app.showToast('Carrinho de compras vazio.', 'warning');
        return;
      }

      const clientIdVal = document.getElementById('pos-client-select').value;
      const payMethod = document.getElementById('pos-payment').value;
      const disc = parseFloat(document.getElementById('pos-discount').value) || 0;
      const inst = parseInt(document.getElementById('pos-installments').value) || 1;

      const payload = {
        client_id: clientIdVal ? parseInt(clientIdVal) : null,
        product_ids: this.cart.map(p => p.id),
        discount: disc,
        payment_method: payMethod,
        installments: inst
      };

      const tradeInToggle = document.getElementById('pos-trade-in-toggle');
      if (tradeInToggle && tradeInToggle.checked) {
        const brand = document.getElementById('trade-brand').value.trim();
        const model = document.getElementById('trade-model').value.trim();
        const valuation = parseFloat(document.getElementById('trade-valuation').value) || 0;
        
        if (!brand) {
          window.app.showToast('Por favor, informe a marca do aparelho de troca.', 'warning');
          return;
        }
        if (!model) {
          window.app.showToast('Por favor, informe o modelo do aparelho de troca.', 'warning');
          return;
        }
        if (valuation <= 0) {
          window.app.showToast('Por favor, informe um valor de avaliação maior que zero.', 'warning');
          return;
        }

        payload.trade_in = {
          brand,
          model,
          color: document.getElementById('trade-color').value.trim() || 'Preto',
          capacity: document.getElementById('trade-capacity').value.trim() || '128 GB',
          ram: document.getElementById('trade-ram').value.trim() || '8 GB',
          state: document.getElementById('trade-state').value,
          imei_1: document.getElementById('trade-imei1').value.trim() || null,
          imei_2: document.getElementById('trade-imei2').value.trim() || null,
          serial_number: document.getElementById('trade-serial').value.trim() || null,
          valuation_value: valuation
        };
      }

      // If Pix, show simulated Pix QR Code checkout modal first
      if (payMethod === 'PIX') {
        this.showPixModal(payload);
      } else if (payMethod === 'Misto') {
        this.showMixedPaymentModal(payload);
      } else {
        this.executeCheckout(payload);
      }
    } catch (err) {
      console.error("Checkout error:", err);
      window.app.showToast(`Erro ao iniciar checkout: ${err.message}`, 'danger');
    }
  },

  showMixedPaymentModal(payload) {
    const subtotal = this.cart.reduce((sum, item) => sum + item.selling_price, 0);
    const tradeInVal = payload.trade_in ? parseFloat(payload.trade_in.valuation_value || 0) : 0;
    const total = Math.max(0, subtotal - payload.discount - tradeInVal);

    const content = `
      <form id="mixed-pay-form">
        <p style="margin-bottom: 16px; text-align: center;">Preencha os valores para cada meio de pagamento. O total deve somar exatamente <strong>R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>.</p>
        
        ${payload.trade_in ? `
        <div style="margin-bottom: 16px; padding: 10px; border-radius: 6px; background: rgba(22, 163, 74, 0.1); border: 1px solid rgba(22, 163, 74, 0.2); font-size: 12px; text-align: center;">
          <strong>🔄 Aparelho na Troca Recebido:</strong> ${payload.trade_in.brand} ${payload.trade_in.model} (${payload.trade_in.capacity})<br>
          <span style="color: var(--success); font-weight: bold;">Abatimento: - R$ ${payload.trade_in.valuation_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
        ` : ''}
        
        <div class="form-grid-2">
          <div class="form-group">
            <label>Dinheiro Físico (R$)</label>
            <input type="number" id="mix-cash" step="0.01" min="0" value="0.00">
          </div>
          <div class="form-group">
            <label>Pix (R$)</label>
            <input type="number" id="mix-pix" step="0.01" min="0" value="0.00">
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label>Cartão de Débito (R$)</label>
            <input type="number" id="mix-deb" step="0.01" min="0" value="0.00">
          </div>
          <div class="form-group">
            <label>Cartão de Crédito (R$)</label>
            <input type="number" id="mix-cred" step="0.01" min="0" value="0.00">
          </div>
        </div>

        <div style="margin-top: 16px; font-size: 14px; text-align: center; border-top: 1px solid var(--border-color); padding-top: 16px;">
          <div>Restante: <span id="mix-remaining" style="font-weight: 700; color: var(--danger);">R$ ${total.toFixed(2)}</span></div>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
          <button type="button" class="btn btn-secondary" onclick="window.app.closeModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary" id="btn-confirm-mix" disabled>Confirmar Venda Mista</button>
        </div>
      </form>
    `;

    window.app.showModal('Pagamento Múltiplo (Misto)', content);

    const inputs = ['mix-cash', 'mix-pix', 'mix-deb', 'mix-cred'];
    const confirmBtn = document.getElementById('btn-confirm-mix');
    const remainingSpan = document.getElementById('mix-remaining');

    const recalculateMixed = () => {
      let currentSum = 0;
      inputs.forEach(id => {
        currentSum += parseFloat(document.getElementById(id).value) || 0;
      });
      const diff = total - currentSum;
      if (Math.abs(diff) < 0.01) {
        remainingSpan.textContent = 'R$ 0,00 (Valor Completo ✓)';
        remainingSpan.style.color = 'var(--success)';
        confirmBtn.disabled = false;
      } else {
        remainingSpan.textContent = `R$ ${diff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        remainingSpan.style.color = diff > 0 ? 'var(--warning)' : 'var(--danger)';
        confirmBtn.disabled = true;
      }
    };

    inputs.forEach(id => {
      document.getElementById(id).addEventListener('input', recalculateMixed);
    });

    document.getElementById('mixed-pay-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const cashVal = parseFloat(document.getElementById('mix-cash').value) || 0;
      const pixVal = parseFloat(document.getElementById('mix-pix').value) || 0;
      const debVal = parseFloat(document.getElementById('mix-deb').value) || 0;
      const credVal = parseFloat(document.getElementById('mix-cred').value) || 0;

      const methodsArray = [];
      if (cashVal > 0) methodsArray.push(`Dinheiro: R$${cashVal.toFixed(2)}`);
      if (pixVal > 0) methodsArray.push(`Pix: R$${pixVal.toFixed(2)}`);
      if (debVal > 0) methodsArray.push(`Débito: R$${debVal.toFixed(2)}`);
      if (credVal > 0) methodsArray.push(`Crédito: R$${credVal.toFixed(2)}`);

      payload.payment_method = 'Misto';
      payload.mixed_payments = {
        dinheiro: cashVal,
        pix: pixVal,
        debito: debVal,
        credito: credVal
      };

      window.app.closeModal();
      this.executeCheckout(payload);
    });
  },

  showPixModal(payload) {
    const subtotal = this.cart.reduce((sum, item) => sum + item.selling_price, 0);
    const tradeInVal = payload.trade_in ? parseFloat(payload.trade_in.valuation_value || 0) : 0;
    const total = Math.max(0, subtotal - payload.discount - tradeInVal);

    const content = `
      <div style="text-align: center;">
        <p style="margin-bottom: 16px;">Escaneie o QR Code abaixo para confirmar o recebimento via Pix.</p>
        <div class="qr-card">
          <!-- simulated Pix QR Code on canvas -->
          <canvas id="pix-qr-canvas"></canvas>
          <div style="text-align: center; margin-top: 8px;">
            <h4 style="font-weight:700;">Recebimento iNando Store</h4>
            <p class="text-success font-semibold" style="font-size: 16px; margin-top: 4px;">R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            ${payload.trade_in ? `
            <div style="margin-top: 8px; font-size: 11px; color: var(--text-secondary); border-top: 1px solid var(--border-color); padding-top: 6px;">
              <strong>🔄 Aparelho na Troca:</strong><br>
              ${payload.trade_in.brand} ${payload.trade_in.model} (-R$ ${payload.trade_in.valuation_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
            </div>
            ` : ''}
          </div>
        </div>
        
        <div class="auth-footer-info" style="margin-top: 16px; text-align: left;">
          <strong>Integração Mercado Pago / Stripe:</strong>
          <p>Esta simulação gera uma transação fictícia. Em produção, este QR Code é gerado via API e o sistema aguarda a notificação Webhook de confirmação.</p>
        </div>

        <div style="display: flex; gap: 12px; justify-content: center; margin-top: 24px;">
          <button class="btn btn-secondary" onclick="window.app.closeModal()">Cancelar Venda</button>
          <button class="btn btn-success" id="btn-confirm-pix-pay">✅ Confirmar Pagamento Pix</button>
        </div>
      </div>
    `;

    window.app.showModal('Pagamento Pix Integrado', content);

    // Draw Simulated Pix code
    const canvas = document.getElementById('pix-qr-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 140;
    canvas.height = 140;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 140, 140);
    ctx.fillStyle = '#06b6d4'; // Pix Teal Theme
    
    // Draw visual QR squares
    ctx.fillRect(10, 10, 30, 30);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(14, 14, 22, 22);
    ctx.fillStyle = '#06b6d4'; ctx.fillRect(18, 18, 14, 14);

    ctx.fillRect(100, 10, 30, 30);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(104, 14, 22, 22);
    ctx.fillStyle = '#06b6d4'; ctx.fillRect(108, 18, 14, 14);

    ctx.fillRect(10, 100, 30, 30);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(14, 104, 22, 22);
    ctx.fillStyle = '#06b6d4'; ctx.fillRect(18, 108, 14, 14);

    // dots
    ctx.fillStyle = '#06b6d4';
    for (let r = 0; r < 20; r++) {
      for (let c = 0; c < 20; c++) {
        if ((r < 6 && c < 6) || (r < 6 && c > 13) || (r > 13 && c < 6)) continue;
        if ((r + c * 3) % 2 === 0) {
          ctx.fillRect(10 + c * 6, 10 + r * 6, 5, 5);
        }
      }
    }

    document.getElementById('btn-confirm-pix-pay').addEventListener('click', () => {
      window.app.closeModal();
      this.executeCheckout(payload);
    });
  },

  async executeCheckout(payload) {
    try {
      const res = await window.api.sales.create(payload);
      window.app.showToast('Venda concluída com sucesso!', 'success');
      
      // Clean Cart
      this.cart = [];
      this.renderCart();
      
      // Reset trade-in fields
      const tradeInToggle = document.getElementById('pos-trade-in-toggle');
      if (tradeInToggle) {
        tradeInToggle.checked = false;
        const tradeInContainer = document.getElementById('pos-trade-in-container');
        if (tradeInContainer) tradeInContainer.classList.add('hidden');
        
        // Reset form inputs
        document.getElementById('trade-brand').value = 'Apple';
        document.getElementById('trade-model').value = '';
        document.getElementById('trade-color').value = '';
        document.getElementById('trade-capacity').value = '';
        document.getElementById('trade-ram').value = '';
        document.getElementById('trade-state').value = 'usado';
        document.getElementById('trade-imei1').value = '';
        document.getElementById('trade-imei2').value = '';
        document.getElementById('trade-serial').value = '';
        document.getElementById('trade-valuation').value = '0.00';
      }

      this.updateTotals();
      document.getElementById('pos-discount').value = '0.00';

      // Reload available products
      this.availableProducts = await window.api.products.list({ status: 'disponivel' });
      this.renderCatalog();

      // Open Thermal Receipt modal
      this.showReceiptModal(res.sale_id);

    } catch (err) {
      window.app.showToast(err.message, 'danger');
    }
  },

  async showReceiptModal(saleId) {
    try {
      const details = await window.api.sales.getReceipt(saleId);
      const sale = details.sale;
      const items = details.items;

      const dateStr = new Date(sale.sale_date).toLocaleString('pt-BR');

      const modalTitle = `Cupom de Venda #${sale.id}`;
      
      const content = `
        <div style="max-width: 400px; margin: 0 auto; background: var(--bg-primary); border: 1px solid var(--border-color); padding: 20px; border-radius: var(--border-radius-md);">
          <div style="text-align: center; border-bottom: 1px dashed var(--border-color); padding-bottom: 12px; margin-bottom: 12px;">
            <h3 style="font-weight:800; font-size:16px;">iNando Store ERP</h3>
            <p style="font-size:11px; color: var(--text-secondary); margin-top:4px;">Av. Paulista, 1000 - São Paulo/SP</p>
            <p style="font-size:11px; color: var(--text-secondary);">CNPJ: 45.123.789/0001-90</p>
          </div>

          <div style="font-size: 12px; margin-bottom: 12px; line-height: 1.6;">
            <p><strong>CUPOM DE VENDA:</strong> #${sale.id}</p>
            <p><strong>DATA/HORA:</strong> ${dateStr}</p>
            <p><strong>VENDEDOR:</strong> ${sale.seller_name}</p>
            <p><strong>CLIENTE:</strong> ${sale.client_name || 'Consumidor Final'}</p>
            ${sale.client_doc ? `<p><strong>CPF/CNPJ:</strong> ${sale.client_doc}</p>` : ''}
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 12px;">
            <thead>
              <tr style="border-bottom: 1px dashed var(--border-color); border-top: 1px dashed var(--border-color);">
                <th style="padding: 6px 0; text-align: left; color: var(--text-secondary);">Item</th>
                <th style="padding: 6px 0; text-align: right; color: var(--text-secondary);">Valor</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                  <td style="padding: 6px 0;">
                    <strong>${item.brand}</strong> ${item.model}<br>
                    <small style="color:var(--text-secondary); font-size:10px;">${item.imei_1 || item.serial_number || 'Sem IMEI'}</small>
                  </td>
                  <td style="padding: 6px 0; text-align: right;">R$ ${item.selling_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="font-size: 13px; line-height: 1.6; border-top: 1px dashed var(--border-color); padding-top: 8px;">
            <div style="display:flex; justify-content:space-between;">
              <span>Subtotal:</span>
              <span>R$ ${sale.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div style="display:flex; justify-content:space-between; color: var(--danger);">
              <span>Desconto:</span>
              <span>- R$ ${sale.discount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            ${details.trade_in ? `
            <div style="display:flex; justify-content:space-between; color: var(--success);">
              <span>Abatimento Troca:</span>
              <span>- R$ ${details.trade_in.purchase_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            ` : ''}
            <div style="display:flex; justify-content:space-between; font-weight:800; font-size:15px; border-top: 1px solid var(--border-color); padding-top: 6px; margin-top: 4px;">
              <span>${details.trade_in ? 'DIFERENÇA PAGA:' : 'TOTAL FINAL:'}</span>
              <span class="text-success">R$ ${(sale.total - (details.trade_in ? details.trade_in.purchase_price : 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div style="margin-top: 6px; font-size:11px; color: var(--text-secondary);">
              Forma de pagamento: <strong>${sale.payment_method}</strong> ${sale.installments > 1 ? `(${sale.installments}x)` : ''}
            </div>
            ${details.trade_in ? `
            <div style="display:flex; flex-direction:column; border-top: 1px dashed var(--border-color); padding-top: 8px; margin-top: 8px; font-size: 11px; color: var(--text-secondary);">
              <strong>Aparelho Recebido (Troca):</strong>
              <div>${details.trade_in.brand} ${details.trade_in.model} (${details.trade_in.capacity || ''})</div>
              <div>IMEI/Serial: ${details.trade_in.imei_1 || details.trade_in.serial_number || 'N/A'}</div>
            </div>
            ` : ''}
          </div>
        </div>

        <div style="display: flex; gap: 12px; justify-content: center; margin-top: 24px;">
          <button class="btn btn-secondary" onclick="window.views.sales.printThermalReceipt(${sale.id})">🖨️ Imprimir Térmica</button>
          <button class="btn btn-ghost" onclick="window.views.sales.shareReceiptWhatsApp(${sale.id})">🟢 Compartilhar WhatsApp</button>
          <button class="btn btn-primary" onclick="window.app.closeModal()">Fechar</button>
        </div>
      `;

      window.app.showModal(modalTitle, content);

    } catch (e) {
      window.app.showToast('Erro ao renderizar comprovante', 'danger');
    }
  },

  printThermalReceipt(saleId) {
    window.api.sales.getReceipt(saleId).then(res => {
      const sale = res.sale;
      const items = res.items;
      const tradeIn = res.trade_in;

      const thermalArea = document.getElementById('thermal-receipt');
      thermalArea.innerHTML = `
        <div class="receipt-header">
          <h2>iNando Store ERP</h2>
          <p>Av. Paulista, 1000 - São Paulo/SP</p>
          <p>CNPJ: 45.123.789/0001-90</p>
          <p>Tel: (11) 99999-8888</p>
        </div>
        <p><strong>CUPOM VENDA:</strong> #${sale.id}</p>
        <p><strong>DATA:</strong> ${new Date(sale.sale_date).toLocaleString('pt-BR')}</p>
        <p><strong>VENDEDOR:</strong> ${sale.seller_name}</p>
        <p><strong>CLIENTE:</strong> ${sale.client_name || 'Consumidor Final'}</p>
        ${sale.client_doc ? `<p><strong>CPF:</strong> ${sale.client_doc}</p>` : ''}
        
        <div class="receipt-divider"></div>
        
        <table class="receipt-items-table">
          <thead>
            <tr>
              <th align="left">Item</th>
              <th align="right">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td>
                  ${item.brand} ${item.model}<br>
                  <small>${item.imei_1 || item.serial_number || 'Sem IMEI'}</small>
                </td>
                <td align="right">R$ ${item.selling_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="receipt-divider"></div>
        
        <div class="receipt-row">
          <span>Subtotal:</span>
          <span>R$ ${sale.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
        <div class="receipt-row">
          <span>Desconto:</span>
          <span>- R$ ${sale.discount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
        ${tradeIn ? `
        <div class="receipt-row" style="color: green;">
          <span>Abatimento Troca:</span>
          <span>- R$ ${tradeIn.purchase_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
        <div style="font-size: 9px; color: #555; padding-left: 10px; margin-bottom: 4px;">
          Troca: ${tradeIn.brand} ${tradeIn.model} (${tradeIn.capacity || ''}) - IMEI/Serial: ${tradeIn.imei_1 || tradeIn.serial_number || 'N/A'}
        </div>
        ` : ''}
        <div class="receipt-row" style="font-weight:bold;">
          <span>${tradeIn ? 'DIFERENÇA PAGA:' : 'TOTAL FINAL:'}</span>
          <span>R$ ${(sale.total - (tradeIn ? tradeIn.purchase_price : 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
        <p style="margin-top: 4px; font-size:10px;">Pagamento: ${sale.payment_method} ${sale.installments > 1 ? `(${sale.installments}x)` : ''}</p>
        
        <div class="receipt-footer">
          <p>Obrigado pela preferência!</p>
          <p>iNando Store - Eletrônicos Premium</p>
        </div>
      `;

      // Trigger Print
      window.print();
    });
  },

  shareReceiptWhatsApp(saleId) {
    window.api.sales.getReceipt(saleId).then(res => {
      const sale = res.sale;
      const items = res.items;
      const tradeIn = res.trade_in;
      
      let msg = `*iNando Store - Comprovante de Compra*\n`;
      msg += `Cupom: #${sale.id}\n`;
      msg += `Data: ${new Date(sale.sale_date).toLocaleString('pt-BR')}\n`;
      msg += `-----------------------------\n`;
      items.forEach(item => {
        msg += `*${item.brand} ${item.model}*\n`;
        msg += `Identificador: ${item.imei_1 || item.serial_number || 'Sem IMEI'}\n`;
        msg += `Valor: R$ ${item.selling_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      });
      if (tradeIn) {
        msg += `-----------------------------\n`;
        msg += `*Aparelho Recebido (Troca)*\n`;
        msg += `${tradeIn.brand} ${tradeIn.model} (${tradeIn.capacity || ''})\n`;
        msg += `Identificador: ${tradeIn.imei_1 || tradeIn.serial_number || 'N/A'}\n`;
        msg += `Valor Avaliado: R$ ${tradeIn.purchase_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      }
      msg += `-----------------------------\n`;
      msg += `Subtotal: R$ ${sale.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      msg += `Desconto: R$ ${sale.discount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      if (tradeIn) {
        msg += `Abatimento Troca: R$ ${tradeIn.purchase_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      }
      const finalDiff = sale.total - (tradeIn ? tradeIn.purchase_price : 0);
      msg += `*${tradeIn ? 'Diferença Paga' : 'Total Final'}: R$ ${finalDiff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\n`;
      msg += `Forma de pagamento: ${sale.payment_method}\n`;
      msg += `Obrigado pela preferência!`;

      const encoded = encodeURIComponent(msg);
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${sale.client_phone ? sale.client_phone.replace(/[^0-9]/g, '') : ''}&text=${encoded}`;
      
      // Open in window
      window.open(whatsappUrl, '_blank');
      window.app.showToast('Link do WhatsApp gerado com sucesso!', 'success');
    });
  },

  // Sales Ledger / History
  async renderHistory() {
    const viewport = document.getElementById('sales-view-content');
    const user = window.app.currentUser;
    const isAdmin = user && user.role === 'admin';

    viewport.innerHTML = `
      <div class="table-responsive">
        <table id="sales-history-table">
          <thead>
            <tr>
              <th>Cód Venda</th>
              <th>Data/Hora</th>
              <th>Cliente</th>
              <th>Vendedor</th>
              <th>Faturamento Bruto</th>
              <th>Desconto</th>
              <th>Total Líquido</th>
              <th>Forma Pagto</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="10" class="empty-state">Buscando histórico...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    try {
      const data = await window.api.sales.list();
      const tbody = document.querySelector('#sales-history-table tbody');
      if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="empty-state">Nenhuma venda realizada.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.map(s => {
        let statusBadge = '';
        if (s.status === 'concluida') statusBadge = `<span class="badge badge-success">Concluída</span>`;
        else if (s.status === 'cancelada') statusBadge = `<span class="badge badge-danger">Cancelada</span>`;
        else statusBadge = `<span class="badge badge-warning">Pendente</span>`;

        const isTradeInSale = s.payment_method && s.payment_method.includes('Troca');
        return `
          <tr data-id="${s.id}">
            <td>#${s.id}</td>
            <td>${new Date(s.sale_date).toLocaleString('pt-BR')}</td>
            <td>${s.client_name || 'Consumidor Final'}</td>
            <td>${s.seller_name}</td>
            <td>R$ ${s.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            <td class="text-danger">- R$ ${s.discount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            <td class="font-semibold text-primary">R$ ${s.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            <td>
              ${s.payment_method} ${s.installments > 1 ? `(${s.installments}x)` : ''}
              ${isTradeInSale ? `<br><small class="badge badge-success" style="font-size: 9px; padding: 2px 4px; display: inline-block; margin-top: 4px; background-color: var(--success); color: white; border-radius: 4px;">🔄 Retomada/Troca</small>` : ''}
            </td>
            <td>${statusBadge}</td>
            <td>
              <div style="display:flex; gap: 4px;">
                <button class="btn btn-ghost btn-sm btn-view-invoice">📄 Ver Cupom</button>
                ${isAdmin && s.status !== 'cancelada' ? `<button class="btn btn-ghost btn-sm text-danger btn-cancel-sale">Estornar 🗑️</button>` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.btn-view-invoice').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = parseInt(e.target.closest('tr').dataset.id);
          this.showReceiptModal(id);
        });
      });

      tbody.querySelectorAll('.btn-cancel-sale').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = parseInt(e.target.closest('tr').dataset.id);
          this.cancelSale(id);
        });
      });

    } catch (e) {
      window.app.showToast('Erro ao carregar histórico de vendas', 'danger');
    }
  },

  async cancelSale(id) {
    if (confirm('Deseja realmente CANCELAR esta venda? Isso irá reverter os produtos vendidos de volta para o estoque disponível e estornar o financeiro.')) {
      try {
        await window.api.sales.cancel(id);
        window.app.showToast('Venda cancelada e estoque retornado!', 'success');
        this.renderHistory();
      } catch (err) {
        window.app.showToast(err.message, 'danger');
      }
    }
  }
};
