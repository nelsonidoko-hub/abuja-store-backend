import express from 'express'
import { resetStoreData } from '../controllers/adminController.js'
import { protect, admin } from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/reset-store', protect, admin, resetStoreData)

export default router