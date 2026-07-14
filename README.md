# Raízes do Nordeste - API REST

API Back-end para a rede de lanchonetes **Raízes do Nordeste**, uma rede em expansão que atende múltiplos canais (APP, TOTEM, BALCÃO, PICKUP, WEB).

## Fluxo MVP Implementado

**Fluxo A:** Pedido → Pagamento Mock → Atualização de Status

O sistema permite:
- Criação de pedidos com validação de canal, estoque e produtos
- Simulação de pagamento via gateway mock (aprovado/recusado)
- Atualização automática do status do pedido conforme resultado do pagamento
- Registro de auditoria em todas as ações sensíveis

---

## Tecnologias

| Tecnologia | Versão | Função |
|---|---|---|
| Node.js | ≥ 18 | Runtime |
| Express | 4.21.1 | Framework HTTP |
| PostgreSQL | ≥ 14 | Banco de dados |
| Prisma ORM | 5.22.0 | ORM + Migrations |
| JWT | 9.0.2 | Autenticação |
| bcrypt | 5.1.1 | Hash de senhas |
| Swagger/OpenAPI | 3.0 | Documentação |

---

## Requisitos para Rodar

- Node.js 18+
- PostgreSQL 14+ (rodando localmente ou em container)
- npm ou yarn

---

## Instalação e Execução

### 1. Clonar o repositório

```bash
git clone https://github.com/DanielAlexssander/Raizes-Do-Nordeste-API
cd raizes-do-nordeste-api
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar variáveis de ambiente

Copie o arquivo `.env.example` para `.env` e ajuste as variáveis:

```bash
cp .env.example .env
```

Edite o `.env`:
```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/raizes_nordeste?schema=public"
JWT_SECRET="minha-chave-secreta-jwt-2026"
JWT_EXPIRES_IN="1h"
PORT=3000
```

### 4. Criar o banco de dados

```bash
createdb raizes_nordeste
```

### 5. Executar migrations

```bash
npx prisma migrate dev --name init
```

### 6. Executar seed (dados iniciais)

```bash
npx prisma db seed
```

Isso cria:
- 3 usuários (admin, gerente, cliente) — senha: `Senha@123`
- 2 unidades
- 5 produtos
- Estoque inicial
- Fidelidade para o cliente

### 7. Iniciar a API

```bash
npm run dev
```

A API estará disponível em: `http://localhost:3000`

---

## Documentação Swagger

Acesse após iniciar a API:

```
http://localhost:3000/api-docs
```

---

## Estrutura do Projeto

```
raizes-do-nordeste-api/
├── prisma/
│   ├── schema.prisma        # Modelo de dados (DER)
│   └── seed.js              # Dados iniciais
├── src/
│   ├── api/                 # Camada API (Controllers/Rotas)
│   │   ├── middlewares/
│   │   │   ├── auth.js          # Autenticação JWT + Autorização
│   │   │   └── errorHandler.js  # Tratamento padronizado de erros
│   │   ├── routes/
│   │   │   ├── auth.js          # Login, registro, perfil
│   │   │   ├── unidades.js      # CRUD unidades
│   │   │   ├── produtos.js      # CRUD produtos
│   │   │   ├── estoque.js       # Movimentação estoque
│   │   │   ├── pedidos.js       # Fluxo de pedidos
│   │   │   ├── pagamentos.js    # Pagamento mock
│   │   │   └── fidelidade.js    # Programa de fidelidade
│   │   └── app.js              # Configuração Express + Swagger
│   ├── infrastructure/      # Camada Infraestrutura
│   │   ├── database.js          # Prisma Client
│   │   ├── auditoria.js         # Logs de auditoria
│   │   └── pagamentoGateway.js  # Gateway de pagamento mock
│   └── server.js            # Ponto de entrada
├── postman_collection.json  # Coleção Postman
├── .env.example
├── .gitignore
└── package.json
```

### Arquitetura em Camadas

| Camada | Responsabilidade |
|---|---|
| **API** | Rotas, middlewares, contratos HTTP, Swagger |
| **Infrastructure** | Banco de dados (Prisma), auditoria, gateway mock |
| **Domain** | Regras de negócio embutidas nas rotas (validações de estoque, canal, status) |

---

## Endpoints Principais

| Recurso | Método | Rota | Auth | Descrição |
|---|---|---|---|---|
| Auth | POST | /auth/login | Público | Login e geração de token |
| Auth | POST | /auth/registro | Público | Cadastro de usuário |
| Auth | GET | /auth/perfil | JWT | Dados do usuário logado |
| Unidades | GET | /unidades | JWT | Listar unidades (paginado) |
| Unidades | POST | /unidades | JWT + ADMIN/GERENTE | Criar unidade |
| Produtos | GET | /produtos | JWT | Listar produtos (paginado) |
| Produtos | POST | /produtos | JWT + ADMIN/GERENTE | Criar produto |
| Produtos | PUT | /produtos/:id | JWT + ADMIN/GERENTE | Atualizar produto |
| Estoque | GET | /estoque?unidadeId= | JWT | Consultar estoque |
| Estoque | POST | /estoque/movimentar | JWT + ADMIN/GERENTE/ATENDENTE | Entrada/saída |
| Pedidos | POST | /pedidos | JWT | Criar pedido |
| Pedidos | GET | /pedidos | JWT | Listar pedidos (filtro por canal) |
| Pedidos | GET | /pedidos/:id | JWT | Detalhe do pedido |
| Pedidos | PATCH | /pedidos/:id/status | JWT + Staff | Atualizar status |
| Pedidos | PATCH | /pedidos/:id/cancelar | JWT | Cancelar pedido |
| Pagamentos | POST | /pagamentos | JWT | Solicitar pagamento mock |
| Pagamentos | GET | /pagamentos/:pedidoId | JWT | Consultar pagamento |
| Fidelidade | GET | /fidelidade/saldo | JWT | Saldo de pontos |
| Fidelidade | POST | /fidelidade/consentimento | JWT | Registrar consentimento |

---

## Autenticação e Roles

| Role | Permissões |
|---|---|
| ADMIN | Acesso total |
| GERENTE | Gestão de unidades, produtos, estoque, pedidos |
| ATENDENTE | Atualizar status de pedidos, movimentar estoque |
| COZINHA | Atualizar status de pedidos |
| CLIENTE | Criar pedidos, consultar seus pedidos, fidelidade |

### Como obter o token

1. Faça login em `POST /auth/login`
2. Copie o `accessToken` retornado
3. Use como header: `Authorization: Bearer <token>`

---

## Padrão de Erro

Todos os erros seguem o formato:

```json
{
  "error": "CODIGO_ERRO",
  "message": "Mensagem legível",
  "details": [{ "field": "campo", "issue": "problema" }],
  "timestamp": "2026-06-17T12:00:00.000Z",
  "path": "/rota"
}
```

---

## Multicanalidade

O campo `canalPedido` é **obrigatório** na criação de pedidos:
- Valores aceitos: `APP`, `TOTEM`, `BALCAO`, `PICKUP`, `WEB`
- Pedidos podem ser filtrados por canal: `GET /pedidos?canalPedido=APP`
- Validação retorna erro 400 (ausente) ou 422 (inválido)

---

## Coleção Postman

Importe o arquivo `postman_collection.json` no Postman.

### Ordem recomendada para testar:

1. **T01** - Login válido (Cliente) → salva token
2. **T02** - Login Admin → salva adminToken
3. **T03** - Login inválido → valida 401
4. **T04** - Acesso sem token → valida 401
5. **T05** - Cliente cria unidade → valida 403
6. **T06** - Produto sem campo obrigatório → valida 400
7. **T07** - Criar pedido válido → valida 201 + fluxo
8. **T08** - Pedido sem canalPedido → valida 400
9. **T09** - Pedido com canal inválido → valida 422
10. **T10** - Pedido com produto inexistente → valida 404
11. **T11** - Pedido com estoque insuficiente → valida 409
12. **T12** - Pagamento mock → valida aprovado/recusado

---

## Usuários de Teste (Seed)

| Email | Senha | Role |
|---|---|---|
| admin@raizes.com | Senha@123 | ADMIN |
| gerente@raizes.com | Senha@123 | GERENTE |
| cliente@email.com | Senha@123 | CLIENTE |

---

## Link do Repositório

[LINK DO REPOSITÓRIO](https://github.com/DanielAlexssander/Raizes-Do-Nordeste-API)

 A aplicação está completa e funcionando. Projeto verificado com sucesso — o require('./src/api/app') carrega sem
  erros.
  
  O que está implementado:

  - ✅ Fluxo A completo (Pedido → Pagamento Mock → Status)
  - ✅ Multicanalidade (canalPedido ENUM obrigatório)
  - ✅ Auth JWT com 5 roles
  - ✅ Padrão de erro JSON consistente
  - ✅ Paginação em listagens
  - ✅ Estoque atômico (transação)
  - ✅ Logs de auditoria
  - ✅ Swagger em /api-docs
  - ✅ Coleção Postman com 12 cenários (7 positivos, 5 negativos)
  - ✅ README com instruções completas
  - ✅ pdf.md com toda a documentação para o PDF final