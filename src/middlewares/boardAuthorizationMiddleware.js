import { boardModel } from '~/models/boardModel'
import { columnModel } from '~/models/columnModel'
import { cardModel } from '~/models/cardModel'
import { StatusCodes } from 'http-status-codes'
import ApiError from '~/utils/ApiError'
import { BOARD_PUBLIC_ACTION, BOARD_OWNER_ACTIONS } from '~/utils/constants'

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

    if (!boardId) throw new ApiError(StatusCodes.NOT_FOUND, 'Board not found.')

    const board = await boardModel.findOneById(boardId)
    if (!board) throw new ApiError(StatusCodes.NOT_FOUND, 'Board not found.')

    const ownerIds = (board.ownerIds || []).map(id => id.toString())
    const memberIds = (board.memberIds || []).map(id => id.toString())

    const isOwner = ownerIds.includes(userId)
    const isMember = memberIds.includes(userId)

    // ===== Rule 1: Cho phép GET nếu public hoặc là member/owner =====
    if (req.method === 'GET') {
      if (board.type === 'public' || isOwner || isMember) return next()
      throw new ApiError(StatusCodes.FORBIDDEN, 'You do not have permission to view this board.')
    }

    // ===== Rule 2: PUBLIC actions (ví dụ leaveBoard) - ai cũng có thể làm =====
    if (BOARD_PUBLIC_ACTION.some(key => req.body?.[key])) return next()

    // ===== Rule 3: OWNER only actions (ví dụ updatePermissions) =====
    if (BOARD_OWNER_ACTIONS.some(key => req.body?.[key])) {
      if (!isOwner)
        throw new ApiError(StatusCodes.FORBIDDEN, 'Only board owners can perform this action.')
      return next()
    }

    // ===== Rule 4: Owner toàn quyền =====
    if (isOwner) return next()

    // ===== Rule 5: Member có quyền theo permission =====
    if (isMember) {
      const actionKey = actionMapFromRequest(req)

      // Nếu không có actionKey (tức là không nằm trong danh sách quản lý), cho phép
      if (!actionKey) return next()

      const perms = board.memberPermissions || {}
      if (perms[actionKey]) return next()

      throw new ApiError(StatusCodes.FORBIDDEN, 'You are not allowed to perform this action.')
    }

    // ===== Rule 6: Người ngoài board =====
    throw new ApiError(StatusCodes.FORBIDDEN, 'You are not a member of this board.')
  } catch (error) {
    next(error)
  }
}

export const boardAuthMiddleware = { isAuthorized }
