import express from 'express'
import { columnValidation } from '~/validations/columnValidation'
import { columnController } from '~/controllers/columnController'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { boardAuthMiddleware } from '~/middlewares/boardAuthorizationMiddleware'

const Router = express.Router()

Router.route('/')
  .post(
    authMiddleware.isAuthorized,
    boardAuthMiddleware.isAuthorized('edit'),
    columnValidation.createNew,
    columnController.createNew
  )

Router.route('/:id')
  .put(
    authMiddleware.isAuthorized,
    boardAuthMiddleware.isAuthorized('edit'),
    columnValidation.update,
    columnController.update
  )
  .delete(
    authMiddleware.isAuthorized,
    boardAuthMiddleware.isAuthorized('edit'),
    columnValidation.deleteItem,
    columnController.deleteItem
  )

export const columnRoute = Router