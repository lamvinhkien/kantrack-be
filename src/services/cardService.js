/* eslint-disable no-console */
import { cardModel } from '~/models/cardModel'
import { columnModel } from '~/models/columnModel'
import { CloudinaryProvider } from '~/providers/CloudinaryProvider'
import { CARD_ATTACHMENT_ACTIONS, CARD_COMMENT_ACTIONS } from '~/utils/constants'
import { v4 as uuidv4 } from 'uuid'
import { normalizeFileName } from '~/utils/formatters'
import ApiError from '~/utils/ApiError'
import { StatusCodes } from 'http-status-codes'
import moment from 'moment'
import { MailerSendProvider } from '~/providers/MailerSendProvider'
import { userModel } from '~/models/userModel'

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
    if (!currentCard) throw new ApiError(StatusCodes.NOT_FOUND, 'Card not found.')

    // ------------------- COVER UPLOAD -------------------
    if (cardCoverFile) {
      if (currentCard.cover?.publicId) {
        await CloudinaryProvider.deleteFile(currentCard.cover.publicId)
      }

      const upload = await CloudinaryProvider.streamUpload(
        cardCoverFile.buffer,
        'card-covers',
        'image',
        `${uuidv4()}-${cardCoverFile.originalname}`
      )

      const newCover = {
        url: upload.secure_url,
        publicId: upload.public_id,
        displayText: normalizeFileName(cardCoverFile.originalname),
        uploadedAt: Date.now(),
        size: cardCoverFile.size
      }

      return await cardModel.update(cardId, { cover: newCover })
    }

    // ------------------- COVER DELETE -------------------
    if (updateData.coverToDelete) {
      const { publicId, url } = updateData.coverToDelete
      if (currentCard.cover?.url === url && currentCard.cover?.publicId === publicId) {
        await CloudinaryProvider.deleteFile(publicId)
      }
      return await cardModel.update(cardId, {
        cover: { url: null, publicId: null, displayText: null, uploadedAt: null, size: null }
      })
    }

    // ------------------- ADD LINK ATTACHMENT -------------------
    if (updateData.link) {
      const newLink = {
        attachmentId: uuidv4(),
        url: updateData.link,
        type: 'link',
        displayText: updateData.displayText || null,
        uploadedAt: Date.now()
      }
      return await cardModel.unshiftNewAttachments(cardId, [newLink])
    }

    // ------------------- UPLOAD ATTACHMENTS -------------------
    if (Array.isArray(cardAttachmentFiles) && cardAttachmentFiles.length > 0) {
      const existingFiles = currentCard.attachments.filter(a => a.type === 'file')
      if (cardAttachmentFiles.length + existingFiles.length > 10) throw new ApiError(StatusCodes.FORBIDDEN, 'Card has reached the limit of 10 file attachments.')

      const uploads = await Promise.all(
        cardAttachmentFiles.map(file =>
          CloudinaryProvider.streamUpload(file.buffer, 'card-attachments', 'auto', `${uuidv4()}-${file.originalname}`)
        )
      )

      const newAttachments = uploads.map((res, i) => ({
        attachmentId: uuidv4(),
        url: res.secure_url,
        publicId: res.public_id,
        type: 'file',
        displayText: normalizeFileName(cardAttachmentFiles[i].originalname),
        size: cardAttachmentFiles[i].size,
        uploadedAt: Date.now()
      }))

      return await cardModel.unshiftNewAttachments(cardId, newAttachments)
    }

    // ------------------- ATTACHMENT EDIT / REMOVE -------------------
    if (updateData.action && updateData.newAttachment) {
      const { action, newAttachment } = updateData

      const attachments = Array.isArray(currentCard.attachments) ? currentCard.attachments : []
      const target = attachments.find(a => a.attachmentId === newAttachment.attachmentId)

      if (action === CARD_ATTACHMENT_ACTIONS.EDIT && target) {
        if (newAttachment.newLink) target.url = newAttachment.newLink
        if (typeof newAttachment.displayText !== 'undefined') target.displayText = newAttachment.displayText
        return await cardModel.update(cardId, { attachments })
      }

      if (action === CARD_ATTACHMENT_ACTIONS.REMOVE && target) {
        if (target.publicId) await CloudinaryProvider.deleteFile(target.publicId)
        const updatedAttachments = attachments.filter(a => a.attachmentId !== newAttachment.attachmentId)
        return await cardModel.update(cardId, { attachments: updatedAttachments })
      }
    }

    // ------------------- COMMENT ADD / EDIT / REMOVE -------------------
    if (updateData.action && updateData.comment) {
      const { action, comment } = updateData
      const comments = Array.isArray(currentCard.comments) ? currentCard.comments : []

      if (action === CARD_COMMENT_ACTIONS.ADD) {
        const newComment = {
          commentId: uuidv4(),
          userId: userInfo._id,
          content: comment.content.trim(),
          commentedAt: Date.now()
        }
        return await cardModel.unshiftNewComment(cardId, newComment)
      }

      const target = comments.find(c => c.commentId === comment.commentId)
      if (!target) throw new ApiError(StatusCodes.NOT_FOUND, 'Comment not found.')

      if (target.userId.toString() !== userInfo._id.toString()) {
        throw new ApiError(StatusCodes.FORBIDDEN, 'Not allowed.')
      }

      if (action === CARD_COMMENT_ACTIONS.EDIT) {
        if (comment.content?.trim()) {
          target.content = comment.content.trim()
          target.commentedAt = Date.now()
        }
        return await cardModel.update(cardId, { comments })
      }

      if (action === CARD_COMMENT_ACTIONS.REMOVE) {
        const updatedComments = comments.filter(c => c.commentId !== comment.commentId)
        return await cardModel.update(cardId, { comments: updatedComments })
      }
    }

    // ------------------- MEMBER UPDATE -------------------
    if (updateData.incomingMemberInfo) {
      return await cardModel.updateMembers(cardId, updateData.incomingMemberInfo)
    }

    // ------------------- DATES UPDATE -------------------
    if (updateData.dates) {
      const { startDate, dueDate, dueTime, reminder } = updateData.dates

      const parsedStart = startDate ? moment(startDate).toDate() : null
      const parsedDue = dueDate ? moment(dueDate).toDate() : null

      const dueDateTime = dueDate && dueTime
        ? moment(`${moment(dueDate).format('YYYY-MM-DD')} ${dueTime}`, 'YYYY-MM-DD HH:mm')
        : moment(dueDate)

      let scheduledAt = null

      if (reminder?.enabled && parsedDue) {
        if (reminder?.scheduledAt) {
          scheduledAt = moment(reminder.scheduledAt).toDate()
        } else if (reminder.timeBefore === 0) {
          scheduledAt = dueDateTime.toDate()
        } else {
          scheduledAt = moment(dueDateTime)
            .subtract(reminder.timeBefore || 0, 'minutes')
            .toDate()
        }
      }

      const newDates = {
        startDate: parsedStart,
        dueDate: parsedDue,
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

    // ------------------- COMPLETE TOGGLE -------------------
    if (typeof updateData.complete !== 'undefined') {
      return await cardModel.update(cardId, { complete: updateData.complete })
    }

    // ------------------- DEFAULT UPDATE -------------------
    return await cardModel.update(cardId, updateData)
  } catch (error) { throw error }
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

const formatLogTime = () => moment().format('HH:mm:ss DD/MM/YYYY')

const sendDueReminderMail = async () => {
  const now = moment().toDate()
  console.log(`[ReminderJob] (${formatLogTime()}) Started job...`)

  const cards = await cardModel.findAll({
    'dates.reminder.enabled': true,
    'dates.reminder.sent': false,
    'dates.reminder.scheduledAt': { $lte: now },
    _destroy: false
  })

  if (!cards.length) {
    console.log(`[ReminderJob] (${formatLogTime()}) No cards found to send reminders.`)
    return
  }

  for (const card of cards) {
    try {
      const memberIds = card.memberIds || []

      if (!memberIds.length) {
        console.log(`[ReminderJob] (${formatLogTime()}) Card "${card.title}" has no members → marking as sent.`)
        card.dates.reminder.sent = true
        await cardModel.update(card._id, { dates: card.dates })
        continue
      }

      const members = await Promise.all(
        memberIds.map(async id => {
          try {
            const user = await userModel.findOneById(id.toString())
            if (user && user.email) {
              return { email: user.email, name: user.displayName || user.username || 'User' }
            }
            return null
          } catch {
            return null
          }
        })
      )

      const validRecipients = members.filter(Boolean)
      if (!validRecipients.length) {
        console.log(`[ReminderJob] (${formatLogTime()}) Card "${card.title}" has no valid recipients → marking as sent.`)
        card.dates.reminder.sent = true
        await cardModel.update(card._id, { dates: card.dates })
        continue
      }

      const subject = `Reminder: ${card.title}`
      const formattedDueDate = moment(card.dates.dueDate).format('DD/MM/YYYY')
      const formattedDueTime = card.dates.dueTime ? ` ${card.dates.dueTime}` : ''

      const html = `
        <p>Hello ${validRecipients.length > 1 ? 'team' : validRecipients[0].name},</p>
        <p>This is a reminder that the task <b>${card.title}</b> is due on 
        <b>${formattedDueDate}${formattedDueTime}</b>.</p>
        <p>Please make sure to complete it before the deadline.</p>
        <p>— Task Management System</p>
      `

      await MailerSendProvider.sendBulkEmail({
        recipients: validRecipients,
        subject,
        html
      })

      console.log(`[ReminderJob] (${formatLogTime()}) Successfully sent reminder for "${card.title}" to ${validRecipients.length} recipient(s).`)

      card.dates.reminder.sent = true
      await cardModel.update(card._id, { dates: card.dates })
    } catch (err) {
      const message = err?.body?.message || err?.message || JSON.stringify(err)
      console.error(`[ReminderJob] (${formatLogTime()}) Failed to send reminder for "${card.title}":`, message)

      if (message.includes('quota limit')) {
        console.warn(`[ReminderJob] (${formatLogTime()}) Quota limit reached — stopping job until reset.`)
        break
      }
    }
  }
}

export const cardService = {
  createNew,
  update,
  deleteItem,
  sendDueReminderMail
}
