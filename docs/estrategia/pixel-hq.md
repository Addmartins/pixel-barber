# Pixel HQ — Painel Executivo

**Foco atual:** validar quais problemas o Pixel Barber resolve para barbearias independentes e se elas pagariam para resolvê-los.

**Próximo resultado esperado:** selecionar 10 barbearias com o perfil do blueprint e entrevistar seus decisores. Use as evidências para definir o escopo do beta e a proposta comercial a testar.

[Blueprint Estratégico v1.0](blueprint-v1.0.md) · [Decisões e plano de execução](README.md) · [Roteiro de entrevistas](roteiro-validacao.md)

## Tarefas prioritárias

| Tarefa | Projeto | Status | Responsável | Conclusão |
| --- | --- | --- | --- | --- |
| Aprovar o blueprint e confirmar o ambiente central | Fundação | Pendente | Direção | Aprovação e local registrados no [histórico de decisões](README.md#decisões-iniciais). |
| Selecionar 10 barbearias | Validação | Pendente | A definir | Dez barbearias compatíveis com o perfil do blueprint registradas na carteira abaixo. |
- [ ] Entrevistar os decisores | Validação | Pendente | A definir | Dez entrevistas registradas com exemplos de problemas, ferramentas atuais e disposição a pagar. |
| [x] Aprovar o plano de validação comercial e aquisição de 30 dias (ver `docs/estrategia/validacao-comercial-30dias.md`) | Comercial e aquisição | **Aprovado** | Direção | Portas de validação (prospeção, demo, onboarding, métricas, campanhas, riscos, decisão do beta); plano de execução 30 dias aprovado em 2026-11-24. |
| [ ] Consolidar os achados | Validação | Pendente | A definir | Resumo com dores recorrentes, evidências de interesse comercial e proposta de escopo para o beta. |

O [plano de execução](README.md#plano-de-execução) reúne o andamento das demais tarefas. Revise as prioridades, atribua responsáveis e combine datas na primeira revisão do painel.

## Semana 1 — Fundação e janela de prospeção (D1–D7)

| Tarefa | Projeto | Status | Responsável | Conclusão |
|---|---|---|---|---|
| Registrar a aprovação do plano de execução no log de decisões | Direção | Pendente | Diretoria | Decisão registrada; plano vinculado ao painel |
| Versão do produto e ambiente central confirmado (Vercel/Supabase) | Fundação | Pendente | Engenharia | Build retorna HTTP 200 e variáveis reais em sincronia com `.env.example` |
| Secrets (Supabase, TextBee, hook SMS) configurados no ambiente | Fundação | Pendente | Engenharia | Sem segredos em `.env.local`; `.env.example` atualizado |
| Carteira aberta com 15+ barbearias qualificadas | Aquisição | Pendente | Comercial | 15+ linhas com perfil, bairro e contato; status `Selecionada`/`Contatada` |
| Demostração aprovada (checklist 4.2) | Produto | Pendente | Produto | Demo funcionando; 3 perguntas de fechamento gravadas; dados fictícios |
| Roteiro de prospeção em execução (48h/5d/10d) | Aquisição | Pendente | Comercial | Primeiro toque dentro de 48h; cadência registrada no CRM |

## Indicadores de validação

| Indicador | Meta inicial | Realizado | Como apurar |
| --- | --- | --- | --- |
| Barbearias selecionadas | 10 | Sem medição | Contar barbearias do perfil registrado, uma vez por negócio. |
| Barbearias entrevistadas | 10 | Sem medição | Contar negócios com entrevista concluída e registro disponível. |
| Participantes de validação ou beta | 7 | Sem medição | Contar negócios com participação confirmada nessa categoria. |
| Clientes pagantes | 3 | Sem medição | Contar negócios com pagamento confirmado. |

Sete participantes e três pagantes são a hipótese de tração inicial do blueprint. Para acompanhar essa composição, conte cada barbearia na categoria correspondente ao seu estado atual. Registre a data da apuração ao atualizar os valores.

## Carteira de barbearias

Adicione uma linha por barbearia quando houver um contato identificado. Use os estágios **Selecionada**, **Contatada**, **Entrevistada**, **Validação ou beta confirmado**, **Pagante** ou **Encerrada**. Na coluna Evidência, use uma referência ao registro da entrevista ou da confirmação e guarde dados pessoais fora do repositório.

| Barbearia | Estágio | Responsável | Próxima ação | Data de retorno | Evidência |
| --- | --- | --- | --- | --- | --- |

## Portfólio e projetos

| Produto | Situação | Próximo marco |
| --- | --- | --- |
| Pixel Barber | Prioridade atual | Consolidar a validação e definir o escopo do beta. |
| Pixel Bloom | Previsto no portfólio | Reavaliar a oportunidade pelos critérios de expansão do blueprint. |
| Pixel Order | Previsto no portfólio | Reavaliar a oportunidade pelos critérios de expansão do blueprint. |
| Pixel Core | Infraestrutura compartilhada prevista | Consolidar componentes quando a experiência com Pixel Barber mostrar o que pode ser reutilizado. |

| Projeto | Status inicial | Entrega esperada |
| --- | --- | --- |
| Fundação | Em andamento | Blueprint aprovado e ambiente central confirmado. |
| Validação do Pixel Barber | Em preparação | Entrevistas, síntese das dores e hipóteses para o beta. |
| Preparação do beta | Planejado | Auditoria do produto e lista de lacunas para decidir a liberação do beta. |
| Comercial e distribuição | Planejado | Demonstração, prospecção, onboarding e canais iniciais de aquisição. |

## Revisão semanal

1. Atualize a carteira, os indicadores e a data da apuração.
2. Confira as tarefas prioritárias. Registre responsável, prazo e próximo passo para cada tarefa ativa.
3. Registre as decisões e suas justificativas no [histórico de decisões](README.md#decisões-iniciais). Atualize o painel quando uma decisão mudar uma prioridade ou o próximo marco de um projeto.
