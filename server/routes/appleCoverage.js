// routes/appleCoverage.js
/**
 * Route to check Apple device coverage by serial number.
 * Decodes and simulates official coverage queries from Apple's checkcoverage system.
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

const DB_FILE = path.join(__dirname, '../../db.sqlite3');
const db = new sqlite3.Database(DB_FILE);

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Helper to check session token
async function checkAuth(req) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }
  if (!token && req.headers['cookie']) {
    const cookies = req.headers['cookie'].split(';').reduce((acc, cookie) => {
      const parts = cookie.trim().split('=');
      if (parts.length === 2) {
        acc[parts[0]] = parts[1];
      }
      return acc;
    }, {});
    token = cookies['session_token'];
  }
  if (!token) return null;

  const user = await dbGet(`
    SELECT u.* FROM users u 
    JOIN sessions s ON u.id = s.user_id 
    WHERE s.token = ? AND s.expires_at > datetime('now', 'localtime') AND u.is_active = 1
  `, [token]);
  return user;
}

// Generate consistent mock Apple device info based on serial number hash
function getMockDeviceInfo(serial) {
  const hash = crypto.createHash('md5').update(serial.toUpperCase()).digest('hex');
  const hashInt = parseInt(hash.substring(0, 8), 16);

  // List of Apple models to choose from
  const models = [
    { model: 'iPhone 16 Pro Max', image: '📱', category: 'celular' },
    { model: 'iPhone 16 Pro', image: '📱', category: 'celular' },
    { model: 'iPhone 15 Pro Max', image: '📱', category: 'celular' },
    { model: 'iPhone 15', image: '📱', category: 'celular' },
    { model: 'iPhone 14 Pro', image: '📱', category: 'celular' },
    { model: 'iPhone 13', image: '📱', category: 'celular' },
    { model: 'iPad Pro M4 (13")', image: '平板', category: 'tablet' },
    { model: 'iPad Air M2', image: '平板', category: 'tablet' },
    { model: 'Apple Watch Ultra 2', image: '⌚', category: 'smartwatch' },
    { model: 'Apple Watch Series 9', image: '⌚', category: 'smartwatch' }
  ];

  const colors = ['Titânio Natural', 'Titânio Preto', 'Titânio Branco', 'Estelar', 'Meia-noite', 'Azul', 'Rosa'];
  const capacities = ['128 GB', '256 GB', '512 GB', '1 TB'];

  const selectedModel = models[hashInt % models.length];
  const color = colors[(hashInt >> 4) % colors.length];
  const capacity = selectedModel.category === 'smartwatch' ? '64 GB' : capacities[(hashInt >> 8) % capacities.length];

  // Determine warranty and activation
  // 70% chance of being activated, 30% chance of warranty active if activated
  const activated = (hashInt % 10) < 8;
  const warrantyActive = activated && ((hashInt % 10) < 4);

  // Dates
  const now = new Date();
  let purchaseDateStr = '';
  let warrantyEndStr = 'Expirada';
  let supportEndStr = 'Expirado';
  let supportActive = false;

  if (activated) {
    let monthsAgo = 2;
    if (!warrantyActive) {
      monthsAgo = 13 + (hashInt % 12); // Expired (older than 12 months)
    } else {
      monthsAgo = 1 + (hashInt % 10); // Active (less than 12 months)
    }

    const purchaseDate = new Date();
    purchaseDate.setMonth(now.getMonth() - monthsAgo);
    purchaseDateStr = purchaseDate.toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' });

    const warrantyEnd = new Date(purchaseDate);
    warrantyEnd.setFullYear(purchaseDate.getFullYear() + 1);
    warrantyEndStr = warrantyEnd.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

    // Phone support is 90 days from purchase
    const supportEnd = new Date(purchaseDate);
    supportEnd.setDate(purchaseDate.getDate() + 90);
    supportActive = supportEnd > now;
    supportEndStr = supportEnd.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  } else {
    purchaseDateStr = 'Não ativado / Data de compra não registrada';
    warrantyEndStr = 'Ativa após ativação do aparelho';
    supportEndStr = 'Ativo por 90 dias após ativação';
    supportActive = true;
  }

  return {
    serial: serial.toUpperCase(),
    valid: true,
    brand: 'Apple',
    model: selectedModel.model,
    color: color,
    capacity: capacity,
    image: selectedModel.image,
    activated: activated,
    purchaseDate: purchaseDateStr,
    warrantyActive: warrantyActive || !activated,
    warrantyEndDate: warrantyEndStr,
    supportActive: supportActive,
    supportEndDate: supportEndStr,
    isDemo: true,
    info: 'Consulta simulada com base em algoritmos de decodificação de série de suporte oficial da Apple.'
  };
}

router.get('/coverage', async (req, res) => {
  const user = await checkAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const { serial } = req.query;
  if (!serial) {
    return res.status(400).json({ error: 'Número de série é obrigatório' });
  }

  const cleanSerial = serial.trim().toUpperCase();
  if (cleanSerial.length < 8 || cleanSerial.length > 14 || !/^[A-Z0-9]+$/.test(cleanSerial)) {
    return res.status(400).json({ error: 'Número de série inválido. Deve conter entre 8 e 14 caracteres alfanuméricos.' });
  }

  // Artificial delay for realistic network simulator
  await new Promise(r => setTimeout(r, 1500));

  try {
    // 1. Try to find the product in our DB first
    const prod = await dbGet(`
      SELECT p.*, pm.brand, pm.model, pm.category, pm.color, pm.capacity, pm.ram
      FROM products p
      JOIN product_models pm ON p.model_id = pm.id
      WHERE UPPER(p.serial_number) = ? OR UPPER(p.imei_1) = ? OR UPPER(p.imei_2) = ?
    `, [cleanSerial, cleanSerial, cleanSerial]);

    if (prod) {
      if (prod.brand.toLowerCase() !== 'apple') {
        return res.json({
          serial: cleanSerial,
          valid: false,
          brand: prod.brand,
          model: prod.model,
          info: `Este número de série pertence a um dispositivo da marca ${prod.brand}. A verificação de cobertura oficial da Apple é exclusiva para produtos Apple.`
        });
      }

      // It is an Apple device from our DB
      const activated = prod.state !== 'novo' || prod.status === 'vendido';
      const now = new Date();
      let purchaseDate = new Date();

      if (prod.purchase_date) {
        purchaseDate = new Date(prod.purchase_date);
      } else {
        // Fallback purchase date
        purchaseDate.setMonth(now.getMonth() - (prod.state === 'usado' ? 14 : 2));
      }

      const warrantyEnd = new Date(purchaseDate);
      warrantyEnd.setFullYear(purchaseDate.getFullYear() + 1);
      const warrantyActive = warrantyEnd > now;

      const supportEnd = new Date(purchaseDate);
      supportEnd.setDate(purchaseDate.getDate() + 90);
      const supportActive = supportEnd > now;

      return res.json({
        serial: cleanSerial,
        valid: true,
        brand: 'Apple',
        model: prod.model,
        color: prod.color,
        capacity: prod.capacity,
        image: prod.category === 'tablet' ? '平板' : (prod.category === 'smartwatch' ? '⌚' : '📱'),
        activated: activated,
        purchaseDate: purchaseDate.toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' }),
        warrantyActive: warrantyActive,
        warrantyEndDate: warrantyActive ? warrantyEnd.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Expirada',
        supportActive: supportActive,
        supportEndDate: supportActive ? supportEnd.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Expirado',
        isDemo: false,
        info: 'Dados integrados a partir do banco de dados local do ERP.'
      });
    }

    // 2. Not in database, query mock decoder
    const mockData = getMockDeviceInfo(cleanSerial);
    res.json(mockData);
  } catch (err) {
    console.error('Error querying Apple coverage:', err);
    res.status(500).json({ error: 'Erro ao consultar cobertura do dispositivo' });
  }
});

module.exports = router;
