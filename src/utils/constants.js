import { env } from '~/config/environment'

export const WEBSITE_DOMAIN = env.BUILD_MODE === 'production' ? env.WEBSITE_DOMAIN_PROD : env.WEBSITE_DOMAIN_DEV
export const WHITELIST_DOMAINS = [env.WEBSITE_DOMAIN_DEV]

export const BOARD_TYPES = { PUBLIC: 'public', PRIVATE: 'private' }

export const MAILER_SEND_TEMPLATES_IDS = {
  REGISTER_ACCOUNT: 'z3m5jgry3704dpyo',
  OTP_CODE: 'neqvygmeqrw40p7w'
}

export const CRON_REMINDER_TIME = env.BUILD_MODE === 'production' ? env.CRON_REMINDER_TIME_PROD : env.CRON_REMINDER_TIME_DEV

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

