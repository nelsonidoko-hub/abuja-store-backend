import express from 'express'
import {
  createOrder,
  getMyOrders,
  getOrderById,
  getAllOrders,
} from '../controllers/orderController.js'
import { protect, admin } from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/', protect, createOrder)
router.get('/my-orders', protect, getMyOrders)
router.get('/', protect, admin, getAllOrders)
router.get('/:id', protect, getOrderById)

export default router