import { cardModel } from '~/models/cardModel'
import { columnModel } from '~/models/columnModel'
import { CloudinaryProvider } from '~/providers/CloudinaryProvider'
import { CARD_ATTACHMENT_ACTIONS } from '~/utils/constants'
import { v4 as uuidv4 } from 'uuid'
import { normalizeFileName } from '~/utils/formatters'

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

    if (cardCoverFile) {
      const currentCard = await cardModel.findOneById(cardId)
      if (currentCard.cover?.attachment && currentCard.cover?.publicId) {
        await CloudinaryProvider.deleteFile(currentCard.cover.publicId)
      }

      const uploadResult = await CloudinaryProvider.streamUpload(
        cardCoverFile.buffer,
        'card-covers',
        'image',
        `${uuidv4()}-${cardCoverFile.originalname}`
      )

      return await cardModel.update(cardId, { cover: { attachment: uploadResult.secure_url, publicId: uploadResult.public_id } })
    }

    if (updateData.coverToDelete) {
      const currentCard = await cardModel.findOneById(cardId)
      if (currentCard.cover?.attachment === updateData.coverToDelete.attachment && currentCard.cover?.publicId === updateData.coverToDelete.publicId) {
        await CloudinaryProvider.deleteFile(currentCard.cover.publicId)
        currentCard.cover = { attachment: null, publicId: null }
      }
      return await cardModel.update(cardId, currentCard)
    }

    if (updateData.link) {
      const newLink = {
        attachmentId: uuidv4(),
        attachment: updateData.link,
        publicId: null,
        type: 'link',
        displayText: updateData?.displayText,
        size: null,
        uploadedAt: Date.now()
      }
      return await cardModel.unshiftNewAttachments(cardId, [newLink])
    }

    if (cardAttachmentFiles && cardAttachmentFiles.length > 0) {
      const uploadResults = await Promise.all(
        cardAttachmentFiles.map(file => {
          return CloudinaryProvider.streamUpload(
            file.buffer,
            'card-attachments',
            'auto',
            `${uuidv4()}-${file.originalname}`
          )
        })
      )

      const newAttach = uploadResults.map((r, idx) => {
        return {
          attachmentId: uuidv4(),
          attachment: r.secure_url,
          publicId: r.public_id,
          type: 'file',
          displayText: normalizeFileName(cardAttachmentFiles[idx].originalname),
          size: cardAttachmentFiles[idx].size,
          uploadedAt: Date.now()
        }
      })

      return await cardModel.unshiftNewAttachments(cardId, newAttach)
    }

    if (updateData.action && updateData.newAttachment) {
      const currentCard = await cardModel.findOneById(cardId)

      if (updateData.action === CARD_ATTACHMENT_ACTIONS.EDIT) {
        currentCard.attachments.find(a => {
          if (a.attachmentId === updateData.newAttachment.attachmentId) {
            if (updateData.newAttachment.newLink) {
              a.attachment = updateData.newAttachment.newLink
            }

            a.displayText = updateData.newAttachment.displayText
          }
        })
        return await cardModel.update(cardId, currentCard)
      }

      if (updateData.action === CARD_ATTACHMENT_ACTIONS.REMOVE) {
        const attachmentToDelete = currentCard.attachments.find(
          a => a.attachmentId === updateData.newAttachment.attachmentId
        )

        if (attachmentToDelete && attachmentToDelete.publicId) {
          await CloudinaryProvider.deleteFile(attachmentToDelete.publicId)
        }

        currentCard.attachments = currentCard.attachments.filter(
          a => a.attachmentId !== updateData.newAttachment.attachmentId
        )

        return await cardModel.update(cardId, currentCard)
      }
    }

    if (updateData.commentToAdd) {
      const commetData = {
        ...updateData.commentToAdd,
        userId: userInfo._id,
        userEmail: userInfo.email,
        commentedAt: Date.now()
      }
      return await cardModel.unshiftNewComment(cardId, commetData)
    }

    if (updateData.incomingMemberInfo) {
      return await cardModel.updateMembers(cardId, updateData.incomingMemberInfo)
    }

    return await cardModel.update(cardId, updateData)
  } catch (error) { throw error }
}

export const cardService = {
  createNew,
  update
}