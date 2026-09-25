import axios from 'axios'
import Order from '../models/Order.js'

export const initializePayment = async (req, res) => {
  try {
    const { orderId } = req.body
    const order = await Order.findById(orderId)

    if (!order) return res.status(404).json({ message: 'Order not found' })

    const response = await axios.post(
    'https://api.paystack.co/transaction/initialize',
    {
        email: req.user.email,
        amount: order.totalPrice * 100,
        callback_url: 'http://localhost:5173/payment-success',
        metadata: { orderId: order._id.toString() },
    },
    {
        headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
    }
    )

    res.json(response.data)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    )

    const { status, metadata } = response.data.data

    if (status === 'success') {
      const order = await Order.findById(metadata.orderId)
      order.isPaid = true
      order.paidAt = Date.now()
      order.paymentReference = reference
      order.status = 'paid'
      await order.save()
    }

    res.json(response.data.data)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}