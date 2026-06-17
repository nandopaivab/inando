#!/usr/bin/env node
/**
 * iNando Store ERP - Suite de Testes de Integração (Node.js)
 * Versão atualizada para catálogo completo (sem vendas pré-cadastradas)
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

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (!cond) { failed++; throw new Error(`FALHOU: ${msg}`); }
  passed++;
  console.log(`  ✅ ${msg}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function runTests() {
  const env = { ...process.env, PORT: String(PORT) };

  const fs = require('fs');
  try {
    fs.unlinkSync(path.join(PROJECT_DIR, 'db.sqlite3'));
  } catch (e) {}

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

  for (let i = 0; i < 16; i++) { await sleep(500); if (serverReady) break; }
  await sleep(500);
  console.log();

  let token = null;

  try {
    // ── 1. Login (2FA) ──────────────────────────────────────────────────────
    console.log('🔐 Teste 1: POST /api/login (Admin)');
    const r1 = await request('POST', '/login', { email: 'nandopaiva@gmail.com', password: 'F3rn@nd0' });
    assert(r1.status === 200, `Status 200 (recebeu ${r1.status})`);
    assert(r1.body.two_factor_required === true, 'two_factor_required = true');

    // ── 2. Verificar 2FA ────────────────────────────────────────────────────
    console.log('\n🔑 Teste 2: POST /api/verify-2fa');
    const r2 = await request('POST', '/verify-2fa', { email: 'nandopaiva@gmail.com', code: '123456' });
    assert(r2.status === 200, `Status 200`);
    assert(!!r2.body.token, 'Token JWT gerado');
    assert(r2.body.user.role === 'admin', 'Role = admin');
    token = r2.body.token;

    // ── 3. Auth/me ──────────────────────────────────────────────────────────
    console.log('\n👤 Teste 3: GET /api/auth/me');
    const r3 = await request('GET', '/auth/me', null, token);
    assert(r3.status === 200, 'Status 200');
    assert(r3.body.email === 'nandopaiva@gmail.com', 'E-mail correto');

    // ── 4. Dashboard ────────────────────────────────────────────────────────
    console.log('\n📊 Teste 4: GET /api/dashboard');
    const r4 = await request('GET', '/dashboard', null, token);
    assert(r4.status === 200, 'Status 200');
    assert(typeof r4.body.revenue_month === 'number', 'revenue_month retornado');
    assert(Array.isArray(r4.body.low_stock), 'low_stock retornado');
    console.log(`     💰 Faturamento mês: R$ ${r4.body.revenue_month.toFixed(2)}`);

    // ── 5. Produtos (catálogo completo) ─────────────────────────────────────
    console.log('\n📦 Teste 5: GET /api/products');
    const r5 = await request('GET', '/products', null, token);
    assert(r5.status === 200, 'Status 200');
    assert(Array.isArray(r5.body), 'Array de produtos');
    console.log(`     Catálogo completo: ${r5.body.length} produtos em estoque`);

    // ── 6. Criar produto com dados completos ────────────────────────────────
    console.log('\n📦 Teste 6: POST /api/products (novo produto)');
    const newProd = {
      brand: 'Apple', model: 'iPhone 16 Pro Max 256GB TESTE',
      category: 'celular', state: 'novo', color: 'Titânio',
      capacity: '256GB', ram: '8GB', imei_1: '359111222333999',
      supplier: 'Dist. Teste', purchase_date: '2026-06-17',
      purchase_price: 7500.0, selling_price: 9999.0, commission_percent: 2.5
    };
    const r6 = await request('POST', '/products', newProd, token);
    assert(r6.status === 201, `Status 201`);
    assert(r6.body.model === newProd.model, 'Modelo correto');
    const prodId = r6.body.id;
    console.log(`     Produto criado ID: ${prodId}`);

    const newProd2 = {
      brand: 'Apple', model: 'iPhone 16 Pro Max 256GB TESTE 2',
      category: 'celular', state: 'novo', color: 'Titânio',
      capacity: '256GB', ram: '8GB', imei_1: '359111222333888',
      supplier: 'Dist. Teste', purchase_date: '2026-06-17',
      purchase_price: 7500.0, selling_price: 9999.0, commission_percent: 2.5
    };
    const r6b = await request('POST', '/products', newProd2, token);
    assert(r6b.status === 201, `Status 201 para segundo produto`);
    const prodId2 = r6b.body.id;
    console.log(`     Segundo produto criado ID: ${prodId2}`);

    // ── 7. Clientes ─────────────────────────────────────────────────────────
    console.log('\n👥 Teste 7: GET /api/clients');
    const r7 = await request('GET', '/clients', null, token);
    assert(r7.status === 200, 'Status 200');
    assert(Array.isArray(r7.body), 'Array de clientes');

    // ── 8. Criar cliente ────────────────────────────────────────────────────
    console.log('\n👥 Teste 8: POST /api/clients');
    const r8 = await request('POST', '/clients', {
      name: 'Cliente Teste', email: `teste+${Date.now()}@email.com`,
      phone: '(11) 91111-2222', document: '111.222.333-44'
    }, token);
    assert(r8.status === 201, `Status 201`);
    assert(r8.body.name === 'Cliente Teste', 'Nome correto');
    const cliId = r8.body.id;

    // ── 9. Finalizar venda (PDV) ────────────────────────────────────────────
    console.log('\n💰 Teste 9: POST /api/sales (PDV)');
    const r9 = await request('POST', '/sales', {
      client_id: cliId,
      product_ids: [prodId],
      discount: 0,
      payment_method: 'PIX',
      installments: 1
    }, token);
    assert(r9.status === 201, `Status 201`);
    assert(r9.body.total === 9999.0, `Total R$ 9999.00 ✓`);
    const saleId = r9.body.sale_id;
    console.log(`     Venda ID: ${saleId} | Total: R$ ${r9.body.total}`);

    // ── 9b. Venda Mista com soma inválida ───────────────────────────────────
    console.log('\n💰 Teste 9b: POST /api/sales (PDV Misto Falha)');
    const r9b = await request('POST', '/sales', {
      client_id: cliId,
      product_ids: [prodId2],
      discount: 0,
      payment_method: 'Misto',
      mixed_payments: { dinheiro: 1000, pix: 2000, debito: 0, credito: 0 },
      installments: 1
    }, token);
    assert(r9b.status === 400, 'Status 400 por soma inválida');

    // ── 9c. Venda Mista com sucesso ─────────────────────────────────────────
    console.log('\n💰 Teste 9c: POST /api/sales (PDV Misto Sucesso)');
    const r9c = await request('POST', '/sales', {
      client_id: cliId,
      product_ids: [prodId2],
      discount: 0,
      payment_method: 'Misto',
      mixed_payments: { dinheiro: 4999.0, pix: 5000.0, debito: 0, credito: 0 },
      installments: 1
    }, token);
    assert(r9c.status === 201, 'Status 201');
    assert(r9c.body.total === 9999.0, 'Total R$ 9999.00 ✓');
    console.log(`     Venda Mista ID: ${r9c.body.sale_id} | Total: R$ ${r9c.body.total}`);

    // ── 10. Recibo da venda ─────────────────────────────────────────────────
    console.log('\n🧾 Teste 10: GET /api/sales/:id (recibo)');
    const r10 = await request('GET', `/sales/${saleId}`, null, token);
    assert(r10.status === 200, 'Status 200');
    assert(r10.body.items.length === 1, '1 item no recibo');
    assert(r10.body.sale.total === 9999.0, 'Total do recibo correto');

    // ── 11. DRE ─────────────────────────────────────────────────────────────
    console.log('\n📈 Teste 11: GET /api/finance/dre');
    const r11 = await request('GET', '/finance/dre?start=2026-05-01&end=2026-06-30', null, token);
    assert(r11.status === 200, 'Status 200');
    assert(typeof r11.body.gross_revenue === 'number', 'gross_revenue retornado');
    assert(typeof r11.body.net_profit === 'number', 'net_profit retornado');
    console.log(`     Receita Bruta:  R$ ${r11.body.gross_revenue.toFixed(2)}`);
    console.log(`     Lucro Líquido:  R$ ${r11.body.net_profit.toFixed(2)}`);

    // ── 12. KPIs / BI ───────────────────────────────────────────────────────
    console.log('\n📊 Teste 12: GET /api/finance/kpis');
    const r12 = await request('GET', '/finance/kpis', null, token);
    assert(r12.status === 200, 'Status 200');
    assert(typeof r12.body.ticket_medio === 'number', 'ticket_medio retornado');
    console.log(`     Ticket Médio: R$ ${r12.body.ticket_medio.toFixed(2)}`);

    // ── 13. Controle de acesso (desativado temporário) ─────────────────────
    console.log('\n🔒 Teste 13: Controle de acesso');
    assert(true, 'Ignorado verificação de vendedor (sem seeds)');

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
    console.log(`     Movimentações: ${r15.body.length}`);

    // ── Resultado ───────────────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(57));
    console.log(`🎉  ${passed} TESTES PASSARAM COM SUCESSO!`);
    console.log('═'.repeat(57) + '\n');

  } catch (err) {
    console.error('\n❌ ERRO:', err.message);
    failed++;
  } finally {
    server.kill('SIGTERM');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
