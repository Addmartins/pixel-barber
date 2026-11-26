# Plano de Validação Comercial e Aquisição — 30 dias

**Produto:** Pixel Barber / Pixel (Blueprint v1.0, `docs/estrategia/blueprint-v1.0.md`, seção 7/8/13/14/15)
**Prazo:** 30 dias (4 semanas + 2 dias), contado a partir do dia 1
**Público-alvo:** proprietários/sócios/administradores de barbearias independentes (decisores, Blueprint seção 5.2)
**Decisores envolvidos:** Direção (aprovador de portas), Comercial/Growth, Produto/Engenharia, Operações

---

## 0. Pré-requisitos verificados (estado do produto)

- `npm run typecheck`: **exit 0** (tipagem OK). `docs/estrategia/README.md` e `blueprint-v1.0.md` constam.
- Deploy no Vercel: `https://pixel-barber.vercel.app` retorna **HTTP 200** (verificado em 2026-11-24).
- Supabase: **33 migrações** aplicáveis em ordem e uma vez cada (`supabase/migrations/`); testes SQL existentes em `supabase/tests/` (10 arquivos, ex.: `booking_and_leaderboard.sql`).
- Demo disponível: "Experimentar demonstração" — agenda e ranking de exemplo com dados fictícios (`src/lib/demo-booking.ts`, `README.md` seção "Acesso ao clube e demonstração").
- Preços experimentais do Blueprint (hipóteses a testar, não fixos): **0 / R$ 49 / R$ 89 / R$ 129** mensais.
- Metas iniciais do Blueprint (hipótese de tração): **10 barbearias entrevistadas · 7 validação ou beta · 3 pagantes**.
- Nota de metodologia: a sigla **UCC** não é padrão no vocabulário SaaS brasileiro. Neste plano, adotamos **UCC = Unidades de Cliente** (número de contas/business de barbearia que entram no funil). Se o time usar outro significado, apenas a legenda da tabela 1 muda; os cálculos não.

---

## 1. Metas e distribuição das 30 dias

| Meta (blueprint) | Meta do plano | Dia acionável |
|---|---|---|
| 10 barbearias entrevistadas | 10 entrevistas concluídas | Dia 21 |
| 7 participantes de validação ou beta | 7 participantes confirmados ou agendados | Dia 30 |
| 3 clientes pagantes | 3 pagantes confirmados (ou justificativa de baixa) | Dia 30 |
| 0 / 49 / 89 / 129 como hipóteses | Teste de preço em 4-8 contratações | Dia 21-30 |

| Semana | Foco | Ações principais | Porta de saída |
|---|---|---|---|
| 1 | Fundação + janela de prospeção | Selecionar 10+ barbearias; CRM/carteira ativa; demonstração aprovada; script de prospeção; checklist de onboarding | Dia 3: carteira com 15+ contatos; Dia 7: 10 entrevistadas |
| 2 | Roteiro das 10 + demos | Entrevista nas 10 (3-4 durante a semana 1, 6-7 na semana 2); 4-6 demonstrações; correção de bugs antes das demos acima dos 3 pontos críticos | Dia 14: **Gate 1** — entrevistadas ≥ 6 |
| 3 | Teste de preço + validação | Testes de preço (faixa, plano, parcelamento, decisão); correções dos detalhes de onboarding; validação da demonstração no painel | Dia 21: **Gate 2** — 10 entrevistadas concluídas |
| 4 | Fechamento + decisão do beta | Agendamentos de piloto; campanha QR e fatias de indicação; decisão do escopo do beta; relatório para a direção | Dia 30: **Gate 3** — composição de participantes/pagantes definida |

---

## 2. Janela de prospeção

### 2.1 Quem prospectar (critérios de filtro, do Blueprint seção 5.1)

Barbearia deve ter **todos** os itens abaixo para entrar na janela de prospeção:

- É barbearia independente, com pelo menos 1 profissional ativo;
- Tem clientes recorrentes;
- Utiliza WhatsApp ou redes sociais para relacionamento;
- Deseja melhorar a organização / presença digital;
- Tem abertura explícita para testar novas ferramentas (ou compra de ferramentas no último ano);
- Contato identificável: dono, sócio ou administrador (Blueprint seção 5.2).

### 2.2 Fontes de contato

1. **Comparação com a carteira de barbearias** (pixel-hq.md, seção "Carteira de barbearias"): agregar bairros já conhecidos, sem gerar dados pessoais no repositório.
2. **Indicadas**: socios da equipe, parceiros (cabeleireiros, estilistas, cafeterias, academia) e barbearias que já experimentaram o app.
3. **Batalha aberta**: Google Maps/MAPA, grupos de barbeiros e WhatsApp de cada cidade (região +1 da cidade principal).
4. **Conteúdo**: post de captura em Instagram/TikTok perguntando "quem cuida do agendamento da sua barbearia?" → contatos qualificados.
5. **Outros produtos/fornecedores**: lojas de acessórios, corretoras, farmácias do bairro (público de barbeiros e donos de lojas de beleza) — para barbearias de médio porte.

### 2.3 Janela de abertura do prospect (quando agir)

- **Primeira contato:** até 48h após o contato gerado (visita agendada ou mensagem no WhatsApp Business).
- **Segundo toque:** dentro de 5 dias úteis.
- **Terceiro toque:** dentro de 10 dias úteis (e-mail/WhatsApp, sem pressa).
- **Fechamento do contato:** se não houver resposta aos 3 toques ou recusa explícita, passar para a próxima barbearia — não ficar mais de 20 dias com a mesma.

### 2.4 Rotina semanal de prospeção

- 3h/dia de prospeção, 4h/dia no sábado (técnico): agendamento, envio de mensagem, encaminhamento e log;
- **Mês 1:** 30-40 contatos/dia → meta de 10 barbearias entrevistadas;
- **Mês 2:** juros de contatos qualificados e demonstrações;
- Georeferenciar os bairros para fazer campanha de 1 dia por região (evitar desgaste no tempo).

### 2.5 Ciclo de aquisição para o cliente

`Prospecção → demonstração → cadastro → onboarding → utilização → assinatura → retenção → indicação` (Blueprint seção 7.4/7.5). O plano abaixo guia o "Prospecção → demonstração" e define onde a aquisição continua depois.

---

## 3. Roteiro aprimorado para as 10 entrevistas

### 3.1 Antes da entrevista (pré-requisito do entrevistador)

1. Ler o roteiro abaixo e o registo da barbearia na carteira;
2. Ter os 3 recursos essenciais: (a) contexto da barbearia (nº de profissionais, bairro), (b) proposta de 1 frase, (c) dados de demonstração preparados;
3. Definir 1 objetivo por entrevista (ex.: descobrir quanta urgência ou qual é a faixa de preço); não pedir contrato nessa fase.

### 3.2 Fluxo da entrevista (o mesmo nos 10, para comparar)

**0) Abertura (5 min)** — quem é, proposta de 1 frase, ordem: `operação atual primeiro, produto depois` (regras do roteiro original `docs/estrategia/roteiro-validacao.md`).

**1) Operação atual (10-12 min)** — para responder ao roteiro original:

1. Como foi o último agendamento, do pedido do cliente até o atendimento? Quem participou e quais ferramentas foram usadas?
2. Quando foi a última pausa, cancelamento ou conflito de horário? Como a equipe lidou com isso? Com que frequência acontece?
3. Como fazem os clientes voltarem? Conte um exemplo recente e como acompanharam o resultado.
4. Qual tarefa da operação mais toma tempo hoje? Quanto tempo tomou na última semana?
5. O que já tentaram mudando? Quanto pagam pelas ferramentas atuais e como decidiram contratá-las?
6. **Complemento obrigatório (não no roteiro original):** qual o caminho em um dia seguinte que mais quebra a barbearia? (faltas, retornos, pedidos perdidos)

**2) Demonstração (15-20 min)** — fluxo padrão:

- Acesso (celular, 60s); desenho da barbearia com dados fictícios; agendar um horário (ex.: 10h, corte + barba); ver pontos e extrato; mural e ranking; painel admin (agenda, barbeiros, publicações) — para quem decide contratar.
- Durante: **não vender, não dar contrato**; observar o fluxo que usa, tirar anotações de obstáculos de uso.

**3) Proposta e teste de preço (5-8 min)**:

- Apresentar os planos do Blueprint como **experimentais**: gratuito 0, Partner 49, Pro 89, Premium 129;
- Perguntas: que valor mensal caberia no orçamento para resolver o problema apontado? Quem aprovaria a contratação e o que precisaria ver antes? Teste por quanto tempo (período combinado)? O que mostraria que vale continuar?

**4) Fechamento (5 min)** — separar **interesse declarado** (ex.: "estou interessado") de **compromisso concreto** (ex.: "pediu a senha", "agendou teste", "quero falar com minha esposa amanhã"):
- Próximo passo combinado e data/hora;
- Quem é a decisão final;
- Demonstração de verdade ou apenas acesso ao catálogo? São dados reais?
- Gravação rápida: prioridade do problema (1-5), urgência (alta/média/baixa), disposição a pagar (faixa), confiança na solução, "o que faria hoje para não precisar de um produto assim?".

### 3.3 Registro (obrigatório, separar duas séries)

Registro por entrevista no `docs/estrategia/` (planilha padrão / carteira de barbearias do `pixel-hq.md`):

- Data, barbearia (sem dados pessoais), responsável, função;
- Ferramentas atuais, dores com exemplo, frequência, impacto estimado;
- Objeções e faixa de preço;
- **Série A — interesse declarado** e **Série B — compromisso concreto** (ex.: agendou teste, pediu login);
- Prioridade do problema (1-5) e urgência;
- Próximo passo combinado.

### 3.4 Escore de prioridade (use para classificar a entrevista)

| Peso | Pergunta | Nota |
|---|---|---|
| 1 | Dor com frequência demonstrável (ex.: pausa ≥ 1x/mês ou conflito de horário) | 1-3 |
| 2 | Impacto do problema sobre o lucro do dia (tempo perdido, clientes aproveitados) | 1-3 |
| 3 | Orçamento declarado ou rastro de compra (já pagou ferramenta, planeja comprar) | 1-3 |
| 4 | Decisor presente e decidido sobre tooling no curto prazo | 1-3 |
| 5 | Compromisso concreto (agenda de teste, cadastro, retorno) | 1-3 |
| **Totals** | **7-15 = alto** (provavelmente para beta/pagante); 4-6 = médio; 0-3 = baixo | |

Classes: **Alto** (todo novo beta + pagantes prováveis), **Médio** (testar com um período de 30d), **Baixo** (mapear para o roadmap, não incluir no escopo do beta).

### 3.5 Agregação das 10 entrevistas

- Ao concluir cada entrevista, gravar no registro (não importa a qualidade verbal, importa o dado).
- No **dia 21**, consolidar em tabela: problema × frequência (n° de barbearias), impacto médio, faixa de preço mais citada, urgência média, compromissos concretos.
- No **dia 30**, produzir o relatório de decisão do escopo do beta (ver seção 9).

---

## 4. Demonstração aprovada

### 4.1 O que é "demonstração aprovada"

Após a demo, o time marca reunião de 20 min com o cliente para validar **3 perguntas**:

1. Qual fluxo você usaria primeiro?
2. O que precisaria mudar para funcionar na sua barbearia?
3. Quem tomaria a decisão e o que precisa ver para agir?

A demonstração só é **aprovada** se atingir o checklist 4.2 e o cliente responder, com registro, as 3 perguntas acima.

### 4.2 Checklist obrigatório da demonstração (a ser rigido)

1. [ ] Acesso com 60s (cadastro por celular do cliente): "Experimentar demonstração" ou conta de teste;
2. [ ] Glosário/cláusula de 60s de funcionalidade (o que é, para que serve, para quem);
3. [ ] Reserva de horário demonstrativa (serviço + barbeiro + data) e confirmação visual;
4. [ ] Pontos e extrato demonstrativos (criar valor de fidelidade no demo);
5. [ ] Mural (avisos/álbuns) e ranking semanal;
6. [ ] Painel admin reativo (agenda, barbeiros, publicações) — para quem vende e contratou;
7. [ ] Guardar contato e registrar a demonstração (formulário de 5 linhas, em 2 minutos);
8. [ ] O cliente tem no minimal o que decidir hoje (se sim, mover para teste de preço; se não, reagendar 7 dias);
9. [ ] Não oferecer nem exigir pagamento na demonstração;
10. [ ] Registrar "próximo passo" na carteira antes de fechar a conexão.

### 4.3 Script de demonstração (12 min)

| Minuto | Ação | Dica |
|---|---|---|
| 0-1 | "O que eu mostro em 3 minutos: reserva, pontos e painel" | Não mexa |
| 1-4 | Acesso (celular) com a conta da barbearia | Entrar pelo começo, não pular |
| 4-7 | Reservar um horário (selecione serviço, barbeiro, data; confirme) | Pergunte: "você faria isso hoje?" |
| 7-9 | Pontos: cadastrar compra, resgatar item, ver extrato | Mostre o motor de fidelidade |
| 9-11 | Mural + ranking + admin (painel) | Mostre a visão do dono |
| 11-12 | Perguntas: fluxo primeiro, o que mudaria, decisão | Bloqueie vendas |

### 4.4 Registro da demonstração

Registro obrigatório: data, barbearia, demonstrante, resultado (quantos itens do checklist atingidos), fluxo usado primeiro, objeção 1-3, próximo passo combinado, data do retorno. Registre se o cliente pediu acesso real (conta de teste) — separado de "interesse declarado".

### 4.5 Sobre "demonstração de verdade"

- O demo usa dados fictícios (Blueprint/README seção "Validação da Sprint 2" e "Acesso ao clube e demonstração").
- Quando o barbeiro perguntar "tem feito isso na prática?", responder sempre: "é um estado de teste, me perdoe, o objetivo hoje é validar o fluxo" — nunca validar dados de clientes reais.
- Se o demo exigir dados reais, desative o demo automático e peça acesso ao ambiente de produção.

---

## 5. Script de onboarding (para os participantes da fase de beta/validação)

**Objetivo:** dos 7 participantes, garantir que o primeiro agendamento, o primeiro resgate e o primeiro uso do painel aconteçam antes do fechamento do período de teste (30d).

### 5.1 Fases

| Fase | Prazo | Ações | Entregável |
|---|---|---|---|
| Pré-onboarding | 3-7 dias antes do acesso | E-mail/WhatsApp: código da barbearia, credenciais, instruções de acesso, checklist do painel | Convite + checklist |
| 0 | Dia 0 | Configurar barbeiros, serviços, agenda, mensagem padrão (painel admin); agendar 3 horários de teste; definir quem usa o app (consumidor) | Perfil completo |
| 1 a 7 | 72h de check-in | Liga/diálogo 1 para solucionar o primeiro agendamento; e-mail no dia 3 pedindo Feedback rápido (3 perguntas) | 1º agendamento real |
| 8 a 30 | Semana 2 e 4 | Check-in (telefone/WhatsApp) sobre uso, grupos de fidelidade, resgate de item; relatório semanal do uso; 1º resgate; feedback estruturado | Relatório de uso |
| Fechamento | Dia 30 | Decisão: continuar pagante (compra confirmada) ou realizar "retorno de estudo" | Logo de decisão |

### 5.2 Checklist de onboarding (responsabilidade: Comercial + Produto)

- [ ] Login do admin e dos barbeiros; verificação do celular por SMS (TextBee, conforme `.env.example`);
- [ ] Cadastro da barbearia, endereço, horário de funcionamento e serviços (corte, barba, combo);
- [ ] Criação do time com permissões;
- [ ] 3 agendamentos de teste e 1 agendamento real;
- [ ] 1 resgate de item e 1 extrato de pontos;
- [ ] Mural com 1 aviso + 1 álbum;
- [ ] Escalada: quem toca no painel de apoio, com qual atalho;
- [ ] Documento de setup salvo na pasta `docs/estrategia/` (será reutilizável);
- [ ] Check-ins semanais com foco em uso, não em "você não está vendo".

### 5.3 Indicadores de onboarding

- Atenção no 72h (contato confirmado);
- Perfil completo da barbearia em 48h;
- 1º agendamento real (sem gratuito);
- 1º resgate de item;
- Uso semanal (domingo ou dia de checking);
- Retorno do check-in (taxa de resposta);
- NPS ou "qual parte da plataforma você usaria no dia seguinte?" (1-5).

---

## 6. Métricas de UCC, CAC e conversão

### 6.1 Funil e unidades

| Etapa | Unidade medida | Meta | Como apurar |
|---|---|---|---|
| Contatos | Contatos qualificados (filtragem do perfil) | 40/dia, W1 | Contatos do CRM |
| Entrevistadas | 1 barbearia = 1 entrevista concluída | 10 no dia 21 | Registro + carteira |
| Demonstráveis | Ainda mostra ao cliente | 6-8 | Demo log |
| Demonstrações | Demo aprovada | 5-6 | Checklist 4.2 |
| Testes de preço | Contrato/amostra de teste | 4-6 | Registro de fechamento |
| Bailes | Compromisso de retornar | 50% dos teste | Registro |
| **Pagantes** | Assinatura confirmada | 3 | Supabase / CRM / faturamento |
| **UCC** | **Unidades de Cliente** (contas de barbearia ativas) | 7+ no dia 30 | Carteira + Supabase |

### 6.2 Cálculo e meta

- **UCC** = n° de barbeiras ativas no fundo (excluindo as "encerradas" e os "somente demonstráveis");
- **CAC (Customer Acquisition Cost)** = (custo de mkt + custo de vendas + ferramentas) / novos pagantes no período. No bootstrap, use o custo real: tempo do time (estimado em R$) + licenças/planos + ferramentas. Meta: **CAC ≤ 1/3 do ARPU mensal** no período de 30 dias (meta conservadora), observar que a meta do blueprint é 3 pagantes com 7 participantes — o CAC na fase de demonstração deve ser baixo (prospecção manual).
- **Conversion (conversão por etapa)**:
  - contato → entrevistada ≥ 25%;
  - entrevistada → demonstração ≥ 60%;
  - demonstração → teste de preço ≥ 60%;
  - teste → pagante ≥ 40%;
  - candidato a beta → assinatura ≥ 60%;
- **LTV rough** = ARPA médio × 12 / churn mensal (estimativa para R$ 49-129/mês);
- **LTV/CAC** ≥ 3:1;
- **CAC payback** ≤ 12 meses (objetivo < 6 meses para o bootstrap sem investimento externo);
- **Churn mensal** < 2%;
- **NRR** > 100% (sem expansão, para verificar se entre nos planos maiores no beta);
- **MRR** = soma das faturas confirmadas no mês.

### 6.3 Divisão de CAC por canal

| Canal | OR | Meta de CAC |
|---|---|---|
| Prospecção direta (visita/WhatsApp) | 10 entrevistadas | ≤ R$ 1.500 por cliente |
| Indicada | 3-5 contatos | ≤ R$ 2.000 |
| Conteúdo/WhatsApp | marca + indicação | ≤ R$ 3.000 |
| QR (apenas locais autorizados) | cadastros de consumidores | não se aplica ao CAC de barbeiras (mede engagement) |

> Nota: no bootstrap, o "orçamento" dominante é o tempo do time. Avalie o custo em R$ (1 hora = ~R$ 100, ajuste pela carga horária) e registre-o como custo de canal, não como despesa ignorada.

---

## 7. Plano de campanhas

CampiLinkáveis por ação. "Escala" = nível de investimento; "saída" = entrega sobre a meta de 30 dias.

| Campanha | Escala | Público | Mensagem | Canal | Orçamento (R$) | Saída | Indicador | Pausa/ajuste |
|---|---|---|---|---|---|---|---|---|
| C1 Prospecção direta | Alta | 30-40 contatos/dia (W1-W4) | "Gestão e presença para barbearias que querem organizar mais o dia a dia" | Visitas agendadas + WhatsApp Business + e-mail | 0 (tempo) | 10 entrevistadas, 5-6 demos | ≥ 40 contatos/dia; ≥ 25% qualificado; ≥ 60% demo → teste | Se taxa de qualificação < 20% em 3 dias: mudar roteiro de abertura |
| C2 Demonstração | Média | 6-10 barbearias qualificadas | "Veja como o dia a dia depois de 10 minutos" | Demo, reunião telado, WhatsApp | 0 (tempo) | 4-6 testes de preço | ≥ 5 demo aprovadas; ≥ 60% virar teste | Reescrever script se < 50% dos demos atingirem o checklist |
| C3 Indicadas | Baixa | Socios, parceiros, boca a boca | "Troca de barbearias que estão mudando" | Indicação, WhatsApp, grupo de cidades | 0 | 3-5 contatos | ≥ 3 contatos indicados | 10 dias sem resposta → enviar e-mail alternativo |
| C4 QR (locais autorizados) | Baixa | Barbearias parceiras + 2 locais (praças/cafeterias) | "Tire a foto do app e descubra o dia da sua barbearia" | QRs empastados, print, pill | 0 (material) | 10 QRs; 30+ scans | Scans, cadastros de consumidores, ouvidência | Se < 30 scans/QR no 5º dia: reposicionar |
| C5 Conteúdo/WhatsApp Business | Baixa | Consumidores (impacto sobre a barbearia) | "Barberia com agenda, pontos e fidelidade" | Stories, status, reels | 0 | marca + indicações | 20% de salvamento; 5 indicações | Se taxa de salvamento < 15%: mudar roteiro de shot |

### 7.1 Ordens de prioridade para 30 dias

1. C1 (prospecção direta) → métrica: barbearias entrevistadas;
2. C2 (demonstração) → métrica: teste de preço;
3. C3 (indicadas) → ampliação do funil;
4. C4 (QR) → só se houver parceiros com local autorizado;
5. C5 (conteúdo) → mantém a marca viva e alimenta indicações a partir da semana 3.

### 7.2 Regra de desligamento

- Qualquer campanha com menos de 50% da saída acumulada do plano no dia 21 **é descartada** e reencaminçada (não há "manter travando o orçamento").

---

## 8. Riscos de validação

| ID | Risco | Probabilidade | Impacto | Mitigação | Responsável |
|---|---|---|---|---|---|
| R1 | Barbearia não vê urgência (o problema é "manutenível") | Média | Alto | Pergunta sobre pausa/cancelamento e orçamento; classificar como baixa e não incluir no beta; recomeçar a busca no R2 | Comercial |
| R2 | Diputado não tem tempo para chamar (canais alternativos) | Média | Médio | Roteiros de 15 min, e-mail e WhatsApp; prioridade por score (seção 3.4) | Comercial |
| R3 | Prospecção não rende (quantidade insuficiente) | Média | Alto | Doses por semana (30-40/dia), geolocalização por bairro, 5 fontes de contato | Comercial |
| R4 | Demonstração não fecha (falta de atenção ou rejeição) | Média | Alto | Checklist 4.2; demo preparada com dados reais da barbearia; reagenda antes de desistir | Produto |
| R5 | Teste de preço não converte (orçamento inviável ou sem pagador definido) | Alta | Alto | Proibir "solicitar preço" sem definir quem decide; segmentar por decisores; permutar plano (49 vs 89) | Comercial |
| R6 | Bug ou deficiência usa o produto durante a demonstração | Média | Médio | Bug de alta prioridade liberado antes das demos de aprovação; checklist de "não mostrar" (r000) | Engenharia |
| R7 | Métrica da semana e carregamento de dados ausente | Alta | Médio | Tudo registrado no CRM + planilha; métrica de gestão diária: "registros além do produto" | Operações |
| R8 | Retenção na fase de teste baixa | Média | Médio | Check-ins semanais (seção 5), onboarding rígido, alertas de abandono no dia 14 do piloto | Customer Success |
| R9 | Lideranças de barbearia mudam de mesa ou pausam a barbearia | Média | Alto | Revisar a carteira a cada 4 dias; melhorar a relação de "contato" e a mensagem de concorrência, se necessário | Direção |
| R10 | Menos de 10 entrevistadas até o dia 21 | Média | Alto | **Gate 1** (dia 14: ≥ 6 entrevistadas) aciona a janela de prospeção em dois dias extras | Direção |
| R11 | LGPD: coleta de dados além do necessário | Baixa | Alto | Como na documentação de segurança do Blueprint: minimização, finalidade, transparência; nunca coletar texto livre de médio/longo prazo das entrevistas (use resumo) | Direção/Operações |

**Regra de viagem:** não paga barbearia que não tentou o produto; não contrata para o beta com base só no interesse declarado (exige compromisso concreto, seção 3.2).

---

## 9. Fluxo de agregação dos resultados das 10 entrevistas → decisão do escopo do beta

### 9.1 Instrumentos

1. **Plaquinha de entrevista** (`docs/estrategia/validacao-comercial-30dias.md`, anexo A1) — preenchida em 5 min por entrevista;
2. **Carteira de barbearias** (pixel-hq.md, seção "Carteira de barbearias") — status: Selecionada → Contatada → Entrevistada → Validação/beta confirmado → Pagante → Encerrada;
3. **Log de decisões** — data, decisão, justificativa, decisores — conforme README (`docs/estrategia/README.md`) e pixel-hq.md.

### 9.2 Etapas

**Dia 14 — Gate 1:** contagens de entrevistadas. Se < 6, estender a janela de prospeção (mais 2 dias de contatos, 30/dia) e reprogramar.

**Dia 21 — Gate 2 (conclusão das 10 entrevistas):** consolidar em matriz:

| Doença | Frequência (n°) | Impacto médio | Faixa de preço mais citada | Disposição média | Compromisso concreto |
|---|---|---|---|---|---|
| (ex.: organização da agenda) | | 1-3 | | | |

Atualização: carteira com 10 linhas, status e evidências (referência do registro).

**Dia 30 — Gate 3 (decisão do escopo do beta):** aplicar regras de decisão:

**R1 — Doença paciente:** funcionalidade citada por **≥ 6 das 10** (ou ≥ 60%) e com impacto médio ≥ 2 (moderado/alto) → **inclui-se no escopo do beta**. Descarte de funcionalidades com baixo score em menos de 3 entrevistadas: permanece fora (registrar o "não" no relatório).
**R2 — Preço:** plano comercial (49/89/129 ou combos) aceito por **≥ 5 das 10** → fixa o preço do beta. Se diversidade: o portador do valor imediato define (e o resultado é anotado).
**R3 — Participantes:** candidatos a beta com **compromisso concreto** ≥ 3 e **pagantes** ≥ 2 → o beta começa com esse recorte. Se pagantes < 3: o "beta" pode continuar como validação aberta (até 7 participantes) e a decisão de pagamento é reposta ao dia 30 (relatório para a direção).
**R4 — O que causa estagnação?** Se o número total de participantes < 7 ou o pagantes < 3 no dia 30, a direção decide entre:
  - I. **Validar mais 14 dias** (janela de prospeção ampliada, 20 contatos/dia);
  - II. **Escopo reduzido** (somente as funcionalidades com maior score, redirecionando para 3-5 clientes focais);
  - III. **Pivotar a proposta** (ex.: focar em agendamento + agenda, deixar fora gamificação/loja) — com base no relatório de dolorosidade.

### 9.3 Rubrica do relatório de decisão (alvo do dia 30)

1. Numeração das barbearias entrevistadas (status, evidência);
2. Dores por frequência/impacto (tab. 9.2);
3. Propostas de preço aceitas e aprovadas;
4. Candidatos a beta (compromisso concreto) e pagantes;
5. Funcionalidades para o esquema do beta (citei ≥ 60% das 10);
6. Dúvidas abertas e risco restante;
7. Decisão: "Dar continuidade com escopo X e meta Y" ou "tentar mais 14 dias com porta Z".

---

## 10. Anexos

### A1. Modelo de planilha de entrevista (uma aba por barbearia)

`Data | Barbearia (sem dados pessoais) | Responsável | Perfil (1-5) | Função | Ferramentas atuais | Dor 1 (ex, freq) | Dor 2 | Objeção | Faixa de preço | Compromisso concreto (Série B) | Interesse declarado (Série A) | Prioridade (1-5) | Urgência | Próximo passo | Status`

### A2. Checklist de abertura de conversa (prospeção)

- [ ] Barbearia atende ao filtro de seção 2.1;
- [ ] Contato: dono/sócio/admin;
- [ ] Mensagem: 1 frase sobre o agendamento/fidelidade; não pedir cadastro;
- [ ] Objetivo: 15 min; 13 perguntas de operação;
- [ ] Próximo toque definido (5 dias úteis);
- [ ] Registro: phone ou contato, uma linha de nota.

### A3. Checklist de demonstração (ressumo)

- [ ] 10 itens (4.2); **1-7** são obrigatórios para aprovar;
- [ ] 3 perguntas de fechamento gravadas;
- [ ] Contato salvo antes de fechar;
- [ ] Próximo passo com data.
- **Reprovação automática:** não atingir itens 1-7 → reagendar 7 dias e reenviar os dados.

### A4. Checklist de onboarding (resumo)

- [ ] Acesso com 60s; SMS verificado;
- [ ] Barbearia, endereço, horários, serviços;
- [ ] Time com permissões;
- [ ] Agenda real de teste;
- [ ] Mural + ranking;
- [ ] Check-in 72h, 7d, 14d, 30d;
- [ ] Decisão de pagamento no dia 30.

### A5. Template de decisão (Gate 3, dia 30)

```
Decisão: (     ) continuar com escopo X     (     ) tentar mais 14 dias     (     ) pivotar
Participantes confirmados: ___/7    |    Pagantes: ___/3
Funcionalidades para beta (>= 60% das 10): 
Duvidas abertas: 
Responsável da decisão: 
Prazo de validação da decisão: 
```

---

## 11. Entregáveis para a direção (fitas do plano)

- [ ] **Dia 7:** carteira com 15+ contatos (estágio: selecionada/contatada); demonstração aprovada; roteiro de prospeção rodando.
- [ ] **Dia 14:** Gate 1 (entrevistadas ≥ 6); relatório parcial de dores.
- [ ] **Dia 21:** Gate 2 (10 entrevistadas concluídas) e matriz de dores consolidada.
- [ ] **Dia 30:** Gate 3 (composição: 7+ participantes, 3+ pagantes ou justificativa); relatório de decisão enviado para a direção; reunião de decisão agendada.
