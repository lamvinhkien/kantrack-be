import { v2 as cloudinary } from 'cloudinary'
import streamifier from 'streamifier'
import { env } from '~/config/environment'

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET
})

const streamUpload = (fileBuffer, folderName, resourceType = 'auto', originalFilename) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: folderName,
        resource_type: resourceType,
        use_filename: true,
        unique_filename: false,
        overwrite: true,
        public_id: originalFilename
      },
      (err, result) => {
        if (err) reject(err)
        else resolve(result)
      }
    )

    streamifier.createReadStream(fileBuffer).pipe(stream)
  })
}

const deleteFile = async (publicId) => {
  const resourceTypes = ['image', 'video', 'raw']

  for (const type of resourceTypes) {
    try {
      const res = await cloudinary.uploader.destroy(publicId, { resource_type: type })
      if (res.result === 'ok' || res.result === 'not_found') {
        return res
      }
    } catch (err) { throw err }
  }

  return { result: 'not_found' }
}

export const CloudinaryProvider = { streamUpload, deleteFile }
