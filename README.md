# Time Tracker

App de acompanhamento de horas trabalhadas, inspirado no ClickUp.

## Funcionalidades

- Timer em tempo real com start/stop
- Entrada manual de horas
- Projetos com cores distintas
- Entradas agrupadas por dia
- Totais: hoje, semana e geral
- Dados salvos no localStorage (persistem entre sessões)
- Dark mode automático

## Deploy na Vercel

### Opção 1 — Arrastar e soltar (mais simples)

1. Acesse [vercel.com](https://vercel.com) e faça login
2. Clique em **Add New → Project**
3. Arraste esta pasta para o campo de upload
4. Clique em **Deploy**

### Opção 2 — Via CLI

```bash
npm install
npm run dev        # rodar localmente
npx vercel         # deploy
```

## Rodar localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:5173`
