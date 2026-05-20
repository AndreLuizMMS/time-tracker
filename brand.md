# Time Tracker — Brand & Design System

> Fonte única da verdade visual. Toda cor, fonte, raio, sombra e transição da UI vem daqui.
> Nada de hardcode. Nada de "achismo de bom gosto" fora deste arquivo.

---

## 1. Voz visual (mood)

A marca é **calma, precisa e focada**, com cara de **ferramenta de estúdio / cronômetro profissional**, e transmite **controle do tempo sem ansiedade**.

- Não é um app de produtividade gritante. É um instrumento de medição confiável.
- O **tempo é o herói**. O timer e os números mandam na hierarquia.
- **Dark-first.** O tema escuro é o padrão de design; o claro é derivado.
- **Teal com propósito.** Cor primária só onde importa: ação ativa, valor em destaque, item corrente.
- **Respiração.** Densidade baixa, blocos separados, ar entre seções.

### Personalidade de motion

Profissional/preciso → **motion crisp e curto**. Durações baixas, `ease-out` em entradas. Zero bounce. O timer ativo respira (pulse lento) — único movimento contínuo permitido, porque comunica "rodando".

---

## 2. Tipografia

| Papel       | Família                          | Uso                                                              |
| ----------- | -------------------------------- | --------------------------------------------------------------- |
| **Display** | `Space Grotesk`                  | Títulos, valores de KPI, números grandes que precisam de peso   |
| **Body**    | `Inter`                          | Corpo, descrições, labels de formulário, botões                 |
| **Mono**    | `JetBrains Mono`                 | Timer, intervalos de horário, durações, micro-labels técnicos   |

```css
--font-display: 'Space Grotesk', system-ui, sans-serif;
--font-body: 'Inter', system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', monospace;
```

Pesos: Display 500/600/700 · Body 400/500/600 · Mono 400/500/600.

### Type scale

| Token          | Tamanho | Uso                                  |
| -------------- | ------- | ------------------------------------ |
| `--text-xs`    | 11px    | micro-labels (uppercase, mono)       |
| `--text-sm`    | 13px    | corpo secundário, metadados          |
| `--text-base`  | 14px    | corpo padrão, inputs, botões         |
| `--text-md`    | 16px    | títulos de seção, logo               |
| `--text-lg`    | 22px    | valores de KPI                       |
| `--text-xl`    | 32px    | hero secundário                      |
| `--text-2xl`   | 48px    | timer hero                           |

**Regras tipográficas**
- Números em coluna/timer → sempre `font-variant-numeric: tabular-nums` (mono já é tabular).
- Micro-labels → `font-mono`, `text-transform: uppercase`, `letter-spacing: 0.14em`, `--neutral-500`.
- Linha de corpo nunca passa de 65ch.

---

## 3. Cores

Dark-first. Os tokens semânticos (`--bg`, `--surface`, `--text-*`) trocam por tema; a escala bruta é fixa.

### Escala neutra (warm gray)

```css
--neutral-0:   #ffffff;
--neutral-50:  #f7f7f5;
--neutral-100: #ececea;
--neutral-200: #d8d6d0;
--neutral-300: #b4b2a9;
--neutral-400: #908e85;
--neutral-500: #74726b;
--neutral-600: #54534e;
--neutral-700: #3a3936;
--neutral-800: #2a2a27;
--neutral-900: #1c1c1a;
--neutral-950: #131311;
```

### Primária — Teal (a cor da marca)

```css
--primary-300: #5DCAA5;
--primary-400: #2FB488;  /* texto/acento de destaque no dark */
--primary-500: #1D9E75;  /* brand — CTA, item ativo */
--primary-600: #16805F;
--primary-700: #0F6E56;  /* hover no light */
```

### Funcionais

```css
--success: #1D9E75;
--warning: #E0A03B;
--error:   #E24B4A;
--error-soft: #F09595;
--info:    #378ADD;
```

### Cores de projeto (categóricas — fixas, ligadas aos dados)

```
Geral #1D9E75 · Design #378ADD · Desenvolvimento #D4537E · Reunião #BA7517 · Pesquisa #7F77DD
```
Uso: dot e accent bar lateral da entrada. Nunca como fundo de área grande.

### Semânticos — tema escuro (padrão)

```css
--bg:               var(--neutral-950);
--surface:          var(--neutral-900);
--surface-2:        var(--neutral-800);
--surface-3:        var(--neutral-700);
--border:           rgba(255,255,255,0.08);
--border-strong:    rgba(255,255,255,0.16);
--text-primary:     #f1efe8;
--text-secondary:   var(--neutral-300);
--text-tertiary:    var(--neutral-400);
--primary:          var(--primary-500);
--primary-hover:    var(--primary-400);
--on-primary:       var(--neutral-950);
```

### Semânticos — tema claro (derivado)

```css
--bg:               var(--neutral-50);
--surface:          var(--neutral-0);
--surface-2:        var(--neutral-100);
--surface-3:        var(--neutral-200);
--border:           rgba(0,0,0,0.09);
--border-strong:    rgba(0,0,0,0.18);
--text-primary:     var(--neutral-950);
--text-secondary:   var(--neutral-600);
--text-tertiary:    var(--neutral-500);
--primary:          var(--primary-500);
--primary-hover:    var(--primary-700);
--on-primary:       var(--neutral-0);
```

**Contraste mínimo:** corpo ≥ 4.5:1, UI grande ≥ 3:1.

---

## 4. Raios

```css
--radius-sm:   8px;
--radius-md:   10px;
--radius-lg:   14px;
--radius-xl:   20px;
--radius-full: 999px;
```

## 5. Sombras (dark-first, sutis)

```css
--shadow-sm:   0 1px 2px rgba(0,0,0,0.30);
--shadow-md:   0 6px 20px rgba(0,0,0,0.35);
--shadow-lg:   0 16px 48px rgba(0,0,0,0.45);
--shadow-glow: 0 0 0 1px rgba(29,158,117,0.35), 0 10px 34px rgba(29,158,117,0.20);
```

## 6. Transições

```css
--transition-fast:   140ms;
--transition-normal: 220ms;
--transition-slow:   320ms;
--ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
```

- Entradas/saídas → `ease-out`. Movimento na tela → `ease-in-out`. Cor/hover → `ease`.
- **Nunca** `ease-in` em UI. **Nunca** `transition: all`. Animar só `transform` e `opacity`.
- Press feedback < 160ms · dropdown < 250ms · modal < 400ms.

## 7. Spacing

Escala em múltiplos de 4: `4 8 12 16 20 24 32 40 48 64`.
Padding de card 20-24px · gap interno 12-16px · separação entre blocos 24-32px.

---

## 8. Padrões de componentes

### Botão primário (`.btn-primary`)
Altura 44px · `background: var(--primary)` · texto `var(--on-primary)` · `font-weight: 600` · `radius: var(--radius-md)` · hover `var(--primary-hover)` + `--shadow-glow` · `:active { transform: scale(0.97); }` · disabled `opacity: 0.45 + not-allowed`.
Variante perigo (`.btn-stop`): `background: var(--error)`.

### Botão secundário (`.btn-secondary`)
Altura 44px · `background: transparent` · `border: 1px solid var(--border-strong)` · texto `var(--text-secondary)` · hover `background: var(--surface-2)` · mesmo `:active`.

### Botão fantasma (`.btn-ghost`)
Sem borda · texto `var(--text-secondary)` · hover `color: var(--text-primary)` + `background: var(--surface-2)`.

### Input / Select
Altura 44px · `background: var(--surface-2)` · `border: 1px solid var(--border)` · `radius: var(--radius-md)` · foco `border-color: var(--primary)` + ring (ver foco). Erro: `border-color: var(--error)` + texto de erro `--error`, `text-sm`.

### Card
`background: var(--surface)` · `border: 1px solid var(--border)` · `radius: var(--radius-lg)` · padding 20-24px. Hover (se clicável): `border-color: var(--border-strong)`.

### Card hero (timer)
Card + accent: quando ativo, `border-color: var(--primary)` + `box-shadow: var(--shadow-glow)` + pulse lento do dot.

### KPI / StatCard
`background: var(--surface)` · accent bar lateral 3px. Label em mono uppercase `--text-xs` `--neutral-400`. Valor em Display `--text-lg` `--text-primary` tabular. O KPI principal ("Hoje") usa accent `var(--primary)` e valor `var(--primary-400)`.

### Badge de projeto
`radius: var(--radius-full)` · `background: var(--surface-2)` · `border: 1px solid var(--border)` · `text-xs` · dot da cor do projeto.

### Linha de entrada
Card pequeno · accent bar lateral 3px na cor do projeto · descrição (body, primary) · badge projeto · intervalo (mono, tertiary) · duração (mono, secondary, peso 600) · botão deletar (ghost, ícone). Toda a linha clicável (editar). Hover: `border-color: var(--border-strong)`.

---

## 9. Foco, toque e movimento (a11y)

- **Foco visível** em todo focável: `:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(29,158,117,0.30); }`.
- **Alvo de toque ≥ 44px**. Gap ≥ 8px entre alvos.
- **Hover sempre gated**: `@media (hover: hover) and (pointer: fine) { ... }`.
- **Status nunca só por cor** — sempre dot/ícone + texto.
- **Reduced motion**:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```

---

## 10. Iconografia

- Família única: **Tabler Icons** (webfont `ti`). Nunca emoji como ícone estrutural.
- Tamanhos da escala: 16 / 20 / 24. Cor via `currentColor`.
- Stroke uniforme (padrão Tabler 2px). SVG/webfont, nunca PNG raster.

---

## 11. Do & Don't

**Do**
- Deixe o tempo ser o herói: timer e KPI "Hoje" dominam.
- Use mono para todo número que o olho lê de relance.
- Uma única CTA primária por contexto (Iniciar/Parar).
- Respire: ar entre blocos, padding generoso.

**Don't**
- Não use teal em fundo grande nem decorativo.
- Não misture famílias de ícone nem use emoji.
- Não anime ação repetida (toggle, hover de menu) com duração perceptível.
- Não deixe número "dançar": sempre tabular.
- Não crie botão/card "caseiro" quando há padrão aqui.
