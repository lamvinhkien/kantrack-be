import express from 'express'
import { invitationValidation } from '~/validations/invitationValidation'
import { invitationController } from '~/controllers/invitationController'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { boardAuthMiddleware } from '~/middlewares/boardAuthorizationMiddleware'

const Router = express.Router()

Router.route('/board')
  .post(
    authMiddleware.isAuthorized,
    boardAuthMiddleware.isAuthorized(),
    invitationValidation.createNewBoardInvitation,
    invitationController.createNewBoardInvitation
  )

Router.route('/')
  .get(authMiddleware.isAuthorized, invitationController.getInvitations)

Router.route('/board/:invitationId')
  .put(
    authMiddleware.isAuthorized,
    invitationController.updateBoardInvitation
  )

export const invitationRoute = Router