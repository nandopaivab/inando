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
        <!-- Cart & Scanner -->
        <div class="pos-left">
          <div class="pos-search-box">
            <h4 style="font-weight: 700; margin-bottom: 8px;">Scanner ou Pesquisa de Aparelhos</h4>
            <div class="barcode-simulator">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-top: 10px; color: var(--text-secondary);"><path d="M3 5v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"></path><path d="M7 9h10M7 12h10M7 15h10"></path></svg>
              <input type="text" id="pos-scan-input" placeholder="Simular leitor: Digite IMEI, Serial ou código de barras e tecle Enter...">
            </div>
            
            <div style="margin-top: 12px;">
              <label style="font-size: 11px; color: var(--text-muted);">Busca manual por catálogo</label>
              <select id="pos-manual-select" style="margin-top: 4px;">
                <option value="">Selecione um aparelho disponível...</option>
              </select>
            </div>
          </div>

          <!-- Cart list -->
          <div class="pos-cart-list" id="pos-cart-items">
            <p class="empty-state">Carrinho vazio. Escaneie ou selecione um produto para iniciar.</p>
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
              <div class="summary-row total">
                <span>Total Final</span>
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
      
      // Populate Manual catalog select
      const manualSelect = document.getElementById('pos-manual-select');
      manualSelect.innerHTML = `<option value="">Selecione um aparelho disponível...</option>` + 
        this.availableProducts.map(p => `<option value="${p.id}">${p.brand} ${p.model} (${p.color || ''} - ${p.capacity || ''}) - R$ ${p.selling_price.toLocaleString('pt-BR')}</option>`).join('');

      // Populate Client select
      const clientSelect = document.getElementById('pos-client-select');
      clientSelect.innerHTML = `<option value="">Consumidor Final (Sem cadastro)</option>` + 
        this.clients.map(c => `<option value="${c.id}">${c.name} (${c.document || 'Sem doc'})</option>`).join('');

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

    // Manual add
    manualSelect.addEventListener('change', () => {
      const id = parseInt(manualSelect.value);
      if (id) {
        const p = this.availableProducts.find(prod => prod.id === id);
        if (p) {
          this.addToCart(p);
          manualSelect.value = '';
        }
      }
    });

    // Discount watcher
    const discInput = document.getElementById('pos-discount');
    discInput.addEventListener('input', () => this.updateTotals());

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
    if (this.cart.some(item => item.id === product.id)) {
      window.app.showToast('Aparelho ja inserido no carrinho', 'warning');
      return;
    }
    this.cart.push(product);
    this.renderCart();
    this.updateTotals();
  },

  removeFromCart(id) {
    this.cart = this.cart.filter(item => item.id !== id);
    this.renderCart();
    this.updateTotals();
  },

  renderCart() {
    const container = document.getElementById('pos-cart-items');
    if (this.cart.length === 0) {
      container.innerHTML = `<p class="empty-state">Carrinho vazio. Escaneie ou selecione um produto para iniciar.</p>`;
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
    const total = Math.max(0, subtotal - disc);

    document.getElementById('summary-subtotal').textContent = `R$ ${subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    document.getElementById('summary-discount').textContent = `- R$ ${disc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    document.getElementById('summary-total').textContent = `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  },

  async checkout() {
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

    // If Pix, show simulated Pix QR Code checkout modal first
    if (payMethod === 'PIX') {
      this.showPixModal(payload);
    } else {
      this.executeCheckout(payload);
    }
  },

  showPixModal(payload) {
    const subtotal = this.cart.reduce((sum, item) => sum + item.selling_price, 0);
    const total = Math.max(0, subtotal - payload.discount);

    const content = `
      <div style="text-align: center;">
        <p style="margin-bottom: 16px;">Escaneie o QR Code abaixo para confirmar o recebimento via Pix.</p>
        <div class="qr-card">
          <!-- simulated Pix QR Code on canvas -->
          <canvas id="pix-qr-canvas"></canvas>
          <div style="text-align: center; margin-top: 8px;">
            <h4 style="font-weight:700;">Recebimento iNando Store</h4>
            <p class="text-success font-semibold" style="font-size: 16px; margin-top: 4px;">R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
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
      this.updateTotals();
      document.getElementById('pos-discount').value = '0.00';

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
            <div style="display:flex; justify-content:space-between; font-weight:800; font-size:15px; border-top: 1px solid var(--border-color); padding-top: 6px; margin-top: 4px;">
              <span>TOTAL FINAL:</span>
              <span class="text-success">R$ ${sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div style="margin-top: 6px; font-size:11px; color: var(--text-secondary);">
              Forma de pagamento: <strong>${sale.payment_method}</strong> ${sale.installments > 1 ? `(${sale.installments}x)` : ''}
            </div>
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
    // Fill the thermal receipt print area
    const details = this.availableProducts; // Fallback or reload.
    window.api.sales.getReceipt(saleId).then(res => {
      const sale = res.sale;
      const items = res.items;

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
        <div class="receipt-row" style="font-weight:bold;">
          <span>TOTAL FINAL:</span>
          <span>R$ ${sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
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
      
      let msg = `*iNando Store - Comprovante de Compra*\n`;
      msg += `Cupom: #${sale.id}\n`;
      msg += `Data: ${new Date(sale.sale_date).toLocaleString('pt-BR')}\n`;
      msg += `-----------------------------\n`;
      items.forEach(item => {
        msg += `*${item.brand} ${item.model}*\n`;
        msg += `Identificador: ${item.imei_1 || item.serial_number || 'Sem IMEI'}\n`;
        msg += `Valor: R$ ${item.selling_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      });
      msg += `-----------------------------\n`;
      msg += `Subtotal: R$ ${sale.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      msg += `Desconto: R$ ${sale.discount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      msg += `*Total Final: R$ ${sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\n`;
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

        return `
          <tr data-id="${s.id}">
            <td>#${s.id}</td>
            <td>${new Date(s.sale_date).toLocaleString('pt-BR')}</td>
            <td>${s.client_name || 'Consumidor Final'}</td>
            <td>${s.seller_name}</td>
            <td>R$ ${s.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            <td class="text-danger">- R$ ${s.discount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            <td class="font-semibold text-primary">R$ ${s.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            <td>${s.payment_method} ${s.installments > 1 ? `(${s.installments}x)` : ''}</td>
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
