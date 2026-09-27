import Product from '../models/Product.js'

export const getProducts = async (req, res) => {
  try {
    const products = await Product.find()
    res.json(products)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)

    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    res.json(product)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getProductsByCategory = async (req, res) => {
  try {
    // category is stored lowercase (schema has lowercase: true), so the
    // query filter needs to match that or lookups with different casing
    // in the URL (e.g. /category/Shoes) silently return nothing.
    const products = await Product.find({
      category: req.params.categoryName.toLowerCase(),
    })
    res.json(products)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getBestSellers = async (req, res) => {
  try {
    const products = await Product.find({ bestSeller: true })
    res.json(products)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const createProduct = async (req, res) => {
  try {
    const product = new Product(req.body)
    const createdProduct = await product.save()
    res.status(201).json(createdProduct)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
}

export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)

    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    Object.assign(product, req.body)
    const updatedProduct = await product.save()

    res.json(updatedProduct)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
}

export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)

    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    await product.deleteOne()

    res.json({ message: 'Product removed' })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const searchProducts = async (req, res) => {
  try {
    const { q } = req.query

    if (!q) {
      return res.json([])
    }

    const products = await Product.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
      ],
    })

    res.json(products)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}