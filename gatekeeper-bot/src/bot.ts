import { InlineKeyboard } from 'grammy';
import { bot, CHAT_ID } from './config/telegram';
import { subscriberModel } from './models/Subscriber';

export function setupBot() {
  bot.command('start', async (ctx) => {
    const token = ctx.match; // Pega o token após ?start=TOKEN

    if (!token) {
      return ctx.reply('Olá! Adquira sua vaga no Grupo VIP para receber seu acesso.');
    }

    const subscriber = subscriberModel.findByToken(token);

    if (!subscriber || subscriber.status === 'CANCELED') {
      return ctx.reply('❌ Token de acesso inválido ou expirado.');
    }

    try {
      // Gera link de convite exclusivo com member_limit = 1
      const invite = await ctx.api.createChatInviteLink(CHAT_ID, {
        member_limit: 1,
        name: `VIP - ${ctx.from?.first_name}`,
      });

      // Vincula o ID do Telegram ao cliente no Model
      subscriberModel.update(token, {
        telegramUserId: ctx.from?.id,
        telegramUsername: ctx.from?.username,
        status: 'ACTIVE',
      });

      const keyboard = new InlineKeyboard().url('Entrar no Grupo VIP 🚀', invite.invite_link);

      await ctx.reply(`Olá, ${ctx.from?.first_name}! Seu acesso exclusivo foi gerado abaixo:`, {
        reply_markup: keyboard,
      });
    } catch (error) {
      console.error('Erro ao gerar convite:', error);
      await ctx.reply('Erro ao emitir seu link. Chame o suporte.');
    }
  });
}