import Joi from 'joi'
import { ObjectId } from 'mongodb'
import { GET_DB } from '~/config/mongodb'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

const TWO_FACTOR_SECRET_KEY_COLLECTION_NAME = 'two_factor_secret_keys'
const TWO_FACTOR_SECRET_KEY_COLLECTION_SCHEMA = Joi.object({
  userId: Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  value: Joi.string().required(),
  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

const validateBeforeCreate = async (data) => {
  return await TWO_FACTOR_SECRET_KEY_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

const findOneById = async (id) => {
  try {
    return await GET_DB().collection(TWO_FACTOR_SECRET_KEY_COLLECTION_NAME).findOne({ _id: new ObjectId(id) })
  } catch (error) {
    throw new Error(error)
  }
}

const findOneByUserId = async (userId) => {
  try {
    return await GET_DB().collection(TWO_FACTOR_SECRET_KEY_COLLECTION_NAME).findOne({ userId: new ObjectId(userId) })
  } catch (error) {
    throw new Error(error)
  }
}

const createNew = async (userId, data) => {
  try {
    const validData = await validateBeforeCreate(data)
    return await GET_DB().collection(TWO_FACTOR_SECRET_KEY_COLLECTION_NAME).insertOne({ ...validData, userId: new ObjectId(userId) })
  } catch (error) {
    throw new Error(error)
  }
}

export const twoFactorSecretKeyModel = {
  TWO_FACTOR_SECRET_KEY_COLLECTION_NAME,
  TWO_FACTOR_SECRET_KEY_COLLECTION_SCHEMA,
  findOneById,
  findOneByUserId,
  createNew
}
