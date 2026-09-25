import mongoose from 'mongoose'

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    oldPrice: { type: Number, min: 0, default: null },
    onSale: { type: Boolean, default: false },
    bestSeller: { type: Boolean, default: false },
    category: { type: String, required: true, lowercase: true, index: true },
    image: { type: String, required: true },
    hoverImage: { type: String, default: '' },
    // Extra gallery shots (back view, another color, etc.) shown as
    // thumbnails on the product detail page, alongside image/hoverImage.
    images: { type: [String], default: [] },
    sizes: [
      {
        size: { type: String, required: true },
        stock: { type: Number, required: true, default: 0, min: 0 },
      },
    ],
    description: { type: String, default: '' },
  },
  { timestamps: true }
)

// Guard against a "sale" where the old price isn't actually higher than the
// current price (i.e. not a real discount).
// No `next` param here — Mongoose 7+ dropped callback-style middleware;
// throwing synchronously is how you fail a pre-save hook now.
productSchema.pre('save', function () {
  if (this.onSale && this.oldPrice != null && this.oldPrice <= this.price) {
    throw new Error('oldPrice must be greater than price when onSale is true')
  }
})

const Product = mongoose.model('Product', productSchema)

export default Product