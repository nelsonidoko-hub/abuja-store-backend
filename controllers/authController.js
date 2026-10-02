import User from '../models/User.js'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { sendPasswordReset } from '../utils/email.js'

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  })
}

export const registerAdmin = async (req, res) => {
  try {
    const { name, email, password, setupKey } = req.body

    if (setupKey !== process.env.ADMIN_SETUP_KEY) {
      return res.status(403).json({ message: 'Invalid setup key' })
    }

    const userExists = await User.findOne({ email })

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' })
    }

    const user = await User.create({ name, email, password, role: 'admin' })

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body

    const userExists = await User.findOne({ email })

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' })
    }

    const user = await User.create({ name, email, password })

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await User.findOne({ email })

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getAllCustomers = async (req, res) => {
  try {
    const users = await User.find({ role: 'customer' }).select('-password')
    res.json(users)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body
    const user = await User.findOne({ email })

    // Always respond the same way, so it can't be used to check which emails are registered
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex')
      user.resetToken = crypto.createHash('sha256').update(rawToken).digest('hex')
      user.resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000)
      await user.save()

      const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${rawToken}`
      sendPasswordReset(user, resetUrl).catch((e) => console.error('Reset email error:', e.message))
    }

    res.json({ message: 'If that email is registered, a reset link has been sent.' })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body
    const hashed = crypto.createHash('sha256').update(token || '').digest('hex')

    const user = await User.findOne({
      resetToken: hashed,
      resetTokenExpires: { $gt: new Date() },
    })

    if (!user) {
      return res.status(400).json({ message: 'This reset link is invalid or has expired' })
    }

    user.password = password
    user.resetToken = undefined
    user.resetTokenExpires = undefined
    await user.save()

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

