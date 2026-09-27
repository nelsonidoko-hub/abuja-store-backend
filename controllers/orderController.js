import Order from '../models/Order.js'
import Product from '../models/Product.js'

export const createOrder = async (req, res) => {
  try {
    const { items, shippingAddress, totalPrice } = req.body

    for (const item of items) {
      const product = await Product.findById(item.product)

      if (!product) {
        return res.status(404).json({ message: `Product not found: ${item.name}` })
      }

      const sizeEntry = product.sizes.find((s) => s.size === item.size)

      if (!sizeEntry || sizeEntry.stock < item.quantity) {
        return res.status(400).json({
          message: `${item.name} (${item.size}) is out of stock or insufficient quantity available`,
        })
      }
    }

    for (const item of items) {
      await Product.updateOne(
        { _id: item.product, 'sizes.size': item.size },
        { $inc: { 'sizes.$.stock': -item.quantity } }
      )
    }

    const order = await Order.create({
      user: req.user._id,
      items,
      shippingAddress,
      totalPrice,
    })

    res.status(201).json(order)
  } catch (error) {
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

export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body
    const order = await Order.findById(req.params.id)

    if (!order) {
      return res.status(404).json({ message: 'Order not found' })
    }

    order.status = status
    if (status === 'delivered') {
      order.deliveredAt = Date.now()
    }
    await order.save()

    res.json(order)
  } catch (error) {
    res.status(400).json({ message: error.message })
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