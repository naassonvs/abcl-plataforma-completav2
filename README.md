# ABCL Plataforma v2 — Documentação Técnica

## Estrutura de arquivos

```
abcl-v2/
├── index.html        ← Site público do acampamento
├── login.html        ← Login unificado (admin + vendinha)
├── admin.html        ← Painel completo (requer login)
├── links.html        ← Hub de links público (tipo Linktree)
├── css/
│   └── abcl.css      ← Design system compartilhado
├── js/
│   └── core.js       ← Auth, offline queue, sync, toast, IDs únicos
└── assets/
    └── logo-abcl.png
```

---

## Credenciais padrão

| Usuário  | Senha       | Acesso        |
|----------|-------------|---------------|
| naasson  | abcl2026    | Admin completo|
| haniel   | abcl2026    | Admin completo|
| mauri    | abcl2026    | Admin completo|
| caixa    | vendinha    | Vendinha       |
| admin    | abcl@admin  | Admin completo|

> Para alterar, edite o objeto `USERS` em `js/core.js`

---

## Módulos do admin

### Dashboard
- Resumo de vendas, fiado, inscritos, fila de sync
- Status de conexão e API em tempo real
- Últimas vendas

### Vendinha
- **Caixa**: grade de produtos, carrinho, desconto, forma de pagamento
- **Histórico**: filtro por PIX/Dinheiro/Fiado, marcar fiado como pago
- **Fiado**: lista de devedores com totais
- **Estoque**: editar quantidades, adicionar/remover produtos

### Financeiro
- Totais por forma de pagamento
- Lista de devedores com ação "marcar pago"
- Resumo por data/período
- Exportar CSV

### Inscrições
- Carrega dados do Google Forms via Apps Script
- Busca por nome/cidade
- Filtros: pagos, pendentes, menores
- Cache local para uso offline
- Exportar CSV

### Preletores
- CRUD completo com foto (base64)
- Usado também na página pública

### Links Hub
- Gerenciar links da página /links
- Editar cabeçalho

### Configurações
- Todos os dados do evento (datas, local, preços, temas)
- ID do dispositivo (para multi-caixa)
- Limpar fila de sync

---

## Offline-first

O sistema opera **completamente sem internet**:

1. Venda registrada → salva em `localStorage`
2. Adicionada à `fila de sync` com ID único
3. Badge na sidebar mostra quantos itens pendentes
4. Quando internet volta → sync automático via `SyncEngine`
5. Botão "↻ Sync" na sidebar para sync manual
6. Banner amarelo no topo quando offline

---

## IDs únicos (anti-duplicidade)

Formato: `ABCL-YYYYMMDD-DEVICE-0001`

Exemplo: `ABCL-20260604-CAIXA01-0023`

- Cada dispositivo tem ID configurável em Configurações
- ID gerado na primeira abertura e persistido
- Garante que duas vendas nunca tenham o mesmo ID

---

## Multi-dispositivo

Configure dispositivos diferentes em **Admin > Configurações > ID do dispositivo**:

- `CAIXA01` — notebook principal
- `CAIXA02` — notebook auxiliar
- `TABLET01` — tablet de check-in
- `PHONE01`  — celular auxiliar

---

## APIs Google Sheets

Em `js/core.js`, edite:

```js
const ABCL_CONFIG = {
  SALES_API:  'https://script.google.com/.../exec',  // vendas
  FORMS_API:  'https://script.google.com/.../exec',  // inscrições
};
```

### Formato esperado pela API de vendas (POST)

```json
{
  "action": "sale_create",
  "data": {
    "id": "ABCL-20260604-CAIXA01-0001",
    "pessoa": "João Silva",
    "itens": [{"nome": "Coca-Cola", "qtd": 2, "preco": 3}],
    "total": 6,
    "pagamento": "PIX",
    "periodo": "Tarde",
    "createdAt": "2026-06-04T15:30:00.000Z"
  }
}
```

### Formato esperado pela API de inscrições (GET)

```
GET ?action=getRegistrations
```

Retorno esperado:

```json
{
  "data": [
    { "nome": "João", "cidade": "CL", "idade": "22", "telefone": "31999...", "pagamento": "pago" }
  ]
}
```

---

## Deploy

### Netlify (recomendado — mais fácil)
1. Acesse **netlify.com/drop**
2. Arraste a pasta `abcl-v2`
3. Pronto — URL gerada automaticamente

### GitHub Pages
1. Crie repositório público
2. Suba os arquivos
3. Settings → Pages → Branch: main → Folder: / (root)

### Vercel
```bash
npm i -g vercel
cd abcl-v2
vercel --prod
```

---

## Próximos passos (Fase 2)

Após usar no acampamento e coletar feedback real:

- [ ] Migrar para Next.js + Supabase
- [ ] Auth real (NextAuth ou Supabase Auth)
- [ ] PWA completo com service worker
- [ ] Push notifications para sync
- [ ] Relatórios em PDF
- [ ] Gestão de quartos/acomodações
- [ ] App mobile (React Native ou PWA)
