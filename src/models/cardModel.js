import Joi from 'joi'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE, DUE_TIME_RULE } from '~/utils/validators'
import { GET_DB } from '~/config/mongodb'
import { ObjectId } from 'mongodb'
import { CARD_MEMBER_ACTIONS } from '~/utils/constants'

const CARD_COLLECTION_NAME = 'cards'
const CARD_COLLECTION_SCHEMA = Joi.object({
  boardId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  columnId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  title: Joi.string().required().min(3).max(40).trim().strict(),
  description: Joi.string().optional(),
  cover: Joi.object({
    url: Joi.string().required().default(null),
    publicId: Joi.string().required().default(null),
    displayText: Joi.string(),
    uploadedAt: Joi.date().timestamp().default(null),
    size: Joi.number().required().default(null)
  }).default(null),
  attachments: Joi.array().items({
    attachmentId: Joi.string().required(),
    url: Joi.string().required(),
    publicId: Joi.string().required().default(null),
    displayText: Joi.string(),
    type: Joi.string().required(),
    uploadedAt: Joi.date().timestamp().default(null),
    size: Joi.number().required().default(null)
  }).default([]),
  memberIds: Joi.array().items(Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)).default([]),
  comments: Joi.array().items({
    commentId: Joi.string().required(),
    userId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
    content: Joi.string().required().min(1).max(200).trim().strict(),
    commentedAt: Joi.date().timestamp('javascript').allow(null).default(null)
  }).default([]),
  dates: Joi.object({
    startDate: Joi.date().timestamp('javascript').allow(null).default(null),
    dueDate: Joi.date().timestamp('javascript').allow(null).default(null),
    dueTime: Joi.string().pattern(DUE_TIME_RULE).allow(null).default(null),
    reminder: Joi.object({
      enabled: Joi.boolean().default(false),
      timeBefore: Joi.number().integer().min(0).default(0),
      type: Joi.string().valid('notification', 'email').default('email'),
      scheduledAt: Joi.date().timestamp('javascript').allow(null).default(null),
      sent: Joi.boolean().default(false)
    }).default({
      enabled: false,
      timeBefore: 0,
      type: 'email',
      scheduledAt: null,
      sent: false
    })
  }).default({
    startDate: null,
    dueDate: null,
    dueTime: null,
    reminder: {
      enabled: false,
      timeBefore: 0,
      type: 'email',
      scheduledAt: null,
      sent: false
    }
  }),
  complete: Joi.boolean().default(false),
  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

const INVALID_UPDATE_FIELDS = ['_id', 'boardId', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await CARD_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

const createNew = async (data) => {
  try {
    const validData = await validateBeforeCreate(data)
    return await GET_DB().collection(CARD_COLLECTION_NAME).insertOne({
      ...validData,
      boardId: new ObjectId(validData.boardId),
      columnId: new ObjectId(validData.columnId)
    })
  } catch (error) { throw new Error(error) }
}

const findAll = async (condition) => {
  try {
    return await GET_DB().collection(CARD_COLLECTION_NAME).find(condition).toArray()
  } catch (error) { throw new Error(error) }
}

const findOneById = async (id) => {
  try {
    return await GET_DB().collection(CARD_COLLECTION_NAME).findOne({ _id: new ObjectId(id) })
  } catch (error) { throw new Error(error) }
}

const findAllByColumnId = async (columnId) => {
  try {
    return await GET_DB().collection(CARD_COLLECTION_NAME).find({ columnId: new ObjectId(columnId) }).toArray()
  } catch (error) { throw new Error(error) }
}

const update = async (cardId, updateData) => {
  try {
    Object.keys(updateData).forEach(fieldName => {
      if (INVALID_UPDATE_FIELDS.includes(fieldName)) {
        delete updateData[fieldName]
      }
    })

    if (updateData.columnId) updateData.columnId = new ObjectId(updateData.columnId)

    return await GET_DB().collection(CARD_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(cardId) },
      { $set: updateData },
      { returnDocument: 'after' }
    )
  } catch (error) { throw new Error(error) }
}

const deleteManyByColumnId = async (columnId) => {
  try {
    return await GET_DB().collection(CARD_COLLECTION_NAME).deleteMany({ columnId: new ObjectId(columnId) })
  } catch (error) { throw new Error(error) }
}

const unshiftNewComment = async (cardId, commentData) => {
  try {
    const result = await GET_DB().collection(CARD_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(cardId) },
      { $push: { comments: { $each: [commentData], $position: 0 } } },
      { returnDocument: 'after' }
    )
    return result
  } catch (error) { throw new Error(error) }
}

const updateMembers = async (cardId, incomingMemberInfo) => {
  try {
    let updateCondition = {}

    if (incomingMemberInfo.action === CARD_MEMBER_ACTIONS.ADD) {
      updateCondition = { $push: { memberIds: new ObjectId(incomingMemberInfo.userId) } }
    }

    if (incomingMemberInfo.action === CARD_MEMBER_ACTIONS.REMOVE) {
      updateCondition = { $pull: { memberIds: new ObjectId(incomingMemberInfo.userId) } }
    }

    const result = await GET_DB().collection(CARD_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(cardId) },
      updateCondition,
      { returnDocument: 'after' }
    )

    return result
  } catch (error) { throw new Error(error) }
}

const unshiftNewAttachments = async (cardId, attachmentsData) => {
  try {
    const result = await GET_DB().collection(CARD_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(cardId) },
      { $push: { attachments: { $each: attachmentsData, $position: 0 } } },
      { returnDocument: 'after' }
    )
    return result
  } catch (error) { throw new Error(error) }
}

const deleteOneById = async (id) => {
  try {
    return await GET_DB().collection(CARD_COLLECTION_NAME).deleteOne({ _id: new ObjectId(id) })
  } catch (error) { throw new Error(error) }
}

const countActiveRemindersByBoard = async (boardId) => {
  try {
    return await GET_DB().collection(CARD_COLLECTION_NAME).countDocuments({
      boardId: new ObjectId(boardId),
      'dates.reminder.enabled': true,
      'dates.reminder.sent': false,
      _destroy: false
    })
  } catch (error) { throw new Error(error) }
}

const countCardInBoard = async (boardId) => {
  try {
    return await GET_DB().collection(CARD_COLLECTION_NAME).countDocuments({
      boardId: new ObjectId(boardId),
      _destroy: false
    })
  } catch (error) { throw new Error(error) }
}

const countCommentsInCard = async (cardId) => {
  try {
    const card = await GET_DB().collection(CARD_COLLECTION_NAME).findOne(
      { _id: new ObjectId(cardId) },
      { projection: { comments: 1 } }
    )

    if (!card || !Array.isArray(card.comments)) return 0
    return card.comments.length
  } catch (error) { throw new Error(error) }
}

export const cardModel = {
  CARD_COLLECTION_NAME,
  CARD_COLLECTION_SCHEMA,
  createNew,
  findAll,
  findOneById,
  findAllByColumnId,
  update,
  deleteManyByColumnId,
  unshiftNewComment,
  updateMembers,
  unshiftNewAttachments,
  deleteOneById,
  countActiveRemindersByBoard,
  countCardInBoard,
  countCommentsInCard
}
