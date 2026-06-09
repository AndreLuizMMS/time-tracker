# MentalMap — Brand & Design System

> Fonte única da verdade visual. Toda cor, fonte, raio, sombra e transição da UI vem daqui.
> Nada de hardcode. Nada de "achismo de bom gosto" fora deste arquivo.

---

## 1. Voz visual (mood)

A marca é **um segundo cérebro**: o lugar onde todas as suas atribuições, projetos e fios de pensamento vivem mapeados. É **calma, profunda e estruturada**, com cara de **mapa mental à noite** — nós que acendem, conexões que se desenham, ordem emergindo do caos.

- Não é um cronômetro. É **cartografia da mente**. O timer continua, mas é uma ferramenta dentro do mapa — nunca o herói.
- O **mapa é o herói**. A estrutura — projetos, tarefas, foco do dia — manda na hierarquia. O olho lê o território antes dos números.
- **Dark-first.** O escuro é o céu de pensamentos; o claro é derivado (mapa em papel).
- **Indigo com propósito.** A cor da cognição só onde importa: nó em foco, ação ativa, conexão viva.
- **Ciano sináptico** é a faísca — o destaque que diz "isto está aceso agora". Raro, elétrico.
- **Respiração.** Densidade baixa, blocos separados como nós no espaço, ar entre seções.

### Personalidade de motion

Cognitivo/preciso → **motion crisp e curto**. Durações baixas, `ease-out` em entradas. Zero bounce. O nó em foco **respira** (pulso sináptico lento) — único movimento contínuo permitido, porque comunica "ativo / pensando". Conexões e linhas **se desenham** (não aparecem secas) em `ease-out`.

---

## 2. Tipografia

| Papel       | Família                          | Uso                                                              |
| ----------- | -------------------------------- | --------------------------------------------------------------- |
| **Display** | `Space Grotesk`                  | Títulos, rótulos de nó, valores de KPI, números com peso        |
| **Body**    | `Inter`                          | Corpo, descrições, labels de formulário, botões                 |
| **Mono**    | `JetBrains Mono`                 | Timer, intervalos, durações, IDs de nó, metadados e coordenadas |

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
| `--text-lg`    | 22px    | valores de KPI, rótulo de nó grande  |
| `--text-xl`    | 32px    | hero secundário                      |
| `--text-2xl`   | 48px    | número/timer hero                    |

**Regras tipográficas**
- Números em coluna/timer → sempre `font-variant-numeric: tabular-nums` (mono já é tabular).
- Micro-labels → `font-mono`, `text-transform: uppercase`, `letter-spacing: 0.14em`, `--neutral-500`.
- Linha de corpo nunca passa de 65ch.

---

## 3. Cores

Dark-first. Os tokens semânticos (`--bg`, `--surface`, `--text-*`) trocam por tema; a escala bruta é fixa. A neutra é **slate azul-noite** — frio, profundo, de céu.

### Escala neutra (cool slate / azul-noite)

```css
--neutral-0:   #ffffff;
--neutral-50:  #f5f6fb;
--neutral-100: #e9ebf4;
--neutral-200: #d1d4e6;
--neutral-300: #a8adc8;
--neutral-400: #7e84a2;
--neutral-500: #5e6380;
--neutral-600: #444862;
--neutral-700: #2c2f44;
--neutral-800: #1c1e2e;
--neutral-900: #15161f;
--neutral-950: #0e0e16;  /* céu de pensamentos */
```

### Primária — Neural Indigo (a cor da marca)

```css
--primary-300: #9C90F8;
--primary-400: #8676F7;  /* texto/acento de destaque no dark */
--primary-500: #6D5DF5;  /* brand — nó em foco, CTA, item ativo */
--primary-600: #5847D8;
--primary-700: #4636B0;  /* hover no light */
```

### Acento — Synaptic Cyan (a faísca)

A faísca sináptica: "aceso agora", conexão viva, link entre nós. Use com parcimônia — pontual, elétrico, nunca em área grande.

```css
--accent-300: #67E3F4;
--accent-400: #3CDCEF;
--accent-500: #22D3EE;  /* conexão ativa, link, highlight pontual */
--accent-600: #12AEC7;
```

### Funcionais

```css
--success: #36C28E;
--warning: #E0A03B;
--error:   #E24B4A;
--error-soft: #F09595;
--info:    #5B8DEF;
```

### Cores de projeto (categóricas — fixas, ligadas aos dados)

```
Geral #6D5DF5 · Design #5B8DEF · Desenvolvimento #D4537E · Reunião #BA7517 · Pesquisa #22D3EE
```
Uso: dot do nó e accent bar lateral da entrada. Nunca como fundo de área grande.

### Semânticos — tema escuro (padrão)

```css
--bg:               var(--neutral-950);
--surface:          var(--neutral-900);
--surface-2:        var(--neutral-800);
--surface-3:        var(--neutral-700);
--border:           rgba(255,255,255,0.08);
--border-strong:    rgba(255,255,255,0.16);
--text-primary:     #ecedf6;
--text-secondary:   var(--neutral-300);
--text-tertiary:    var(--neutral-400);
--primary:          var(--primary-500);
--primary-hover:    var(--primary-400);
--accent:           var(--accent-500);
--on-primary:       #ffffff;
```

### Semânticos — tema claro (derivado · mapa em papel)

```css
--bg:               var(--neutral-50);
--surface:          var(--neutral-0);
--surface-2:        var(--neutral-100);
--surface-3:        var(--neutral-200);
--border:           rgba(20,22,40,0.09);
--border-strong:    rgba(20,22,40,0.18);
--text-primary:     var(--neutral-950);
--text-secondary:   var(--neutral-600);
--text-tertiary:    var(--neutral-500);
--primary:          var(--primary-500);
--primary-hover:    var(--primary-700);
--accent:           var(--accent-600);
--on-primary:       #ffffff;
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
--shadow-md:   0 6px 20px rgba(0,0,0,0.40);
--shadow-lg:   0 16px 48px rgba(0,0,0,0.50);
--shadow-glow: 0 0 0 1px rgba(109,93,245,0.40), 0 10px 34px rgba(109,93,245,0.22);
```

`--shadow-glow` é o **halo do nó em foco** — indigo, suave, como sinapse acendendo.

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
- Linhas de conexão entre nós **se desenham** em `ease-out` (`stroke-dashoffset`/`opacity`), nunca piscam.

## 7. Spacing

Escala em múltiplos de 4: `4 8 12 16 20 24 32 40 48 64`.
Padding de card 20-24px · gap interno 12-16px · separação entre blocos/nós 24-32px.

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

### Card / Nó
A unidade visual é o **nó**: um card que representa um ponto do mapa (projeto, tarefa, entrada).
`background: var(--surface)` · `border: 1px solid var(--border)` · `radius: var(--radius-lg)` · padding 20-24px. Hover (se clicável): `border-color: var(--border-strong)`.

### Nó em foco (hero)
Card + acento: quando ativo/em foco, `border-color: var(--primary)` + `box-shadow: var(--shadow-glow)` + pulso sináptico lento do dot. É o único elemento que respira.

### KPI / StatCard
`background: var(--surface)` · accent bar lateral 3px. Label em mono uppercase `--text-xs` `--neutral-400`. Valor em Display `--text-lg` `--text-primary` tabular. O KPI principal ("Hoje") usa accent `var(--primary)` e valor `var(--primary-400)`.

### Badge de projeto
`radius: var(--radius-full)` · `background: var(--surface-2)` · `border: 1px solid var(--border)` · `text-xs` · dot da cor do projeto.

### Linha de entrada
Card pequeno · accent bar lateral 3px na cor do projeto · descrição (body, primary) · badge projeto · intervalo (mono, tertiary) · duração (mono, secondary, peso 600) · botão deletar (ghost, ícone). Toda a linha clicável (editar). Hover: `border-color: var(--border-strong)`.

### Conexão (linha entre nós)
Quando o desenho mostrar relação entre nós: traço de 1.5px, `var(--border-strong)` em repouso, `var(--accent)` quando a conexão está viva/em foco. Curva suave, nunca ortogonal dura. Desenha-se em `ease-out`.

---

## 9. Foco, toque e movimento (a11y)

- **Foco visível** em todo focável: `:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(109,93,245,0.35); }`.
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
- Motivos da marca: nó/círculo, conexão, ramificação, mapa, cérebro/sinapse — preferir esses ícones onde a metáfora ajudar.

---

## 11. Do & Don't

**Do**
- Deixe o mapa ser o herói: estrutura e nó em foco dominam; números servem.
- Use indigo para o que está em foco/ativo; ciano só para a faísca pontual.
- Use mono para todo número, ID e metadado que o olho lê de relance.
- Uma única CTA primária por contexto.
- Respire: ar entre nós, padding generoso.

**Don't**
- Não use indigo nem ciano em fundo grande ou decorativo.
- Não trate o app como cronômetro: o timer é ferramenta, não herói.
- Não misture famílias de ícone nem use emoji.
- Não anime ação repetida (toggle, hover de menu) com duração perceptível.
- Não deixe número "dançar": sempre tabular.
- Não crie botão/card "caseiro" quando há padrão aqui.
