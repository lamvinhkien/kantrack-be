import { cloneDeep } from 'lodash'
import { pick } from 'lodash'

export const pickUser = (user) => {
  if (!user) return {}
  return pick(user, [
    '_id',
    'email',
    'username',
    'displayName',
    'avatar',
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

export const normalizeBoardData = (rawBoard) => {
  if (!rawBoard) return null

  const board = cloneDeep(rawBoard)

  const convertIdToString = (obj) => {
    if (!obj) return obj
    for (const key in obj) {
      const val = obj[key]
      if (val && typeof val === 'object') {
        if (val._bsontype === 'ObjectID' || val.constructor?.name === 'ObjectId') {
          obj[key] = val.toString()
        } else {
          convertIdToString(val)
        }
      }
    }
    return obj
  }

  convertIdToString(board)

  const columnsWithCards = board.columns.map((col) => {
    const cardsInColumn = board.cards.filter(
      (card) => card.columnId === col._id && !card._destroy
    )

    col.cards = cardsInColumn.sort((a, b) => {
      return col.cardOrderIds.indexOf(a._id) - col.cardOrderIds.indexOf(b._id)
    })

    if (!col.cards.length) {
      col.cards = [
        {
          _id: `${col._id}-placeholder-card`,
          boardId: board._id,
          columnId: col._id,
          FE_PlaceholderCard: true
        }
      ]
      col.cardOrderIds = [`${col._id}-placeholder-card`]
    }

    return col
  })

  board.columns = columnsWithCards

  delete board.cards

  return board
}
