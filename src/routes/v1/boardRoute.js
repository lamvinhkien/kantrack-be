import express from 'express'
import { boardValidation } from '~/validations/boardValidation'
import { boardController } from '~/controllers/boardController'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { boardAuthMiddleware } from '~/middlewares/boardAuthorizationMiddleware'

const Router = express.Router()

Router.route('/')
  .get(authMiddleware.isAuthorized, boardController.getBoards)
  .post(authMiddleware.isAuthorized, boardValidation.createNew, boardController.createNew)

Router.route('/:id')
  .get(
    authMiddleware.isAuthorized,
    boardAuthMiddleware.isAuthorized(),
    boardController.getDetails
  )
  .put(
    authMiddleware.isAuthorized,
    boardAuthMiddleware.isAuthorized(),
    boardValidation.update,
    boardController.update
  )
  .delete(
    authMiddleware.isAuthorized,
    boardAuthMiddleware.isAuthorized(),
    boardValidation.deleteItem,
    boardController.deleteItem
  )

Router.route('/supports/moving_card')
  .put(
    authMiddleware.isAuthorized,
    boardAuthMiddleware.isAuthorized(),
    boardValidation.moveCardToDifferentColumn,
    boardController.moveCardToDifferentColumn
  )

export const boardRoute = Router