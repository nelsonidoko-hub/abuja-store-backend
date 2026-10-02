import Order from '../models/Order.js'
import User from '../models/User.js'
import Counter from '../models/Counter.js'

export const resetStoreData = async (req, res) => {
  try {
    const { confirm } = req.body

    if (confirm !== 'RESET STORE') {
      return res.status(400).json({ message: 'Confirmation phrase did not match' })
    }

    const [orders, customers, counters] = await Promise.all([
      Order.deleteMany({}),
      User.deleteMany({ role: 'customer' }),
      Counter.deleteMany({}),
    ])

    res.json({
      message: 'Store data reset',
      deleted: {
        orders: orders.deletedCount,
        customers: customers.deletedCount,
      },
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}