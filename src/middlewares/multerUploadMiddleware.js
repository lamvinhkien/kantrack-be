import { StatusCodes } from 'http-status-codes'
import multer from 'multer'
import ApiError from '~/utils/ApiError'
import { LIMIT_COMMON_FILE_SIZE, ALLOW_COMMON_FILE_TYPES } from '~/utils/validators'

const upload = multer({
  limits: { fileSize: LIMIT_COMMON_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOW_COMMON_FILE_TYPES.includes(file.mimetype)) {
      return cb(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'File type is invalid. Only accept jpg, jpeg and png'), null)
    }
    return cb(null, true)
  }
})

export const multerUploadMiddleware = { upload }