import { boardModel } from '~/models/boardModel'
import { columnModel } from '~/models/columnModel'
import { cardModel } from '~/models/cardModel'
import { StatusCodes } from 'http-status-codes'
import ApiError from '~/utils/ApiError'
import { BOARD_PUBLIC_ACTIONS, BOARD_OWNER_ACTIONS, BOARD_MEMBER_ACTIONS } from '~/utils/constants'

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
    if (method === 'PUT' && body.title) return BOARD_MEMBER_ACTIONS.editBoardTitle
    if (method === 'PUT' && body.type) return BOARD_MEMBER_ACTIONS.editBoardType
    if (method === 'PUT' && body.columnOrderIds) return BOARD_MEMBER_ACTIONS.moveColumn
    if (method === 'PUT' && body.currentCardId && body.nextColumnId) return BOARD_MEMBER_ACTIONS.moveCard
  }

  if (url.includes('/invitations')) {
    if (method === 'POST' && body.inviteeEmail) return BOARD_MEMBER_ACTIONS.inviteMemberToBoard
  }

  if (url.includes('/columns')) {
    if (method === 'POST' && body.title) return BOARD_MEMBER_ACTIONS.addColumn
    if (method === 'PUT' && body.title) return BOARD_MEMBER_ACTIONS.editColumnTitle
    if (method === 'DELETE' && params.id) return BOARD_MEMBER_ACTIONS.deleteColumn
    if (method === 'PUT' && body.cardOrderIds) return BOARD_MEMBER_ACTIONS.moveCard
  }

  if (url.includes('/cards')) {
    if (method === 'POST' && body.title) return BOARD_MEMBER_ACTIONS.addCard
    if (method === 'PUT' && body.title) return BOARD_MEMBER_ACTIONS.editCardTitle
    if (method === 'PUT' && body.description) return BOARD_MEMBER_ACTIONS.editCardDescription
    if ((method === 'PUT') && (files.cardCover || body.coverToDelete)) return BOARD_MEMBER_ACTIONS.editCardCover
    if ((method === 'PUT') && (files.cardAttachments || body.newAttachment)) return BOARD_MEMBER_ACTIONS.editCardAttachment
    if (method === 'PUT' && body.incomingMemberInfo) return BOARD_MEMBER_ACTIONS.editCardMember
    if (method === 'PUT' && body.dates) return BOARD_MEMBER_ACTIONS.editCardDate
    if (method === 'PUT' && body.comment) return BOARD_MEMBER_ACTIONS.editCardComment
    if (method === 'PUT' && body.complete !== undefined) return BOARD_MEMBER_ACTIONS.editCardMarkComplete
    if (method === 'DELETE' && params.id) return BOARD_MEMBER_ACTIONS.deleteCard
  }

  return null
}

const isAuthorized = () => async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id
    const boardId = await findBoardIdFromRequest(req)

    if (!boardId) throw new ApiError(StatusCodes.NOT_FOUND, 'Board not found.')

    const board = await boardModel.findOneById(boardId)
    if (!board) throw new ApiError(StatusCodes.NOT_FOUND, 'Board not found.')

    const ownerIds = (board.ownerIds || []).map(id => id.toString())
    const memberIds = (board.memberIds || []).map(id => id.toString())

    const isOwner = ownerIds.includes(userId)
    const isMember = memberIds.includes(userId)

    if (req.method === 'GET') {
      if (board.type === 'public' || isOwner || isMember) return next()
      throw new ApiError(StatusCodes.FORBIDDEN, 'You do not have permission to view this board.')
    }

    if (BOARD_PUBLIC_ACTIONS.some(key => req.body?.[key])) return next()

    if (req.method === 'DELETE') {
      if (isOwner) return next()
      throw new ApiError(StatusCodes.FORBIDDEN, 'Only board owners can perform this action.')
    }

    if (BOARD_OWNER_ACTIONS.some(key => req.body?.[key])) {
      if (!isOwner) throw new ApiError(StatusCodes.FORBIDDEN, 'Only board owners can perform this action.')
      return next()
    }

    if (isOwner) return next()

    if (isMember) {
      const actionKey = actionMapFromRequest(req)

      if (!actionKey) return next()

      const perms = board.memberPermissions || {}
      if (perms[actionKey]) return next()

      throw new ApiError(StatusCodes.FORBIDDEN, 'You are not allowed to perform this action.')
    }

    throw new ApiError(StatusCodes.FORBIDDEN, 'You are not a member of this board.')
  } catch (error) { next(error) }
}

export const boardAuthMiddleware = { isAuthorized }
