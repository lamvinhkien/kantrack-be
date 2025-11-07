import { StatusCodes } from 'http-status-codes'
import { JwtProvider } from '~/providers/JwtProvider'
import { env } from '~/config/environment'
import ApiError from '~/utils/ApiError'

const isAuthorized = async (req, res, next) => {
  const { accessToken, refreshToken } = req.cookies

  if (!accessToken) {
    if (refreshToken) {
      next(new ApiError(StatusCodes.GONE, 'Need to refresh token'))
      return
    }
    next(new ApiError(StatusCodes.UNAUTHORIZED, 'Unauthorized.'))
    return
  }

  try {
    const decoded = await JwtProvider.verifyToken(accessToken, env.ACCESS_TOKEN_SECRET_SIGNATURE)
    req.jwtDecoded = decoded
    next()
  } catch (error) {
    if (error.message.includes('jwt expired')) {
      next(new ApiError(StatusCodes.GONE, 'Need to refresh token'))
      return
    }
    next(new ApiError(StatusCodes.UNAUTHORIZED, 'Unauthorized.'))
  }
}

export const authMiddleware = {
  isAuthorized
}
