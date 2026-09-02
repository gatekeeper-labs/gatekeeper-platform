import { Bot } from 'grammy';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
export const CHAT_ID = Number(process.env.TELEGRAM_CHAT_ID);

if (!token || !CHAT_ID) {
  console.error('❌ Defina TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID no .env');
  process.exit(1);
}

export const bot = new Bot(token);