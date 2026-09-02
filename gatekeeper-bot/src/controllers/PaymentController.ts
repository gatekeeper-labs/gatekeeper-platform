import { Request, Response } from 'express';
import crypto from 'crypto';
import { subscriberModel } from '../models/Subscriber';
import { bot, CHAT_ID } from '../config/telegram';

export class PaymentController {
  async handleWebhook(req: Request, res: Response) {
    const { event, email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'E-mail obrigatório' });
    }

    // 1. Pagamento aprovado
    if (event === 'charge.paid' || event === 'subscription.created') {
      const inviteToken = crypto.randomBytes(12).toString('hex');

      subscriberModel.create({
        email,
        token: inviteToken,
      });

      const botLink = `https://t.me/${bot.botInfo.username}?start=${inviteToken}`;
      console.log(`[PAGAMENTO APROVADO] Link para ${email}: ${botLink}`);

      return res.status(200).json({
        success: true,
        activation_url: botLink,
      });
    }

    // 2. Assinatura cancelada, estorno ou chargeback
    if (event === 'subscription.canceled' || event === 'charge.refunded') {
      const subscriber = subscriberModel.findByEmail(email);

      if (subscriber && subscriber.telegramUserId) {
        try {
          // Expulsa o membro do canal/supergrupo via API Telegram
          await bot.api.banChatMember(CHAT_ID, subscriber.telegramUserId);
          await bot.api.unbanChatMember(CHAT_ID, subscriber.telegramUserId);

          subscriberModel.update(subscriber.token, { status: 'CANCELED' });
          console.log(`[MEMBRO EXPULSO] ID: ${subscriber.telegramUserId} (${email})`);

          return res.status(200).json({ success: true, message: 'Usuário removido do grupo VIP' });
        } catch (error) {
          console.error('Erro ao expulsar membro:', error);
          return res.status(500).json({ error: 'Falha ao expulsar membro do Telegram' });
        }
      }

      return res.status(404).json({ error: 'Assinante não encontrado ou não ativou o bot' });
    }

    return res.status(400).json({ error: 'Evento não tratado' });
  }
}