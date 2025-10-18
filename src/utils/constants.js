import { env } from '~/config/environment'

export const WEBSITE_DOMAIN = env.BUILD_MODE === 'production' ? env.WEBSITE_DOMAIN_PROD : env.WEBSITE_DOMAIN_DEV
export const WHITELIST_DOMAINS = [env.WEBSITE_DOMAIN_DEV]

export const BOARD_TYPES = { PUBLIC: 'public', PRIVATE: 'private' }

export const MAILER_SEND_TEMPLATES_IDS = { REGISTER_ACCOUNT: '3zxk54vyzk64jy6v' }

export const DEFAULT_PAGE = 1
export const DEFAULT_ITEMS_PER_PAGE = 12

export const INVITATION_TYPES = { BOARD_INVITATION: 'BOARD_INVITATION' }
export const BOARD_INVITATION_STATUS = { PENDING: 'PENDING', ACCEPTED: 'ACCEPTED', REJECTED: 'REJECTED' }

export const CARD_MEMBER_ACTIONS = { ADD: 'ADD', REMOVE: 'REMOVE' }

export const CARD_COMMENT_ACTIONS = { ADD: 'ADD', EDIT: 'EDIT', REMOVE: 'REMOVE' }

export const CARD_ATTACHMENT_ACTIONS = { EDIT: 'EDIT', REMOVE: 'REMOVE' }

export const SETUP_2FA_ACTIONS = { ENABLE: 'Enable', DISABLE: 'Disable' }

export const BOARD_PUBLIC_ACTION = ['leaveBoard']
export const BOARD_OWNER_ACTIONS = ['updatePermissions']
