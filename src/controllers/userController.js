import { StatusCodes } from 'http-status-codes'
import { userService } from '~/services/userService'
import { v4 as uuidv4 } from 'uuid'
import ApiError from '~/utils/ApiError'
import ms from 'ms'

const createNew = async (req, res, next) => {
  try {
    const createdUser = await userService.createNew(req.body)
    res.status(StatusCodes.CREATED).json(createdUser)
  } catch (error) { next(error) }
}

const verifyAccount = async (req, res, next) => {
  try {
    const result = await userService.verifyAccount(req.body)
    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

const login = async (req, res, next) => {
  try {
    const deviceId = req.cookies.deviceId || uuidv4()
    const result = await userService.login(req.body, deviceId)

    if (result.require2fa) {
      res.cookie('deviceId', deviceId, { httpOnly: true, secure: true, sameSite: 'none', maxAge: ms('365 days') })
    }

    if (result.accessToken && result.refreshToken) {
      res.cookie('accessToken', result.accessToken, { httpOnly: true, secure: true, sameSite: 'none', maxAge: ms('7 days') })
      res.cookie('refreshToken', result.refreshToken, { httpOnly: true, secure: true, sameSite: 'none', maxAge: ms('14 days') })
      res.cookie('deviceId', deviceId, { httpOnly: true, secure: true, sameSite: 'none', maxAge: ms('365 days') })
    }

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

const logout = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id
    const deviceId = req.cookies?.deviceId
    const result = await userService.logout(userId, deviceId)

    res.clearCookie('deviceId')
    res.clearCookie('accessToken')
    res.clearCookie('refreshToken')

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

const refreshToken = async (req, res, next) => {
  try {
    const result = await userService.refreshToken(req.cookies?.refreshToken)

    res.cookie('accessToken', result.accessToken, { httpOnly: true, secure: true, sameSite: 'none', maxAge: ms('7 days') })

    res.status(StatusCodes.OK).json(result)
  } catch (error) {
    next(new ApiError(StatusCodes.FORBIDDEN, 'Please sign in.'))
  }
}

const update = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id
    const userAvatarFile = req.file
    const deviceId = req.cookies.deviceId || null
    const updatedUser = await userService.update(userId, req.body, userAvatarFile, deviceId)
    res.status(StatusCodes.OK).json(updatedUser)
  } catch (error) { next(error) }
}

const get2FA_QRCode = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id
    const result = await userService.get2FA_QRCode(userId)
    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

const setup2FA = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id
    const otpToken = req.body.otpToken
    const action = req.body.action2FA
    const deviceId = req.cookies.deviceId || null
    const result = await userService.setup2FA(userId, otpToken, action, deviceId)
    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

const verify2FA = async (req, res, next) => {
  try {
    const { email, otpToken } = req.body
    const deviceId = req.cookies.deviceId || null
    const result = await userService.verify2FA(email, otpToken, deviceId)

    if (result.accessToken && result.refreshToken) {
      res.cookie('accessToken', result.accessToken, { httpOnly: true, secure: true, sameSite: 'none', maxAge: ms('7 days') })
      res.cookie('refreshToken', result.refreshToken, { httpOnly: true, secure: true, sameSite: 'none', maxAge: ms('14 days') })
    }

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

export const userController = {
  createNew,
  verifyAccount,
  login,
  logout,
  refreshToken,
  update,
  get2FA_QRCode,
  setup2FA,
  verify2FA
}
