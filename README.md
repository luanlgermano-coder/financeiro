# Financeiro — Dashboard de Controle Financeiro Pessoal

Dashboard completo para controle financeiro pessoal com React + Node.js + SQLite.

## Funcionalidades

- **Visão Geral** — Cards semânticos, saúde financeira, resumo por categoria e evolução de 6 meses
- **Gastos** — Listagem com filtros, barras por categoria e edição inline
- **Assinaturas** — Controle de serviços recorrentes com projeção anual
- **Dívidas** — Progresso de quitação e registro de pagamentos
- **WhatsApp** — Lançamentos via mensagem com processamento por IA
- **Upload de Fatura** — Extração automática de transações de PDFs com Claude

---

## Requisitos

- Node.js 18+ (testado com Node 24)
- npm 9+
- **Sem dependências nativas** — o banco de dados usa `sql.js` (SQLite compilado para JavaScript puro), que funciona em qualquer plataforma sem precisar de `node-gyp`, Visual Studio Build Tools ou Python.

---

## Instalação local

```bash
# Clone o repositório
git clone <url-do-repo>
cd financeiro

# Instala dependências do servidor
cd server && npm install && cd ..

# Instala dependências do cliente
cd client && npm install && cd ..
```

### Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` com suas chaves:

```env
GEMINI_API_KEY=AIza...             # Obrigatório para Upload de Fatura e WhatsApp (IA)
                                   # Grátis em: https://aistudio.google.com/app/apikey
EVOLUTION_API_URL=https://...      # URL da sua instância Evolution API
EVOLUTION_API_KEY=sua-chave        # Chave da Evolution API
EVOLUTION_INSTANCE=nome-instancia  # Nome da instância WhatsApp
PORT=3000
NODE_ENV=development
DB_PATH=./data/financeiro.db
```

### Rodar em desenvolvimento

```bash
# Terminal 1 — Backend
cd server && npm run dev

# Terminal 2 — Frontend
cd client && npm run dev
```

Acesse: http://localhost:5173

---

## Deploy no Railway

### 1. Crie o projeto no Railway

```bash
railway login
railway new
```

### 2. Configure as variáveis de ambiente no Railway Dashboard

Acesse seu projeto → **Variables** e adicione:

| Variável | Valor |
|---|---|
| `GEMINI_API_KEY` | Chave do Google AI Studio (grátis) |
| `EVOLUTION_API_URL` | URL da Evolution API |
| `EVOLUTION_API_KEY` | Chave da API |
| `EVOLUTION_INSTANCE` | Nome da instância |
| `NODE_ENV` | `production` |
| `DB_PATH` | `/data/financeiro.db` |

#### Como obter a GEMINI_API_KEY (gratuito)

1. Acesse **https://aistudio.google.com/app/apikey**
2. Faça login com uma conta Google
3. Clique em **"Create API Key"**
4. Copie a chave gerada (começa com `AIza...`)
5. Cole no `.env` como `GEMINI_API_KEY=AIza...`

> O plano gratuito inclui **1.500 requisições/dia** com `gemini-1.5-flash` — mais que suficiente para uso pessoal.

> **Importante:** No Railway, use um volume persistente para `/data` para não perder o banco SQLite entre deploys.

### 3. Adicionar volume persistente

No Railway Dashboard → seu serviço → **Volumes** → Add Volume:
- Mount path: `/data`

### 4. Deploy

```bash
railway up
```

O `Procfile` instrui o Railway a:
1. Buildar o frontend (`cd client && npm install && npm run build`)
2. Iniciar o servidor Node.js que serve o frontend estático

---

## Configuração da Evolution API (WhatsApp)

### O que é a Evolution API?

A [Evolution API](https://github.com/EvolutionAPI/evolution-api) é um servidor self-hosted que conecta o WhatsApp Web ao seu backend via webhook.

### Passos:

1. **Instale a Evolution API** (Docker recomendado):
```bash
docker run -d \
  -p 8080:8080 \
  --name evolution-api \
  atendai/evolution-api:latest
```

2. **Crie uma instância** no painel da Evolution API (http://localhost:8080)

3. **Configure o webhook** apontando para seu backend:
```
URL: https://seu-app.railway.app/api/webhook/whatsapp
Eventos: messages.upsert
```

4. **Escaneie o QR Code** com seu WhatsApp

5. **Teste enviando uma mensagem** para o número conectado:
```
gastei 50 reais no mercado
paguei 35 no uber
recebi 3000 de salário
```

### Como o parser funciona

O sistema usa dois estágios:

**1. Parser por regex (sem IA, instantâneo)**
Extrai valor, data e categoria automaticamente para padrões comuns. Não consome cota da API.

**2. Fallback Gemini (IA, só se o regex falhar)**
Para mensagens ambíguas ou complexas, envia para o `gemini-1.5-flash`.

### Formato das mensagens aceitas

| Mensagem | Resultado | Parser |
|---|---|---|
| `almoço 35` | Gasto — Alimentação — R$ 35 | regex |
| `mercado 89,90` | Gasto — Supermercado — R$ 89,90 | regex |
| `uber 23` | Gasto — Transporte — R$ 23 | regex |
| `farmácia 45,50` | Gasto — Saúde — R$ 45,50 | regex |
| `gasolina 180 ontem` | Gasto — Transporte — R$ 180 (data ontem) | regex |
| `recebi 5000 salário` | Receita — R$ 5.000 | regex |
| `paguei 32 no sushi do shopping` | Gasto — Alimentação — R$ 32 | Gemini |
| `netflix 55,90` | Gasto — Lazer — R$ 55,90 | regex |

---

## Upload de Fatura PDF

1. Acesse **Upload Fatura** no menu lateral
2. Arraste um PDF de fatura (Nubank, Itaú, Bradesco, etc.)
3. Aguarde o processamento com Claude AI (~10-30 segundos)
4. Revise as transações extraídas (edite categorias se necessário)
5. Clique em **Confirmar importação**

> Requer `GEMINI_API_KEY` configurada (grátis em aistudio.google.com).

---

## Estrutura do projeto

```
financeiro/
├── client/                 # React + Vite + Tailwind
│   └── src/
│       ├── components/     # Sidebar, Modal, TransactionModal
│       ├── pages/          # Overview, Gastos, Assinaturas, Dividas, WhatsApp, UploadFatura
│       ├── api.js          # Chamadas à API
│       └── utils/          # Formatadores
├── server/                 # Node.js + Express
│   ├── db/
│   │   ├── database.js     # Conexão SQLite
│   │   └── schema.sql      # Schema + dados iniciais
│   ├── routes/             # dashboard, transactions, categories, cards, subscriptions, debts, whatsapp, upload, settings
│   └── index.js            # Entry point
├── data/                   # SQLite database (gerado automaticamente)
├── Procfile                # Railway deploy
└── .env.example
```

---

## Banco de dados

SQLite via `sql.js` em `./data/financeiro.db` (criado automaticamente na primeira execução).

O banco roda em memória e é persistido em disco após cada escrita — funciona sem nenhuma compilação nativa.

### Categorias padrão

Alimentação · Transporte · Moradia · Saúde · Lazer · Educação · Roupas · Supermercado · Outros

### Cartões padrão

Nubank · Inter · Itaú · Bradesco · Dinheiro

---

## API Endpoints

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/dashboard?month=YYYY-MM` | Dados da visão geral |
| GET/POST/PUT/DELETE | `/api/transactions` | CRUD de lançamentos |
| GET/POST/PUT/DELETE | `/api/categories` | CRUD de categorias |
| GET/POST/PUT/DELETE | `/api/cards` | CRUD de cartões |
| GET/POST/PUT/DELETE | `/api/subscriptions` | CRUD de assinaturas |
| GET/POST/PUT/DELETE | `/api/debts` | CRUD de dívidas |
| POST | `/api/debts/:id/payment` | Registrar pagamento |
| POST | `/api/webhook/whatsapp` | Webhook WhatsApp |
| GET | `/api/webhook/whatsapp/logs` | Histórico WhatsApp |
| GET | `/api/webhook/whatsapp/stats` | Estatísticas WhatsApp |
| POST | `/api/upload/fatura` | Upload e análise de PDF |
| POST | `/api/upload/confirm` | Confirmar importação |
| GET/PUT | `/api/settings` | Configurações |
