import { InlineKeyboard } from 'grammy';
import { bot, CHAT_ID } from './config/telegram';
import { subscriberModel } from './models/Subscriber';
import { botLogModel } from './models/BotLog';

export function setupBot() {
  // 1. Monitora mensagens no grupo para coletar atividade e risco de churn
  bot.on('message:text', async (ctx, next) => {
    // Só processa se a mensagem veio do grupo VIP monitorado
    if (ctx.chat.id === CHAT_ID && ctx.from) {
      await subscriberModel.registerActivity(ctx.from.id);
    }
    return next();
  });

  // 2. Comando /start com suporte a deep linking e ativação de convite
  bot.command('start', async (ctx) => {
    const token = ctx.match; // Pega o token após /start TOKEN

    if (!token) {
      return ctx.reply('👋 Olá! Adquira sua vaga no Grupo VIP para receber seu link de acesso.');
    }

    const subscriber = await subscriberModel.findByToken(token);

    if (!subscriber || subscriber.status === 'CANCELED') {
      return ctx.reply('❌ Link de ativação inválido, expirado ou cancelado.');
    }

    try {
      // Gera convite de uso único no Telegram
      const invite = await ctx.api.createChatInviteLink(CHAT_ID, {
        member_limit: 1,
        name: `VIP - ${ctx.from?.first_name || 'Assinante'}`,
      });
      
      await botLogModel.logOperacao({
        tipo: 'CONVITE_GERADO',
        detalhes: 'Link de uso único emitido',
        emailAssinante: subscriber.email
      });

      // Vincula o ID do Telegram e registra a ativação
      await subscriberModel.update(token, {
        telegramUserId: ctx.from?.id,
        telegramUsername: ctx.from?.username,
        status: 'ACTIVE',
        lastMessageAt: new Date(),
      });

      const keyboard = new InlineKeyboard().url('Entrar no Grupo VIP 🚀', invite.invite_link);

      await ctx.reply(
        `🎉 Olá, ${ctx.from?.first_name}!\n\nSeu acesso foi liberado com sucesso. Clique abaixo para entrar:`,
        { reply_markup: keyboard }
      );
    } catch (error) {
      console.error('Erro ao gerar convite no Telegram:', error);
      await ctx.reply('❌ Ocorreu um erro ao emitir seu link. Contate o suporte.');
    }
  });

  // 3. Monitora entrada de membros no grupo VIP
  bot.on('chat_member', async (ctx) => {
    const newMember = ctx.chatMember.new_chat_member;
    const oldMember = ctx.chatMember.old_chat_member;
    
    // Se o usuário entrou no grupo (status mudou para 'member')
    if (newMember.status === 'member' && oldMember.status !== 'member') {
      await botLogModel.logOperacao({ 
        tipo: 'MEMBRO_ENTROU', 
        detalhes: 'Usuário validou acesso e entrou no grupo' 
      });
    }
  });
}