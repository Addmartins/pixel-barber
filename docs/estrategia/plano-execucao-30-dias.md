# Plano de Execução — 30 Dias
**Produto:** Pixel (brand: Pixel Barber)
**Repo ativo:** `/home/addhyel/Área de trabalho/pixel-barber`
**Data de elaboração:** 2026-11-24
**Status:** Rascunho para aprovação da diretoria (porta de saída Dia 1: aprovar backlog e registrar esta decisão)

---

## 0. Princípios e regras de corte

1. **Pixel Barber é o único produto no fundo do planejamento.** Pixel Bloom, Pixel Order e novas linhas são hipóteses sem evidência; não são escalados sem decisão explícita.
2. **Bootstrap até validação.** Sem capital externo, sem contratações, sem microserviços, sem infraestrutura cara, sem mkt pago em escala. Orçamento definido é tempo do time (R$ 100/hora média), registrado por canal.
3. **Tudo o que é dito como feito deve ser evidenciado.** "Concluído" exige comando + saída registrada no log auditável (ex.: `tsc --noEmit` exit 0, deploy HTTP 200, migração aplicada, teste SQL green).
4. **Decisões de diretoria** (preço de produção do produto, contratação, despesas não planejadas > R$ 500, alteração de escopo da validação) exige apoio explícito da diretoria, registrado no log de decisões.
5. **Segurança/LGPD não aguenta atraso.** Olhar de segurança concluído pelo audit de segurança (195s, 27 chamadas) é pré-requisito de produção; produção só com secrets gerenciados no ambiente (Vercel/Supabase UI), nunca em `.env.local` commitável.

## 1. Estado de fato (evidências)

| Área | O que é | Evidência |
|---|---|---|
| Frontend | Next.js 14 (App Router), TS, Tailwind. 11 páginas estáticas + rotas dinâmicas | `npm run build` exit 0; `tsc --noEmit` exit 0 |
| Deploy | PWA no Vercel → HTTP 200 | HTTP probe 2026-11-24 |
| Backend | Supabase: 34 migrações (não 33 como documento afirma) + 11 suites SQL (isolamento, RLS) | `ls supabase/migrations/` = 34; testes 11 arquivos |
| Segurança | Audit de segurança concluído (195s, 27 chamadas): RLS aplicada em todas as tabelas, acesso por clube, verificação de localização via RPC, texto SMS webhook assinado HMAC, bines fotos sem publicação | Resumo consolidado em segurança |
| Mobile | Capacitor: Android (minSdk 24, targetSDK 36) e iOS disponíveis; CI macOS gera **simulador iOS** apenas, sem APK Android | `.github/workflows/ios.yml` |
| Docs | `docs/estrategia/` não versionado (5 arquivos) | `git status`: `?? docs/estrategia/` |
| `.env` | `.env.example` aberto; `.env.local` não lido por segurança. Variáveis reais **não verificadas** | `.env.example` |
| Versão | `release.json` code 25 / name "1.24", mas há commits de fix a partir do release | git log |

## 2. Gap para beta (o que impede a produção, com evidência)

1. **Migrações:** 34 arquivos; "33" no README é desatualizado. Revisar nomeação (202611240000xx para os mais recentes) e atualizar README.
2. **Acesso por localização:** série `20261124000028 → ... → 20261124000033` reescreve políticas RLS de forma acumulativa; risco de sobrescrita invertida. Revisar a ordem e consolidar em uma operações de teste.
3. **Fluxo de conta:** cadastro → SMS (TextBee) → confirmação → agendamento → loja **não roda sem infraestrutura externa** (TextBee + webhook + chip). `.env.local` é segredo; build NGT falha com `NEXT_PUBLIC_SUPABASE_URL` ausente.
4. **Sem testes frontend/integração.** `package.json` não tem `test`. Só SQL, em banco descartável.
5. **Sem CI Android.** `.github/workflows/ios.yml` → iOS Simulator. APK via `./gradlew assembleRelease` + zipalign + assinatura em máquina.
6. **Versão desatualizada:** `release.json` (code 25, "1.24") vs fixes posteriores ao release.
7. **Demo:** `demoEntry`/`demoBooking`/`createDemoBookingApi` trackam o fluxo real (agendamento, loja, ranking, historia) com dados fictícios; o delta é grande e pouco documentado. A regra: demo em estado de teste, nunca apresentar dados de clientes reais.
8. **Link `/admin`:** no PWA o link aponta para `/admin.html` em produção; o build exporta `out/admin.html`. Normalizar ao caminho `_next/` ou expor admin via rota segura, e documentar.

## 3. Escopo do Pixel Barber — prioridade (o que vale a pena entregar nos 30 dias)

| Foco | O que priorizar | O que não fazer |
|---|---|---|
| **Operação da barbearia** (piloto) | Agendamento por WhatsApp/chat; agenda do barbeiro; pontos de fidelidade; mural; painel admin (agenda/barbeiros/publicações) | Gamificação, loja de itens, arcade, comics/avatares em escala |
| **Validação de compra** | Teste de preço (0 / 49 / 89 / 129), checkout/assinatura funcional, onboarding de barbearias | Freelas extensas, ancoragem, suporte dedicado a 100+ contas |
| **Segurança** | Acesso a clube por região; aprovação manual; políticas de DADOS; expiração de pontos; termos e política de privacidade | Abordagem de terceiros, coleta de dados além do necessário |
| **Aquisição** | Prospecção direta (WhatsApp/e-mail 48h/5d/10d), indicações, QR em locais autorizados, demo aprovada com checklists | Mkt pago, tráfego pago, afiliados |
| **Sustentabilidade** | Reserva financeira, métrica diária, decisão de preço/porta, decisão do escopo do beta | Novas fontes de receita até validar o funil |

## 4. Metas quantitativas (hipóteses do Blueprint, em teste)

| Meta | Meta do plano | Dia de saída |
|---|---|---|
| 10 barbearias entrevistadas | 10 concluídas | Dia 21 (Gate 2) |
| 7 participantes de validação/beta | 7 confirmados ou agendados | Dia 30 (Gate 3) |
| 3 clientes pagantes | 3 confirmados ou justificativa de baixa | Dia 30 |
| Teste de preço em 4-8 contratações | 0 / 49 / 89 / 129 experimentados | Dia 21-30 |
| Métrica principal | Pagantes confirmados no mês 1 (mínimo 3) ou decisão de "tentar mais 14 dias" | Dia 30 |

## 5. Linha do tempo e portas de saída

| Semana | Foco | Ações principais | Porta de saída |
|---|---|---|---|
| **Semana 1** | Fundação e janela de prospeção | Registrar decisão em diretoria; aprovar blueprint; versão do produto; secrets; carregamento de contatos; **demo aprovada** (checklist 4.2); script de prospeção; onboarding | **Dia 3:** carteira com 15+ contatos; **Dia 7:** demo aprovada, roteiro de prospeção em execução e 10+ contatos qualificados; entrevistadas até Dia 21 |
| **Semana 2** | Roteiro das 10 + demos | Entrevista nas 10 (3-4 na W1, 6-7 na W2); 4-6 demonstrações; correção de bugs antes das demos acima dos 3 pontos críticos; migrações consolidadas; testes SQL roda sempre | **Dia 14:** Gate 1 — entrevistadas ≥ 6 |
| **Semana 3** | Teste de preço + validação | Teste de preço (faixa, plano, parcelamento, decisão); correções de onboarding; validação da demo no painel; fluxo de dois dias; migração de acesso de localização | **Dia 21:** Gate 2 — 10 entrevistadas |
| **Semana 4** | Fechamento + decisão do beta | Agendamentos de piloto; campanha QR + indicação; decisão de escopo do beta; relatório para diretoria; planejamento do mês 2 | **Dia 30:** Gate 3 — composição e decisão |

## 6. Validação comercial e aquisição

### 6.1 Janela de prospeção
- Perfil: barbearia independente com ≥ 1 profissional ativo, clientes recorrentes, WhatsApp/redes, abertura para teste, contato identificável.
- Fontes: 5 (carteira, indicadas, batalha aberta, conteúdo, fornecedores/lojas).
- Cadence: 48h / 5 dias úteis / 10 dias úteis; 30-40 contatos/dia na W1.

### 6.2 Roteiro da entrevista (fixo)
Operação atual → demonstração → teste de preço → fechamento. Separar **interesse declarado** da **compromisso concreto**. Escore de prioridade (1-5, peso de 1 a 5) → alto/médio/baixo para beta.

### 6.3 Demonstração aprovada (checklist 4.2, 10 itens, reprovação automática em 1-7)
- Duração ~12 min. Dados fictícios; regra de "estado de teste".
- 3 perguntas de fechamento gravadas: fluxo primeiro, o que mudaria, quem decide.

### 6.4 Onboarding (fases de pré a 30 dias)
- 62h de acesso; cadastro da barbearia, endereço, horários, serviços; time com permissões; 3 agendamentos de teste + 1 real; 1 resgate e extrato; mural; check-ins; decisão do dia 30.

### 6.5 Métricas de aquisição
- **Funil:** contatos → entrevistadas ≥ 25% → demonstração ≥ 60% → teste de preço ≥ 60% → pagante ≥ 40% → beta ≥ 60%.
- **UCC** (Unidades de Cliente) = n° de barbeiras ativas no fundo.
- **CAC** = (tempo + licenças + ferramentas) / novos pagantes. Meta: ≤ 1/3 do ARPU mensal. Divisão por canal:
  - Prospecção direta: ≤ R$ 1.500
  - Indicada: ≤ R$ 2.000
  - Conteúdo/WhatsApp: ≤ R$ 3.000
- **LTV rough** = ARPA × 12 / churn mensal; **LTV/CAC** ≥ 3:1; **CAC payback** ≤ 12 meses; turbulência < 2%/mês; **NRR** > 100%; **MRR** = faturas confirmadas.

### 6.6 Campanhas de tráfego
| Campanha | Foco | Saída | Risco | Ação de desligamento |
|---|---|---|---|---|
| C1 Prospecção direta | 30-40 contatos/dia | 10 entrevistadas, 5-6 demos | Qualificação < 20% em 3 dias | Mudar roteiro de abertura |
| C2 Demonstração | 6-10 qualificadas | 5-6 demos aprovadas | < 50% checklist | Reescrever script |
| C3 Indicações | Socios/parceiros | 3-5 contatos | 10 dias sem resposta | E-mail alternativo |
| C4 QR (locais autorizados) | Parceiros + 2 locais | 10 QRs, 30+ scans | < 30 scans/QR no 5º dia | Reposicionar |
| C5 Conteúdo | Consumidores | marca, indicações | Salvamento < 15% | Mudar roteiro de shot |

### 6.7 Fluxo de agregação (gates)
- **Gate 1 (Dia 14):** ≥ 6 entrevistadas; se < 6, abrir 2 dias extras.
- **Gate 2 (Dia 21):** 10 entrevistadas; matriz dor × frequência × faixa de preço.
- **Gate 3 (Dia 30):** composição do beta; decisão de diretoria (continuar, mais 14 dias, ou pivotar). Regras R1-R4 aplicadas.

### 6.8 Riscos de validação (11, com probabilidade/impacto/mitigação/responsável)
Ver `docs/estrategia/validacao-comercial-30dias.md` (arquivo da workstream de validação, criado 2026-11-24). Regras principais:
- Não pagar barbearia que não tentou o produto; não contratar beta só com interesse declarado.
- LGPD: minimização, finalidade, privacidade; nunca texto livre de médio/longo prazo das entrevistas (use resumo).

## 7. Segurança e privacidade (LGPD)

- **Acesso por clube:** RLS + `club_members`; verificação de localização via `verify_location_access`; aprovação manual das solicitações; gestão de sessões de acesso.
- **Separação de dados:** `anon` não vê `barbers`, `services`, `store_products`, `club_notices`, `club_suggestions`, `club_members`; `authenticated` só vê o próprio `clients`, `appointments`, `point_ledger`.
- **Segredos:** gerenciar no Vercel/Supabase UI (pública e secreta); `.env.local` não versionável; testes em banco de desenvolvimento.
- **Dados:** consenso de coleta mínimo; expiração de pontos; termos de ambiente e política de privacidade em produção antes de compras.
- **Cookies/identidade:** verificação de SMS; gestão de usuários e permissões por equipe (POLP).

## 8. Sustentabilidade financeira

### 8.1 Cenários (cada item explicitamente Fato ou Hipótese)
| Métrica | Conservador (H) | Base (H) | Otimista (H) |
|---|---|---|---|
| Receita mês (30 dias) | R$ 187 | R$ 250 | R$ 456 |
| Fluxo líquido mensal | -113 | -115 | -24 |
| Custo fixo base | R$ 300 | R$ 300 | R$ 300 |
| Custo de aquisição | 0 | R$ 65 | R$ 180 |
| LTV estimado | R$ 13.089 | R$ 10.471 | R$ 37.380 |
| LTV/CAC | — (sem novos) | 161× | 87× |
| **Reserva recomendada** | — | R$ 9.000 (6 meses de fixo + imprevistos) | — |
| Custos desabilitados até validação | **R$ 6.800/mês** (mkt pago, Bloom/Order, ferramentas premium, consultoria) | | |

Nota: o modelo de financeiro está em `Modelo_Financeiro_30Dias.md` e `modelo_financeiro_30dias.csv` (workstream de financeiro, gerado 2026-11-24). Pressionar sempre: **Fato** = preço 0/49/89/129, metas de 10/7/3, Pixel Barber prioridade. **Hipótese** = mix de planos, AOV, churn 5%, margem 70%, custo fixo R$ 300/mês, CAC R$ 60-120, novos pagantes 0/1/3, caixa R$ 6.000.

### 8.2 Regras de autonomia e controle
- **Regra da crédito:** sem capital externo; reserva única R$ 9.000.
- **Transações:** pagamentos, alteração de plano pago, contratação — só com aprovação explícita da diretoria.
- **Abrir caixa:** R$ 6.000 para engenharia de validação.
- **Custo de canal:** tempo do time (R$ 100/hora) registrado por canal, não desconsiderado.
- **Decisão de preço:** R$ 49/89/129 definidos conforme teste de preço (Gate 3); não fixos nunca antes do teste.

### 8.3 Métricas de saúde financeira (dashboard)
MRR, CAC, LTV, churn mensal, NRR, payback, reserve (mês 1 a 3), fluxo de caixa mensal, custo fixo vs variável. Revisão a cada 15 dias (vs cenário base).

## 9. Riscos e contorno do plano

| Risco | Prob. | Impacto | Contorno |
|---|---|---|---|
| Barbearia não vê urgência | Média | Alto | Classificar como baixa; não incluir no beta; recomeçar a busca |
| Prospecção não rende | Média | Alto | 30-40 contatos/dia, 5 fontes, geolocalização por bairro |
| Demo não fecha | Média | Alto | Checklist 4.2; demo com dados da barbearia; reagendar antes de desistir |
| Teste de preço não converte | Alta | Alto | Proibir "solicitar preço" sem decisão de quem; segmentar decisores; permutar plano |
| Bug usa o produto na demo | Média | Médio | Bug crítico liberado antes das demos; "não mostrar" regras |
| Dados ausentes de métrica | Alta | Médio | Registro automático no CRM + planilha; métrica de gestão diária |
| Baixa retenção no teste | Média | Médio | Check-ins semanais; onboarding rígido; alertas de abandono no dia 14 |
| Troca de liderança da barbearia | Média | Alto | Revisar carteira a cada 4 dias; relação de contato e mensagem |
| < 10 entrevistadas até dia 21 | Média | Alto | Gate 1 libera 2 dias extras de prospeção (30/dia) |
| LGPD: coleta além do necessário | Baixa | Alto | Minimização; privacidade; nunca texto livre das entrevistas (resumo) |

## 10. Propriedade, cadência e decisões

| Papel | Responsável | Grau de autonomia |
|---|---|---|
| Pixel Barber (tarja executiva) | Diretoria | Decisões não planejadas |
| Prospecção/Aquisição | Comercial | Executa prospecção e cadência |
| Produto/Engenharia | Engenharia | Crítico liberado antes das demos |
| Operações/Segurança | Operações | Geração de métrica diária; audit LGPD |
| Financeiro | Financeiro | Cenário base; decisões apenas com aprovação |

- **Cadência diária** (15-30 min): métrica de gestão ("registros além do produto" + 3 números).
- **Cadência semanal** (1h): executivo + produto + comercial: prospecção/demo/entrevista.
- **Cadência quinzenal** (1h): todo o time: planejamento, risco do sprint, entre em contato com quem está no feriado.
- **Decisões de diretoria** registradas no log de decisões (data, decisão, justificativa, decisores).
- **Backlog de produção:** do dia 1 (diretoria aprova); o escopo do beta na porta 3 (Gate 3).

## 11. Checklist de evidência ("não inventar progresso")

- [ ] Todo "feito" tem: comando + saída registrada (ex.: `tsc --noEmit` exit 0; deploy HTTP 200; migração aplicada; SQL green)
- [ ] `.env.example` aberto; `.env.local` não lido por segurança; secrets no ambiente
- [ ] `docs/estrategia/` versionado no git após aprovação dos documentos
- [ ] README atualizado: 34 migrações; fluxo de demo; acesso ao clube
- [ ] `supervisor` não é usado sem decisão de diretoria; suporte pré-venda não começa antes do Gate 2
- [ ] Teste de preço: 4-8 contratações; faixa de preço registrada
- [ ] Fluido de pagamento verificado (a partir de 0, sem desconto de margem) — "pagamentos" é algo a ser testado na porta 3, não assumido

## 12. Entregáveis para a diretoria

| Dia | Entregável |
|---|---|
| Dia 7 | Carteira com 15+ contatos (selecionada/contatada); demo aprovada; roteiro de prospeção em execução |
| Dia 14 | Gate 1 (entrevistadas ≥ 6); relatório parcial de dores |
| Dia 21 | Gate 2 (10 entrevistadas); matriz de dores consolidada |
| Dia 30 | Gate 3 (7+ participantes, 3+ pagantes ou justificativa); relatório de decisão para diretoria; decisão registrada |

**Próximo passo:** aprovar o plano (porta 1) e registrar no log de decisões. Após a aprovação, iniciar a semana 1 com fundação (secrets, versão, carregamento de contatos, demo aprovada).
