import cloudinary from '../config/cloudinary.js'

export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' })
    }

    const uploadFromBuffer = () => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'abujastore' },
          (error, result) => {
            if (error) reject(error)
            else resolve(result)
          }
        )
        stream.end(req.file.buffer)
      })
    }

    const result = await uploadFromBuffer()

    res.json({ url: result.secure_url })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}