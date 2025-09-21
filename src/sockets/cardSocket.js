export const cardSocket = (socket) => {
  socket.on('FE_JOIN_CARD', (cardId) => {
    socket.join(cardId)
  })

  socket.on('FE_LEAVE_CARD', (cardId) => {
    socket.leave(cardId)
  })

  socket.on('FE_UPDATE_CARD', ({ cardId, card }) => {
    socket.to(cardId).emit('BE_UPDATE_CARD', card)
  })
}
