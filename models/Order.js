import mongoose from 'mongoose'

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
)

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true, sparse: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        name: String,
        image: String,
        price: Number,
        size: String,
        quantity: Number,
      },
    ],
    deliveryMethod: {
      type: String,
      enum: ['ship', 'pickup'],
      default: 'ship',
    },
    shippingAddress: {
      firstName: String,
      lastName: String,
      address: {
        type: String,
        required: function () {
          return this.deliveryMethod !== 'pickup'
        },
      },
      apartment: String,
      city: {
        type: String,
        required: function () {
          return this.deliveryMethod !== 'pickup'
        },
      },
      state: String,
      postalCode: String,
      phone: { type: String, required: true },
      type: String, // e.g. 'Store Pickup'
      location: String, // e.g. 'Main Retail Store Branch'
    },
    totalPrice: { type: Number, required: true },
    paymentReference: String,
    isPaid: { type: Boolean, default: false },
    paidAt: Date,
    status: {
      type: String,
      enum: ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
    statusHistory: [statusHistorySchema],
    tracking: {
      courier: String,
      trackingNumber: String,
      trackingUrl: String,
      riderPhone: String,
      estimatedDelivery: Date,
    },
    deliveredAt: Date,

    expiresAt: Date,
    expiredAt: Date,
  },
  { timestamps: true }
)

const Order = mongoose.model('Order', orderSchema)
export default Order