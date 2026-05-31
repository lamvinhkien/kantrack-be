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
import { userModel } from '~/models/userModel'

let io

const START_SERVER = () => {
  const app = express()

  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })

  app.use(cookieParser())
  app.use(cors(corsOptions))
  app.use(express.json())

  // ping route for free render
  app.get('/ping', (req, res) => {
    res.status(200).send('Server is alive!')
  })

  app.use('/v1', APIs_V1)
  app.use(errorHandlingMiddleware)

  const server = http.createServer(app)
  io = socketIo(server, { cors: corsOptions })

  io.on('connection', (socket) => {
    inviteSocket(socket)
    boardSocket(socket)
    activeCardSocket(socket)
  })

  const port = env.LOCAL_DEV_APP_PORT || 8017
  const host = env.BUILD_MODE === 'production' ? '0.0.0.0' : (env.LOCAL_DEV_APP_HOST || 'localhost')

  server.listen(port, host, () => {
    console.log(`Server running production successfully at http://${host}:${port}`)
  })
  exitHook(() => CLOSE_DB())

  return io
}

(async () => {
  try {
    await CONNECT_DB()
    console.log('Connected to MongoDB Cloud Atlas.')
    await userModel.createUserIndexes()

    const ioInstance = START_SERVER()

    const { startReminderJob } = await import('~/jobs/reminderJob.js')
    startReminderJob(ioInstance)

  } catch (error) {
    console.error(error)
    process.exit(0)
  }
})()

export { io }
