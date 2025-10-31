import { StatusCodes } from 'http-status-codes'
import { boardService } from '~/services/boardService'
import { userService } from '~/services/userService'

const createNew = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id
    const createdBoard = await boardService.createNew(userId, req.body)
    res.status(StatusCodes.CREATED).json(createdBoard)
  } catch (error) { next(error) }
}

const getDetails = async (req, res, next) => {
  try {
    const boardId = req.params.id
    const userId = req.jwtDecoded._id
    const board = await boardService.getDetails(boardId)
    await userService.update(userId, { recentAction: true, boardId }, null)
    res.status(StatusCodes.OK).json(board)
  } catch (error) { next(error) }
}

const update = async (req, res, next) => {
  try {
    const updatedBoard = await boardService.update(req.params.id, req.body)
    res.status(StatusCodes.OK).json(updatedBoard)
  } catch (error) { next(error) }
}

const moveCardToDifferentColumn = async (req, res, next) => {
  try {
    const result = await boardService.moveCardToDifferentColumn(req.body)
    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

const getBoards = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id
    const { ownerPage, memberPage, favouritePage, itemsPerPage, ...filters } = req.query

    const queryFilters = {}
    if (filters.title) {
      queryFilters.title = filters.title
    }

    const results = await boardService.getBoards(
      userId,
      ownerPage,
      memberPage,
      favouritePage,
      itemsPerPage,
      queryFilters
    )

    res.status(StatusCodes.OK).json(results)
  } catch (error) { next(error) }
}

const deleteItem = async (req, res, next) => {
  try {
    const result = await boardService.deleteItem(req.params.id)
    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

export const boardController = {
  createNew,
  getDetails,
  update,
  moveCardToDifferentColumn,
  getBoards,
  deleteItem
}