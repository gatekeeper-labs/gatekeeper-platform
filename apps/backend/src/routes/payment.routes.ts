import { Router } from 'express';
import { PaymentController } from '../controllers/PaymentController';

const paymentRoutes = Router();
const paymentController = new PaymentController();

paymentRoutes.post('/webhooks/payment', (req, res) => paymentController.handleWebhook(req, res));

export { paymentRoutes };