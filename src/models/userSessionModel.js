import Joi from 'joi'
import { ObjectId } from 'mongodb'
import { GET_DB } from '~/config/mongodb'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

const USER_SESSION_NAME = 'user_sessions'
const USER_SESSION_SCHEMA = Joi.object({
  userId: Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  deviceId: Joi.string().required(),
  is2faVerified: Joi.boolean().default(false),
  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

const validateBeforeCreate = async (data) => {
  return await USER_SESSION_SCHEMA.validateAsync(data, { abortEarly: false })
}

const findOneById = async (id) => {
  try {
    return await GET_DB().collection(USER_SESSION_NAME).findOne({ _id: new ObjectId(id) })
  } catch (error) { throw new Error(error) }
}

const findOneByUserAndDeviceId = async (userId, deviceId) => {
  try {
    return await GET_DB().collection(USER_SESSION_NAME).findOne(
      { $and: [{ userId: new ObjectId(userId) }, { deviceId: deviceId }] }
    )
  } catch (error) { throw new Error(error) }
}

const createNew = async (userId, data) => {
  try {
    const validData = await validateBeforeCreate(data)
    return await GET_DB().collection(USER_SESSION_NAME).insertOne({ ...validData, userId: new ObjectId(userId) })
  } catch (error) { throw new Error(error) }
}

const deleteOneByUserAndDeviceId = async (userId, deviceId) => {
  try {
    return await GET_DB().collection(USER_SESSION_NAME).deleteOne(
      { $and: [{ userId: new ObjectId(userId) }, { deviceId: deviceId }] }
    )
  } catch (error) { throw new Error(error) }
}

const deleteManyByUserId = async (userId) => {
  try {
    return await GET_DB().collection(USER_SESSION_NAME).deleteOne({ userId: new ObjectId(userId) })
  } catch (error) { throw new Error(error) }
}

const update = async (userId, deviceId) => {
  try {
    return await GET_DB().collection(USER_SESSION_NAME).findOneAndUpdate(
      { userId: new ObjectId(userId), deviceId: deviceId },
      { $set: { is2faVerified: true } },
      { returnDocument: 'after' }
    )
  } catch (error) { throw new Error(error) }
}

export const userSessionModel = {
  USER_SESSION_NAME,
  USER_SESSION_SCHEMA,
  createNew,
  findOneById,
  findOneByUserAndDeviceId,
  deleteOneByUserAndDeviceId,
  deleteManyByUserId,
  update
}
