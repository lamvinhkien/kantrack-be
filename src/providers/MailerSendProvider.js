import { env } from '~/config/environment'
import { ADMIN_SENDER_EMAIL, ADMIN_SENDER_NAME } from '~/utils/constants'
import { MailerSend, EmailParams, Sender, Recipient } from 'mailersend'

const mailerSendInstance = new MailerSend({ apiKey: env.MAILER_SEND_API_KEY })
const sendFrom = new Sender(ADMIN_SENDER_EMAIL, ADMIN_SENDER_NAME)

const sendEmail = async ({
  to,
  toName,
  subject,
  templateId = null,
  personalizationData = null,
  html = null,
  text = null
}) => {
  try {
    const recipients = [new Recipient(to, toName)]
    const emailParams = new EmailParams()
      .setFrom(sendFrom)
      .setTo(recipients)
      .setReplyTo(sendFrom)
      .setSubject(subject)

    if (templateId) {
      emailParams
        .setTemplateId(templateId)
        .setPersonalization(personalizationData || [])
    } else {
      if (html) emailParams.setHtml(html)
      if (text) emailParams.setText(text || html?.replace(/<[^>]*>?/gm, ''))
    }

    const response = await mailerSendInstance.email.send(emailParams)
    return response
  } catch (error) { throw error }
}

const sendBulkEmail = async ({
  recipients,
  subject,
  templateId = null,
  personalizationData = null,
  html = null,
  text = null
}) => {
  try {
    if (!recipients?.length) throw new Error('No recipients provided for bulk email.')

    const recipientObjects = recipients.map(r => new Recipient(r.email, r.name))
    const emailParams = new EmailParams()
      .setFrom(sendFrom)
      .setTo(recipientObjects)
      .setReplyTo(sendFrom)
      .setSubject(subject)

    if (templateId) {
      emailParams
        .setTemplateId(templateId)
        .setPersonalization(personalizationData || [])
    } else {
      if (html) emailParams.setHtml(html)
      if (text) emailParams.setText(text || html?.replace(/<[^>]*>?/gm, ''))
    }

    const response = await mailerSendInstance.email.send(emailParams)
    return response
  } catch (error) { throw error }
}

export const MailerSendProvider = { sendEmail, sendBulkEmail }
