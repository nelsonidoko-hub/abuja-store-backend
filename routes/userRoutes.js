import express from 'express'
import { registerUser, loginUser, registerAdmin, getAllCustomers, forgotPassword, resetPassword } from '../controllers/authController.js'
import { protect, admin } from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/register', registerUser)
router.post('/login', loginUser)
router.post('/register-admin', registerAdmin)
router.get('/customers', protect, admin, getAllCustomers)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password', resetPassword)

export default router