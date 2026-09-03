import db from '../database';

export interface ISubscriber {
  id: string;
  email: string;
  token: string;
  telegramUserId?: number;
  telegramUsername?: string;
  status: 'PENDING' | 'ACTIVE' | 'CANCELED';
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  lastMessageAt?: Date;
  totalMessages: number;
  createdAt: Date;
}

class SubscriberModel {
  async create(data: {
    email: string;
    token: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  }): Promise<ISubscriber> {
    const status = 'PENDING';
    
    const query = `
      INSERT INTO assinantes (
        email, token_ativacao, status, utm_source, utm_medium, utm_campaign, 
        produtor_id
      ) 
      VALUES (
        $1, $2, 'PENDENTE', $3, $4, $5, 
        (SELECT id FROM produtores LIMIT 1) -- Assumindo que há 1 produtor no DB
      )
      RETURNING id, email, token_ativacao as token, telegram_user_id as "telegramUserId",
                telegram_username as "telegramUsername", status, utm_source as "utmSource", 
                utm_medium as "utmMedium", utm_campaign as "utmCampaign", 
                ultima_mensagem_em as "lastMessageAt", total_mensagens_enviadas as "totalMessages", 
                criado_em as "createdAt"
    `;

    const values = [data.email, data.token, data.utmSource, data.utmMedium, data.utmCampaign];

    try {
      const result = await db.query(query, values);
      const row = result.rows[0];
      return { ...row, status: row.status === 'PENDENTE' ? 'PENDING' : row.status };
    } catch (error) {
      console.error('Erro ao criar assinante no DB:', error);
      throw error;
    }
  }

  async findByToken(token: string): Promise<ISubscriber | undefined> {
    const query = `SELECT * FROM assinantes WHERE token_ativacao = $1`;
    const result = await db.query(query, [token]);
    if (result.rows.length === 0) return undefined;
    return this.mapToISubscriber(result.rows[0]);
  }

  async findByEmail(email: string): Promise<ISubscriber | undefined> {
    const query = `SELECT * FROM assinantes WHERE email = $1`;
    const result = await db.query(query, [email]);
    if (result.rows.length === 0) return undefined;
    return this.mapToISubscriber(result.rows[0]);
  }

  async findByTelegramId(telegramId: number): Promise<ISubscriber | undefined> {
    const query = `SELECT * FROM assinantes WHERE telegram_user_id = $1`;
    const result = await db.query(query, [telegramId]);
    if (result.rows.length === 0) return undefined;
    return this.mapToISubscriber(result.rows[0]);
  }

  async update(token: string, updates: Partial<ISubscriber>): Promise<ISubscriber | undefined> {
    const setFields: string[] = [];
    const values: any[] = [];
    let queryIndex = 1;

    const dbFieldsMap: Record<string, string> = {
      status: 'status',
      telegramUserId: 'telegram_user_id',
      telegramUsername: 'telegram_username',
      lastMessageAt: 'ultima_mensagem_em',
      totalMessages: 'total_mensagens_enviadas'
    };

    for (const [key, value] of Object.entries(updates)) {
      if (dbFieldsMap[key]) {
        let dbValue = value;
        if (key === 'status') {
           if (value === 'ACTIVE') dbValue = 'ATIVO';
           if (value === 'CANCELED') dbValue = 'CANCELADO';
           if (value === 'PENDING') dbValue = 'PENDENTE';
        }
        setFields.push(`${dbFieldsMap[key]} = $${queryIndex}`);
        values.push(dbValue);
        queryIndex++;
      }
    }

    if (setFields.length === 0) return this.findByToken(token);

    values.push(token);
    const query = `
      UPDATE assinantes 
      SET ${setFields.join(', ')}, atualizado_em = CURRENT_TIMESTAMP
      WHERE token_ativacao = $${queryIndex} 
      RETURNING *
    `;

    const result = await db.query(query, values);
    if (result.rows.length === 0) return undefined;
    return this.mapToISubscriber(result.rows[0]);
  }

  async registerActivity(telegramId: number): Promise<void> {
    const query = `
      UPDATE assinantes 
      SET ultima_mensagem_em = CURRENT_TIMESTAMP, 
          total_mensagens_enviadas = total_mensagens_enviadas + 1
      WHERE telegram_user_id = $1
    `;
    await db.query(query, [telegramId]);
  }

  async getAll(): Promise<ISubscriber[]> {
    const query = `SELECT * FROM assinantes`;
    const result = await db.query(query);
    return result.rows.map(this.mapToISubscriber);
  }

  private mapToISubscriber(row: any): ISubscriber {
    let mappedStatus = row.status;
    if (row.status === 'PENDENTE') mappedStatus = 'PENDING';
    if (row.status === 'ATIVO') mappedStatus = 'ACTIVE';
    if (row.status === 'CANCELADO') mappedStatus = 'CANCELED';

    return {
      id: row.id,
      email: row.email,
      token: row.token_ativacao,
      telegramUserId: row.telegram_user_id ? Number(row.telegram_user_id) : undefined,
      telegramUsername: row.telegram_username,
      status: mappedStatus as any,
      utmSource: row.utm_source,
      utmMedium: row.utm_medium,
      utmCampaign: row.utm_campaign,
      lastMessageAt: row.ultima_mensagem_em,
      totalMessages: row.total_mensagens_enviadas || 0,
      createdAt: row.criado_em,
    };
  }
}

export const subscriberModel = new SubscriberModel();