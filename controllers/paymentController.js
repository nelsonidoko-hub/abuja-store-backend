import axios from 'axios'
import crypto from 'crypto'
import Order from '../models/Order.js'
import { markOrderPaid } from '../utils/payments.js'

// Env is read inside functions on purpose: dotenv.config() in server.js
// runs after the imports are evaluated.
const paystackHeaders = () => ({
  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
})

// export const initializePayment = async (req, res) => {
//   try {
//     const order = await Order.findById(req.body.orderId)

//     if (!order) return res.status(404).json({ message: 'Order not found' })
//     if (order.user.toString() !== req.user._id.toString()) {
//       return res.status(403).json({ message: 'Not authorized' })
//     }
//     if (order.isPaid) return res.status(400).json({ message: 'This order is already paid' })
//     if (order.status === 'cancelled') return res.status(400).json({ message: 'This order was cancelled' })

//     const response = await axios.post(
//       'https://api.paystack.co/transaction/initialize',
//       {
//         email: req.user.email,
//         amount: Math.round(order.totalPrice * 100),
//         callback_url: `${process.env.FRONTEND_URL}/payment-success`,
//         metadata: { orderId: order._id.toString(), orderNumber: order.orderNumber },
//       },
//       { headers: paystackHeaders() }
//     )

//     res.json(response.data)
//   } catch (error) {
//     res.status(500).json({ message: error.response?.data?.message || error.message })
//   }
// }

// export const verifyPayment = async (req, res) => {
//   try {
//     const { data } = await axios.get(
//       `https://api.paystack.co/transaction/verify/${encodeURIComponent(req.params.reference)}`,
//       { headers: paystackHeaders() }
//     )
//     const tx = data.data

//     if (tx.status !== 'success') {
//       return res.status(400).json({ success: false, message: 'Payment was not successful' })
//     }

//     const { order, mismatch } = await markOrderPaid(tx.metadata?.orderId, tx.reference, tx.amount)

//     if (!order || mismatch) {
//       return res.status(400).json({ success: false, message: 'Payment could not be matched to an order' })
//     }

//     if (String(order.user._id || order.user) !== req.user._id.toString()) {
//       return res.status(403).json({ success: false, message: 'Not authorized' })
//     }

//     res.json({ success: true, order })
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.response?.data?.message || error.message })
//   }
// }

import { HOLD_MINUTES } from '../utils/expireOrders.js'

export const initializePayment = async (req, res) => {
  try {
    const order = await Order.findById(req.body.orderId)

    if (!order) return res.status(404).json({ message: 'Order not found' })
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' })
    }
    if (order.isPaid) return res.status(400).json({ message: 'This order is already paid' })
    if (order.status === 'cancelled') {
      return res.status(400).json({ message: 'This order expired or was cancelled. Please place it again.' })
    }

    // Fresh hold window while the customer pays; fails if the order was cancelled a moment ago
    const extended = await Order.updateOne(
      { _id: order._id, status: 'pending', isPaid: false },
      { $set: { expiresAt: new Date(Date.now() + HOLD_MINUTES * 60 * 1000) } }
    )
    if (extended.matchedCount === 0) {
      return res.status(400).json({ message: 'This order expired. Please place it again.' })
    }

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: req.user.email,
        amount: Math.round(order.totalPrice * 100),
        callback_url: `${process.env.FRONTEND_URL}/payment-success`,
        metadata: { orderId: order._id.toString(), orderNumber: order.orderNumber },
      },
      { headers: paystackHeaders() }
    )

    res.json(response.data)
  } catch (error) {
    res.status(500).json({ message: error.response?.data?.message || error.message })
  }
}

export const verifyPayment = async (req, res) => {
  try {
    const { data } = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(req.params.reference)}`,
      { headers: paystackHeaders() }
    )
    const tx = data.data

    if (tx.status !== 'success') {
      return res.status(400).json({ success: false, message: 'Payment was not successful' })
    }

    const { order, mismatch } = await markOrderPaid(tx.metadata?.orderId, tx.reference, tx.amount)

    if (!order || mismatch) {
      return res.status(400).json({ success: false, message: 'Payment could not be matched to an order' })
    }

    if (String(order.user._id || order.user) !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' })
    }

    if (order.status === 'cancelled') {
      return res.status(409).json({
        success: false,
        message:
          'Your payment was received, but this order had expired and the items are no longer available. We will refund you and email you shortly.',
      })
    }

    res.json({ success: true, order })
  } catch (error) {
    res.status(500).json({ success: false, message: error.response?.data?.message || error.message })
  }
}

// Paystack calls this directly, so the order is marked paid even if the customer closes the tab
export const paystackWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'] || ''
    const expected = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(req.rawBody || '')
      .digest('hex')

    const a = Buffer.from(expected)
    const b = Buffer.from(signature)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.sendStatus(401)
    }

    const event = req.body
    if (event.event === 'charge.success') {
      const tx = event.data
      await markOrderPaid(tx.metadata?.orderId, tx.reference, tx.amount)
    }

    res.sendStatus(200)
  } catch (error) {
    console.error('Webhook error:', error.message)
    res.sendStatus(500)
  }
}