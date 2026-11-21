# Pixel Barber

Primeira entrega do clube de barbearia em Next.js 14 App Router, TypeScript estrito, Tailwind CSS, Lucide e Supabase.

```text
src/
  app/
    layout.tsx                 Layout e metadados
    page.tsx                   Rota inicial
    globals.css                Tema arcade e estilos responsivos
  components/auth/
    AuthScreen.tsx             Cadastro, login e perfil de entrada
    AvatarSprite.tsx           Sprites dos quatro avatares
  lib/
    avatars.ts                 Catálogo de avatares e versão do aceite
    phone.ts                   Normalização de celulares para o Supabase Auth
    supabase/browser.ts        Cliente Supabase e contrato tipado do perfil
supabase/migrations/
  20261121000000_initial.sql   DDL inicial e catálogo de serviços de exemplo
  20261121000001_phone_consent.sql   Atualiza o aceite para o cadastro por celular
```

## Executar

1. Em um projeto Supabase dedicado ao Pixel Barber, execute os arquivos em `supabase/migrations` no SQL Editor, em ordem e uma vez cada. O DDL inicial instala um gatilho de cadastro em `auth.users`. Se o DDL inicial já foi aplicado, execute apenas a migração de consentimento para celular.
2. Copie `.env.example` para `.env.local`. Preencha a URL e a chave publicável do projeto.
3. Habilite **Phone** nos provedores de autenticação do Supabase e configure o mínimo de 8 caracteres para a senha. Para validar a titularidade do celular, configure um provedor de SMS e habilite a confirmação por SMS.
4. Com Node.js 22+, rode `npm ci` e `npm run dev`. Acesse `http://localhost:3000`. Use **Criar conta**, informe o celular com DDD, escolha um avatar e aceite os termos da versão de testes. Com confirmação habilitada, digite o código recebido por SMS. Nos próximos acessos, use o celular e a senha.
5. **Experimentar demonstração** abre um perfil local e funciona mesmo sem Supabase.

`npm run typecheck` verifica a tipagem. `npm run build` gera a compilação de produção.

## Contratos do banco

- O celular é o identificador de login. Números brasileiros informados com DDD recebem o prefixo `+55`. Contas anteriores cadastradas só com e-mail precisam ter um celular associado no Supabase Auth para entrar pela nova tela. As credenciais ficam no Supabase Auth. O gatilho grava o nome, o avatar e o aceite versionado, com timestamp do banco. O navegador só pode alterar nome e avatar na tabela de perfis.
- Agendamentos usam instantes com fuso horário e derivam data e hora em `America/Recife`. O banco impede sobreposições para o profissional e o cliente. Em uma futura operação de criação, o backend deve validar expediente, calcular o fim a partir do serviço e gravar os dois instantes. A RPC `cancel_appointment` exige titularidade e aceita cancelamentos com pelo menos 15 minutos de antecedência.
- A RPC `post_points` é restrita ao backend. Ela serializa alterações por cliente e usa uma chave de evento para evitar créditos ou débitos duplicados. A penalidade de falta usa até o saldo disponível. As regras que autorizam cada ganho, perda ou resgate pertencem aos futuros fluxos de negócio.
- Produtos físicos têm preço em reais e cosméticos têm preço em pontos. Os carrinhos e o checkout fazem parte das próximas entregas, assim como a agenda visual, a edição de perfil, o mural, o ranking, as regras de streak, os minijogos, os avisos e o suporte.
- O texto de consentimento acompanha a versão de testes. Para disponibilizar a aplicação ao público, substitua-o pelos documentos da barbearia e atualize a versão no código e no gatilho.
