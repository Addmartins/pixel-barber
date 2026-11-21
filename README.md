# Pixel Barber

Clube de barbearia em Next.js 14 App Router, TypeScript estrito, Tailwind CSS, Lucide e Supabase.

```text
src/
  app/
    layout.tsx                 Layout e metadados
    page.tsx                   Rota inicial
    globals.css                Tema arcade e estilos responsivos
  components/auth/
    AuthScreen.tsx             Cadastro, login e perfil de entrada
    AvatarSprite.tsx           Sprites dos quatro avatares
  components/dashboard/
    Dashboard.tsx              Navegação do painel do cliente
    Booking.tsx                Reserva, agenda e cancelamento
    Mural.tsx                  Galeria, pódio e classificação
  lib/
    avatars.ts                 Catálogo de avatares e versão do aceite
    phone.ts                   Normalização de celulares para o Supabase Auth
    booking.ts                 Contratos, datas e horários de Brasília
    demo-booking.ts            Agenda temporária e ranking de exemplo
    supabase/browser.ts        Cliente Supabase e contrato tipado do perfil
    supabase/booking.ts        Consultas e RPCs da agenda e do ranking
supabase/migrations/
  20261121000000_initial.sql   DDL inicial e catálogo de serviços de exemplo
  20261121000001_phone_consent.sql   Atualiza o aceite para o cadastro por celular
  20261121000002_booking_and_leaderboard.sql   Agenda e ranking da Sprint 2
supabase/tests/
  booking_and_leaderboard.sql  Regressões de agenda, cancelamento e ranking
```

## Executar

1. Em um projeto Supabase dedicado ao Pixel Barber, execute as migrações pendentes no SQL Editor, em ordem e uma vez cada. Em um ambiente que já está na Sprint 1 com cadastro por celular, aplique somente `20261121000002_booking_and_leaderboard.sql`.
2. Copie `.env.example` para `.env.local`. Preencha a URL e a chave publicável do projeto.
3. Habilite **Phone** nos provedores de autenticação do Supabase e configure o mínimo de 8 caracteres para a senha. Para validar a titularidade do celular, configure um provedor de SMS e habilite a confirmação por SMS.
4. Com Node.js 22+, rode `npm ci` e `npm run dev`. Acesse `http://localhost:3000`. Use **Criar conta**, informe o celular com DDD, escolha um avatar e aceite os termos da versão de testes. Com confirmação habilitada, digite o código recebido por SMS. Nos próximos acessos, use o celular e a senha.
5. **Experimentar demonstração** abre um perfil local com agenda e ranking de exemplo. As reservas de demonstração duram até sair da sessão ou atualizar a página.

`npm run typecheck` verifica a tipagem. `npm run build` gera a compilação de produção.

## Contratos do banco

- O celular é o identificador de login. Números brasileiros informados com DDD recebem o prefixo `+55`. Contas anteriores cadastradas só com e-mail precisam ter um celular associado no Supabase Auth para entrar pela nova tela. As credenciais ficam no Supabase Auth. O gatilho grava o nome, o avatar e o aceite versionado, com timestamp do banco. O navegador só pode alterar nome e avatar na tabela de perfis.
- A consulta `get_available_slots` devolve horários de início em blocos de 30 minutos a partir das 09h, com fechamento às 19h no horário de Brasília. A RPC `create_appointment` valida o início e calcula o fim pela duração do serviço. O banco impede sobreposições tanto para o barbeiro quanto para o cliente. A RPC `cancel_appointment` exige titularidade e aceita cancelamentos com pelo menos 15 minutos de antecedência.
- A RPC paginada `get_leaderboard` mostra posição, primeiro nome, avatar e pontos aos clientes autenticados. A agenda só mostra ao cliente os próprios agendamentos.
- A RPC `post_points` é restrita ao backend. Ela serializa alterações por cliente e usa uma chave de evento para evitar créditos ou débitos duplicados. A penalidade de falta usa até o saldo disponível. As regras que autorizam cada ganho, perda ou resgate pertencem aos futuros fluxos de negócio.
- Produtos físicos têm preço em reais e cosméticos têm preço em pontos. Os carrinhos, o checkout, a edição de perfil, as regras de streak, os minijogos, os avisos e o suporte ficam para as próximas entregas.
- O texto de consentimento acompanha a versão de testes. Para disponibilizar a aplicação ao público, substitua-o pelos documentos da barbearia e atualize a versão no código e no gatilho.

## Validação da Sprint 2

Execute `psql -v ON_ERROR_STOP=1 -f supabase/tests/booking_and_leaderboard.sql` em um banco descartável com as migrações aplicadas. O teste usa uma transação revertida no final e cobre conflito de reservas, sobreposição, titularidade, cancelamento e paginação do ranking.

Antes de publicar uma compilação da Sprint 2 na Vercel, aplique a migração da agenda no Supabase usado nesse ambiente.

## Sprint Arcade

O painel **Arcade** inclui Navalha Rush, Barba Fighter II e Torre do Fade. Use o D-Pad e os botões A/B na tela ou as setas, Z para B e X para A no teclado. A demonstração roda sem Supabase e mantém recordes somente enquanto a sessão local estiver aberta.

| Jogo | Pontuação de referência |
| --- | --- |
| Navalha Rush | +10 por pomada, +50 por toalha e bônus por combo após aquecer a navalha. As vitórias típicas ficam entre 170 e 300 pontos. |
| Barba Fighter II | +22 por corte, +44 no Corte Turbo e bônus por adversário e vitória perfeita. Uma vitória perfeita vale 374 pontos. |
| Torre do Fade | De 100 a 250 ao chegar à cadeira do topo, conforme o tempo restante. |

O servidor inicia cada partida com uma semente e associa a sessão à conta autenticada. Ao fim, a API recebe os comandos e reproduz a partida a 60 passos por segundo para calcular o placar. O PostgreSQL compara a duração simulada ao tempo decorrido, salva a melhor marca e credita até três partidas com placar positivo por dia no horário de Brasília. O crédito e o lançamento no ledger são atômicos e o reenvio da mesma partida não duplica pontos. A reprodução verifica a coerência dos comandos, mas um bot ainda pode jogar seguindo as regras.

Para publicar, aplique primeiro as migrações pendentes até `20261121000004_arcade_difficulty.sql`. Configure `SUPABASE_SECRET_KEY` como variável exclusiva do servidor na Vercel e em `.env.local` para desenvolvimento com a API real. A API também aceita `SUPABASE_SERVICE_ROLE_KEY` em projetos com chaves legadas. As variáveis públicas do Supabase permanecem as mesmas.

Execute `psql -v ON_ERROR_STOP=1 -f supabase/tests/arcade.sql` em um banco de teste migrado para verificar duração inválida, titularidade, teto diário, recorde na quarta partida, reenvio, saldo e ranking.

### Pixel Boy e dificuldade

Selecione um cartucho e escolha **Iniciante (1,0×)**, **Experiente (1,5×)** ou **Mestre (2,5×)**. Use **SELECT** ou **Shift** para alternar, e **START** ou **Enter** para começar. As setas controlam o D-Pad, **Z** aciona B, e **X** ou **Espaço** acionam A.

A dificuldade fica vinculada à sessão e o servidor aplica o multiplicador ao placar reconstituído, com arredondamento ao inteiro mais próximo. Uma vitória em Mestre libera uma conquista para o jogo no ranking, inclusive se a cota diária de crédito já tiver sido atingida. Os recordes anteriores continuam válidos, com os registros antigos classificados como Iniciante e sem conquista retroativa.

Aplique `20261121000004_arcade_difficulty.sql` antes de publicar o frontend atualizado. Partidas abertas no motor anterior precisam ser reiniciadas após a atualização.
