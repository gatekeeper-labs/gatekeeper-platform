import db from '../database';

export type TipoOperacaoBot = 
  | 'CONVITE_GERADO'
  | 'MEMBRO_ENTROU'
  | 'MEMBRO_EXPULSO'
  | 'MEMBRO_AVISADO'
  | 'MENSAGEM_FIXADA';

class BotLogModel {
  async logOperacao(data: {
    tipo: TipoOperacaoBot;
    detalhes: string;
    emailAssinante?: string; // opcional para buscar o ID depois
  }) {
    let assinanteId = null;

    // Tenta encontrar o assinante_id se o email foi passado
    if (data.emailAssinante) {
      const result = await db.query('SELECT id FROM assinantes WHERE email = $1 LIMIT 1', [data.emailAssinante]);
      if (result.rows.length > 0) {
        assinanteId = result.rows[0].id;
      }
    }

    const query = `
      INSERT INTO log_operacoes_bot (tipo, detalhes, assinante_id, produtor_id)
      VALUES ($1, $2, $3, (SELECT id FROM produtores LIMIT 1))
    `;
    const values = [data.tipo, data.detalhes, assinanteId];

    try {
      await db.query(query, values);
    } catch (error) {
      console.error('Erro ao registrar log da operacao do bot:', error);
    }
  }

  async getBotOperationsStats() {
    const query = `
      SELECT 
          tipo, 
          COUNT(*) as total
      FROM log_operacoes_bot
      WHERE executado_em >= NOW() - INTERVAL '7 days'
      GROUP BY tipo;
    `;
    const result = await db.query(query);
    return result.rows;
  }
}

export const botLogModel = new BotLogModel();