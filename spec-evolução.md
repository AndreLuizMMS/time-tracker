# Time Tracker — Mapa Mental do Tech Lead: Spec Conceitual

## Visão geral

É o **mapa mental de um tech lead** que faz malabarismo entre múltiplos projetos e pessoas. Resolve um problema só: *não deixar cair nenhuma responsabilidade*. Projetos, categorias, tempo e tarefas existem todos a serviço disso.

Não substitui o software de gestão (que computa hora/tarefa do time e presta contas). É a camada **pessoal e privada** onde você enxerga e organiza o próprio trabalho antes de ele virar número oficial. A única ponte externa é o transporte manual, 1:1, das horas do cronômetro pro software de gestão.

A tela é um **cockpit de desktop**: um radar transversal no topo (o que não pode cair, em qualquer projeto) e o trabalho organizado por projeto abaixo. O design prioriza mostrar muita informação de forma calma e legível, com captura rápida que já deixa tudo no lugar.

## Atores e capacidades

| Ator | O que pode fazer | O que não pode fazer |
|---|---|---|
| **Você** (tech lead) | Tudo: criar projetos e categorias, registrar e cronometrar tempo, criar e organizar tarefas, delegar (marcar aguardando), ler o cockpit, transportar horas manualmente. | — (é o dono único). |
| **O sistema** (automações) | Contar o tempo do cronômetro, derivar a cola e o radar, acender os sinais de atenção (aguardando há 2 dias úteis, prazo vencido), herdar defaults de captura. | Mudar estado de tarefa, apagar ou reorganizar dado seu por conta própria. |

Não há ator externo com acesso. O software de gestão é **destino**, não ator.

## Entidades principais

- **Projeto** — uma frente de trabalho (Regula+ Fase 2, SisBRR Fase 2, Gestão de Projeto). Tem nome e cor, sem ciclo de vida. **Geral** é um projeto embutido, sempre presente e não removível, que recolhe todo item sem projeto.
- **Categoria** — o tipo de atividade (Reunião, Code Review, Desenvolvimento, Teste, Planejamento). Global: a mesma lista vale para todos os projetos.
- **Tarefa** — algo a fazer ou acompanhar. Pertence a um projeto (ou Geral), opcionalmente a uma categoria, e tem ciclo de vida. Carrega atributos ortogonais ao ciclo: prioridade, foco do dia (★) e prazo opcional.
- **Entrada de tempo** — um bloco de trabalho cronometrado ou lançado à mão, ancorado a uma data. Pertence a um projeto (ou Geral) e sempre a uma categoria. Sem ciclo de vida: existe, é editável e removível com desfazer.
- **Cronômetro ativo** — transitório e único. Quando rodando carrega descrição, projeto e categoria; ao parar, vira uma Entrada de tempo.

**Relações:** um Projeto agrupa muitas Tarefas e Entradas; cada Tarefa e cada Entrada pertence a no máximo um projeto (sem projeto = Geral). Categoria é global e cada Tarefa/Entrada referencia no máximo uma. Iniciar o cronômetro a partir de uma tarefa **herda** descrição + projeto + categoria, mas a entrada gerada não fica amarrada à tarefa depois.

## Máquina de estados — Tarefa

| Estado | Significado | Transições | Quem |
|---|---|---|---|
| **Aberta** | Sua, pendente, na sua mão | → Aguardando, → Concluída | você |
| **Aguardando** | Delegada / esperando alguém; guarda a pessoa (opcional) e desde quando | → Aberta (voltou pra você), → Concluída | você |
| **Concluída** | Resolvida; guarda quando | → Aberta (reabrir) | você |

- O sistema **nunca** transita o estado sozinho. O "aguardando há 2 dias úteis" é sinal visual derivado, não transição.
- Reabrir leva sempre para Aberta (não direto para Aguardando).
- Prioridade, ★ e prazo são atributos ortogonais ao ciclo: uma tarefa Aguardando pode estar no foco do dia e ter prazo.

---

## Funcionalidades

### Gerir projetos e categorias
**Descrição:** criar, renomear, recolorir e remover projetos; o mesmo para categorias (lista global).
**Quem aciona:** você.
**Fluxo principal:** abre o gerenciador, adiciona ou edita; a mudança vale na hora em todo lugar.
**Regras de negócio:** "Geral" não pode ser removido nem renomeado; remover um projeto não destrói nada — os itens caem para Geral; deve existir sempre ao menos uma categoria; remover categoria em uso pede confirmação e os itens passam a "Sem categoria" (neutro).
**Edge cases:** nomes/cores repetidos são permitidos; remover o último projeto não-Geral é válido (sobra só Geral).

### Registrar tempo com captura rápida
**Descrição:** registrar um bloco de trabalho — pelo cronômetro ou à mão — sempre com projeto (ou Geral) e categoria.
**Quem aciona:** você.
**Pré-condição:** existir ao menos uma categoria.
**Fluxo principal (cronômetro):** projeto e categoria já vêm com os **últimos usados**; você digita o que está fazendo (opcional) e inicia; ao parar, vira entrada na data/horário reais. Registrar não pode exigir escolha — o default herdado faz o trabalho.
**Fluxo principal (manual):** escolhe data, início, fim (ou duração), projeto, categoria e descrição; salva.
**Fluxos alternativos:** iniciar a partir de uma tarefa (herda dados); retomar uma entrada (estende a própria); editar/remover com desfazer.
**Exceções:** cronômetro < 1s ao parar é descartado; início ajustado para o futuro assume o dia anterior.
**Edge cases:** cronômetro que cruza a meia-noite ancora a entrada na data de início; sobreposição no mesmo dia avisa, não bloqueia.

### Reaproveitar o que já existe (transição do modelo)
**Descrição:** ao entrar o eixo Projeto, entradas e configuração atuais continuam válidas sem refazer nada.
**Quem aciona:** o sistema, uma vez; você ajusta depois se quiser.
**Fluxo principal:** as categorias atuais viram as Categorias globais (sem mudança visível); toda entrada existente mantém sua categoria e recebe o projeto **Geral**; daí em diante você atribui projeto normalmente.
**Regras de negócio:** nada é perdido nem reescrito além de ganhar "Geral". O histórico fica em Geral mesmo que o texto mencione um projeto.
**Edge case:** importar backup no formato atual segue a mesma regra.

### Criar e organizar tarefas
**Descrição:** criar tarefa com título, projeto (opcional → Geral), categoria (opcional) e prioridade.
**Quem aciona:** você.
**Fluxo principal:** digita o título, escolhe a prioridade direto, projeto/categoria herdados ou ajustados; adiciona. Edição inline.
**Regras de negócio:** prioridade default = Normal; projeto/categoria herdam os últimos usados.
**Edge case:** tarefa sem projeto vai para Geral, sempre visível.

### Prioridade por seleção direta
**Descrição:** definir ou mudar a prioridade em um toque, escolhendo o nível desejado — sem ciclar e sem a tarefa "fugir".
**Quem aciona:** você.
**Fluxo principal:** toca no indicador de prioridade → os níveis aparecem → escolhe o desejado → aplicado.
**Regras de negócio:** mantêm-se quatro níveis (Urgente / Alta / Normal / Baixa); ao mudar a prioridade, a tarefa **não salta de posição no meio da interação** — reordena com transição visível e o item permanece à vista. É a correção direta da dor do toggle cíclico atual.

### Foco do dia (★)
**Descrição:** marcar tarefas como foco de hoje, em qualquer estado (Aberta ou Aguardando).
**Quem aciona:** você.
**Fluxo principal:** toca ★; a tarefa entra no radar e na cola de "hoje vou fazer".
**Regras de negócio:** o ★ expira sozinho na virada do dia — não apaga a tarefa, só desmarca o foco.
**Edge case:** marcar ★ numa tarefa Aguardando significa "hoje vou cobrar isso".

### Delegar e acompanhar (o ciclo do "aguardando")
**Descrição:** marcar uma tarefa como "estou esperando alguém", acompanhar há quanto tempo está parada e resolver (concluir ou trazer de volta). É a funcionalidade que separa este mapa de um todo comum: captura o trabalho que saiu das suas mãos.
**Quem aciona:** você.
**Pré-condição:** tarefa Aberta.
**Fluxo principal:** marca como Aguardando → informa a pessoa (opcional, texto livre) → a tarefa sai da lista de "fazer" e entra na zona "esperando retorno" → o sistema guarda desde quando → após **2 dias úteis** sem retorno, acende um sinal de atenção → quando resolve, você conclui ou traz de volta pra Aberta.
**Fluxos alternativos:** marcar ★ numa tarefa aguardando; editar a pessoa.
**Regras de negócio:** o "desde quando" usa o momento em que entrou em Aguardando; se voltar pra Aberta e for delegada de novo, o relógio reinicia. A pessoa é opcional — às vezes você espera um processo, não alguém.
**Edge cases:** sem pessoa, aparece só como "aguardando"; uma tarefa pode ficar em Aguardando indefinidamente, mas o sinal de 2 dias garante que ela não suma do seu radar.

### Radar transversal
**Descrição:** uma faixa no topo do cockpit que reúne, **ignorando o projeto**, tudo que não pode cair: tarefas atrasadas (prazo vencido), aguardando há 2+ dias úteis, e foco do dia.
**Quem aciona:** o sistema deriva; você lê e age direto dali.
**Fluxo principal:** sempre visível; agrupado por tipo de urgência (não por projeto); cada item permite ação rápida (concluir, abrir, cobrar).
**Regras de negócio:** é derivado — não é uma lista que você mantém, é o espelho do que já está marcado ou atrasado.
**Edge case:** radar vazio mostra um estado calmo de "nada pegando fogo", não um vazio sem sentido.

### Visão por projeto
**Descrição:** abaixo do radar, o trabalho organizado por projeto, cada frente mostrando suas tarefas abertas, o que está aguardando e o tempo do período.
**Quem aciona:** você.
**Fluxo principal:** projetos lado a lado, em largura total; cada projeto colapsável/ocultável; "Geral" é uma frente como as outras.
**Regras de negócio:** nenhum texto é cortado; densidade alta porém calma.
**Edge case:** muitos projetos → rolagem horizontal e colapsar os inativos para o panorama caber (substituto leve do arquivamento, que ficou fora de escopo).

### Cola do daily
**Descrição:** resumo pronto pra reunião diária, derivado dos dados, em três blocos: **fiz / vou fazer / aguardando (bloqueios)**, agrupado por projeto.
**Quem aciona:** o sistema deriva; você lê.
**Fluxo principal:** "fiz" = entradas + tarefas concluídas do último dia com registro; "vou fazer" = tarefas no foco do dia; "aguardando" = o que está bloqueado esperando alguém.
**Regras de negócio:** somente leitura, nunca exige manutenção manual.

### Transportar horas pro software de gestão
**Descrição:** copiar a hora de uma entrada em um toque, pra colar no software de gestão 1:1.
**Quem aciona:** você.
**Fluxo principal:** cada entrada tem copiar-horas, em formato decimal.
**Regras de negócio:** manual, por desenho — sem integração automática.

### Backup (exportar / importar)
**Descrição:** exportar tudo (entradas, tarefas, projetos, categorias) e reimportar.
**Quem aciona:** você.
**Regras de negócio:** importar substitui os dados atuais após confirmação; importar formato antigo segue a regra de reaproveitamento (entradas em Geral).

---

## Design e interface — o cockpit

O ponto mais importante da refatoração. Tudo abaixo é direção de design, não implementação; o brand.md vigente é a base, com uma evolução deliberada.

**Estrutura em duas zonas.** Topo: o **radar transversal**, fino e sempre presente, com o que não pode cair de todos os projetos juntos. Abaixo: a **visão por projeto** em largura total, projetos lado a lado, cada um mostrando suas facetas (abertas, aguardando, tempo). O cronômetro fica como barra de captura persistente no alto.

**Densidade — evolução de marca.** O brand.md atual pede densidade baixa e respiração. A nova necessidade é o oposto: muita informação num olhar. A direção é **"denso, porém calmo"** — dados densos, cromo tranquilo: hierarquia tipográfica forte, números em mono tabular, cor (teal) só onde importa, separação por agrupamento e não por espaço vazio. Isso ajusta o brand.md, não o ignora.

**Captura sem reorganizar depois.** Todo ato de registrar já filia o item: timer e quick-add herdam o último projeto/categoria; prioridade por seleção direta; iniciar timer a partir de uma tarefa herda tudo. O objetivo é nunca precisar arrumar nada num segundo momento.

**Correções firmes de usabilidade.** Nenhum texto cortado (quebra em linha, nunca reticências que escondem informação). Ícones com contraste adequado em todos os estados — o padrão atual de ícone-fantasma (cinza sobre fundo transparente) sai; ícones de ação ganham fundo/contraste suficiente. Alvos de toque e foco visível mantidos conforme o brand.md.

**Desktop-only, largura total.** Sem responsividade mobile; a tela ocupa toda a horizontal disponível, que é o que viabiliza projetos lado a lado.

## Sinais in-app (não há canais externos)

| Sinal | Quando dispara | Onde aparece |
|---|---|---|
| Aguardando parado | Tarefa em Aguardando há 2+ dias úteis | Item da tarefa + radar |
| Prazo | Tarefa com prazo vencido ou vencendo hoje | Item da tarefa + radar |
| Foco do dia | Tarefa marcada com ★ (expira na virada do dia) | Radar + cola |

Tudo é visual e local; não há push, e-mail ou notificação fora do app — por ser ferramenta pessoal de uso ativo.

## Permissões consolidadas

| Ação | Você | Sistema |
|---|---|---|
| Criar/editar/remover projetos, categorias, tarefas, entradas | sim | não |
| Mudar estado de tarefa, marcar ★, definir prioridade/prazo | sim | não |
| Contar tempo, derivar radar/cola, acender sinais, herdar defaults | — | sim |
| Apagar ou reorganizar dado de forma autônoma | — | nunca |

## Fora de escopo

- **Relatórios / KPI / prestação de contas** — papel do software de gestão; duplicar criaria segunda fonte de verdade.
- **Integração automática com o software de gestão** — transporte manual 1:1, por decisão.
- **Multiusuário, compartilhamento, permissões** — é mapa mental privado.
- **Computar trabalho de terceiros** — o "aguardando" é sua nota pessoal, não rastreia o trabalho real do outro.
- **Ciclo de vida formal de projeto** (arquivar/concluir) — só colapsar/ocultar na visão.
- **Vínculo persistente tarefa↔tempo** — herança só no início do cronômetro; per-task time não é necessidade.
- **Responsividade mobile** — desktop-only.

## Resumo de decisões

| Decisão | Escolha | Justificativa | Alternativa descartada |
|---|---|---|---|
| Eixo de organização | Projeto → Categoria (hierárquico) | Reflete a realidade do tech lead: frente de trabalho contém atividades | Dois eixos independentes |
| Categorias | Globais | Reunião/Review/Dev se repetem em toda frente | Categorias por projeto |
| Ciclo de vida de projeto | Nenhum | Decidido pelo usuário; colapsar/ocultar resolve o panorama | Arquivar/concluir formal |
| Item sem projeto | Balde "Geral" embutido | Tarefa/entrada nunca pode virar buraco invisível | Projeto obrigatório |
| Categoria na tarefa | Opcional | Captura sem atrito; nem toda tarefa tem tipo óbvio | Obrigatória |
| Categoria na entrada | Sempre presente, default herdado | Tempo trabalhado é sempre de algum tipo | Opcional |
| Vínculo tarefa↔entrada | Só herança no início | Simplicidade; per-task time não é necessidade | Vínculo persistente |
| Sinal de "aguardando" | 2 dias úteis | Evita falso alarme no fim de semana | 2 dias corridos |
| Pessoa do "aguardando" | Opcional | Às vezes se espera um processo, não alguém | Obrigatória |
| Reabrir tarefa | Sempre para Aberta | Evita ambiguidade de "esperar quem?" | Reabrir para Aguardando |
| Prioridade | 4 níveis, seleção direta, sem teleporte | A dor era a interação cíclica, não os níveis | Trocar a escala de prioridade |
| Migração de dados | Entradas antigas → Geral; sem inferir projeto pelo texto | Inferir erraria em silêncio e exigiria auditoria | Adivinhar projeto pela descrição |
| Layout | Cockpit: radar transversal + visão por projeto | Mostra o panorama e o detalhe por frente num olhar | Lista plana / swimlanes puras |
| Densidade visual | "Denso porém calmo" (evolui o brand.md) | Conflito real entre alto volume e respiração do brand | Manter densidade baixa do brand |
| Transporte de horas | Manual, copiar por entrada | Mantém o app simples e sem dependência | Resumo agregado / integração automática |