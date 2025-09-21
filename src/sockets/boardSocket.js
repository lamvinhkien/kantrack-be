export const boardSocket = (socket) => {
  socket.on('FE_JOIN_BOARD', (boardId) => {
    socket.join(boardId)
  })

  socket.on('FE_LEAVE_BOARD', (boardId) => {
    socket.leave(boardId)
  })

  socket.on('FE_MOVE_COLUMN_IN_BOARD', ({ boardId, board }) => {
    socket.to(boardId).emit('BE_MOVE_COLUMN_IN_BOARD', board)
  })

  socket.on('FE_MOVE_CARD_IN_BOARD', ({ boardId, board }) => {
    socket.to(boardId).emit('BE_MOVE_CARD_IN_BOARD', board)
  })

  socket.on('FE_ADD_COLUMN_IN_BOARD', ({ boardId, board }) => {
    socket.to(boardId).emit('BE_ADD_COLUMN_IN_BOARD', board)
  })

  socket.on('FE_DELETE_COLUMN_IN_BOARD', ({ boardId, board }) => {
    socket.to(boardId).emit('BE_DELETE_COLUMN_IN_BOARD', board)
  })

  socket.on('FE_UPDATE_COLUMN_TITLE_IN_BOARD', ({ boardId, board }) => {
    socket.to(boardId).emit('BE_UPDATE_COLUMN_TITLE_IN_BOARD', board)
  })

  socket.on('FE_ADD_CARD_IN_BOARD', ({ boardId, board }) => {
    socket.to(boardId).emit('BE_ADD_CARD_IN_BOARD', board)
  })
}
