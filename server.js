const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const appleCoverage = require('./server/routes/appleCoverage');
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8000;
const DB_FILE = process.env.DB_FILE ? path.resolve(process.env.DB_FILE) : path.join(__dirname, 'db.sqlite3');
const PUBLIC_DIR = path.join(__dirname, 'public');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(PUBLIC_DIR));
app.use('/api/apple', appleCoverage);

// DB helper
const db = new sqlite3.Database(DB_FILE);

// Run DB queries as Promises
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Database schema initialization
async function initDb() {
  await dbRun("PRAGMA foreign_keys = ON");

  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin', 'manager', 'seller', 'financial')) NOT NULL,
      is_active INTEGER DEFAULT 1,
      two_factor_secret TEXT,
      two_factor_enabled INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMP NOT NULL
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      details TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS product_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      category TEXT CHECK(category IN ('celular', 'tablet', 'smartwatch', 'acessorios')) NOT NULL,
      color TEXT NOT NULL,
      capacity TEXT NOT NULL,
      ram TEXT NOT NULL,
      min_stock_alert INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id INTEGER REFERENCES product_models(id) ON DELETE CASCADE,
      imei_1 TEXT UNIQUE,
      imei_2 TEXT UNIQUE,
      serial_number TEXT UNIQUE,
      state TEXT CHECK(state IN ('novo', 'seminovo', 'usado', 'recondicionado')) NOT NULL,
      purchase_date TEXT,
      supplier TEXT,
      purchase_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      commission_percent REAL DEFAULT 0.0,
      images TEXT,
      qr_code TEXT,
      status TEXT CHECK(status IN ('disponivel', 'vendido', 'reservado')) DEFAULT 'disponivel',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    await dbRun("ALTER TABLE products ADD COLUMN replaced_parts TEXT");
  } catch (e) {
    // Column already exists or error, ignore
  }

  try {
    await dbRun("ALTER TABLE products ADD COLUMN battery_health TEXT");
  } catch (e) {
    // Column already exists or error, ignore
  }

  await dbRun(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      type TEXT CHECK(type IN ('entrada', 'saida_venda', 'ajuste', 'reserva')) NOT NULL,
      quantity INTEGER NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      notes TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      document TEXT UNIQUE,
      phone TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      email TEXT NOT NULL,
      address TEXT,
      birthday TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      subtotal REAL NOT NULL,
      discount REAL DEFAULT 0.0,
      total REAL NOT NULL,
      payment_method TEXT NOT NULL,
      installments INTEGER DEFAULT 1,
      status TEXT CHECK(status IN ('concluida', 'pendente', 'cancelada')) DEFAULT 'concluida',
      receipt_printed INTEGER DEFAULT 0
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      selling_price REAL NOT NULL,
      commission_paid REAL NOT NULL
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS finance_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT CHECK(type IN ('receita', 'despesa')) NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      due_date TEXT NOT NULL,
      payment_date TEXT,
      status TEXT CHECK(status IN ('pago', 'pendente', 'atrasado')) DEFAULT 'pendente',
      sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Seeds
  const settingsSeed = [
    ['company_name', 'iNando Store'],
    ['company_cnpj', '45.123.789/0001-90'],
    ['company_phone', '(11) 99999-8888'],
    ['company_address', 'Av. Paulista, 1000 - São Paulo/SP'],
    ['company_email', 'contato@inandostore.com.br'],
    ['default_tax', '6.5'],
    ['backup_frequency', 'diario'],
    ['theme', 'dark']
  ];
  for (const [key, val] of settingsSeed) {
    await dbRun("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", [key, val]);
  }

  const usersSeed = [
    ['nandopaiva@gmail.com', hashPassword('F3rn@nd0'), 'Fernando Paiva', 'admin', 'INANDOSTOREERPTWOFAS', 0],
    ['test2fa@email.com', hashPassword('F3rn@nd0'), 'Test 2FA User', 'admin', 'INANDOSTOREERPTWOFAS', 1]
  ];
  for (const [email, pw_hash, name, role, secret, is_2fa] of usersSeed) {
    const exists = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
    if (exists) {
      await dbRun("UPDATE users SET two_factor_secret = ?, two_factor_enabled = ? WHERE email = ?", [secret, is_2fa, email]);
    } else {
      await dbRun(`
        INSERT INTO users (email, password_hash, name, role, two_factor_secret, two_factor_enabled)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [email, pw_hash, name, role, secret, is_2fa]);
    }
  }

  const prodCount = await dbGet("SELECT COUNT(*) as count FROM products");
  if (prodCount.count === 0) {
    // Nenhum produto pré-cadastrado — o usuário fará os lançamentos manualmente
    // Os produtos podem ser cadastrados pela interface em Produtos → Novo Produto

    const clients = [];
    for (const c of clients) {
      await dbRun(`
        INSERT INTO clients (name, document, phone, whatsapp, email, address, birthday, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, c);
    }

    // Nenhuma transação financeira pré-cadastrada - o sistema começará limpo para produção
    const financeSeeds = [];
    for (const f of financeSeeds) {
      await dbRun(`
        INSERT INTO finance_transactions (type, category, amount, description, due_date, payment_date, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, f);
    }
  }
}

// Activity logging helper
async function logActivity(userId, action, details = "") {
  await dbRun(`
    INSERT INTO activity_logs (user_id, action, details)
    VALUES (?, ?, ?)
  `, [userId, action, details]);
}

// Middleware: Auth check
async function authMiddleware(req, res, next) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token && req.headers['cookie']) {
    const cookies = req.headers['cookie'].split(';').reduce((acc, cookie) => {
      const [k, v] = cookie.trim().split('=');
      acc[k] = v;
      return acc;
    }, {});
    token = cookies['session_token'];
  }

  if (!token) {
    return res.status(401).json({ error: 'Nao autorizado' });
  }

  const user = await dbGet(`
    SELECT u.* FROM users u 
    JOIN sessions s ON u.id = s.user_id 
    WHERE s.token = ? AND s.expires_at > datetime('now', 'localtime') AND u.is_active = 1
  `, [token]);

  if (!user) {
    return res.status(401).json({ error: 'Nao autorizado' });
  }

  req.user = user;
  next();
}

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Campos obrigatorios ausentes' });
  }

  const user = await dbGet("SELECT * FROM users WHERE email = ? AND is_active = 1", [email]);
  if (user && user.password_hash === hashPassword(password)) {
    const token = crypto.randomUUID();
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
    
    await dbRun("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", [token, user.id, expires_at]);
    await logActivity(user.id, "login", `Usuario logado: ${email}`);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        two_factor_enabled: false
      }
    });
  } else {
    res.status(401).json({ error: 'Credenciais invalidas' });
  }
});

app.post('/api/logout', authMiddleware, async (req, res) => {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }
  if (token) {
    await dbRun("DELETE FROM sessions WHERE token = ?", [token]);
  }
  await logActivity(req.user.id, "logout", "Usuario fez logout");
  res.json({ message: 'Deslogado com sucesso' });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    role: req.user.role,
    two_factor_enabled: req.user.two_factor_enabled
  });
});

// Dashboard Metrics
app.get('/api/dashboard', authMiddleware, async (req, res) => {
  const today = new Date().toISOString().slice(0, 7); // YYYY-MM
  
  const revMonthRow = await dbGet("SELECT SUM(total) as val FROM sales WHERE strftime('%Y-%m', sale_date) = ? AND status = 'concluida'", [today]);
  const revenue_month = revMonthRow.val || 0.0;

  const stockValRow = await dbGet("SELECT SUM(purchase_price) as val FROM products WHERE status = 'disponivel'");
  const stock_value = stockValRow.val || 0.0;

  const soldCountRow = await dbGet("SELECT COUNT(*) as val FROM products WHERE status = 'vendido'");
  const units_sold = soldCountRow.val || 0;

  // cogs
  const cogsRow = await dbGet(`
    SELECT SUM(p.purchase_price) as val FROM sale_items si
    JOIN products p ON si.product_id = p.id
    JOIN sales s ON si.sale_id = s.id
    WHERE strftime('%Y-%m', s.sale_date) = ? AND s.status = 'concluida'
  `, [today]);
  const cogs_month = cogsRow.val || 0.0;

  const expensesRow = await dbGet(`
    SELECT SUM(amount) as val FROM finance_transactions
    WHERE type = 'despesa' AND status = 'pago' AND strftime('%Y-%m', payment_date) = ?
  `, [today]);
  const expenses_month = expensesRow.val || 0.0;

  const net_profit_month = revenue_month - cogs_month - expenses_month;

  const low_stock = await dbAll(`
    SELECT pm.brand, pm.model, pm.category, COUNT(p.id) as stock_count, pm.min_stock_alert 
    FROM product_models pm
    LEFT JOIN products p ON p.model_id = pm.id AND p.status = 'disponivel'
    GROUP BY pm.id
    HAVING stock_count <= pm.min_stock_alert
  `);

  const best_sellers = await dbAll(`
    SELECT pm.brand, pm.model, pm.category, COUNT(*) as qty, SUM(si.selling_price) as faturamento
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    JOIN product_models pm ON p.model_id = pm.id
    GROUP BY pm.id
    ORDER BY qty DESC LIMIT 5
  `);

  const recent_logs = await dbAll(`
    SELECT l.*, u.name as user_name FROM activity_logs l
    LEFT JOIN users u ON l.user_id = u.id
    ORDER BY l.timestamp DESC LIMIT 10
  `);

  res.json({
    revenue_month,
    stock_value,
    units_sold,
    net_profit_month,
    low_stock,
    best_sellers,
    recent_logs
  });
});

// Listar todos os modelos cadastrados no banco
app.get('/api/product-models', authMiddleware, async (req, res) => {
  const models = await dbAll("SELECT * FROM product_models ORDER BY brand, model");
  res.json(models);
});

// Criar um novo modelo de aparelho
app.post('/api/product-models', authMiddleware, async (req, res) => {
  if (['seller'].includes(req.user.role)) return res.status(403).json({ error: 'Acesso negado' });
  const { brand, model, category, color, capacity, ram, min_stock_alert } = req.body;
  if (!brand || !model || !category) {
    return res.status(400).json({ error: 'Dados obrigatorios ausentes' });
  }
  try {
    await dbRun(`
      INSERT INTO product_models (brand, model, category, color, capacity, ram, min_stock_alert)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [brand, model, category, color || 'N/A', capacity || 'N/A', ram || 'N/A', parseInt(min_stock_alert || 1)]);
    
    const lastRow = await dbGet("SELECT last_insert_rowid() as id");
    const newModel = await dbGet("SELECT * FROM product_models WHERE id = ?", [lastRow.id]);
    res.status(201).json(newModel);
  } catch (err) {
    res.status(400).json({ error: 'Erro ao criar modelo' });
  }
});

// Products routes (Aparelhos Fisicos)
app.get('/api/products', authMiddleware, async (req, res) => {
  const { q, status, category } = req.query;
  let sql = `
    SELECT p.*, pm.brand, pm.model, pm.category, pm.color, pm.capacity, pm.ram, pm.min_stock_alert
    FROM products p
    JOIN product_models pm ON p.model_id = pm.id
    WHERE 1=1
  `;
  const params = [];

  if (q) {
    sql += " AND (pm.brand LIKE ? OR pm.model LIKE ? OR p.imei_1 LIKE ? OR p.imei_2 LIKE ? OR p.serial_number LIKE ?)";
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (status) {
    sql += " AND p.status = ?";
    params.push(status);
  }
  if (category) {
    sql += " AND pm.category = ?";
    params.push(category);
  }
  
  sql += " ORDER BY p.id DESC";
  const prods = await dbAll(sql, params);
  res.json(prods);
});

app.get('/api/products/:id', authMiddleware, async (req, res) => {
  const p = await dbGet(`
    SELECT p.*, pm.brand, pm.model, pm.category, pm.color, pm.capacity, pm.ram, pm.min_stock_alert
    FROM products p
    JOIN product_models pm ON p.model_id = pm.id
    WHERE p.id = ?
  `, [req.params.id]);
  if (p) res.json(p);
  else res.status(404).json({ error: 'Produto nao encontrado' });
});

app.get('/api/imei-check/:imei', authMiddleware, async (req, res) => {
  const { imei } = req.params;
  
  if (!imei || imei.length < 14 || imei.length > 16 || !/^\d+$/.test(imei)) {
    return res.status(400).json({ error: 'IMEI inválido. Deve possuir entre 14 e 16 dígitos numéricos.' });
  }

  // Simulated Database query delay
  await new Promise(r => setTimeout(r, 1200));

  // Determine state based on last digit or specific mock suffixes
  // If IMEI ends with 999 or 000 or 123 -> Blacklisted
  const isBlocked = imei.endsWith('999') || imei.endsWith('000') || imei.endsWith('123');
  
  const tac = imei.substring(0, 8);
  let modelInfo = {
    brand: 'Apple',
    model: 'iPhone (Modelo Genérico)',
    manufacturer: 'Apple Inc.',
    device_type: 'Smartphone'
  };

  if (tac.startsWith('359111')) {
    modelInfo = {
      brand: 'Apple',
      model: 'iPhone 16 Pro Max',
      manufacturer: 'Apple Inc.',
      device_type: 'Smartphone'
    };
  } else if (tac.startsWith('358888')) {
    modelInfo = {
      brand: 'Samsung',
      model: 'Galaxy S24 Ultra',
      manufacturer: 'Samsung Electronics',
      device_type: 'Smartphone'
    };
  }

  if (isBlocked) {
    return res.json({
      imei,
      status: 'blocked',
      status_label: 'IMPEDIDO (BLACKLIST)',
      message: 'Este aparelho consta como ROUBADO, FURTADO ou PERDIDO nos bancos de dados da Anatel / GSMA.',
      checked_at: new Date().toISOString(),
      details: {
        ...modelInfo,
        block_date: '2026-03-12',
        block_reason: 'Roubo / Furto registrado via B.O.',
        police_report: 'BO-28314/2026 - SSP/SP',
        requesting_carrier: 'Claro S/A',
        blacklist_source: 'CEM (Cadastro de Estações Impedidas - ANATEL)'
      }
    });
  } else {
    return res.json({
      imei,
      status: 'clean',
      status_label: 'REGULAR (SEM RESTRIÇÕES)',
      message: 'Nenhuma restrição encontrada para este IMEI nos bancos de dados nacionais e internacionais.',
      checked_at: new Date().toISOString(),
      details: {
        ...modelInfo,
        certification_body: 'Anatel',
        certification_status: 'Homologado',
        blacklist_source: 'GSMA Device Registry / ANATEL'
      }
    });
  }
});

app.post('/api/products', authMiddleware, async (req, res) => {
  if (['seller'].includes(req.user.role)) return res.status(403).json({ error: 'Acesso negado' });
  
  const { 
    model_id, brand, model, category, color, capacity, ram, min_stock_alert,
    purchase_price, selling_price, imei_1, imei_2, serial_number, state, supplier, purchase_date, commission_percent, images, qr_code,
    replaced_parts, battery_health
  } = req.body;

  if (!purchase_price || !selling_price) {
    return res.status(400).json({ error: 'Dados obrigatorios ausentes' });
  }

  let finalModelId = model_id;

  try {
    // Se nao enviou model_id, cria ou procura um modelo correspondente
    if (!finalModelId) {
      if (!brand || !model || !category) {
        return res.status(400).json({ error: 'Dados do modelo obrigatorios' });
      }
      
      let existingModel = await dbGet(
        "SELECT id FROM product_models WHERE brand = ? AND model = ? AND capacity = ? AND color = ?", 
        [brand, model, capacity || 'N/A', color || 'N/A']
      );

      if (existingModel) {
        finalModelId = existingModel.id;
      } else {
        await dbRun(`
          INSERT INTO product_models (brand, model, category, color, capacity, ram, min_stock_alert)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [brand, model, category, color || 'N/A', capacity || 'N/A', ram || 'N/A', parseInt(min_stock_alert || 1)]);
        const lastM = await dbGet("SELECT last_insert_rowid() as id");
        finalModelId = lastM.id;
      }
    }

    const qr_val = qr_code || `PROD-MODEL-${finalModelId}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    await dbRun(`
      INSERT INTO products (model_id, imei_1, imei_2, serial_number, state, purchase_date, supplier, purchase_price, selling_price, commission_percent, images, qr_code, status, replaced_parts, battery_health)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'disponivel', ?, ?)
    `, [
      finalModelId, imei_1 || null, imei_2 || null, serial_number || null,
      state || 'novo', purchase_date || new Date().toISOString().slice(0,10), supplier || 'N/A',
      purchase_price, selling_price, parseFloat(commission_percent || 0.0),
      JSON.stringify(images || []), qr_val, replaced_parts || null, battery_health || null
    ]);
    
    const lastRow = await dbGet("SELECT last_insert_rowid() as id");
    await dbRun("INSERT INTO stock_movements (product_id, type, quantity, user_id, notes) VALUES (?, 'entrada', 1, ?, ?)", [lastRow.id, req.user.id, 'Entrada por cadastro de produto']);
    await logActivity(req.user.id, "product_create", `Cadastrou item no estoque (Modelo ID: ${finalModelId})`);

    const newProd = await dbGet(`
      SELECT p.*, pm.brand, pm.model, pm.category 
      FROM products p 
      JOIN product_models pm ON p.model_id = pm.id 
      WHERE p.id = ?
    `, [lastRow.id]);
    res.status(201).json(newProd);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'IMEI ou Serial number duplicado ou erro ao salvar.' });
  }
});

app.put('/api/products/:id', authMiddleware, async (req, res) => {
  if (['seller'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  const prod = await dbGet("SELECT * FROM products WHERE id = ?", [req.params.id]);
  if (!prod) {
    return res.status(404).json({ error: 'Produto nao encontrado' });
  }

  const data = req.body;
  try {
    // Atualiza o item fisico
    await dbRun(`
      UPDATE products SET imei_1=?, imei_2=?, serial_number=?, state=?, purchase_price=?, selling_price=?, commission_percent=?, status=?, replaced_parts=?, battery_health=?
      WHERE id = ?
    `, [
      data.imei_1 !== undefined ? data.imei_1 : prod.imei_1,
      data.imei_2 !== undefined ? data.imei_2 : prod.imei_2,
      data.serial_number !== undefined ? data.serial_number : prod.serial_number,
      data.state || prod.state, 
      data.purchase_price !== undefined ? data.purchase_price : prod.purchase_price,
      data.selling_price !== undefined ? data.selling_price : prod.selling_price,
      parseFloat(data.commission_percent || prod.commission_percent),
      data.status || prod.status,
      data.replaced_parts !== undefined ? data.replaced_parts : prod.replaced_parts,
      data.battery_health !== undefined ? data.battery_health : prod.battery_health,
      req.params.id
    ]);

    // Se admin/manager enviou dados de modelo e model_id, atualiza o modelo tambem
    if (data.model_id) {
      await dbRun(`
        UPDATE products SET model_id = ? WHERE id = ?
      `, [data.model_id, req.params.id]);
    }

    await logActivity(req.user.id, "product_update", `Editou item físico ID: ${req.params.id}`);
    const updated = await dbGet("SELECT * FROM products WHERE id = ?", [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: 'IMEI ou Serial number duplicado' });
  }
});

app.delete('/api/products/:id', authMiddleware, async (req, res) => {
  if (['seller'].includes(req.user.role)) return res.status(403).json({ error: 'Acesso negado' });
  
  const prod = await dbGet(`
    SELECT p.*, pm.brand, pm.model 
    FROM products p
    JOIN product_models pm ON p.model_id = pm.id
    WHERE p.id = ?
  `, [req.params.id]);
  if (!prod) return res.status(404).json({ error: 'Produto nao encontrado' });
  if (prod.status === 'vendido') {
    return res.status(400).json({ error: 'Nao e possivel excluir produto vendido' });
  }

  await dbRun("DELETE FROM products WHERE id = ?", [req.params.id]);
  await logActivity(req.user.id, "product_delete", `Excluiu produto ID: ${req.params.id} (${prod.brand} ${prod.model})`);
  res.json({ message: 'Produto excluido com sucesso' });
});

// Stock Adjustments
app.get('/api/stock/history', authMiddleware, async (req, res) => {
  const history = await dbAll(`
    SELECT sm.*, pm.brand, pm.model, p.imei_1, p.serial_number, u.name as user_name 
    FROM stock_movements sm
    JOIN products p ON sm.product_id = p.id
    JOIN product_models pm ON p.model_id = pm.id
    LEFT JOIN users u ON sm.user_id = u.id
    ORDER BY sm.timestamp DESC
  `);
  res.json(history);
});

app.post('/api/stock/adjust', authMiddleware, async (req, res) => {
  if (['seller'].includes(req.user.role)) return res.status(403).json({ error: 'Acesso negado' });
  
  const { product_id, type, notes } = req.body;
  if (!product_id || !['entrada', 'ajuste'].includes(type)) {
    return res.status(400).json({ error: 'Dados incompletos para ajuste' });
  }

  const prod = await dbGet("SELECT * FROM products WHERE id = ?", [product_id]);
  if (!prod) return res.status(404).json({ error: 'Produto nao encontrado' });
  if (prod.status === 'vendido') {
    return res.status(400).json({ error: 'Nao e possivel ajustar estoque de produto vendido' });
  }

  await dbRun(`
    INSERT INTO stock_movements (product_id, type, quantity, user_id, notes)
    VALUES (?, ?, 1, ?, ?)
  `, [product_id, type, req.user.id, notes || '']);

  await logActivity(req.user.id, "stock_adjust", `Ajustou estoque do produto ID: ${product_id}`);
  res.json({ message: 'Ajuste de estoque salvo com sucesso' });
});

// Clients CRM
app.get('/api/clients', authMiddleware, async (req, res) => {
  const { q } = req.query;
  let sql = "SELECT * FROM clients";
  const params = [];
  if (q) {
    sql += " WHERE name LIKE ? OR document LIKE ? OR phone LIKE ? OR email LIKE ?";
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  sql += " ORDER BY name ASC";
  const clis = await dbAll(sql, params);
  res.json(clis);
});

app.post('/api/clients', authMiddleware, async (req, res) => {
  const { name, document, phone, whatsapp, email, address, birthday, notes } = req.body;
  if (!name || !phone || !email) {
    return res.status(400).json({ error: 'Campos obrigatorios ausentes' });
  }

  try {
    await dbRun(`
      INSERT INTO clients (name, document, phone, whatsapp, email, address, birthday, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [name, document, phone, whatsapp || phone, email, address, birthday, notes]);
    
    const lastRow = await dbGet("SELECT last_insert_rowid() as id");
    await logActivity(req.user.id, "client_create", `Cadastrou cliente: ${name}`);
    
    const newCli = await dbGet("SELECT * FROM clients WHERE id = ?", [lastRow.id]);
    res.status(201).json(newCli);
  } catch (err) {
    res.status(400).json({ error: 'Documento (CPF/CNPJ) ja cadastrado' });
  }
});

app.get('/api/clients/sales/:id', authMiddleware, async (req, res) => {
  const list = await dbAll(`
    SELECT s.*, u.name as seller_name FROM sales s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.client_id = ? 
    ORDER BY s.sale_date DESC
  `, [req.params.id]);
  res.json(list);
});

app.put('/api/clients/:id', authMiddleware, async (req, res) => {
  const cli = await dbGet("SELECT * FROM clients WHERE id = ?", [req.params.id]);
  if (!cli) return res.status(404).json({ error: 'Cliente nao encontrado' });

  const data = req.body;
  try {
    await dbRun(`
      UPDATE clients SET name=?, document=?, phone=?, whatsapp=?, email=?, address=?, birthday=?, notes=?
      WHERE id = ?
    `, [
      data.name || cli.name, data.document !== undefined ? data.document : cli.document,
      data.phone || cli.phone, data.whatsapp || cli.whatsapp, data.email || cli.email,
      data.address || cli.address, data.birthday || cli.birthday, data.notes || cli.notes,
      req.params.id
    ]);

    await logActivity(req.user.id, "client_update", `Editou cliente ID: ${req.params.id}`);
    const updated = await dbGet("SELECT * FROM clients WHERE id = ?", [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: 'Documento já cadastrado' });
  }
});

app.delete('/api/clients/:id', authMiddleware, async (req, res) => {
  if (['seller'].includes(req.user.role)) return res.status(403).json({ error: 'Acesso negado' });
  await dbRun("DELETE FROM clients WHERE id = ?", [req.params.id]);
  await logActivity(req.user.id, "client_delete", `Excluiu cliente ID: ${req.params.id}`);
  res.json({ message: 'Cliente excluido com sucesso' });
});

// Sales & POS
app.get('/api/sales', authMiddleware, async (req, res) => {
  const list = await dbAll(`
    SELECT s.*, c.name as client_name, u.name as seller_name FROM sales s
    LEFT JOIN clients c ON s.client_id = c.id
    LEFT JOIN users u ON s.user_id = u.id
    ORDER BY s.sale_date DESC
  `);
  res.json(list);
});

app.post('/api/sales', authMiddleware, async (req, res) => {
  const { client_id, product_ids, discount, payment_method, installments, trade_in } = req.body;
  if (!product_ids || product_ids.length === 0 || !payment_method) {
    return res.status(400).json({ error: 'Venda sem produtos ou forma de pagamento' });
  }

  // Fetch products and verify status
  let subtotal = 0.0;
  const prods = [];
  for (const pid of product_ids) {
    const p = await dbGet(`
      SELECT p.*, pm.brand, pm.model
      FROM products p
      JOIN product_models pm ON p.model_id = pm.id
      WHERE p.id = ?
    `, [pid]);
    if (!p) return res.status(400).json({ error: `Produto ID ${pid} nao encontrado` });
    if (p.status !== 'disponivel') {
      return res.status(400).json({ error: `Produto ${p.brand} ${p.model} nao esta disponivel` });
    }
    subtotal += p.selling_price;
    prods.push(p);
  }

  const discVal = parseFloat(discount || 0.0);
  const total = Math.max(0, subtotal - discVal);
  const tradeInVal = trade_in ? parseFloat(trade_in.valuation_value || 0.0) : 0.0;
  const expectedDifference = Math.max(0, total - tradeInVal);

  if (payment_method === 'Misto') {
    if (!req.body.mixed_payments) {
      return res.status(400).json({ error: 'Detalhamento do pagamento misto não enviado' });
    }
    const mix = req.body.mixed_payments;
    const cashVal = parseFloat(mix.dinheiro || 0.0);
    const pixVal = parseFloat(mix.pix || 0.0);
    const debVal = parseFloat(mix.debito || 0.0);
    const credVal = parseFloat(mix.credito || 0.0);
    const mixTotal = cashVal + pixVal + debVal + credVal;
    if (Math.abs(mixTotal - expectedDifference) > 0.02) {
      return res.status(400).json({ error: `A soma dos valores (R$ ${mixTotal.toFixed(2)}) não confere com a diferença a pagar (R$ ${expectedDifference.toFixed(2)})` });
    }
  }

  const finalPaymentMethod = trade_in ? `Troca + ${payment_method}` : payment_method;

  // Insert sale
  await dbRun(`
    INSERT INTO sales (client_id, user_id, subtotal, discount, total, payment_method, installments, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'concluida')
  `, [client_id, req.user.id, subtotal, discVal, total, finalPaymentMethod, installments || 1]);
  
  const lastSale = await dbGet("SELECT last_insert_rowid() as id");
  const sale_id = lastSale.id;

  // Items & stock updates
  for (const p of prods) {
    const comm = p.selling_price * (p.commission_percent / 100.0);
    await dbRun(`
      INSERT INTO sale_items (sale_id, product_id, selling_price, commission_paid)
      VALUES (?, ?, ?, ?)
    `, [sale_id, p.id, p.selling_price, comm]);

    await dbRun("UPDATE products SET status = 'vendido' WHERE id = ?", [p.id]);

    await dbRun(`
      INSERT INTO stock_movements (product_id, type, quantity, user_id, notes)
      VALUES (?, 'saida_venda', 1, ?, ?)
    `, [p.id, req.user.id, `Venda ID: ${sale_id}`]);
  }

  // Handle trade-in device registration if present
  const todayStr = new Date().toISOString().slice(0, 10);
  if (trade_in) {
    const brand = trade_in.brand || 'Apple';
    const modelName = trade_in.model || 'iPhone';
    const category = trade_in.category || 'celular';
    const color = trade_in.color || 'Preto';
    const capacity = trade_in.capacity || '128 GB';
    const ram = trade_in.ram || '8 GB';
    const state = trade_in.state || 'usado';
    const valVal = parseFloat(trade_in.valuation_value || 0.0);

    let modelId = null;
    const existingModel = await dbGet(`
      SELECT id FROM product_models
      WHERE UPPER(brand) = ? AND UPPER(model) = ? AND UPPER(color) = ? AND UPPER(capacity) = ? AND UPPER(ram) = ?
    `, [brand.toUpperCase(), modelName.toUpperCase(), color.toUpperCase(), capacity.toUpperCase(), ram.toUpperCase()]);

    if (existingModel) {
      modelId = existingModel.id;
    } else {
      await dbRun(`
        INSERT INTO product_models (brand, model, category, color, capacity, ram, min_stock_alert)
        VALUES (?, ?, ?, ?, ?, ?, 0)
      `, [brand, modelName, category, color, capacity, ram]);
      const newModel = await dbGet("SELECT last_insert_rowid() as id");
      modelId = newModel.id;
    }

    const suggestedSellingPrice = valVal * 1.3;
    let clientName = 'Cliente Final';
    if (client_id) {
      const clientRow = await dbGet("SELECT name FROM clients WHERE id = ?", [client_id]);
      if (clientRow) clientName = clientRow.name;
    }

    await dbRun(`
      INSERT INTO products (model_id, imei_1, imei_2, serial_number, state, purchase_date, supplier, purchase_price, selling_price, commission_percent, status, replaced_parts, battery_health)
      VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'), ?, ?, ?, 2.0, 'disponivel', ?, ?)
    `, [
      modelId, 
      trade_in.imei_1 || null, 
      trade_in.imei_2 || null, 
      trade_in.serial_number || null, 
      state, 
      `Troca - Cliente: ${clientName}`, 
      valVal, 
      suggestedSellingPrice,
      trade_in.replaced_parts || null,
      trade_in.battery_health || null
    ]);
    const newProd = await dbGet("SELECT last_insert_rowid() as id");
    const tradeInProductId = newProd.id;

    await dbRun(`
      INSERT INTO stock_movements (product_id, type, quantity, user_id, notes)
      VALUES (?, 'entrada', 1, ?, ?)
    `, [tradeInProductId, req.user.id, `Entrada via Troca na Venda ID: ${sale_id}`]);

    await dbRun(`
      INSERT INTO finance_transactions (type, category, amount, description, due_date, payment_date, status, sale_id)
      VALUES ('despesa', 'compra_produto', ?, ?, ?, ?, 'pago', ?)
    `, [valVal, `Compra via Retomada/Troca - Venda #${sale_id}`, todayStr, todayStr, sale_id]);
  }

  // Finance Transactions Receipts
  if (tradeInVal > 0) {
    await dbRun(`
      INSERT INTO finance_transactions (type, category, amount, description, due_date, payment_date, status, sale_id)
      VALUES ('receita', 'venda', ?, ?, ?, ?, 'pago', ?)
    `, [tradeInVal, `Recebimento Troca (Aparelho Recebido) Venda #${sale_id}`, todayStr, todayStr, sale_id]);
  }

  if (expectedDifference > 0) {
    if (payment_method === 'Misto' && req.body.mixed_payments) {
      const mix = req.body.mixed_payments;
      if (mix.dinheiro > 0) {
        await dbRun(`
          INSERT INTO finance_transactions (type, category, amount, description, due_date, payment_date, status, sale_id)
          VALUES ('receita', 'venda', ?, ?, ?, ?, 'pago', ?)
        `, [mix.dinheiro, `Recebimento Misto (Dinheiro) Venda #${sale_id}`, todayStr, todayStr, sale_id]);
      }
      if (mix.pix > 0) {
        await dbRun(`
          INSERT INTO finance_transactions (type, category, amount, description, due_date, payment_date, status, sale_id)
          VALUES ('receita', 'venda', ?, ?, ?, ?, 'pago', ?)
        `, [mix.pix, `Recebimento Misto (Pix) Venda #${sale_id}`, todayStr, todayStr, sale_id]);
      }
      if (mix.debito > 0) {
        await dbRun(`
          INSERT INTO finance_transactions (type, category, amount, description, due_date, payment_date, status, sale_id)
          VALUES ('receita', 'venda', ?, ?, ?, ?, 'pago', ?)
        `, [mix.debito, `Recebimento Misto (Débito) Venda #${sale_id}`, todayStr, todayStr, sale_id]);
      }
      if (mix.credito > 0) {
        await dbRun(`
          INSERT INTO finance_transactions (type, category, amount, description, due_date, payment_date, status, sale_id)
          VALUES ('receita', 'venda', ?, ?, ?, ?, 'pago', ?)
        `, [mix.credito, `Recebimento Misto (Crédito) Venda #${sale_id}`, todayStr, todayStr, sale_id]);
      }
    } else if (payment_method === 'Credito' && installments > 1) {
      const valInst = expectedDifference / installments;
      for (let i = 1; i <= installments; i++) {
        const due = new Date(Date.now() + 30 * i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        await dbRun(`
          INSERT INTO finance_transactions (type, category, amount, description, due_date, status, sale_id)
          VALUES ('receita', 'venda', ?, ?, ?, 'pendente', ?)
        `, [valInst, `Venda #${sale_id} Parcela ${i}/${installments}`, due, sale_id]);
      }
    } else {
      await dbRun(`
        INSERT INTO finance_transactions (type, category, amount, description, due_date, payment_date, status, sale_id)
        VALUES ('receita', 'venda', ?, ?, ?, ?, 'pago', ?)
      `, [expectedDifference, `Recebimento Venda #${sale_id} (${payment_method})`, todayStr, todayStr, sale_id]);
    }
  }

  // Seller commission
  const totalComm = prods.reduce((sum, p) => sum + (p.selling_price * (p.commission_percent / 100.0)), 0);
  if (totalComm > 0) {
    const due = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0,10);
    await dbRun(`
      INSERT INTO finance_transactions (type, category, amount, description, due_date, status)
      VALUES ('despesa', 'comissao', ?, ?, ?, 'pendente')
    `, [totalComm, `Comissão Venda #${sale_id} - Vendedor ID: ${req.user.id}`, due]);
  }

  await logActivity(req.user.id, "sale_create", `Registrou venda ID: ${sale_id}`);
  res.status(201).json({ message: 'Venda concluida com sucesso', sale_id, total });
});

app.get('/api/sales/:id', authMiddleware, async (req, res) => {
  const sale = await dbGet(`
    SELECT s.*, c.name as client_name, c.document as client_doc, c.phone as client_phone, u.name as seller_name 
    FROM sales s
    LEFT JOIN clients c ON s.client_id = c.id
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.id = ?
  `, [req.params.id]);

  if (!sale) return res.status(404).json({ error: 'Venda nao encontrada' });

  const items = await dbAll(`
    SELECT si.*, pm.brand, pm.model, pm.category, p.imei_1, p.serial_number, pm.color, pm.capacity
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    JOIN product_models pm ON p.model_id = pm.id
    WHERE si.sale_id = ?
  `, [req.params.id]);

  const tradeIn = await dbGet(`
    SELECT p.*, pm.brand, pm.model, pm.color, pm.capacity, pm.ram
    FROM products p
    JOIN product_models pm ON p.model_id = pm.id
    JOIN stock_movements sm ON p.id = sm.product_id
    WHERE sm.type = 'entrada' AND sm.notes = ?
  `, [`Entrada via Troca na Venda ID: ${req.params.id}`]);

  res.json({ sale, items, trade_in: tradeIn || null });
});

app.delete('/api/sales/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const sale = await dbGet("SELECT * FROM sales WHERE id = ?", [req.params.id]);
  if (!sale) return res.status(404).json({ error: 'Venda nao encontrada' });
  if (sale.status === 'cancelada') {
    return res.status(400).json({ error: 'Venda ja cancelada' });
  }

  const items = await dbAll("SELECT product_id FROM sale_items WHERE sale_id = ?", [req.params.id]);
  for (const item of items) {
    await dbRun("UPDATE products SET status = 'disponivel' WHERE id = ?", [item.product_id]);
    await dbRun("INSERT INTO stock_movements (product_id, type, quantity, user_id, notes) VALUES (?, 'entrada', 1, ?, ?)", [item.product_id, req.user.id, `Estoque retornado: Venda ID #${req.params.id} cancelada`]);
  }

  await dbRun("UPDATE sales SET status = 'cancelada' WHERE id = ?", [req.params.id]);
  await dbRun("DELETE FROM finance_transactions WHERE sale_id = ?", [req.params.id]);
  await logActivity(req.user.id, "sale_cancel", `Cancelou venda ID: ${req.params.id}`);

  res.json({ message: 'Venda cancelada com sucesso' });
});

// Finance routes
app.get('/api/finance/transactions', authMiddleware, async (req, res) => {
  const { type, status } = req.query;
  let sql = "SELECT * FROM finance_transactions WHERE 1=1";
  const params = [];

  if (type) {
    sql += " AND type = ?";
    params.push(type);
  }
  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  sql += " ORDER BY due_date DESC";
  const txs = await dbAll(sql, params);
  res.json(txs);
});

app.post('/api/finance/transactions', authMiddleware, async (req, res) => {
  if (['seller'].includes(req.user.role)) return res.status(403).json({ error: 'Acesso negado' });
  const { type, category, amount, due_date, status, description } = req.body;
  if (!['receita', 'despesa'].includes(type) || !category || !amount || !due_date) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  const pay_date = status === 'pago' ? new Date().toISOString().slice(0,10) : null;
  await dbRun(`
    INSERT INTO finance_transactions (type, category, amount, description, due_date, payment_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [type, category, amount, description || '', due_date, pay_date, status || 'pendente']);

  const lastRow = await dbGet("SELECT last_insert_rowid() as id");
  await logActivity(req.user.id, "finance_tx_create", `Lancou financeiro ID: ${lastRow.id}`);
  res.status(201).json({ message: 'Transacao registrada', id: lastRow.id });
});

app.put('/api/finance/transactions/:id/pay', authMiddleware, async (req, res) => {
  if (['seller'].includes(req.user.role)) return res.status(403).json({ error: 'Acesso negado' });
  
  const tx = await dbGet("SELECT * FROM finance_transactions WHERE id = ?", [req.params.id]);
  if (!tx) return res.status(404).json({ error: 'Lancamento nao encontrado' });

  const pay_date = new Date().toISOString().slice(0,10);
  await dbRun("UPDATE finance_transactions SET status = 'pago', payment_date = ? WHERE id = ?", [pay_date, req.params.id]);
  await logActivity(req.user.id, "finance_tx_pay", `Confirmou recebimento/pagamento ID: ${req.params.id}`);

  res.json({ message: 'Pagamento baixado com sucesso' });
});

app.delete('/api/finance/transactions/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  await dbRun("DELETE FROM finance_transactions WHERE id = ?", [req.params.id]);
  await logActivity(req.user.id, "finance_tx_delete", `Excluiu lancamento financeiro ID: ${req.params.id}`);
  res.json({ message: 'Lançamento financeiro excluido' });
});

app.get('/api/warranty/used', authMiddleware, async (req, res) => {
  try {
    const sql = `
      SELECT 
        p.id as product_id,
        p.imei_1,
        p.serial_number,
        pm.brand,
        pm.model,
        pm.color,
        pm.capacity,
        s.id as sale_id,
        s.sale_date,
        c.name as client_name,
        c.phone as client_phone,
        c.email as client_email,
        p.replaced_parts,
        p.battery_health
      FROM products p
      JOIN product_models pm ON p.model_id = pm.id
      JOIN sale_items si ON p.id = si.product_id
      JOIN sales s ON si.sale_id = s.id
      LEFT JOIN clients c ON s.client_id = c.id
      WHERE p.state IN ('usado', 'seminovo', 'recondicionado') AND s.status = 'concluida'
      ORDER BY s.sale_date DESC
    `;
    const rows = await dbAll(sql);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/commissions', authMiddleware, async (req, res) => {
  if (req.user.role === 'seller') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const { start, end } = req.query;
  let dateFilterSales = "";
  let dateFilterItems = "";
  const paramsSales = [];
  const paramsItems = [];

  if (start && end) {
    dateFilterSales = " AND date(s.sale_date) BETWEEN ? AND ?";
    dateFilterItems = " AND date(s.sale_date) BETWEEN ? AND ?";
    paramsSales.push(start, end);
    paramsItems.push(start, end);
  }

  const sql = `
    SELECT 
      u.id as seller_id,
      u.name as seller_name,
      u.email as seller_email,
      (SELECT COUNT(*) FROM sales s WHERE s.user_id = u.id AND s.status = 'concluida'${dateFilterSales}) as sales_count,
      (SELECT IFNULL(SUM(s.total), 0.0) FROM sales s WHERE s.user_id = u.id AND s.status = 'concluida'${dateFilterSales}) as total_sales,
      (SELECT IFNULL(SUM(si.commission_paid), 0.0) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.user_id = u.id AND s.status = 'concluida'${dateFilterItems}) as total_commission
    FROM users u
  `;

  const allParams = [...paramsSales, ...paramsSales, ...paramsItems];
  try {
    const rows = await dbAll(sql, allParams);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching commissions report:", err);
    res.status(500).json({ error: "Erro ao gerar relatório de comissões" });
  }
});

app.get('/api/finance/dre', authMiddleware, async (req, res) => {
  const { start, end } = req.query;
  const start_date = start || '2026-05-01';
  const end_date = end || '2026-06-30';

  const revRow = await dbGet("SELECT SUM(total) as val FROM sales WHERE status = 'concluida' AND date(sale_date) BETWEEN ? AND ?", [start_date, end_date]);
  const gross_revenue = revRow.val || 0.0;

  const discRow = await dbGet("SELECT SUM(discount) as val FROM sales WHERE status = 'concluida' AND date(sale_date) BETWEEN ? AND ?", [start_date, end_date]);
  const discounts = discRow.val || 0.0;

  const cmvRow = await dbGet(`
    SELECT SUM(p.purchase_price) as val FROM sale_items si
    JOIN products p ON si.product_id = p.id
    JOIN sales s ON si.sale_id = s.id
    WHERE s.status = 'concluida' AND date(s.sale_date) BETWEEN ? AND ?
  `, [start_date, end_date]);
  const cmv = cmvRow.val || 0.0;

  const commRow = await dbGet(`
    SELECT SUM(commission_paid) as val FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    WHERE s.status = 'concluida' AND date(s.sale_date) BETWEEN ? AND ?
  `, [start_date, end_date]);
  const commissions = commRow.val || 0.0;

  const expenses_breakdown = await dbAll(`
    SELECT category, SUM(amount) as total FROM finance_transactions
    WHERE type = 'despesa' AND status = 'pago' AND date(payment_date) BETWEEN ? AND ?
    GROUP BY category
  `, [start_date, end_date]);

  const operating_expenses = expenses_breakdown.reduce((sum, e) => sum + e.total, 0.0);
  const net_profit = gross_revenue - cmv - commissions - operating_expenses;

  res.json({
    start_date,
    end_date,
    gross_revenue,
    discounts,
    cmv,
    commissions,
    expenses_breakdown,
    operating_expenses,
    net_profit
  });
});

app.get('/api/finance/kpis', authMiddleware, async (req, res) => {
  const salesRow = await dbGet("SELECT COUNT(*) as count, SUM(total) as total FROM sales WHERE status = 'concluida'");
  const sales_count = salesRow.count || 0;
  const sales_total = salesRow.total || 0.0;
  const ticket_medio = sales_count > 0 ? (sales_total / sales_count) : 0.0;

  const marginRow = await dbGet(`
    SELECT SUM(p.purchase_price) as cost, SUM(si.selling_price) as selling FROM sale_items si
    JOIN products p ON si.product_id = p.id
    JOIN sales s ON si.sale_id = s.id
    WHERE s.status = 'concluida'
  `);
  const costSum = marginRow.cost || 0.0;
  const sellingSum = marginRow.selling || 0.0;
  const average_margin = sellingSum > 0 ? (((sellingSum - costSum) / sellingSum) * 100) : 0.0;

  const investRow = await dbGet("SELECT SUM(purchase_price) as val FROM products");
  const total_investment = investRow.val || 0.0;

  const revRow = await dbGet("SELECT SUM(amount) as val FROM finance_transactions WHERE type = 'receita' AND status = 'pago'");
  const expRow = await dbGet("SELECT SUM(amount) as val FROM finance_transactions WHERE type = 'despesa' AND status = 'pago'");
  const net_profit = (revRow.val || 0.0) - (expRow.val || 0.0);
  const roi = total_investment > 0 ? ((net_profit / total_investment) * 100) : 0.0;

  res.json({
    ticket_medio,
    average_margin,
    roi
  });
});

// Users management (Admin only)
app.get('/api/users', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  const list = await dbAll("SELECT id, email, name, role, is_active, two_factor_enabled, created_at FROM users");
  res.json(list);
});

app.post('/api/users', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  
  const { email, password, name, role } = req.body;
  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  try {
    await dbRun(`
      INSERT INTO users (email, password_hash, name, role, is_active, two_factor_secret, two_factor_enabled)
      VALUES (?, ?, ?, ?, 1, 'XYZ123ABC', 0)
    `, [email, hashPassword(password), name, role]);
    
    const lastRow = await dbGet("SELECT last_insert_rowid() as id");
    await logActivity(req.user.id, "user_create", `Criou usuario: ${email}`);
    res.status(201).json({ message: 'Usuario criado', id: lastRow.id });
  } catch (err) {
    res.status(400).json({ error: 'Email ja cadastrado' });
  }
});

// Rota para qualquer usuario logado alterar a propria senha
app.put('/api/users/change-password', authMiddleware, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  const user = await dbGet("SELECT * FROM users WHERE id = ?", [req.user.id]);
  if (!user || user.password_hash !== hashPassword(current_password)) {
    return res.status(400).json({ error: 'Senha atual incorreta' });
  }

  await dbRun("UPDATE users SET password_hash = ? WHERE id = ?", [hashPassword(new_password), req.user.id]);
  await logActivity(req.user.id, "password_change", "Alterou a propria senha");
  res.json({ message: 'Senha alterada com sucesso' });
});

app.put('/api/users/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  
  const { name, role, is_active, two_factor_enabled, password } = req.body;
  if (password) {
    await dbRun(`
      UPDATE users SET name=?, role=?, is_active=?, two_factor_enabled=?, password_hash=?
      WHERE id = ?
    `, [name, role, is_active, two_factor_enabled, hashPassword(password), req.params.id]);
  } else {
    await dbRun(`
      UPDATE users SET name=?, role=?, is_active=?, two_factor_enabled=?
      WHERE id = ?
    `, [name, role, is_active, two_factor_enabled, req.params.id]);
  }

  await logActivity(req.user.id, "user_update", `Editou usuario ID: ${req.params.id}`);
  res.json({ message: 'Usuario atualizado com sucesso' });
});

app.delete('/api/users/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Nao e possivel excluir o proprio usuario logado' });
  }

  await dbRun("DELETE FROM users WHERE id = ?", [req.params.id]);
  await logActivity(req.user.id, "user_delete", `Excluiu usuario ID: ${req.params.id}`);
  res.json({ message: 'Usuario excluido com sucesso' });
});

// Settings general
app.get('/api/settings', authMiddleware, async (req, res) => {
  const rows = await dbAll("SELECT * FROM settings");
  const config = rows.reduce((acc, r) => {
    acc[r.key] = r.value;
    return acc;
  }, {});
  res.json(config);
});

app.put('/api/settings', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  
  const data = req.body;
  for (const key of Object.keys(data)) {
    await dbRun("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, String(data[key])]);
  }
  
  await logActivity(req.user.id, "settings_update", "Atualizou configuracoes");
  res.json({ message: 'Configuracoes salvas com sucesso' });
});

// Initialize database schema and start server
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor iNando Store ERP rodando na porta ${PORT}...`);
    console.log(`Diretorio publico: ${PUBLIC_DIR}`);
  });
}).catch(err => {
  console.error("Erro ao inicializar o banco de dados:", err);
});
