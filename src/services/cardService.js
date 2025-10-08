import { cardModel } from '~/models/cardModel'
import { columnModel } from '~/models/columnModel'
import { CloudinaryProvider } from '~/providers/CloudinaryProvider'
import { CARD_ATTACHMENT_ACTIONS, CARD_COMMENT_ACTIONS } from '~/utils/constants'
import { v4 as uuidv4 } from 'uuid'
import { normalizeFileName } from '~/utils/formatters'
import ApiError from '~/utils/ApiError'
import { StatusCodes } from 'http-status-codes'
import moment from 'moment'

const createNew = async (reqBody) => {
  try {
    const newCard = {
      ...reqBody
    }

    const createdCard = await cardModel.createNew(newCard)
    const getNewCard = await cardModel.findOneById(createdCard.insertedId)

    if (getNewCard) {
      await columnModel.pushCardOrderIds(getNewCard)
    }

    return getNewCard
  } catch (error) { throw error }
}

const update = async (cardId, reqBody, cardCoverFile, cardAttachmentFiles, userInfo) => {
  try {
    const updateData = {
      ...reqBody,
      updatedAt: Date.now()
    }

    const currentCard = await cardModel.findOneById(cardId)
    if (!currentCard) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Card not found.')
    }

    if (cardCoverFile) {
      if (currentCard.cover?.url && currentCard.cover?.publicId) {
        await CloudinaryProvider.deleteFile(currentCard.cover.publicId)
      }

      const uploadResult = await CloudinaryProvider.streamUpload(
        cardCoverFile.buffer,
        'card-covers',
        'image',
        `${uuidv4()}-${cardCoverFile.originalname}`
      )

      return await cardModel.update(
        cardId,
        {
          cover: {
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            displayText: normalizeFileName(cardCoverFile.originalname),
            uploadedAt: Date.now(),
            size: cardCoverFile.size
          }
        }
      )
    }

    if (updateData.coverToDelete) {
      if (
        currentCard.cover?.url === updateData.coverToDelete.url &&
        currentCard.cover?.publicId === updateData.coverToDelete.publicId
      ) {
        await CloudinaryProvider.deleteFile(currentCard.cover.publicId)
        currentCard.cover = {
          url: null,
          publicId: null,
          displayText: null,
          uploadedAt: null,
          size: null
        }
      }
      return await cardModel.update(cardId, currentCard)
    }

    if (updateData.link) {
      const newLink = {
        attachmentId: uuidv4(),
        url: updateData.link,
        publicId: null,
        type: 'link',
        displayText: updateData?.displayText || null,
        size: null,
        uploadedAt: Date.now()
      }
      return await cardModel.unshiftNewAttachments(cardId, [newLink])
    }

    if (Array.isArray(cardAttachmentFiles) && cardAttachmentFiles.length > 0) {
      const uploadResults = await Promise.all(
        cardAttachmentFiles.map((file) =>
          CloudinaryProvider.streamUpload(
            file.buffer,
            'card-attachments',
            'auto',
            `${uuidv4()}-${file.originalname}`
          )
        )
      )

      const newAttachments = uploadResults.map((result, idx) => ({
        attachmentId: uuidv4(),
        url: result.secure_url,
        publicId: result.public_id,
        type: 'file',
        displayText: normalizeFileName(cardAttachmentFiles[idx].originalname),
        size: cardAttachmentFiles[idx].size,
        uploadedAt: Date.now()
      }))

      return await cardModel.unshiftNewAttachments(cardId, newAttachments)
    }

    if (updateData.action && updateData.newAttachment) {
      const action = updateData.action
      const attachmentPayload = updateData.newAttachment

      if (action === CARD_ATTACHMENT_ACTIONS.EDIT) {
        const attachments = Array.isArray(currentCard.attachments) ? currentCard.attachments : []
        const target = attachments.find(a => a.attachmentId === attachmentPayload.attachmentId)
        if (target) {
          if (attachmentPayload.newLink) {
            target.url = attachmentPayload.newLink
          }
          if (typeof attachmentPayload.displayText !== 'undefined') {
            target.displayText = attachmentPayload.displayText
          }
        }
        return await cardModel.update(cardId, currentCard)
      }

      if (action === CARD_ATTACHMENT_ACTIONS.REMOVE) {
        const attachments = Array.isArray(currentCard.attachments) ? currentCard.attachments : []
        const attachmentToDelete = attachments.find(a => a.attachmentId === attachmentPayload.attachmentId)

        if (attachmentToDelete && attachmentToDelete.publicId) {
          await CloudinaryProvider.deleteFile(attachmentToDelete.publicId)
        }

        currentCard.attachments = attachments.filter(a => a.attachmentId !== attachmentPayload.attachmentId)

        return await cardModel.update(cardId, currentCard)
      }
    }

    if (updateData.action && updateData.comment) {
      const action = updateData.action
      const commentPayload = updateData.comment

      if (action === CARD_COMMENT_ACTIONS.ADD) {
        const commentData = {
          ...updateData.comment,
          commentId: uuidv4(),
          userId: userInfo._id,
          content: updateData.comment.content.trim(),
          commentedAt: Date.now()
        }
        return await cardModel.unshiftNewComment(cardId, commentData)
      }

      if (action === CARD_COMMENT_ACTIONS.EDIT) {
        const comments = Array.isArray(currentCard.comments) ? currentCard.comments : []
        const target = comments.find(c => c.commentId === commentPayload.commentId)

        if (target) {
          if (target.userId.toString() !== userInfo._id.toString()) {
            throw new ApiError(StatusCodes.FORBIDDEN, 'Not allowed.')
          }

          if (commentPayload.content && commentPayload.content.trim()) {
            target.content = commentPayload.content.trim()
            target.commentedAt = Date.now()
          }
        }

        return await cardModel.update(cardId, currentCard)
      }

      if (action === CARD_COMMENT_ACTIONS.REMOVE) {
        const comments = Array.isArray(currentCard.comments) ? currentCard.comments : []
        const target = comments.find(c => c.commentId === commentPayload.commentId)

        if (!target) {
          throw new ApiError(StatusCodes.NOT_FOUND, 'Comment not found.')
        }

        if (target.userId.toString() !== userInfo._id.toString()) {
          throw new ApiError(StatusCodes.FORBIDDEN, 'Not allowed.')
        }

        currentCard.comments = comments.filter(c => c.commentId !== commentPayload.commentId)

        return await cardModel.update(cardId, currentCard)
      }
    }

    if (updateData.incomingMemberInfo) {
      return await cardModel.updateMembers(cardId, updateData.incomingMemberInfo)
    }

    if (updateData.dates) {
      const { startDate, dueDate, dueTime, reminder } = updateData.dates

      const parsedStartDate = startDate ? moment(startDate).toDate() : null
      const parsedDueDate = dueDate ? moment(dueDate).toDate() : null

      let scheduledAt = null
      if (reminder?.enabled && parsedDueDate) {
        scheduledAt = reminder?.scheduledAt
          ? moment(reminder.scheduledAt).toDate()
          : moment(parsedDueDate).subtract(reminder.timeBefore || 0, 'minutes').toDate()
      }

      const newDates = {
        startDate: parsedStartDate,
        dueDate: parsedDueDate,
        dueTime: dueTime || null,
        reminder: {
          enabled: !!reminder?.enabled,
          timeBefore: reminder?.timeBefore || 0,
          type: reminder?.type || 'email',
          scheduledAt,
          sent: !!reminder?.sent
        }
      }

      return await cardModel.update(cardId, { dates: newDates })
    }

    if (typeof updateData.complete !== 'undefined') {
      return await cardModel.update(cardId, { complete: updateData.complete })
    }

    return await cardModel.update(cardId, updateData)
  } catch (error) {
    throw error
  }
}

const deleteItem = async (cardId) => {
  try {
    const targetCard = await cardModel.findOneById(cardId)

    if (!targetCard) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Card not found.')
    }

    if (targetCard.cover?.publicId) {
      await CloudinaryProvider.deleteFile(targetCard.cover.publicId)
    }

    if (targetCard.attachments?.length) {
      await Promise.all(
        targetCard.attachments
          .filter(att => att.type === 'file' && att.publicId)
          .map(att => CloudinaryProvider.deleteFile(att.publicId))
      )
    }

    await cardModel.deleteOneById(cardId)
    await columnModel.pullCardOrderIds(targetCard)
    return { deleteResult: 'Card deleted.' }
  } catch (error) { throw error }
}

export const cardService = {
  createNew,
  update,
  deleteItem
}