import Order from '../models/Order.js'
import Counter from '../models/Counter.js'
import Product from '../models/Product.js'
import { restoreStock } from '../utils/stock.js'
import { sendStatusUpdate } from '../utils/email.js'
import { HOLD_MINUTES } from '../utils/expireOrders.js'

const STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled']
const NOTIFY = ['processing', 'shipped', 'delivered', 'cancelled']
const NEEDS_PAYMENT = ['processing', 'shipped', 'delivered']

async function nextOrderNumber() {
  const counter = await Counter.findOneAndUpdate(
    { _id: 'order' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  )
  return `${process.env.ORDER_PREFIX || 'ZR'}-${10000 + counter.seq}`
}

export const createOrder = async (req, res) => {
  const reserved = []
  try {
    const { items, shippingAddress, deliveryMethod } = req.body

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Your cart is empty' })
    }

    const orderItems = []

    for (const item of items) {
      const quantity = Number(item.quantity)
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new Error('Invalid quantity')
      }

      // Check and decrement in one atomic step, so two buyers can't take the last unit
      const product = await Product.findOneAndUpdate(
        {
          _id: item.product,
          sizes: { $elemMatch: { size: item.size, stock: { $gte: quantity } } },
        },
        { $inc: { 'sizes.$.stock': -quantity } },
        { new: true }
      )

      if (!product) {
        throw new Error(`${item.name || 'An item'} (${item.size}) is out of stock or not enough is left`)
      }

      reserved.push({ product: product._id, size: item.size, quantity })
      orderItems.push({
        product: product._id,
        name: product.name,
        image: product.image,
        price: product.price,
        size: item.size,
        quantity,
      })
    }

    const totalPrice = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0)

    const order = await Order.create({
      orderNumber: await nextOrderNumber(),
      user: req.user._id,
      items: orderItems,
      deliveryMethod,
      shippingAddress,
      totalPrice,
      statusHistory: [{ status: 'pending', note: 'Order placed', at: new Date() }],
      expiresAt: new Date(Date.now() + HOLD_MINUTES * 60 * 1000),
    })

    res.status(201).json(order)
  } catch (error) {
    await restoreStock(reserved).catch(() => {})
    res.status(400).json({ message: error.message })
  }
}

export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 })
    res.json(orders)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email')

    if (!order) return res.status(404).json({ message: 'Order not found' })

    if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' })
    }

    res.json(order)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().populate('user', 'name email').sort({ createdAt: -1 })
    res.json(orders)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getOrdersByUserId = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.params.userId }).sort({ createdAt: -1 })
    res.json(orders)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const updateOrderStatus = async (req, res) => {
  try {
    const { status, note, tracking } = req.body

    if (status && !STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' })
    }

    const order = await Order.findById(req.params.id).populate('user', 'name email')
    if (!order) return res.status(404).json({ message: 'Order not found' })

    if (order.status === 'cancelled') {
      return res.status(400).json({ message: 'Cancelled orders cannot be changed' })
    }

    if (status && NEEDS_PAYMENT.includes(status) && !order.isPaid) {
      return res.status(400).json({ message: 'This order has not been paid yet' })
    }

    if (tracking) {
      for (const key of ['courier', 'trackingNumber', 'trackingUrl', 'riderPhone', 'estimatedDelivery']) {
        if (tracking[key] !== undefined) order.tracking[key] = tracking[key] || undefined
      }
    }

    const changed = status && status !== order.status

    if (changed) {
      if (status === 'cancelled') await restoreStock(order.items)
      order.status = status
      if (status === 'delivered') order.deliveredAt = new Date()
      order.statusHistory.push({ status, note: note || '', at: new Date() })
    }

    await order.save()

    if (changed && NOTIFY.includes(status)) {
      sendStatusUpdate(order).catch((e) => console.error('Status email error:', e.message))
    }

    res.json(order)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
}

export const cancelMyOrder = async (req, res) => {
  try {
    // Atomic: only the owner, only while pending and unpaid
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id, status: 'pending', isPaid: false },
      {
        $set: { status: 'cancelled' },
        $push: { statusHistory: { status: 'cancelled', note: 'Cancelled by customer', at: new Date() } },
      },
      { new: true }
    )

    if (!order) {
      return res.status(400).json({ message: 'This order can no longer be cancelled' })
    }

    await restoreStock(order.items)
    res.json(order)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}