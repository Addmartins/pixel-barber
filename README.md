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

O painel **Pixel Boy** reúne sete cartuchos. A demonstração roda sem Supabase e mantém os recordes durante a sessão local.

O servidor inicia cada partida com uma semente e associa a sessão à conta autenticada. Ao fim, a API recebe os comandos e reproduz a partida a 60 passos por segundo para calcular o placar. O PostgreSQL compara a duração simulada ao tempo decorrido, salva a melhor marca e credita até três partidas com placar positivo por dia no horário de Brasília. O crédito e o lançamento no ledger são atômicos e o reenvio da mesma partida não duplica pontos. A reprodução verifica a coerência dos comandos, mas um bot ainda pode jogar seguindo as regras.

Para publicar, aplique primeiro as migrações pendentes até `20261121000006_new_retro_games.sql`. Configure `SUPABASE_SECRET_KEY` como variável exclusiva do servidor na Vercel e em `.env.local` para desenvolvimento com a API real. A API também aceita `SUPABASE_SERVICE_ROLE_KEY` em projetos com chaves legadas. As variáveis públicas do Supabase permanecem as mesmas.

Execute `psql -v ON_ERROR_STOP=1 -f supabase/tests/arcade.sql` em um banco de teste migrado para verificar duração inválida, titularidade, teto diário, recorde na quarta partida, reenvio, saldo e ranking.

### Pixel Boy e dificuldade

Selecione um cartucho e escolha **Iniciante (1,0×)**, **Experiente (1,5×)** ou **Mestre (2,5×)**. Use **SELECT** ou **Shift** para alternar e **START** ou **Enter** para começar. As setas movem o personagem nos cartuchos direcionais. **X** ou **Espaço** acionam o botão específico do cartucho.

O servidor reconstitui a partida para validar o placar. Os registros antigos e as conquistas foram preservados. Patrulha Neon e Órbita Pixel compartilham o recorde online da categoria de ação. Todos os cartuchos compartilham o limite diário de três partidas creditadas.

## Loja do Avatar

A aba **Loja** mostra o saldo em pontos, o provador e o guarda-roupa. O catálogo inicial tem oito acessórios de 100 a 800 PTS. O resgate equipa o item automaticamente. É possível desequipar e reequipar itens adquiridos sem custo. Cada espaço do avatar aceita um item equipado por vez. O mural e a classificação mostram os acessórios equipados.

Aplique `20261121000005_avatar_store.sql` depois das migrações anteriores. O endpoint `POST /api/store/avatar/buy` aceita apenas `product_id` e usa a sessão do cliente. O banco consulta preço e estoque do catálogo e registra o débito, a aquisição e o equipamento na mesma transação. A demonstração usa 1.000 PTS fictícios e guarda as compras até sair ou atualizar a página.

Para validar as regras da loja em um banco descartável, execute `psql -v ON_ERROR_STOP=1 -f supabase/tests/avatar_store.sql` após aplicar as migrações.

## Instalação e empacotamento mobile

### PWA

Em produção, abra o site HTTPS. No Chrome para Android, use **Instalar aplicativo** no menu. No Safari para iPhone, use **Compartilhar → Adicionar à Tela de Início** e abra pelo novo ícone. O app inicia em modo standalone. O service worker oferece uma tela de reconexão ao abrir offline e não armazena respostas de autenticação, compras ou pontos.

### Android e iOS

1. Rode `npm ci`, configure as variáveis públicas do Supabase em `.env.local` e execute `npm run build:mobile`.
2. No Android, abra `android/` no Android Studio com JDK 21 e Android SDK Platform 36. Para um APK de teste, rode `./gradlew assembleDebug` dentro de `android/`.
3. No iOS, abra `ios/App/App.xcodeproj` no Xcode em um Mac, selecione a equipe de assinatura e execute em aparelho ou simulador. O projeto usa Swift Package Manager.
4. Para apontar o pacote nativo a um ambiente HTTPS diferente da Vercel de produção, defina `NEXT_PUBLIC_BACKEND_ORIGIN` ao executar `npm run build:mobile`. Use a URL e a chave publicável do mesmo projeto Supabase configurado nesse backend.

O build mobile exporta a interface para `out/` e sincroniza as plataformas pelo Capacitor. Os endpoints de pontuação e resgate continuam no servidor Next.js, e a chave secreta do Supabase continua no ambiente do servidor. Antes de distribuir o app, aponte para um backend publicado com as migrações necessárias.

O feedback háptico usa os motores nativos no Android e iOS. No PWA, funciona quando o navegador oferece a API de vibração. No Safari para iOS, esse feedback depende do pacote nativo.

### Sete cartuchos em estilo 16-bit

Patrulha Neon, Salto de Pomada, Órbita Pixel, Ruínas da Navalha, Joias do Salão e Torre de Neon têm mecânicas e controles próprios. Bigode Snake mantém o crescimento da cauda e as loções douradas, com nova arte e mais tempo para a primeira direção. Os jogos usam o avatar e os cosméticos equipados.

A migração `20261121000006_new_retro_games.sql` deve estar aplicada. Os motores antigos continuam disponíveis para validar partidas iniciadas por versões anteriores do app.

### Atualizações do app

O PWA consulta a versão publicada ao abrir, voltar ao primeiro plano e a cada cinco minutos. Quando encontra uma versão nova, mostra **Atualizar agora**; a próxima abertura online também carrega a publicação atual. O service worker continua usando a rede para a página e as APIs, e guarda somente a tela offline.

No Android nativo, o app compara o código de versão instalado com `GET /api/release` e mostra o link da versão mais recente. O Android pede confirmação para instalar um APK fora da loja. Para publicar um novo APK, incremente `androidVersionCode` em `src/lib/device/release.json`, compile com a mesma assinatura e substitua `public/downloads/pixel-barber-android-debug.apk` na mesma publicação.
