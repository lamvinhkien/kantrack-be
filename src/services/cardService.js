import { cardModel } from '~/models/cardModel'
import { columnModel } from '~/models/columnModel'
import { CloudinaryProvider } from '~/providers/CloudinaryProvider'

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

    let updatedCard = {}

    if (cardCoverFile) {
      const uploadResult = await CloudinaryProvider.streamUpload(cardCoverFile.buffer, 'card-covers')
      updatedCard = await cardModel.update(cardId, { cover: uploadResult.secure_url })
    }

    if (updateData.link) {
      const newLink = { attachment: updateData.link, type: 'link', displayText: updateData?.displayText, uploadedAt: Date.now() }
      updatedCard = await cardModel.unshiftNewAttachments(cardId, [newLink])
    }

    if (cardAttachmentFiles && cardAttachmentFiles.length > 0) {
      const uploadResults = await Promise.all(
        cardAttachmentFiles.map(file =>
          CloudinaryProvider.streamUpload(file.buffer, 'card-attachments')
        )
      )

      const newAttach = uploadResults.map((r, idx) => {
        return {
          attachment: r.secure_url,
          type: 'file',
          displayText: cardAttachmentFiles[idx].originalname,
          uploadedAt: Date.now()
        }
      })

      updatedCard = await cardModel.unshiftNewAttachments(cardId, newAttach)
    }

    if (updateData.commentToAdd) {
      const commetData = {
        ...updateData.commentToAdd,
        userId: userInfo._id,
        userEmail: userInfo.email,
        commentedAt: Date.now()
      }
      updatedCard = await cardModel.unshiftNewComment(cardId, commetData)
    }

    if (updateData.incomingMemberInfo) {
      updatedCard = await cardModel.updateMembers(cardId, updateData.incomingMemberInfo)
    }

    updatedCard = await cardModel.update(cardId, updateData)

    return updatedCard
  } catch (error) { throw error }
}

export const cardService = {
  createNew,
  update
}