# iNando Store ERP

Sistema ERP para loja de eletrônicos — Node.js + SQLite.

## Rodando localmente

```bash
npm install
node server.js
```

Acesse: http://localhost:8000

## Credenciais padrão

| Usuário     | E-mail                    | Senha          | 2FA    |
|-------------|---------------------------|----------------|--------|
| Admin       | admin@inando.com          | admin123       | 123456 |
| Gerente     | gerente@inando.com        | gerente123     | —      |
| Vendedor    | vendedor@inando.com       | vendedor123    | —      |
| Financeiro  | financeiro@inando.com     | financeiro123  | —      |

## Deploy no Railway

1. Faça push para um repositório GitHub
2. Acesse [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Adicione a variável de ambiente `PORT` (Railway define automaticamente)
4. Pronto! ✅
