import Order from '../models/Order.js'
import { restoreStock } from './stock.js'

export const HOLD_MINUTES = 30

function expiryCondition() {
  const now = new Date()
  const legacyCutoff = new Date(now.getTime() - HOLD_MINUTES * 60 * 1000)
  return [
    { expiresAt: { $lt: now } },
    // orders created before expiresAt existed
    { expiresAt: { $exists: false }, createdAt: { $lt: legacyCutoff } },
  ]
}

export async function expireUnpaidOrders() {
  const stale = await Order.find({
    status: 'pending',
    isPaid: false,
    $or: expiryCondition(),
  }).select('_id')

  for (const { _id } of stale) {
    // Atomic claim: only cancels if it is still unpaid AND still expired
    // (a "Pay now" click in the meantime extends expiresAt and wins)
    const order = await Order.findOneAndUpdate(
      { _id, status: 'pending', isPaid: false, $or: expiryCondition() },
      {
        $set: { status: 'cancelled', expiredAt: new Date() },
        $push: {
          statusHistory: { status: 'cancelled', note: 'Payment not received in time', at: new Date() },
        },
      },
      { new: true }
    )
    if (order) await restoreStock(order.items)
  }

  return stale.length
}

export function startOrderExpiryJob() {
  const run = () =>
    expireUnpaidOrders().catch((e) => console.error('Order expiry error:', e.message))
  run()
  setInterval(run, 5 * 60 * 1000)
}