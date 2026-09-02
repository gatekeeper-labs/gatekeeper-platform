import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { bot } from './config/telegram';
import { setupBot } from './bot';
import { paymentRoutes } from './routes/payment.routes';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Registra as rotas
app.use(paymentRoutes);

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  // Inicializa o Bot do Telegram
  setupBot();
  await bot.init();
  bot.start();
  console.log(`🤖 Bot @${bot.botInfo.username} rodando!`);

  // Inicializa o Express
  app.listen(PORT, () => {
    console.log(`🚀 Servidor Express rodando na porta ${PORT}`);
  });
}

bootstrap();