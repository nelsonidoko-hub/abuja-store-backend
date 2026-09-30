import express from 'express'
import { initializePayment, verifyPayment, paystackWebhook } from '../controllers/paymentController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/webhook', paystackWebhook)
router.post('/initialize', protect, initializePayment)
router.get('/verify/:reference', protect, verifyPayment)

export default router