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
import { userSessionModel } from '~/models/userSessionModel'
import { authenticator } from 'otplib'
import { SETUP_2FA_ACTIONS } from '~/utils/constants'
import qrcode from 'qrcode'
import { boardModel } from '~/models/boardModel'

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

    const verificationLink = `${WEBSITE_DOMAIN}/account/verification?email=${getNewUser.email}&token=${getNewUser.verifyToken}`
    const to = getNewUser.email
    const toName = getNewUser.username
    const subject = 'Account created.'
    const templateId = MAILER_SEND_TEMPLATES_IDS.REGISTER_ACCOUNT
    const personalizetionData = [
      {
        email: to,
        data: {
          support_email: env.MAILER_SEND_SUPPORT_EMAIL,
          verification_link: verificationLink
        }
      }
    ]

    await MailerSendProvider.sendEmail({ to, toName, subject, templateId, personalizetionData })

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

const login = async (reqBody, deviceId) => {
  try {
    const existUser = await userModel.findOneByEmail(reqBody.email)
    if (!existUser) throw new ApiError(StatusCodes.NOT_FOUND, 'Your email or password is incorrect.')
    if (!bcryptjs.compareSync(reqBody.password, existUser.password)) throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Your email or password is incorrect.')
    if (!existUser.isActive) throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Your account is not active, please verify email.')

    let currentSession = await userSessionModel.findOneByUserAndDeviceId(existUser._id, deviceId)
    if (!currentSession) {
      const newSession = await userSessionModel.createNew(existUser._id, { deviceId })
      currentSession = await userSessionModel.findOneById(newSession.insertedId)
    }

    if (existUser.require2fa) return { email: existUser.email, require2fa: existUser.require2fa, is2faVerified: currentSession.is2faVerified }

    const userInfo = { _id: existUser._id, email: existUser.email }
    const accessToken = await JwtProvider.generateToken(userInfo, env.ACCESS_TOKEN_SECRET_SIGNATURE, env.ACCESS_TOKEN_LIFE)
    const refreshToken = await JwtProvider.generateToken(userInfo, env.REFRESH_TOKEN_SECRET_SIGNATURE, env.REFRESH_TOKEN_LIFE)

    return { accessToken, refreshToken, ...pickUser(existUser), is2faVerified: currentSession.is2faVerified }
  } catch (error) { throw error }
}

const logout = async (userId, deviceId) => {
  try {
    const existSession = await userSessionModel.findOneByUserAndDeviceId(userId, deviceId)
    if (existSession) await userSessionModel.deleteOneByUserAndDeviceId(userId, deviceId)
    if (!existSession) await userSessionModel.deleteManyByUserId(userId)

    return { isLoggedOut: true }
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

const update = async (userId, reqBody, userAvatarFile, deviceId) => {
  try {
    if (!deviceId)
      throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Please login again.')

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
      'new_password'
    ]
    for (const key in reqBody) {
      if (!excludedFields.includes(key)) {
        updateData[key] = reqBody[key]
      }
    }

    const updatedUser = await userModel.update(userId, updateData)

    const currentSession = await userSessionModel.findOneByUserAndDeviceId(existUser._id, deviceId)

    return { ...pickUser(updatedUser), is2faVerified: currentSession.is2faVerified }
  } catch (error) { throw error }
}

const get2FA_QRCode = async (userId) => {
  try {
    const existUser = await userModel.findOneById(userId)
    if (!existUser) throw new ApiError(StatusCodes.NOT_FOUND, 'Account not found.')
    if (!existUser.isActive) throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Your account is not active.')

    let secretKey = null

    if (!existUser.secretKey2fa) {
      const updatedUser = await userModel.update(existUser._id, { secretKey2fa: authenticator.generateSecret() })
      secretKey = updatedUser.secretKey2fa
    } else {
      secretKey = existUser.secretKey2fa
    }

    const otpAuthToken = authenticator.keyuri(
      existUser.email,
      'KanTrack',
      secretKey
    )

    const QRCodeImageURL = await qrcode.toDataURL(otpAuthToken)

    return { qrcode: QRCodeImageURL }
  } catch (error) { throw error }
}

const setup2FA = async (userId, otpToken, action2FA, deviceId) => {
  try {
    if (!deviceId) throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Please login again.')

    const existUser = await userModel.findOneById(userId)
    if (!existUser) throw new ApiError(StatusCodes.NOT_FOUND, 'Account not found.')
    if (!existUser.isActive) throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Your account is not active, please verify email.')
    if (!existUser.secretKey2fa) throw new ApiError(StatusCodes.NOT_FOUND, '2FA key not found.')

    const isValid = authenticator.verify({
      token: otpToken,
      secret: existUser.secretKey2fa
    })
    if (!isValid) throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Invalid code.')

    let updatedUser = {}
    if (action2FA === SETUP_2FA_ACTIONS.ENABLE) updatedUser = await userModel.update(existUser._id, { require2fa: true })
    if (action2FA === SETUP_2FA_ACTIONS.DISABLE) updatedUser = await userModel.update(existUser._id, { require2fa: false })

    const updatedUserSession = await userSessionModel.update(userId, deviceId)

    return { ...pickUser(updatedUser), is2faVerified: updatedUserSession.is2faVerified }
  } catch (error) { throw error }
}

const verify2FA = async (email, otpToken, deviceId) => {
  try {
    if (!deviceId) throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Please login again.')

    const existUser = await userModel.findOneByEmail(email)
    if (!existUser) throw new ApiError(StatusCodes.NOT_FOUND, 'Account not found.')
    if (!existUser.isActive) throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Your account is not active, please verify email.')
    if (!existUser.secretKey2fa) throw new ApiError(StatusCodes.NOT_FOUND, '2FA key not found.')

    const isValid = authenticator.verify({
      token: otpToken,
      secret: existUser.secretKey2fa
    })
    if (!isValid) throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Invalid code.')

    const updatedUserSession = await userSessionModel.update(existUser._id, deviceId)
    const userInfo = { _id: existUser._id, email: existUser.email }
    const accessToken = await JwtProvider.generateToken(userInfo, env.ACCESS_TOKEN_SECRET_SIGNATURE, env.ACCESS_TOKEN_LIFE)
    const refreshToken = await JwtProvider.generateToken(userInfo, env.REFRESH_TOKEN_SECRET_SIGNATURE, env.REFRESH_TOKEN_LIFE)

    return { accessToken, refreshToken, ...pickUser(existUser), is2faVerified: updatedUserSession.is2faVerified }
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
  logout,
  refreshToken,
  update,
  get2FA_QRCode,
  setup2FA,
  verify2FA,
  getRecentBoards
}
