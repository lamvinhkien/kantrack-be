import { env } from '~/config/environment'
import { MailerSend, EmailParams, Sender, Recipient } from 'mailersend'

const mailerSendInstance = new MailerSend({ apiKey: env.MAILER_SEND_API_KEY })
const sendFrom = new Sender(env.ADMIN_SENDER_EMAIL, env.ADMIN_SENDER_NAME)

const sendEmail = async ({ to, toName, subject, templateId, personalizetionData }) => {
  try {
    const recipients = [
      new Recipient(to, toName)
    ]

    const emailParams = new EmailParams()
      .setFrom(sendFrom)
      .setTo(recipients)
      .setReplyTo(sendFrom)
      .setSubject(subject)
      .setTemplateId(templateId)
      .setPersonalization(personalizetionData)

    const data = await mailerSendInstance.email.send(emailParams)
    return data
  } catch (error) { throw error }
}

export const MailerSendProvider = {
  sendEmail
}