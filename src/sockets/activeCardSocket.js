export const activeCardSocket = (socket) => {
  socket.on('FE_JOIN_ACTIVE_CARD', (cardId) => {
    socket.join(cardId)
  })

  socket.on('FE_LEAVE_ACTIVE_CARD', (cardId) => {
    socket.leave(cardId)
  })

  socket.on('FE_UPDATE_ACTIVE_CARD', ({ cardId, card }) => {
    socket.to(cardId).emit('BE_UPDATE_ACTIVE_CARD', card)
  })

  socket.on('FE_DELETE_ACTIVE_CARD', (cardId) => {
    socket.to(cardId).emit('BE_DELETE_ACTIVE_CARD', cardId)
  })
}
