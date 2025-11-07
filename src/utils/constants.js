import { env } from '~/config/environment'

export const WEBSITE_DOMAIN = env.BUILD_MODE === 'production' ? env.WEBSITE_DOMAIN_PROD : env.WEBSITE_DOMAIN_DEV
export const WHITELIST_DOMAINS = [env.WEBSITE_DOMAIN_DEV]

export const BOARD_TYPES = { PUBLIC: 'public', PRIVATE: 'private' }

export const MAILER_SEND_TEMPLATES_IDS = {
  REGISTER_ACCOUNT: 'z3m5jgry3704dpyo',
  OTP_CODE: 'neqvygmeqrw40p7w',
  TASK_REMINDER: 'zr6ke4njdeygon12'
}

export const MAILER_SEND_SUPPORT_EMAIL = 'lamvinhkien1709@gmail.com'
export const ADMIN_SENDER_EMAIL = 'noreply@kantrack.io.vn'
export const ADMIN_SENDER_NAME = 'KanTrack'

export const OTP_EXPIRE_MINUTES = 3
export const OTP_RESEND_EXPIRES = 1

export const MAX_JOINED_BOARDS = 12
export const MAX_COLUMNS_PER_BOARD = 8
export const MAX_CARDS_PER_BOARD = 40
export const MAX_ATTACHMENTS_PER_CARD = 6
export const MAX_REMINDERS_PER_BOARD = 4
export const MAX_MEMBERS_PER_BOARD = 2

export const CRON_REMINDER_TIME = env.BUILD_MODE === 'production' ? '0 * * * *' : '* * * * *'

export const DEFAULT_PAGE = 1
export const DEFAULT_ITEMS_PER_PAGE = 6

export const INVITATION_TYPES = { BOARD_INVITATION: 'BOARD_INVITATION' }
export const BOARD_INVITATION_STATUS = { PENDING: 'PENDING', ACCEPTED: 'ACCEPTED', REJECTED: 'REJECTED' }

export const CARD_MEMBER_ACTIONS = { ADD: 'ADD', REMOVE: 'REMOVE' }

export const CARD_COMMENT_ACTIONS = { ADD: 'ADD', EDIT: 'EDIT', REMOVE: 'REMOVE' }

export const CARD_ATTACHMENT_ACTIONS = { EDIT: 'EDIT', REMOVE: 'REMOVE' }

export const BOARD_PUBLIC_ACTIONS = ['leaveBoard']
export const BOARD_OWNER_ACTIONS = ['updatePermissions', 'assignAdmin', 'removeMember']
export const BOARD_MEMBER_ACTIONS = {
  editBoardTitle: 'editBoardTitle',
  editBoardType: 'editBoardType',
  inviteMemberToBoard: 'inviteMemberToBoard',

  addColumn: 'addColumn',
  editColumnTitle: 'editColumnTitle',
  deleteColumn: 'deleteColumn',
  moveColumn: 'moveColumn',

  addCard: 'addCard',
  editCardTitle: 'editCardTitle',
  editCardDescription: 'editCardDescription',
  editCardCover: 'editCardCover',
  editCardMember: 'editCardMember',
  editCardDate: 'editCardDate',
  editCardAttachment: 'editCardAttachment',
  editCardComment: 'editCardComment',
  editCardMarkComplete: 'editCardMarkComplete',
  deleteCard: 'deleteCard',
  moveCard: 'moveCard'
}

