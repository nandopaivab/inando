#!/usr/bin/env node
/**
 * iNando Store ERP - Suite de Testes de Integração (Node.js)
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 8001;
const PROJECT_DIR = __dirname;

// ─── Helper HTTP ────────────────────────────────────────────────────────────
function request(method, apiPath, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: `/api${apiPath}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function assert(cond, msg) {
  if (!cond) throw new Error(`FALHOU: ${msg}`);
  console.log(`  ✅ ${msg}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function runTests() {
  // Override PORT via env so server.js picks it up
  const env = { ...process.env, PORT: String(PORT) };

  console.log(`\n🚀 Iniciando servidor de testes na porta ${PORT}...\n`);
  const server = spawn('node', ['server.js'], {
    cwd: PROJECT_DIR,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let serverReady = false;
  server.stdout.on('data', d => {
    const line = d.toString();
    if (line.includes('rodando')) serverReady = true;
    process.stdout.write('  [server] ' + line);
  });
  server.stderr.on('data', d => process.stderr.write('  [server-err] ' + d));

  // Wait up to 8s for server to be ready
  for (let i = 0; i < 16; i++) {
    await sleep(500);
    if (serverReady) break;
  }
  await sleep(500);
  console.log();

  let token = null;
  let errors = 0;

  try {
    // ── 1. Login (2FA) ──────────────────────────────────────────────────────
    console.log('🔐 Teste 1: POST /api/login (Admin)');
    const r1 = await request('POST', '/login', { email: 'admin@inando.com', password: 'admin123' });
    assert(r1.status === 200, `Status 200 (recebeu ${r1.status})`);
    assert(r1.body.two_factor_required === true, 'two_factor_required = true');

    // ── 2. Verificar 2FA ────────────────────────────────────────────────────
    console.log('\n🔑 Teste 2: POST /api/verify-2fa');
    const r2 = await request('POST', '/verify-2fa', { email: 'admin@inando.com', code: '123456' });
    assert(r2.status === 200, `Status 200`);
    assert(!!r2.body.token, 'Token JWT gerado');
    assert(r2.body.user.role === 'admin', 'Role = admin');
    token = r2.body.token;

    // ── 3. Auth/me ──────────────────────────────────────────────────────────
    console.log('\n👤 Teste 3: GET /api/auth/me');
    const r3 = await request('GET', '/auth/me', null, token);
    assert(r3.status === 200, 'Status 200');
    assert(r3.body.email === 'admin@inando.com', 'E-mail correto');

    // ── 4. Dashboard ────────────────────────────────────────────────────────
    console.log('\n📊 Teste 4: GET /api/dashboard');
    const r4 = await request('GET', '/dashboard', null, token);
    assert(r4.status === 200, 'Status 200');
    assert(typeof r4.body.revenue_month === 'number', 'revenue_month retornado');
    assert(Array.isArray(r4.body.low_stock), 'low_stock retornado');
    console.log(`     💰 Faturamento mês: R$ ${r4.body.revenue_month.toFixed(2)}`);
    console.log(`     💵 Lucro líquido:   R$ ${r4.body.net_profit_month.toFixed(2)}`);

    // ── 5. Produtos ─────────────────────────────────────────────────────────
    console.log('\n📦 Teste 5: GET /api/products');
    const r5 = await request('GET', '/products', null, token);
    assert(r5.status === 200, 'Status 200');
    assert(Array.isArray(r5.body), 'Array de produtos');
    console.log(`     Total de produtos: ${r5.body.length}`);

    // ── 6. Criar produto ────────────────────────────────────────────────────
    console.log('\n📦 Teste 6: POST /api/products (novo produto)');
    const newProd = {
      brand: 'Apple', model: 'iPhone 15 Pro Max 256GB Titanium',
      category: 'celular', state: 'novo', color: 'Titânio',
      capacity: '256GB', ram: '8GB', imei_1: '359111222333555',
      supplier: 'Dist. Apple BR', purchase_date: '2026-06-01',
      purchase_price: 6800.0, selling_price: 9499.0, commission_percent: 2.0
    };
    const r6 = await request('POST', '/products', newProd, token);
    assert(r6.status === 201, `Status 201`);
    assert(r6.body.model === newProd.model, 'Modelo correto');
    const prodId = r6.body.id;
    console.log(`     Produto criado ID: ${prodId}`);

    // ── 7. Clientes ─────────────────────────────────────────────────────────
    console.log('\n👥 Teste 7: GET /api/clients');
    const r7 = await request('GET', '/clients', null, token);
    assert(r7.status === 200, 'Status 200');
    assert(Array.isArray(r7.body), 'Array de clientes');
    console.log(`     Total de clientes: ${r7.body.length}`);

    // ── 8. Criar cliente ────────────────────────────────────────────────────
    console.log('\n👥 Teste 8: POST /api/clients');
    const r8 = await request('POST', '/clients', {
      name: 'Carlos Estevam', email: `carlos+${Date.now()}@email.com`,
      phone: '(11) 98888-7777', document: '444.555.666-77'
    }, token);
    assert(r8.status === 201, `Status 201`);
    assert(r8.body.name === 'Carlos Estevam', 'Nome correto');
    const cliId = r8.body.id;

    // ── 9. Finalizar venda (PDV) ────────────────────────────────────────────
    console.log('\n💰 Teste 9: POST /api/sales (PDV)');
    const r9 = await request('POST', '/sales', {
      client_id: cliId,
      product_ids: [prodId],
      discount: 100.0,
      payment_method: 'PIX',
      installments: 1
    }, token);
    assert(r9.status === 201, `Status 201`);
    assert(r9.body.total === 9399.0, `Total R$ 9399.00 ✓ (${r9.body.total})`);
    const saleId = r9.body.sale_id;
    console.log(`     Venda ID: ${saleId} | Total: R$ ${r9.body.total}`);

    // ── 10. Recibo da venda ─────────────────────────────────────────────────
    console.log('\n🧾 Teste 10: GET /api/sales/:id (recibo)');
    const r10 = await request('GET', `/sales/${saleId}`, null, token);
    assert(r10.status === 200, 'Status 200');
    assert(r10.body.items.length === 1, '1 item no recibo');
    assert(r10.body.sale.total === 9399.0, 'Total do recibo correto');

    // ── 11. DRE ─────────────────────────────────────────────────────────────
    console.log('\n📈 Teste 11: GET /api/finance/dre');
    const r11 = await request('GET', '/finance/dre?start=2026-05-01&end=2026-06-30', null, token);
    assert(r11.status === 200, 'Status 200');
    assert(typeof r11.body.gross_revenue === 'number', 'gross_revenue retornado');
    assert(typeof r11.body.net_profit === 'number', 'net_profit retornado');
    console.log(`     Receita Bruta:  R$ ${r11.body.gross_revenue.toFixed(2)}`);
    console.log(`     CMV:            R$ ${r11.body.cmv.toFixed(2)}`);
    console.log(`     Lucro Líquido:  R$ ${r11.body.net_profit.toFixed(2)}`);

    // ── 12. KPIs / BI ───────────────────────────────────────────────────────
    console.log('\n📊 Teste 12: GET /api/finance/kpis');
    const r12 = await request('GET', '/finance/kpis', null, token);
    assert(r12.status === 200, 'Status 200');
    assert(typeof r12.body.ticket_medio === 'number', 'ticket_medio retornado');
    console.log(`     Ticket Médio: R$ ${r12.body.ticket_medio.toFixed(2)}`);
    console.log(`     Margem Média: ${r12.body.average_margin.toFixed(1)}%`);
    console.log(`     ROI:          ${r12.body.roi.toFixed(1)}%`);

    // ── 13. Controle de acesso (Vendedor não acessa /users) ─────────────────
    console.log('\n🔒 Teste 13: Controle de acesso (vendedor)');
    const r13login = await request('POST', '/login', { email: 'vendedor@inando.com', password: 'vendedor123' });
    const sellerToken = r13login.body.token; // vendedor sem 2FA → token direto
    const r13 = await request('GET', '/users', null, sellerToken);
    assert(r13.status === 403, `Vendedor bloqueado (403)`);

    // ── 14. Configurações ───────────────────────────────────────────────────
    console.log('\n⚙️  Teste 14: GET /api/settings');
    const r14 = await request('GET', '/settings', null, token);
    assert(r14.status === 200, 'Status 200');
    assert(r14.body.company_name === 'iNando Store', 'Nome da empresa correto');

    // ── 15. Histórico de estoque ────────────────────────────────────────────
    console.log('\n📜 Teste 15: GET /api/stock/history');
    const r15 = await request('GET', '/stock/history', null, token);
    assert(r15.status === 200, 'Status 200');
    assert(Array.isArray(r15.body), 'Array de movimentações');
    console.log(`     Total de movimentações: ${r15.body.length}`);

    // ── Resultado ───────────────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(57));
    console.log('🎉  TODOS OS 15 TESTES PASSARAM COM SUCESSO!');
    console.log('═'.repeat(57) + '\n');

  } catch (err) {
    console.error('\n❌ ERRO:', err.message);
    errors++;
  } finally {
    server.kill('SIGTERM');
    process.exit(errors > 0 ? 1 : 0);
  }
}

runTests();
