import { StatusCodes } from 'http-status-codes'
import { userModel } from '~/models/userModel'
import ApiError from '~/utils/ApiError'
import bcryptjs from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { pickUser } from '~/utils/formatters'
import { WEBSITE_DOMAIN } from '~/utils/constants'
import { MailerSendProvider } from '~/providers/MailerSendProvider'
import { MAILER_SEND_TEMPLATES_IDS } from '~/utils/constants'
import { env } from '~/config/environment'
import { JwtProvider } from '~/providers/JwtProvider'
import { CloudinaryProvider } from '~/providers/CloudinaryProvider'
import { boardModel } from '~/models/boardModel'
import crypto from 'crypto'
import ms from 'ms'

const createNew = async (reqBody) => {
  try {
    const existUser = await userModel.findOneByEmail(reqBody.email)
    if (existUser) throw new ApiError(StatusCodes.CONFLICT, 'Email already exist.')

    const nameFromEmail = reqBody.email.split('@')[0]
    const newUser = {
      email: reqBody.email,
      password: bcryptjs.hashSync(reqBody.password, 8),
      username: nameFromEmail,
      displayName: nameFromEmail,
      verifyToken: uuidv4()
    }

    const createdUser = await userModel.createNew(newUser)
    const getNewUser = await userModel.findOneById(createdUser.insertedId)

    try {
      const verificationLink = `${WEBSITE_DOMAIN}/account/verification?email=${getNewUser.email}&token=${getNewUser.verifyToken}`
      const to = getNewUser.email
      const toName = getNewUser.username
      const subject = 'Account created.'
      const templateId = MAILER_SEND_TEMPLATES_IDS.REGISTER_ACCOUNT
      const personalizationData = [
        {
          email: to,
          data: {
            support_email: env.MAILER_SEND_SUPPORT_EMAIL,
            verification_link: verificationLink
          }
        }
      ]

      await MailerSendProvider.sendEmail({ to, toName, subject, templateId, personalizationData })
    } catch (error) {
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to send verification email.')
    }

    return pickUser(getNewUser)
  } catch (error) { throw error }
}

const verifyAccount = async (reqBody) => {
  try {
    const existUser = await userModel.findOneByEmail(reqBody.email)

    if (!existUser) throw new ApiError(StatusCodes.NOT_FOUND, 'Account not found.')
    if (existUser.isActive) throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Your account is already active.')
    if (reqBody.token !== existUser.verifyToken) throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Token is invalid.')

    const updateData = {
      isActive: true,
      verifyToken: null
    }

    return pickUser(await userModel.update(existUser._id, updateData))
  } catch (error) { throw error }
}

const login = async (reqBody) => {
  try {
    const existUser = await userModel.findOneByEmail(reqBody.email)
    if (!existUser) throw new ApiError(StatusCodes.NOT_FOUND, 'Your email or password is incorrect.')
    if (!bcryptjs.compareSync(reqBody.password, existUser.password)) throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Your email or password is incorrect.')
    if (!existUser.isActive) throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Your account is not active, please verify email.')

    if (existUser.require2fa) {
      const now = Date.now()

      if (existUser.otp?.resendExpiresAt && now <= existUser.otp?.resendExpiresAt) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Please wait 1 minute before resending the code or logging in again.')
      }

      const otpValue = crypto.randomInt(100000, 999999).toString()
      const expiresAt = now + ms(`${env.OTP_EXPIRE_MINUTES}m`)
      const resendExpiresAt = now + ms(`${env.OTP_RESEND_EXPIRES}m`)

      await userModel.update(existUser._id, { otp: { value: otpValue, expiresAt, resendExpiresAt } })

      try {
        const to = existUser.email
        const toName = existUser.username
        const subject = 'OTP Code.'
        const templateId = MAILER_SEND_TEMPLATES_IDS.OTP_CODE
        const personalizationData = [
          {
            email: to,
            data: {
              support_email: env.MAILER_SEND_SUPPORT_EMAIL,
              otp_expires: env.OTP_EXPIRE_MINUTES,
              otp_code: otpValue
            }
          }
        ]

        await MailerSendProvider.sendEmail({ to, toName, subject, templateId, personalizationData })
      } catch (error) {
        throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to send verification email.')
      }

      return { email: existUser.email, password: reqBody.password, require2fa: existUser.require2fa }
    }

    const userInfo = { _id: existUser._id, email: existUser.email }
    const accessToken = await JwtProvider.generateToken(userInfo, env.ACCESS_TOKEN_SECRET_SIGNATURE, env.ACCESS_TOKEN_LIFE)
    const refreshToken = await JwtProvider.generateToken(userInfo, env.REFRESH_TOKEN_SECRET_SIGNATURE, env.REFRESH_TOKEN_LIFE)

    return { accessToken, refreshToken, ...pickUser(existUser) }
  } catch (error) { throw error }
}

const refreshToken = async (clientRefreshToken) => {
  try {
    const refreshTokenDecoded = await JwtProvider.verifyToken(
      clientRefreshToken,
      env.REFRESH_TOKEN_SECRET_SIGNATURE
    )

    const userInfo = {
      _id: refreshTokenDecoded._id,
      email: refreshTokenDecoded.email
    }

    const accessToken = await JwtProvider.generateToken(
      userInfo,
      env.ACCESS_TOKEN_SECRET_SIGNATURE,
      env.ACCESS_TOKEN_LIFE
    )

    return { accessToken }
  } catch (error) { throw error }
}

const update = async (userId, reqBody, userAvatarFile) => {
  try {
    const existUser = await userModel.findOneById(userId)
    if (!existUser)
      throw new ApiError(StatusCodes.NOT_FOUND, 'Account not found.')
    if (!existUser.isActive)
      throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Your account is not active, please verify email.')

    const updateData = {}

    if (reqBody.recentAction && reqBody.boardId) {
      const boardId = reqBody.boardId
      let recent = existUser.recentBoards || []

      recent = recent.filter(item => item.boardId !== boardId)
      recent.unshift({ boardId, viewedAt: Date.now() })
      if (recent.length > 12) recent = recent.slice(0, 12)

      updateData.recentBoards = recent
    }

    if (reqBody.favouriteAction && reqBody.boardId) {
      const boardId = reqBody.boardId
      let favourite = existUser.favouriteBoards || []

      const isFavourited = favourite.some(item => item.boardId === boardId)

      if (isFavourited) {
        favourite = favourite.filter(item => item.boardId !== boardId)
      } else {
        favourite.unshift({ boardId, viewedAt: Date.now() })
      }

      updateData.favouriteBoards = favourite
    }

    if (reqBody.current_password && reqBody.new_password) {
      const valid = bcryptjs.compareSync(reqBody.current_password, existUser.password)
      if (!valid)
        throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Your current password is incorrect.')
      updateData.password = bcryptjs.hashSync(reqBody.new_password, 8)
    }

    if (reqBody.require2fa) {
      updateData.require2fa = !existUser.require2fa
      if (updateData.require2fa) {
        await userModel.update(userId, updateData)
        return { isLoggedOut: true }
      }
    }

    if (userAvatarFile) {
      if (existUser.avatar?.url && existUser.avatar?.publicId) {
        await CloudinaryProvider.deleteFile(existUser.avatar.publicId)
      }

      const uploadResult = await CloudinaryProvider.streamUpload(
        userAvatarFile.buffer,
        'user-avatars',
        'image',
        `${uuidv4()}-${userAvatarFile.originalname}`
      )

      updateData.avatar = {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id
      }
    }

    const excludedFields = [
      'recentAction',
      'favouriteAction',
      'boardId',
      'current_password',
      'new_password',
      'require2fa'
    ]
    for (const key in reqBody) {
      if (!excludedFields.includes(key)) {
        updateData[key] = reqBody[key]
      }
    }

    const updatedUser = await userModel.update(userId, updateData)

    return { ...pickUser(updatedUser) }
  } catch (error) { throw error }
}

const verify2FA = async (email, otpToken) => {
  try {
    const existUser = await userModel.findOneByEmail(email)
    if (!existUser) throw new ApiError(StatusCodes.NOT_FOUND, 'Account not found.')
    if (!existUser.isActive) throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Your account is not active, please verify email.')

    if (!existUser.otp || !existUser.otp.value) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'No OTP found. Please request again.')
    }

    const now = Date.now()
    if (now > existUser.otp.expiresAt) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'OTP expired. Please request a new one.')
    }

    if (existUser.otp.value !== otpToken) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid code.')
    }

    await userModel.update(existUser._id, { otp: { value: null, expiresAt: null, resendExpiresAt: null } })

    const userInfo = { _id: existUser._id, email: existUser.email }
    const accessToken = await JwtProvider.generateToken(userInfo, env.ACCESS_TOKEN_SECRET_SIGNATURE, env.ACCESS_TOKEN_LIFE)
    const refreshToken = await JwtProvider.generateToken(userInfo, env.REFRESH_TOKEN_SECRET_SIGNATURE, env.REFRESH_TOKEN_LIFE)

    return { accessToken, refreshToken, ...pickUser(existUser) }
  } catch (error) { throw error }
}

const getRecentBoards = async (userId) => {
  try {
    const user = await userModel.findOneById(userId)
    if (!user?.recentBoards || user.recentBoards.length === 0) return []

    const boardIds = user.recentBoards.map(item => item.boardId)

    const boards = await boardModel.getBoardsByIds(boardIds)

    const boardsMap = new Map(boards.map(b => [b._id.toString(), b]))
    return user.recentBoards
      .map(item => boardsMap.get(item.boardId))
      .filter(Boolean)
  } catch (error) {
    throw error
  }
}

export const userService = {
  createNew,
  verifyAccount,
  login,
  refreshToken,
  update,
  verify2FA,
  getRecentBoards
}
