import { Router } from 'express';
import { PaymentController } from '../controllers/PaymentController';

const paymentRoutes = Router();
const paymentController = new PaymentController();

// Webhooks de pagamento
paymentRoutes.post('/webhooks/payment', (req, res) => paymentController.handleWebhook(req, res));

// Endpoint analítico para o Dashboard do CRM
paymentRoutes.get('/api/analytics/dashboard', (req, res) =>
  paymentController.getDashboardMetrics(req, res)
);

// Endpoint analítico para listar operações do bot
paymentRoutes.get('/api/analytics/bot-operations', (req, res) =>
  paymentController.getBotOperationsStats(req, res)
);

export { paymentRoutes };