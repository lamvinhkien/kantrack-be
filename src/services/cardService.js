/* eslint-disable no-console */
import { cardModel } from '~/models/cardModel'
import { columnModel } from '~/models/columnModel'
import { CloudinaryProvider } from '~/providers/CloudinaryProvider'
import {
  CARD_ATTACHMENT_ACTIONS,
  CARD_COMMENT_ACTIONS,
  WEBSITE_DOMAIN,
  MAILER_SEND_TEMPLATES_IDS,
  MAILER_SEND_SUPPORT_EMAIL,
  MAX_REMINDERS_PER_BOARD,
  MAX_ATTACHMENTS_PER_CARD,
  MAX_CARDS_PER_BOARD,
  MAX_COMMENTS_PER_CARD
} from '~/utils/constants'
import { v4 as uuidv4 } from 'uuid'
import { normalizeFileName } from '~/utils/formatters'
import ApiError from '~/utils/ApiError'
import { StatusCodes } from 'http-status-codes'
import moment from 'moment'
import { MailerSendProvider } from '~/providers/MailerSendProvider'
import { userModel } from '~/models/userModel'
import { boardModel } from '~/models/boardModel'
import { normalizeBoardData } from '~/utils/formatters'

const createNew = async (reqBody) => {
  try {
    const newCard = {
      ...reqBody
    }

    const countCard = await cardModel.countCardInBoard(newCard.boardId)

    if (countCard >= MAX_CARDS_PER_BOARD) {
      throw new Error('This board has reached its card limit.')
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
      if (cardAttachmentFiles.length + existingFiles.length > MAX_ATTACHMENTS_PER_CARD) {
        throw new ApiError(StatusCodes.FORBIDDEN, 'File attachment limit reached for this card.')
      }

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
        const totalComments = await cardModel.countCommentsInCard(cardId)
        if (totalComments >= MAX_COMMENTS_PER_CARD) {
          throw new ApiError(StatusCodes.BAD_REQUEST, 'Comment limit reached for this card.')
        }

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

      const cleanDueTime = dueTime
        ? moment(dueTime, 'HH:mm').minutes(0).seconds(0).format('HH:mm')
        : null

      const dueDateTime = parsedDue && cleanDueTime
        ? moment(`${moment(parsedDue).format('YYYY-MM-DD')} ${cleanDueTime}`, 'YYYY-MM-DD HH:mm')
        : moment(parsedDue)

      if (parsedStart && parsedDue && moment(parsedStart).isAfter(moment(parsedDue))) {
        throw new Error('Start date cannot be after due date.')
      }

      const allowedTimeBefore = [0, 60, 120, 1440, 2880]
      const timeBefore = reminder?.timeBefore ?? 0
      if (reminder?.enabled && !allowedTimeBefore.includes(timeBefore)) {
        throw new Error(`Invalid reminder timeBefore value: ${timeBefore}`)
      }

      let scheduledAt = null

      if (reminder?.enabled && !parsedDue) {
        throw new Error('Cannot enable reminder without a due date.')
      }

      if (reminder?.enabled && parsedDue) {
        if (reminder?.scheduledAt) {
          scheduledAt = moment(reminder.scheduledAt).toDate()
        } else if (timeBefore === 0) {
          scheduledAt = dueDateTime.toDate()
        } else {
          scheduledAt = moment(dueDateTime)
            .subtract(timeBefore, 'minutes')
            .toDate()
        }

        if (moment(scheduledAt).isBefore(moment().subtract(30, 'seconds'))) {
          throw new Error('Reminder schedule time cannot be in the past.')
        }
      }

      if (reminder?.enabled) {
        const activeRemindersOnBoard = await cardModel.countActiveRemindersByBoard(currentCard?.boardId.toString())

        const isCurrentlyReminderOffOrSent =
          !currentCard.dates?.reminder?.enabled || currentCard.dates?.reminder?.sent

        if (isCurrentlyReminderOffOrSent && activeRemindersOnBoard >= MAX_REMINDERS_PER_BOARD) {
          throw new Error('This board has reached its email reminder limit.')
        }
      }

      const newDates = {
        startDate: parsedStart,
        dueDate: parsedDue,
        dueTime: cleanDueTime,
        reminder: {
          enabled: !!reminder?.enabled,
          timeBefore,
          type: reminder?.type || 'email',
          scheduledAt,
          sent: reminder?.enabled ? false : !!reminder?.sent
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

const sendDueReminderMail = async (io) => {
  const formatLogTime = () => moment().format('HH:mm:ss DD/MM/YYYY')
  const now = moment().toDate()

  const cards = await cardModel.findAll({
    'dates.reminder.enabled': true,
    'dates.reminder.sent': false,
    'dates.reminder.scheduledAt': { $lte: now },
    _destroy: false
  })

  if (!cards.length) {
    return
  }

  const boardCache = new Map()
  const getBoardDetailsCached = async (boardId) => {
    if (boardCache.has(boardId)) return boardCache.get(boardId)
    const rawBoard = await boardModel.getDetails(boardId)
    const newBoard = normalizeBoardData(rawBoard)
    boardCache.set(boardId, newBoard)
    return newBoard
  }

  for (const card of cards) {
    try {
      const memberIds = card.memberIds || []

      const emitUpdate = async () => {
        const newBoard = await getBoardDetailsCached(card.boardId)
        if (io) io.to(newBoard._id.toString()).emit('BE_UPDATE_CARD_IN_BOARD', newBoard)
      }

      if (!memberIds.length) {
        await cardModel.update(card._id, {
          'dates.reminder.sent': true,
          'dates.reminder.scheduledAt': null
        })
        await emitUpdate()
        continue
      }

      const members = await Promise.all(
        memberIds.map(async id => {
          const user = await userModel.findOneById(id.toString())
          return user?.email
            ? { email: user.email, name: user.displayName || user.username || 'User' }
            : null
        })
      )

      const validRecipients = members.filter(Boolean)
      if (!validRecipients.length) {
        await cardModel.update(card._id, {
          'dates.reminder.sent': true,
          'dates.reminder.scheduledAt': null
        })
        await emitUpdate()
        continue
      }

      const board = await boardModel.findOneById(card.boardId.toString())
      const boardUrl = board?._id ? `${WEBSITE_DOMAIN}/boards/${board._id}` : WEBSITE_DOMAIN
      const formattedDueDate = moment(card.dates.dueDate).format('DD/MM/YYYY')
      const formattedDueTime = card.dates.dueTime
      const subject = `Reminder: ${card.title}`

      const personalizationData = validRecipients.map(r => ({
        email: r.email,
        data: {
          support_email: MAILER_SEND_SUPPORT_EMAIL,
          board_title: board?.title,
          board_url: boardUrl,
          card_title: card?.title,
          due_date: formattedDueDate,
          due_time: formattedDueTime,
          recipient: r.name
        }
      }))

      await MailerSendProvider.sendBulkEmail({
        recipients: validRecipients,
        subject,
        templateId: MAILER_SEND_TEMPLATES_IDS.TASK_REMINDER,
        personalizationData
      })

      console.log(`[ReminderJob] (${formatLogTime()}) Sent reminder for "${card.title}" to ${validRecipients.length} recipient(s).`)

      await cardModel.update(card._id, {
        'dates.reminder.sent': true,
        'dates.reminder.scheduledAt': null
      })
      await emitUpdate()

      await new Promise(r => setTimeout(r, 500))
    } catch (err) {
      const message = err?.body?.message || err?.message || JSON.stringify(err)
      console.error(`[ReminderJob] (${formatLogTime()}) Failed for "${card.title}":`, message)
      if (message.includes('quota limit')) {
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
