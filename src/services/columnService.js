import { columnModel } from '~/models/columnModel'
import { boardModel } from '~/models/boardModel'
import { cardModel } from '~/models/cardModel'
import ApiError from '~/utils/ApiError'
import { StatusCodes } from 'http-status-codes'
import { CloudinaryProvider } from '~/providers/CloudinaryProvider'
import { MAX_COLUMNS_PER_BOARD } from '~/utils/constants'

const createNew = async (reqBody) => {
  try {
    const newColumn = {
      ...reqBody
    }

    const countColumn = await columnModel.countColumnInBoard(newColumn.boardId)

    if (countColumn >= MAX_COLUMNS_PER_BOARD) {
      throw new Error('This board has reached its column limit.')
    }

    const createdColumn = await columnModel.createNew(newColumn)
    const getNewColumn = await columnModel.findOneById(createdColumn.insertedId)

    if (getNewColumn) {
      getNewColumn.cards = []
      await boardModel.pushColumnOrderIds(getNewColumn)
    }

    return getNewColumn
  } catch (error) { throw error }
}

const update = async (columnId, reqBody) => {
  try {
    const updateData = {
      ...reqBody,
      updatedAt: Date.now()
    }
    const updateColumn = await columnModel.update(columnId, updateData)
    return updateColumn
  } catch (error) { throw error }
}

const deleteItem = async (columnId) => {
  try {
    const targetColumn = await columnModel.findOneById(columnId)
    if (!targetColumn) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Column not found.')
    }

    const cards = await cardModel.findAllByColumnId(columnId)

    for (const card of cards) {
      if (card.cover?.publicId) {
        await CloudinaryProvider.deleteFile(card.cover.publicId)
      }

      if (card.attachments?.length) {
        await Promise.all(
          card.attachments
            .filter(att => att.type === 'file' && att.publicId)
            .map(att => CloudinaryProvider.deleteFile(att.publicId))
        )
      }
    }

    await cardModel.deleteManyByColumnId(columnId)
    await columnModel.deleteOneById(columnId)
    await boardModel.pullColumnOrderIds(targetColumn)

    return { deleteResult: 'Column and its cards deleted.' }
  } catch (error) { throw error }
}

export const columnService = {
  createNew,
  update,
  deleteItem
}