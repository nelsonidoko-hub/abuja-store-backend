import Product from '../models/Product.js'

export async function restoreStock(items) {
  for (const item of items) {
    await Product.updateOne(
      { _id: item.product, 'sizes.size': item.size },
      { $inc: { 'sizes.$.stock': item.quantity } }
    )
  }
}

// Takes stock for every item, or none of it (rolls back if any item is short)
export async function reserveStock(items) {
  const taken = []
  for (const item of items) {
    const updated = await Product.findOneAndUpdate(
      {
        _id: item.product,
        sizes: { $elemMatch: { size: item.size, stock: { $gte: item.quantity } } },
      },
      { $inc: { 'sizes.$.stock': -item.quantity } }
    )
    if (!updated) {
      await restoreStock(taken)
      return false
    }
    taken.push(item)
  }
  return true
}