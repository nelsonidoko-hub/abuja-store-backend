import express from 'express'
import { registerUser, loginUser, registerAdmin, getAllCustomers } from '../controllers/authController.js'
import { protect, admin } from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/register', registerUser)
router.post('/login', loginUser)
router.post('/register-admin', registerAdmin)
router.get('/customers', protect, admin, getAllCustomers)

export default router