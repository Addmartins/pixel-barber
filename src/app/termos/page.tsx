import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de Uso da Aplicação | Pixel Barber",
  description: "Regras de uso do aplicativo Pixel Barber e do clube de fidelidade.",
};

export default function TermsPage() {
  return (
    <main className="device-shell">
      <article className="card-modern mx-auto w-full max-w-3xl space-y-5">
        <a className="muted text-sm underline" href="/">Voltar ao Pixel Barber</a>
        <header className="space-y-2">
          <h1 className="text-2xl">Termos de Uso da Aplicação</h1>
          <p className="muted text-sm">Pixel Barber · Versão de 23/11/2026</p>
        </header>
        <section className="space-y-2">
          <h2>1. Conta e acesso</h2>
          <p>O Pixel Barber organiza agendamentos da barbearia, o clube de pontos, a loja de avatares e os jogos do Pixel Boy. Para usar uma conta, informe seu nome e um celular que você possa confirmar por SMS. Mantenha sua senha em segurança e compartilhe o código de verificação apenas com a tela de confirmação do aplicativo.</p>
          <p>A demonstração permite experimentar os jogos e outras áreas. Seus resultados e reservas de demonstração duram apenas durante a sessão e as reservas de teste não ocupam horários reais.</p>
        </section>
        <section className="space-y-2">
          <h2>2. Agendamentos</h2>
          <p>Confira o serviço, o barbeiro, a data, o horário e o preço exibido antes de reservar. O horário fica reservado quando a confirmação aparece no aplicativo. Você pode cancelar pelo app com pelo menos 15 minutos de antecedência. Para alterações próximas ao horário ou em caso de falha, procure o atendimento da barbearia.</p>
          <p>A barbearia registra a presença ou a falta após o horário do serviço. Caso discorde do registro, peça a revisão pelo atendimento.</p>
        </section>
        <section className="space-y-2">
          <h2>3. Pontos, resgates e ranking</h2>
          <p>Os pontos são créditos do clube para resgatar itens elegíveis na loja do avatar, conforme o preço e o estoque exibidos. Eles não podem ser sacados, vendidos ou transferidos para outra conta. Você pode consultar os créditos e débitos no extrato. Cada crédito vale 90 dias pela regra atual, e resgates e outros débitos usam primeiro os pontos mais antigos.</p>
          <p>O ranking semanal reinicia à meia-noite de segunda-feira no horário de Recife. Resgates e expirações afetam a carteira. O ranking usa os créditos da semana e desconta as penalidades por falta.</p>
          <p>Faltas consecutivas aplicam 20%, 30%, 40% e, a partir da quarta, até 50% dos créditos registrados para a semana do agendamento. O total de penalidades é limitado a 50% por semana. Uma presença reinicia a sequência, e o débito na carteira fica limitado ao saldo disponível.</p>
          <p>O Pixel Boy valida os resultados dos cartuchos e pode creditar até três partidas por dia, com teto de 20 pontos por partida. Partidas concluídas podem aparecer no histórico mesmo quando rendem zero pontos.</p>
        </section>
        <section className="space-y-2">
          <h2>4. Uso responsável e publicações</h2>
          <p>Use a aplicação para fins legítimos, respeite os demais clientes e a equipe e evite tentativas de manipular agendamentos, jogos, resgates ou pontos. A barbearia pode revisar lançamentos e limitar o acesso diante de fraude ou abuso, com possibilidade de solicitar revisão pelo atendimento.</p>
          <p>O mural reúne avisos e o portfólio dos barbeiros. A publicação de fotos identificáveis de clientes deve contar com autorização específica. Caso queira pedir a remoção de uma foto ou marcação, procure o atendimento da barbearia.</p>
        </section>
        <section className="space-y-2">
          <h2>5. Dados usados na aplicação</h2>
          <p>O aplicativo usa nome, celular e avatar para criar o perfil, processa reservas e registra resultados de jogos, pontos, resgates e a versão e data do aceite. O primeiro nome e o avatar podem aparecer no ranking ou em marcações no mural para clientes com acesso. O Supabase opera a autenticação e o armazenamento, a Vercel hospeda a aplicação e o TextBee entrega os SMS de verificação. O aparelho guarda a sessão e preferências locais de funcionamento.</p>
          <p>Você pode solicitar acesso, correção ou exclusão dos seus dados pelo atendimento presencial da barbearia. O atendimento pode confirmar sua identidade antes de tratar o pedido. Informe o nome ou celular da conta e o que deseja corrigir, consultar ou excluir. Nunca informe sua senha ou seu código de SMS.</p>
        </section>
        <section className="space-y-2">
          <h2>6. Mudanças e atendimento</h2>
          <p>As regras podem ser atualizadas com a publicação de uma nova versão dos termos. Reservas, pontos e resgates já registrados serão tratados conforme as regras aplicáveis e a legislação. Para dúvidas sobre conta, reservas, pontos ou dados pessoais, procure o atendimento presencial da barbearia.</p>
          <p>Os direitos previstos na legislação brasileira, inclusive as normas de proteção do consumidor e de dados pessoais, continuam aplicáveis.</p>
        </section>
      </article>
    </main>
  );
}
