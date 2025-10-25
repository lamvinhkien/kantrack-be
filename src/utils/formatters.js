import { pick } from 'lodash'

export const pickUser = (user) => {
  if (!user) return {}
  return pick(user, [
    '_id',
    'email',
    'username',
    'displayName',
    'avatar',
    'role',
    'isActive',
    'require2fa',
    'recentBoards',
    'favouriteBoards',
    'createdAt',
    'updatedAt'
  ])
}

export const normalizeFileName = (filename) => {
  const ext = filename.split('.').pop()
  const base = filename.replace(/\.[^/.]+$/, '').replace(/\./g, '_')
  return `${base}.${ext}`
}
