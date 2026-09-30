import Order from '../models/Order.js'
import { reserveStock, restoreStock } from './stock.js'
import {
  sendOrderConfirmation,
  sendStatusUpdate,
  notifyAdminNewOrder,
  notifyAdminRefundNeeded,
} from './email.js'

export async function markOrderPaid(orderId, reference, amountKobo) {
  if (!orderId) return { order: null }

  const existing = await Order.findById(orderId)
  if (!existing) return { order: null }
  if (existing.isPaid) return { order: existing, alreadyPaid: true }

  const expected = Math.round(existing.totalPrice * 100)
  if (amountKobo !== expected) {
    console.error(`Amount mismatch on order ${existing._id}: paid ${amountKobo}, expected ${expected}`)
    return { order: existing, mismatch: true }
  }

  let status = 'paid'
  let note = 'Payment confirmed'
  let reservedAgain = false

  if (existing.status === 'cancelled') {
    // Only orders that auto-expired can be reopened. Anything cancelled on purpose stays cancelled.
    reservedAgain = Boolean(existing.expiredAt) && (await reserveStock(existing.items))
    if (reservedAgain) {
      note = 'Payment received after the hold expired; stock was reserved again'
    } else {
      status = 'cancelled'
      note = 'Payment received for a cancelled order - refund needed'
    }
  }

  const order = await Order.findOneAndUpdate(
    { _id: orderId, isPaid: false },
    {
      $set: { isPaid: true, paidAt: new Date(), paymentReference: reference, status },
      $push: { statusHistory: { status, note, at: new Date() } },
    },
    { new: true }
  ).populate('user', 'name email')

  if (!order) {
    // Another request marked it paid first
    if (reservedAgain) await restoreStock(existing.items)
    return { order: await Order.findById(orderId), alreadyPaid: true }
  }

  if (status === 'paid') {
    sendOrderConfirmation(order).catch((e) => console.error('Confirmation email error:', e.message))
    notifyAdminNewOrder(order).catch((e) => console.error('Admin email error:', e.message))
  } else {
    sendStatusUpdate(order).catch((e) => console.error('Status email error:', e.message))
    notifyAdminRefundNeeded(order).catch((e) => console.error('Admin email error:', e.message))
  }

  return { order }
}