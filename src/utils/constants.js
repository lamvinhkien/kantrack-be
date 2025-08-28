import { env } from '~/config/environment'

export const WEBSITE_DOMAIN = env.BUILD_MODE === 'production' ? env.WEBSITE_DOMAIN_PROD : env.WEBSITE_DOMAIN_DEV
export const WHITELIST_DOMAINS = [env.WEBSITE_DOMAIN_DEV]

export const BOARD_TYPES = { PUBLIC: 'public', PRIVATE: 'private' }

export const MAILER_SEND_TEMPLATES_IDS = { REGISTER_ACCOUNT: '3zxk54vyzk64jy6v' }

export const DEFAULT_PAGE = 1
export const DEFAULT_ITEMS_PER_PAGE = 12