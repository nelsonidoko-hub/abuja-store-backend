import mongoose from 'mongoose'

const counterSchema = new mongoose.Schema({
  _id: String,
  seq: Number,
})

export default mongoose.model('Counter', counterSchema)