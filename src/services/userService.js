import { StatusCodes } from 'http-status-codes'
import { userModel } from '~/models/userModel'
import ApiError from '~/utils/ApiError'
import bcryptjs from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { pickUser } from '~/utils/formatters'
import { WEBSITE_DOMAIN } from '~/utils/constants'
import { MailerSendProvider } from '~/providers/MailerSendProvider'
import { MAILER_SEND_TEMPLATES_IDS } from '~/utils/constants'

const createNew = async (reqBody) => {
  try {
    const existUser = await userModel.findOneByEmail(reqBody.email)
    if (existUser) throw new ApiError(StatusCodes.CONFLICT, 'Email already exist!')

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
    const subject = 'Created account successfully.'
    const templateId = MAILER_SEND_TEMPLATES_IDS.REGISTER_ACCOUNT
    const personalizetionData = [
      {
        email: to,
        data: {
          support_email: 'lamvinhkien1709@gmail.com',
          verification_link: verificationLink
        }
      }
    ]

    await MailerSendProvider.sendEmail({ to, toName, subject, templateId, personalizetionData })

    return pickUser(getNewUser)
  } catch (error) { throw error }
}

export const userService = {
  createNew
}