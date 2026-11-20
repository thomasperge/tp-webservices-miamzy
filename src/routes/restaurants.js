import { Router } from 'express';
import { createOrderHandler } from './orders.js';

const router = Router();

router.post('/:restaurantId/orders', createOrderHandler);

export default router;