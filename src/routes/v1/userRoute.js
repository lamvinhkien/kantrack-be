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

Router.route('/get_2fa_qr_code')
  .get(authMiddleware.isAuthorized, userController.get2FA_QRCode)

Router.route('/setup_2fa')
  .post(authMiddleware.isAuthorized, userController.setup2FA)

Router.route('/verify_2fa')
  .put(userController.verify2FA)

export const userRoute = Router
