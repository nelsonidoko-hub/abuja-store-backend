const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const naira = (n) => `₦${Number(n).toLocaleString('en-NG')}`
const store = () => process.env.STORE_NAME || 'Abuja Store'
const orderRef = (o) => o.orderNumber || `#${String(o._id).slice(-8).toUpperCase()}`
const orderUrl = (o) => `${process.env.FRONTEND_URL}/orders/${o._id}`

async function sendEmail({ to, subject, html }) {
  if (!to) return
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email skipped - no RESEND_API_KEY] ${subject} -> ${to}`)
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || `${store()} <onboarding@resend.dev>`,
      to,
      subject,
      html,
    }),
  })
  if (!res.ok) console.error('Email failed:', res.status, await res.text())
}

function layout(heading, body) {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
    <h2 style="margin:0 0 16px">${esc(heading)}</h2>${body}
    <p style="color:#888;font-size:12px;margin-top:32px">${esc(store())}</p></div>`
}

function itemsTable(order) {
  const rows = order.items
    .map(
      (i) => `<tr><td style="padding:6px 0">${esc(i.name)} (${esc(i.size)}) × ${i.quantity}</td>
      <td style="padding:6px 0;text-align:right">${naira(i.price * i.quantity)}</td></tr>`
    )
    .join('')
  return `<table style="width:100%;border-collapse:collapse;border-top:1px solid #eee;border-bottom:1px solid #eee">${rows}
    <tr><td style="padding:8px 0"><b>Total</b></td><td style="text-align:right"><b>${naira(order.totalPrice)}</b></td></tr></table>`
}

const viewButton = (order) =>
  `<p><a href="${orderUrl(order)}" style="background:#111;color:#fff;padding:10px 18px;text-decoration:none;border-radius:6px;display:inline-block">View your order</a></p>`

export async function sendOrderConfirmation(order) {
  const a = order.shippingAddress
  await sendEmail({
    to: order.user.email,
    subject: `Order ${orderRef(order)} confirmed`,
    html: layout(
      `Thanks for your order, ${order.user.name}!`,
      `<p>We have received your payment for order <b>${esc(orderRef(order))}</b>. We will email you again as it moves along.</p>
       ${itemsTable(order)}
       <p><b>Delivering to:</b><br>${esc(a.address)}, ${esc(a.city)}<br>${esc(a.phone)}</p>
       ${viewButton(order)}`
    ),
  })
}

export async function sendStatusUpdate(order) {
  const messages = {
    processing: { subject: 'We are preparing your order', text: 'we have started getting your order ready.' },
    shipped: { subject: 'Your order is on its way', text: 'your order has been handed over for delivery.' },
    delivered: { subject: 'Your order has been delivered', text: 'your order is marked as delivered. We hope you love it!' },
    cancelled: { subject: 'Your order was cancelled', text: 'your order has been cancelled. If you already paid, please contact us about your refund.' },
  }
  const m = messages[order.status]
  if (!m) return

  const t = order.tracking || {}
  let trackingHtml = ''
  if (order.status === 'shipped') {
    const lines = []
    if (t.courier) lines.push(`Courier: ${esc(t.courier)}`)
    if (t.trackingNumber) lines.push(`Tracking number: ${esc(t.trackingNumber)}`)
    if (t.riderPhone) lines.push(`Rider phone: ${esc(t.riderPhone)}`)
    if (t.estimatedDelivery) lines.push(`Expected by: ${new Date(t.estimatedDelivery).toDateString()}`)
    if (t.trackingUrl && /^https?:\/\//i.test(t.trackingUrl)) {
      lines.push(`<a href="${esc(t.trackingUrl)}">Track your package</a>`)
    }
    if (lines.length) trackingHtml = `<p>${lines.join('<br>')}</p>`
  }

  await sendEmail({
    to: order.user.email,
    subject: `${m.subject} - ${orderRef(order)}`,
    html: layout(
      m.subject,
      `<p>Hi ${esc(order.user.name)}, ${m.text}</p>${trackingHtml}${itemsTable(order)}${viewButton(order)}`
    ),
  })
}

export async function notifyAdminNewOrder(order) {
  const a = order.shippingAddress
  await sendEmail({
    to: process.env.ADMIN_NOTIFY_EMAIL,
    subject: `New order ${orderRef(order)} - ${naira(order.totalPrice)}`,
    html: layout(
      'New paid order',
      `<p><b>${esc(order.user.name)}</b> (${esc(order.user.email)}, ${esc(a.phone)}) just paid.</p>
       ${itemsTable(order)}<p>${esc(a.address)}, ${esc(a.city)}</p>`
    ),
  })
}

export async function notifyAdminRefundNeeded(order) {
  await sendEmail({
    to: process.env.ADMIN_NOTIFY_EMAIL,
    subject: `REFUND NEEDED - order ${orderRef(order)}`,
    html: layout(
      'Refund needed',
      `<p>${esc(order.user.name)} (${esc(order.user.email)}) paid ${naira(order.totalPrice)} for order
       <b>${esc(orderRef(order))}</b>, but the order was already cancelled and the stock could not be
       reserved again. Please refund the payment (reference: ${esc(order.paymentReference)}) from your Paystack dashboard.</p>
       ${itemsTable(order)}`
    ),
  })
}