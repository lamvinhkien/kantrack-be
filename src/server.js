/* eslint-disable no-console */
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import exitHook from 'async-exit-hook'
import { env } from '~/config/environment'
import { CONNECT_DB, CLOSE_DB } from '~/config/mongodb'
import { corsOptions } from '~/config/cors'
import { APIs_V1 } from '~/routes/v1'
import { errorHandlingMiddleware } from '~/middlewares/errorHandlingMiddleware'
import socketIo from 'socket.io'
import http from 'http'
import { boardSocket } from './sockets/boardSocket'
import { inviteSocket } from './sockets/inviteSocket'
import { activeCardSocket } from './sockets/activeCardSocket'

const START_SERVER = () => {
  const app = express()

  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })

  app.use(cookieParser())

  app.use(cors(corsOptions))

  app.use(express.json())

  app.use('/v1', APIs_V1)

  app.use(errorHandlingMiddleware)

  const server = http.createServer(app)

  const io = socketIo(server, { cors: corsOptions })

  io.on('connection', (socket) => {
    inviteSocket(socket)
    boardSocket(socket)
    activeCardSocket(socket)
  })

  server.listen(env.LOCAL_DEV_APP_PORT, env.LOCAL_DEV_APP_HOST, () => {
    console.log(`Server running at http://${env.LOCAL_DEV_APP_HOST}:${env.LOCAL_DEV_APP_PORT}`)
  })

  exitHook(() => {
    CLOSE_DB()
  })
}

(async () => {
  try {
    await CONNECT_DB()
    console.log('Connected to MongoDB Cloud Atlas.')
    START_SERVER()
  } catch (error) {
    console.error(error)
    process.exit(0)
  }
})()