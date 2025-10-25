import Joi from 'joi'
import { ObjectId } from 'mongodb'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'
import { GET_DB } from '~/config/mongodb'
import { BOARD_TYPES } from '~/utils/constants'
import { columnModel } from './columnModel'
import { cardModel } from './cardModel'
import { userModel } from './userModel'
import { pagingSkipValue } from '~/utils/algorithms'
import { DEFAULT_PAGE, DEFAULT_ITEMS_PER_PAGE } from '~/utils/constants'

const BOARD_COLLECTION_NAME = 'boards'
const BOARD_COLLECTION_SCHEMA = Joi.object({
  title: Joi.string().required().min(3).max(35).trim().strict(),
  type: Joi.string().valid(BOARD_TYPES.PUBLIC, BOARD_TYPES.PRIVATE).required(),
  columnOrderIds: Joi.array().items(Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)).default([]),
  ownerIds: Joi.array().items(Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)).default([]),
  memberIds: Joi.array().items(Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)).default([]),
  memberPermissions: Joi.object({
    editBoardTitle: Joi.boolean().default(false),
    editBoardType: Joi.boolean().default(false),
    inviteMemberToBoard: Joi.boolean().default(false),

    addColumn: Joi.boolean().default(true),
    editColumnTitle: Joi.boolean().default(true),
    moveColumn: Joi.boolean().default(true),
    deleteColumn: Joi.boolean().default(true),

    addCard: Joi.boolean().default(true),
    editCardTitle: Joi.boolean().default(true),
    editCardDescription: Joi.boolean().default(true),
    editCardCover: Joi.boolean().default(true),
    editCardDate: Joi.boolean().default(true),
    editCardComment: Joi.boolean().default(true),
    editCardMember: Joi.boolean().default(true),
    editCardAttachment: Joi.boolean().default(true),
    editCardMarkComplete: Joi.boolean().default(true),
    moveCard: Joi.boolean().default(true),
    deleteCard: Joi.boolean().default(true)
  }).default({
    editBoardTitle: false,
    editBoardType: false,
    inviteMemberToBoard: false,

    addColumn: true,
    editColumnTitle: true,
    moveColumn: true,
    deleteColumn: true,

    addCard: true,
    editCardTitle: true,
    editCardDescription: true,
    editCardCover: true,
    editCardDate: true,
    editCardComment: true,
    editCardMember: true,
    editCardAttachment: true,
    editCardMarkComplete: true,
    moveCard: true,
    deleteCard: true
  }),
  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

const INVALID_UPDATE_FIELDS = ['_id', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await BOARD_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

const createNew = async (userId, data) => {
  try {
    const validData = await validateBeforeCreate(data)
    const newBoardToAdd = {
      ...validData,
      ownerIds: [new ObjectId(userId)]
    }

    return await GET_DB().collection(BOARD_COLLECTION_NAME).insertOne(newBoardToAdd)
  } catch (error) { throw new Error(error) }
}

const findOneById = async (id) => {
  try {
    return await GET_DB().collection(BOARD_COLLECTION_NAME).findOne({ _id: new ObjectId(id) })
  } catch (error) { throw new Error(error) }
}

const getDetails = async (boardId) => {
  try {
    const result = await GET_DB().collection(BOARD_COLLECTION_NAME).aggregate([
      {
        $match: {
          $and: [
            { _id: new ObjectId(boardId) },
            { _destroy: false }
          ]
        }
      },
      {
        $lookup: {
          from: columnModel.COLUMN_COLLECTION_NAME,
          localField: '_id',
          foreignField: 'boardId',
          as: 'columns'
        }
      },
      {
        $lookup: {
          from: cardModel.CARD_COLLECTION_NAME,
          localField: '_id',
          foreignField: 'boardId',
          as: 'cards'
        }
      },
      {
        $lookup: {
          from: userModel.USER_COLLECTION_NAME,
          localField: 'ownerIds',
          foreignField: '_id',
          as: 'owners',
          pipeline: [{ $project: { 'password': 0, 'verifyToken': 0 } }]
        }
      },
      {
        $lookup: {
          from: userModel.USER_COLLECTION_NAME,
          localField: 'memberIds',
          foreignField: '_id',
          as: 'members',
          pipeline: [{ $project: { 'password': 0, 'verifyToken': 0 } }]
        }
      }
    ]).toArray()

    return result[0] || null
  } catch (error) { throw new Error(error) }
}

const pushColumnOrderIds = async (column) => {
  try {
    return await GET_DB().collection(BOARD_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(column.boardId) },
      { $push: { columnOrderIds: new ObjectId(column._id) } },
      { returnDocument: 'after' }
    )
  } catch (error) { throw new Error(error) }
}

const update = async (boardId, updateData) => {
  try {
    Object.keys(updateData).forEach(fieldName => {
      if (INVALID_UPDATE_FIELDS.includes(fieldName)) {
        delete updateData[fieldName]
      }
    })

    if (updateData.columnOrderIds) {
      updateData.columnOrderIds = updateData.columnOrderIds.map(_id => (new ObjectId(_id)))
    }

    return await GET_DB().collection(BOARD_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(boardId) },
      { $set: updateData },
      { returnDocument: 'after' }
    )
  } catch (error) { throw new Error(error) }
}

const pullColumnOrderIds = async (column) => {
  try {
    return await GET_DB().collection(BOARD_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(column.boardId) },
      { $pull: { columnOrderIds: new ObjectId(column._id) } },
      { returnDocument: 'after' }
    )
  } catch (error) { throw new Error(error) }
}

const getBoards = async (
  userId,
  ownerPage = DEFAULT_PAGE,
  memberPage = DEFAULT_PAGE,
  favouritePage = DEFAULT_PAGE,
  itemsPerPage = DEFAULT_ITEMS_PER_PAGE,
  queryFilters = {}
) => {
  try {
    const collection = GET_DB().collection(BOARD_COLLECTION_NAME)
    const commonConditions = [{ _destroy: false }]

    if (queryFilters && Object.keys(queryFilters).length > 0) {
      Object.keys(queryFilters).forEach(key => {
        const value = queryFilters[key]
        if (value && typeof value === 'string') {
          commonConditions.push({ [key]: { $regex: new RegExp(value, 'i') } })
        }
      })
    }

    const user = await userModel.findOneById(userId)
    const ownerResult = await collection.aggregate([
      {
        $match: {
          $and: [
            ...commonConditions,
            { ownerIds: { $all: [new ObjectId(userId)] } }
          ]
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          queryBoards: [
            { $skip: pagingSkipValue(ownerPage, itemsPerPage) },
            { $limit: itemsPerPage }
          ],
          queryTotalBoards: [{ $count: 'countedAllBoards' }]
        }
      }
    ]).toArray()

    const memberResult = await collection.aggregate([
      {
        $match: {
          $and: [
            ...commonConditions,
            { memberIds: { $all: [new ObjectId(userId)] } },
            { ownerIds: { $nin: [new ObjectId(userId)] } }
          ]
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          queryBoards: [
            { $skip: pagingSkipValue(memberPage, itemsPerPage) },
            { $limit: itemsPerPage }
          ],
          queryTotalBoards: [{ $count: 'countedAllBoards' }]
        }
      }
    ]).toArray()

    let favouriteBoards = []
    let totalFavouriteBoards = 0

    if (user?.favouriteBoards?.length > 0) {
      const boardIds = user.favouriteBoards.map(item => new ObjectId(item.boardId))

      const favouriteResult = await collection.aggregate([
        {
          $match: {
            $and: [
              ...commonConditions,
              { _id: { $in: boardIds } }
            ]
          }
        },
        {
          $addFields: {
            sortOrder: { $indexOfArray: [boardIds, '$_id'] }
          }
        },
        { $sort: { sortOrder: 1 } },

        {
          $facet: {
            queryBoards: [
              { $skip: pagingSkipValue(favouritePage, itemsPerPage) },
              { $limit: itemsPerPage }
            ],
            queryTotalBoards: [{ $count: 'countedAllBoards' }]
          }
        }
      ]).toArray()

      favouriteBoards = favouriteResult[0]?.queryBoards || []
      totalFavouriteBoards = favouriteResult[0]?.queryTotalBoards?.[0]?.countedAllBoards || 0
    }

    return {
      ownerBoards: ownerResult[0]?.queryBoards || [],
      totalOwnerBoards: ownerResult[0]?.queryTotalBoards?.[0]?.countedAllBoards || 0,

      memberBoards: memberResult[0]?.queryBoards || [],
      totalMemberBoards: memberResult[0]?.queryTotalBoards?.[0]?.countedAllBoards || 0,

      favouriteBoards,
      totalFavouriteBoards
    }
  } catch (error) { throw new Error(error) }
}

const pushMemberIds = async (boardId, userId) => {
  try {
    return await GET_DB().collection(BOARD_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(boardId) },
      { $push: { memberIds: new ObjectId(userId) } },
      { returnDocument: 'after' }
    )
  } catch (error) { throw new Error(error) }
}

const pullMemberIds = async (boardId, userId) => {
  try {
    return await GET_DB().collection(BOARD_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(boardId) },
      { $pull: { memberIds: new ObjectId(userId) } },
      { returnDocument: 'after' }
    )
  } catch (error) { throw new Error(error) }
}

const pushOwnerIds = async (boardId, userId) => {
  try {
    return await GET_DB().collection(BOARD_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(boardId) },
      { $push: { ownerIds: new ObjectId(userId) } },
      { returnDocument: 'after' }
    )
  } catch (error) { throw new Error(error) }
}

const pullOwnerIds = async (boardId, userId) => {
  try {
    return await GET_DB().collection(BOARD_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(boardId) },
      { $pull: { ownerIds: new ObjectId(userId) } },
      { returnDocument: 'after' }
    )
  } catch (error) { throw new Error(error) }
}

const getBoardsByIds = async (boardIds) => {
  try {
    const objectIds = boardIds.map(id => new ObjectId(id))
    return await GET_DB()
      .collection(BOARD_COLLECTION_NAME)
      .find({ _id: { $in: objectIds }, _destroy: false })
      .toArray()
  } catch (error) {
    throw new Error(error)
  }
}

const updateMemberPermissions = async (boardId, updatePermissions) => {
  try {
    const setObject = {}
    for (const [key, value] of Object.entries(updatePermissions)) {
      setObject[`memberPermissions.${key}`] = value
    }

    const result = await GET_DB().collection(BOARD_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(boardId) },
      { $set: setObject },
      { returnDocument: 'after' }
    )

    return result
  } catch (error) {
    throw new Error(error)
  }
}

const deleteOneById = async (id) => {
  try {
    return await GET_DB().collection(BOARD_COLLECTION_NAME).deleteOne({ _id: new ObjectId(id) })
  } catch (error) { throw new Error(error) }
}

export const boardModel = {
  BOARD_COLLECTION_NAME,
  BOARD_COLLECTION_SCHEMA,
  createNew,
  findOneById,
  getDetails,
  pushColumnOrderIds,
  update,
  pullColumnOrderIds,
  getBoards,
  pushMemberIds,
  pullMemberIds,
  pushOwnerIds,
  pullOwnerIds,
  getBoardsByIds,
  updateMemberPermissions,
  deleteOneById
}