import express from 'express'
import { userValidation } from '~/validations/userValidation'
import { userController } from '~/controllers/userController'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { multerUploadMiddleware } from '~/middlewares/multerUploadMiddleware'

const Router = express.Router()

Router.route('/register')
  .post(userValidation.createNew, userController.createNew)

Router.route('/verify')
  .put(userValidation.verifyAccount, userController.verifyAccount)

Router.route('/login')
  .post(userValidation.login, userController.login)

Router.route('/logout')
  .delete(authMiddleware.isAuthorized, userController.logout)

Router.route('/refresh_token')
  .get(userController.refreshToken)

Router.route('/update')
  .put(authMiddleware.isAuthorized, multerUploadMiddleware.upload.single('userAvatar'), userValidation.update, userController.update)

Router.route('/verify_2fa')
  .post(userController.verify2FA)

Router.route('/recent_boards')
  .get(authMiddleware.isAuthorized, userController.getRecentBoards)

export const userRoute = Router
