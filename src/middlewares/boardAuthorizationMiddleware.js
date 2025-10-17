import { boardModel } from '~/models/boardModel'
import { columnModel } from '~/models/columnModel'
import { cardModel } from '~/models/cardModel'
import { StatusCodes } from 'http-status-codes'
import ApiError from '~/utils/ApiError'

const findBoardIdFromRequest = async (req) => {
  const { id } = req.params

  if (req.body?.boardId) return req.body.boardId

  if (req.baseUrl.includes('/boards')) {
    if (id) return id
  }

  if (req.baseUrl.includes('/columns')) {
    const column = await columnModel.findOneById(id)
    return column?.boardId
  }

  if (req.baseUrl.includes('/cards')) {
    const card = await cardModel.findOneById(id)
    return card?.boardId
  }

  return null
}

const actionMapFromRequest = (req) => {
  const url = req.baseUrl
  const body = req.body || {}
  const params = req.params
  const method = req.method
  const files = req.files || {}

  if (url.includes('/boards')) {
    if (method === 'PUT' && body.title) return 'editBoardTitle'
    if (method === 'PUT' && body.type) return 'editBoardType'
    if (method === 'PUT' && body.removeMember) return 'deleteMemberInBoard'
    if (method === 'PUT' && body.columnOrderIds) return 'moveColumn'
    if (method === 'PUT' && body.currentCardId && body.nextColumnId) return 'moveCard'
  }

  if (url.includes('/invitations')) {
    if (method === 'POST' && body.inviteeEmail) return 'inviteMemberToBoard'
  }

  if (url.includes('/columns')) {
    if (method === 'POST' && body.title) return 'addColumn'
    if (method === 'PUT' && body.title) return 'editColumnTitle'
    if (method === 'DELETE' && params.id) return 'deleteColumn'
    if (method === 'PUT' && body.cardOrderIds) return 'moveCard'
  }

  if (url.includes('/cards')) {
    if (method === 'POST' && body.title) return 'addCard'
    if (method === 'PUT' && body.title) return 'editCardTitle'
    if (method === 'PUT' && body.description) return 'editCardDescription'
    if ((method === 'PUT') && (files.cardCover || body.coverToDelete)) return 'editCardCover'
    if ((method === 'PUT') && (files.cardAttachments || body.newAttachment)) return 'editCardAttachment'
    if (method === 'PUT' && body.incomingMemberInfo) return 'editCardMember'
    if (method === 'PUT' && body.dates) return 'editCardDate'
    if (method === 'PUT' && body.comment) return 'editCardComment'
    if (method === 'PUT' && body.complete !== undefined) return 'editCardMarkComplete'
    if (method === 'DELETE' && params.id) return 'deleteCard'
  }

  return null
}

const isAuthorized = () => async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id
    const boardId = await findBoardIdFromRequest(req)

    if (!boardId)
      throw new ApiError(StatusCodes.NOT_FOUND, 'Board not found.')

    const board = await boardModel.findOneById(boardId)
    if (!board)
      throw new ApiError(StatusCodes.NOT_FOUND, 'Board not found.')

    const isOwner = board.ownerIds.map(id => id.toString()).includes(userId)
    const isMember = board.memberIds.map(id => id.toString()).includes(userId)

    if (req.method === 'GET') {
      if (board.type === 'public' || isOwner || isMember) return next()
      throw new ApiError(StatusCodes.FORBIDDEN, 'Not allowed 0.')
    }

    if (isOwner) return next()

    if (isMember) {
      const actionKey = actionMapFromRequest(req)
      if (!actionKey) {
        throw new ApiError(StatusCodes.FORBIDDEN, 'Not allowed 1.')
      }

      const perms = board.memberPermissions || {}
      if (perms[actionKey]) return next()

      throw new ApiError(StatusCodes.FORBIDDEN, 'Not allowed 2.')
    }

    throw new ApiError(StatusCodes.FORBIDDEN, 'Not allowed 3.')
  } catch (error) {
    next(error)
  }
}

export const boardAuthMiddleware = { isAuthorized }
