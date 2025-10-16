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
    boardAuthMiddleware.isAuthorized('read'),
    boardController.getDetails
  )
  .put(
    authMiddleware.isAuthorized,
    boardAuthMiddleware.isAuthorized('edit'),
    boardValidation.update,
    boardController.update
  )

Router.route('/supports/moving_card')
  .put(
    authMiddleware.isAuthorized,
    boardAuthMiddleware.isAuthorized('edit'),
    boardValidation.moveCardToDifferentColumn,
    boardController.moveCardToDifferentColumn
  )

export const boardRoute = Router