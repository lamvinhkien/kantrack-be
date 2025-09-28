import { StatusCodes } from 'http-status-codes'
import multer from 'multer'
import ApiError from '~/utils/ApiError'
import { LIMIT_COMMON_FILE_SIZE, ALLOW_COMMON_FILE_TYPES } from '~/utils/validators'

const storage = multer.memoryStorage()

const IMAGE_FIELDS = ['cardCover', 'userAvatar']

const fileFilter = (req, file, cb) => {
  const isImageField = IMAGE_FIELDS.includes(file.fieldname)

  if (isImageField && !ALLOW_COMMON_FILE_TYPES.includes(file.mimetype)) {
    return cb(
      new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'File must be an image'),
      false
    )
  }

  file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8')
  cb(null, true)
}

const upload = multer({
  storage,
  limits: { fileSize: LIMIT_COMMON_FILE_SIZE },
  fileFilter
})

export const multerUploadMiddleware = { upload }
