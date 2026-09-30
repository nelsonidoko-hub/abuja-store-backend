import express from 'express'
import {
  createOrder,
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
  getOrdersByUserId,
  cancelMyOrder,
} from '../controllers/orderController.js'
import { protect, admin } from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/', protect, createOrder)
router.get('/my-orders', protect, getMyOrders)
router.get('/user/:userId', protect, admin, getOrdersByUserId)
router.get('/', protect, admin, getAllOrders)
router.put('/:id/cancel', protect, cancelMyOrder)
router.put('/:id/status', protect, admin, updateOrderStatus)
router.get('/:id', protect, getOrderById)

export default router