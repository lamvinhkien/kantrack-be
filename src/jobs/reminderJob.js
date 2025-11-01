/* eslint-disable no-console */
import cron from 'node-cron'
import { cardService } from '~/services/cardService'
import { CRON_REMINDER_TIME } from '~/utils/constants'

cron.schedule(CRON_REMINDER_TIME, async () => {
  try {
    await cardService.sendDueReminderMail()
  } catch (error) { console.error('Reminder job failed:', error) }
})
