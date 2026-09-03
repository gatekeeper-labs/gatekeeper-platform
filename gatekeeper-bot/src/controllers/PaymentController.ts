import { Request, Response } from 'express';
import crypto from 'crypto';
import { subscriberModel } from '../models/Subscriber';
import { botLogModel } from '../models/BotLog';
import { bot, CHAT_ID } from '../config/telegram';

export class PaymentController {
  // Recebe compra aprovada e captura UTMs de campanhas
  async handleWebhook(req: Request, res: Response) {
    const { event, email, utm_source, utm_medium, utm_campaign } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'E-mail obrigatório' });
    }

    if (event === 'charge.paid' || event === 'subscription.created') {
      const inviteToken = crypto.randomBytes(12).toString('hex');

      await subscriberModel.create({
        email,
        token: inviteToken,
        utmSource: utm_source,
        utmMedium: utm_medium,
        utmCampaign: utm_campaign,
      });

      const botLink = `https://t.me/${bot.botInfo.username}?start=${inviteToken}`;
      console.log(`[VENDA APROVADA] Link com UTM (${utm_source || 'direct'}): ${botLink}`);

      return res.status(200).json({
        success: true,
        activation_url: botLink,
      });
    }

    if (event === 'subscription.canceled' || event === 'charge.refunded') {
      const subscriber = await subscriberModel.findByEmail(email);

      if (subscriber && subscriber.telegramUserId) {
        try {
          await bot.api.banChatMember(CHAT_ID, subscriber.telegramUserId);
          await bot.api.unbanChatMember(CHAT_ID, subscriber.telegramUserId);

          await botLogModel.logOperacao({
            tipo: 'MEMBRO_EXPULSO',
            detalhes: 'Inadimplência detectada no webhook',
            emailAssinante: subscriber.email
          });

          await subscriberModel.update(subscriber.token, { status: 'CANCELED' });
          console.log(`[EXPULSO] Assinante ${subscriber.email} removido do grupo.`);

          return res.status(200).json({ success: true, message: 'Usuário expulso com sucesso' });
        } catch (error) {
          console.error('Erro ao expulsar membro:', error);
          return res.status(500).json({ error: 'Falha ao expulsar membro do grupo' });
        }
      }

      return res.status(404).json({ error: 'Assinante não localizado' });
    }

    return res.status(400).json({ error: 'Evento não suportado' });
  }

  // Retorna os dados agregados para os gráficos e cartões do CRM
  async getDashboardMetrics(req: Request, res: Response) {
    const all = await subscriberModel.getAll();
    const activeMembers = all.filter((s) => s.status === 'ACTIVE');
    const pendingMembers = all.filter((s) => s.status === 'PENDING');

    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const membersAtRisk = activeMembers.filter(
      (s) => !s.lastMessageAt || new Date(s.lastMessageAt) < tenDaysAgo
    );

    // Agrupamento de LTV/membros por canal de tráfego
    const trafficChannels: Record<string, number> = {};
    for (const sub of all) {
      const source = sub.utmSource || 'direct';
      trafficChannels[source] = (trafficChannels[source] || 0) + 1;
    }

    return res.status(200).json({
      metrics: {
        totalSubscribers: all.length,
        activeMembers: activeMembers.length,
        pendingActivations: pendingMembers.length,
        membersAtRiskCount: membersAtRisk.length,
        activationRate: all.length ? Math.round((activeMembers.length / all.length) * 100) : 0,
      },
      trafficSources: trafficChannels,
      membersAtRiskList: membersAtRisk.map((m) => ({
        email: m.email,
        username: m.telegramUsername,
        lastMessageAt: m.lastMessageAt,
      })),
    });
  }

  // Endpoint para alimentar o Card no CRM
  async getBotOperationsStats(req: Request, res: Response) {
    try {
      const stats = await botLogModel.getBotOperationsStats();
      return res.status(200).json(stats);
    } catch (error) {
      console.error('Erro ao buscar estatisticas de operacoes:', error);
      return res.status(500).json({ error: 'Erro ao buscar dados do bot' });
    }
  }
}