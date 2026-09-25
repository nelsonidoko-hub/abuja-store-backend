import express from 'express'
import {
  getProducts,
  getProductById,
  getProductsByCategory,
  getBestSellers,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/productController.js'
import { protect, admin } from '../middleware/authMiddleware.js'

const router = express.Router()

router.get('/', getProducts)
router.get('/category/:categoryName', getProductsByCategory)
// Must come before '/:id' — otherwise Express matches "/bestsellers" as an
// :id param and it gets routed to getProductById instead.
router.get('/bestsellers', getBestSellers)
router.get('/:id', getProductById)

router.post('/', protect, admin, createProduct)
router.put('/:id', protect, admin, updateProduct)
router.delete('/:id', protect, admin, deleteProduct)

export default router