import express from 'express'
import { cardValidation } from '~/validations/cardValidation'
import { cardController } from '~/controllers/cardController'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { multerUploadMiddleware } from '~/middlewares/multerUploadMiddleware'
import { boardAuthMiddleware } from '~/middlewares/boardAuthorizationMiddleware'

const Router = express.Router()

Router.route('/')
  .post(
    authMiddleware.isAuthorized,
    boardAuthMiddleware.isAuthorized(),
    cardValidation.createNew,
    cardController.createNew
  )

Router.route('/:id')
  .put(
    authMiddleware.isAuthorized,
    multerUploadMiddleware.upload.fields([
      { name: 'cardCover', maxCount: 1 },
      { name: 'cardAttachments', maxCount: 10 }
    ]),
    boardAuthMiddleware.isAuthorized(),
    cardValidation.update,
    cardController.update
  )
  .delete(
    authMiddleware.isAuthorized,
    boardAuthMiddleware.isAuthorized(),
    cardValidation.deleteItem,
    cardController.deleteItem
  )

export const cardRoute = Router
