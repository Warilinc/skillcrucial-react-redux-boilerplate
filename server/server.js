/* eslint-disable import/no-duplicates */
import express from 'express'
import path from 'path'
import cors from 'cors'
import bodyParser from 'body-parser'
import sockjs from 'sockjs'
import axios from 'axios'
import cookieParser from 'cookie-parser'
import Html from '../client/html'

const { readFile, writeFile, unlink } = require('fs').promises

let connections = []

const port = process.env.PORT || 3000
const server = express()

server.use(cors())

const setHeaders = (req, res, next) => {
  res.set('x-skillcrucial-user', '7d7589d0-4310-4280-93ea-726ba7151345')
  res.set('Access-Control-Expose-Headers', 'X-SKILLCRUCIAL-USER')
  return next()
}
server.use(setHeaders)
server.use(express.static(path.resolve(__dirname, '../dist/assets')))
server.use(bodyParser.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }))
server.use(bodyParser.json({ limit: '50mb', extended: true }))

server.use(cookieParser())

const removeUsers = () => {
  unlink(`${__dirname}/test.json`)
}

const saveUsers = (users) => {
  return writeFile(`${__dirname}/test.json`, JSON.stringify(users), { encoding: 'utf8' }).then(
    () => users
  )
}

const getUsers = () => {
  return readFile(`${__dirname}/test.json`)
    .then((data) => JSON.parse(data))
    .catch(() => {
      return axios('https://jsonplaceholder.typicode.com/users').then(({ data }) => saveUsers(data))
    })
}

server.get('/api/v1/users/', async (req, res) => {
  const users = await getUsers()
  res.json(users)
})

server.post('/api/v1/users/', async (req, res) => {
  const user = req.body
  const users = await getUsers()
  const id = users[users.length - 1].id + 1
  await saveUsers([...users, { ...user, id }])
  res.json({ status: 'success', id })
})

server.patch('/api/v1/users/:userId', async (req, res) => {
  const { userId } = req.params
  const user = req.body
  let users = await getUsers()
  users = users.reduce((acc, rec) => {
    if (String(rec.id) === userId) return [...acc, { ...user, id: userId }]
    return [...acc, rec]
  }, [])
  await saveUsers(users)
  res.json({ status: 'success', id: userId })
})

server.delete('/api/v1/users/:userId', async (req, res) => {
  const { userId } = req.params
  let users = await getUsers()
  users = users.reduce((acc, rec) => {
    if (String(rec.id) === userId) return acc
    return [...acc, rec]
  }, [])
  await saveUsers(users)
  res.json({ status: 'success', id: userId })
})

server.delete('/api/v1/users/', async (req, res) => {
  removeUsers()
  res.json({ status: 'success' })
})

server.use('/api/', (req, res) => {
  res.status(404)
  res.end()
})

const echo = sockjs.createServer()
echo.on('connection', (conn) => {
  connections.push(conn)
  conn.on('data', async () => {})

  conn.on('close', () => {
    connections = connections.filter((c) => c.readyState !== 3)
  })
})

server.get('/', (req, res) => {
  // const body = renderToString(<Root />);
  const title = 'Server side Rendering'
  res.send(
    Html({
      body: '',
      title
    })
  )
})

server.get('/*', (req, res) => {
  const initialState = {
    location: req.url
  }

  return res.send(
    Html({
      body: '',
      initialState
    })
  )
})

const app = server.listen(port)

echo.installHandlers(app, { prefix: '/ws' })

// eslint-disable-next-line no-console
console.log(`Serving at http://localhost:${port}`)
