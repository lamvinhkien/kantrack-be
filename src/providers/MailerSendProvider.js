import { env } from '~/config/environment'
import { MailerSend, EmailParams, Sender, Recipient } from 'mailersend'

const mailerSendInstance = new MailerSend({ apiKey: env.MAILER_SEND_API_KEY })

const sendFrom = new Sender(env.ADMIN_SENDER_EMAIL, env.ADMIN_SENDER_NAME)

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

export const MailerSendProvider = { sendEmail }
