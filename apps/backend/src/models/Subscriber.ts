export interface ISubscriber {
  id: string;
  email: string;
  token: string;
  telegramUserId?: number;
  telegramUsername?: string;
  status: 'PENDING' | 'ACTIVE' | 'CANCELED';
  createdAt: Date;
}

// Simulador de repositório em memória
class SubscriberModel {
  private subscribers: Map<string, ISubscriber> = new Map();

  create(data: { email: string; token: string }): ISubscriber {
    const subscriber: ISubscriber = {
      id: Math.random().toString(36).substring(2, 9),
      email: data.email,
      token: data.token,
      status: 'PENDING',
      createdAt: new Date(),
    };
    this.subscribers.set(data.token, subscriber);
    return subscriber;
  }

  findByToken(token: string): ISubscriber | undefined {
    return this.subscribers.get(token);
  }

  findByEmail(email: string): ISubscriber | undefined {
    return Array.from(this.subscribers.values()).find((s) => s.email === email);
  }

  update(token: string, updates: Partial<ISubscriber>): ISubscriber | undefined {
    const current = this.subscribers.get(token);
    if (!current) return undefined;

    const updated = { ...current, ...updates };
    this.subscribers.set(token, updated);
    return updated;
  }
}

export const subscriberModel = new SubscriberModel();