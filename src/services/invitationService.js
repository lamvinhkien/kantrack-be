import { StatusCodes } from 'http-status-codes'
import ApiError from '~/utils/ApiError'
import { userModel } from '~/models/userModel'
import { boardModel } from '~/models/boardModel'
import { invitationModel } from '~/models/invitationModel'
import { INVITATION_TYPES, BOARD_INVITATION_STATUS, MAX_MEMBERS_PER_BOARD } from '~/utils/constants'
import { pickUser } from '~/utils/formatters'

const createNewBoardInvitation = async (reqBody, inviterId) => {
  try {
    const inviter = await userModel.findOneById(inviterId)
    const invitee = await userModel.findOneByEmail(reqBody.inviteeEmail)
    const board = await boardModel.findOneById(reqBody.boardId)

    if (!invitee) throw new ApiError(StatusCodes.NOT_FOUND, 'Invitee not found.')
    if (!inviter || !board) throw new ApiError(StatusCodes.NOT_FOUND, 'Inviter or Board not found.')

    const totalBoardMembers = [...board.ownerIds, ...board.memberIds]

    if (totalBoardMembers.length >= MAX_MEMBERS_PER_BOARD) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        'This board has reached its member limit.'
      )
    }

    if (totalBoardMembers.map(id => id.toString()).includes(invitee._id.toString())) {
      throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Invitee is already a member of this board.')
    }

    const existingPendingInvitation = await invitationModel.findPendingByBoardAndInvitee(
      reqBody.boardId,
      invitee._id
    )
    if (existingPendingInvitation) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        'This user already has a pending invitation to this board.'
      )
    }

    const newInvitationData = {
      inviterId,
      inviteeId: invitee._id.toString(),
      type: INVITATION_TYPES.BOARD_INVITATION,
      boardInvitation: {
        boardId: board._id.toString(),
        status: BOARD_INVITATION_STATUS.PENDING
      }
    }

    const createdInvitation = await invitationModel.createNewBoardInvitation(newInvitationData)
    const getInvitation = await invitationModel.findOneById(createdInvitation.insertedId)

    return {
      ...getInvitation,
      board,
      inviter: pickUser(inviter),
      invitee: pickUser(invitee)
    }
  } catch (error) {
    throw error
  }
}

const getInvitations = async (userId) => {
  try {
    const getInvitations = await invitationModel.findByUser(userId)
    return getInvitations.map(i => ({
      ...i,
      inviter: i.inviter[0] || {},
      invitee: i.invitee[0] || {},
      board: i.board[0] || {}
    }))
  } catch (error) { throw error }
}

const updateBoardInvitation = async (userId, invitationId, status) => {
  try {
    const getInvitation = await invitationModel.findOneById(invitationId)
    if (!getInvitation) throw new ApiError(StatusCodes.NOT_FOUND, 'Invitation not found.')

    const boardId = getInvitation.boardInvitation.boardId
    const getBoard = await boardModel.findOneById(boardId)
    if (!getBoard) throw new ApiError(StatusCodes.NOT_FOUND, 'Board not found.')

    const boardOwnerAndMemberIds = [...getBoard.ownerIds, ...getBoard.memberIds].map(id => id.toString())

    if (boardOwnerAndMemberIds.includes(userId.toString())) {
      throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'You are already a member of this board.')
    }

    if (status === BOARD_INVITATION_STATUS.ACCEPTED) {
      if (boardOwnerAndMemberIds.length >= MAX_MEMBERS_PER_BOARD) {
        throw new ApiError(
          StatusCodes.FORBIDDEN,
          'This board has reached its member limit.'
        )
      }
    }

    const updateData = {
      boardInvitation: {
        ...getInvitation.boardInvitation,
        status
      }
    }

    const updatedInvitation = await invitationModel.update(invitationId, updateData)

    if (updatedInvitation.boardInvitation.status === BOARD_INVITATION_STATUS.ACCEPTED) {
      await boardModel.pushMemberIds(boardId, userId)
    }

    return updatedInvitation
  } catch (error) {
    throw error
  }
}

export const invitationService = {
  createNewBoardInvitation,
  getInvitations,
  updateBoardInvitation
}