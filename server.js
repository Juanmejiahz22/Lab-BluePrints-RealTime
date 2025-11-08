import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'

const PORT = process.env.PORT || 3001
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175'
]

// In-memory store: { `${author}:${name}`: [{x,y}, ...] }
const store = Object.create(null)
const keyOf = (author, name) => `${author}:${name}`
const getPoints = (author, name) => store[keyOf(author, name)] || []
const setPoints = (author, name, points) => { store[keyOf(author, name)] = points }

// Express app (REST minimal)
const app = express()
app.use(cors({ 
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true)
    } else {
      callback(null, true) // Allow all in dev
    }
  }
}))
app.use(express.json())

// list by author
app.get('/api/blueprints', (req, res) => {
  const author = req.query.author
  if (!author) return res.status(400).json({ error: 'author is required' })
  const result = Object.entries(store)
    .filter(([k]) => k.startsWith(`${author}:`))
    .map(([k, points]) => {
      const name = k.split(':', 2)[1]
      return { author, name, points }
    })
  res.json(result)
})

// get single blueprint
app.get('/api/blueprints/:author/:name', (req, res) => {
  const { author, name } = req.params
  const points = getPoints(author, name)
  // ensure entry exists so subsequent updates accumulate
  if (!store[keyOf(author, name)]) setPoints(author, name, points)
  res.json({ author, name, points })
})

// create blueprint
app.post('/api/blueprints', (req, res) => {
  const { author, name, points } = req.body || {}
  if (!author || !name) return res.status(400).json({ error: 'author and name are required' })
  const key = keyOf(author, name)
  if (store[key]) return res.status(409).json({ error: 'blueprint already exists' })
  setPoints(author, name, Array.isArray(points) ? points : [])
  res.status(201).json({ author, name, points: getPoints(author, name) })
})

// update blueprint points
app.put('/api/blueprints/:author/:name', (req, res) => {
  const { author, name } = req.params
  const { points } = req.body || {}
  if (!Array.isArray(points)) return res.status(400).json({ error: 'points array required' })
  setPoints(author, name, points.map(p => ({ x: +p.x, y: +p.y })))
  // broadcast update to room
  const room = `blueprints.${author}.${name}`
  io.to(room).emit('blueprint-update', { author, name, points: getPoints(author, name) })
  res.json({ author, name, points: getPoints(author, name) })
})

// delete blueprint
app.delete('/api/blueprints/:author/:name', (req, res) => {
  const { author, name } = req.params
  const key = keyOf(author, name)
  const existed = Boolean(store[key])
  delete store[key]
  res.json({ deleted: existed })
})

// HTTP + Socket.IO
const httpServer = createServer(app)
const io = new SocketIOServer(httpServer, {
  cors: { 
    origin: ALLOWED_ORIGINS,
    methods: ['GET','POST']
  }
})

io.on('connection', (socket) => {
  console.log(`[io] connected ${socket.id}`)

  socket.on('join-room', (room) => {
    if (typeof room !== 'string' || !room.startsWith('blueprints.')) return
    socket.join(room)
    console.log(`[io] ${socket.id} joined ${room}`)
  })

  socket.on('draw-event', (payload) => {
    try {
      const { room, author, name, point } = payload || {}
      if (!room || !author || !name || !point) return
      if (typeof point.x !== 'number' || typeof point.y !== 'number') return

      const points = getPoints(author, name).concat({ x: point.x, y: point.y })
      setPoints(author, name, points)

      // Emit solo a otros (evita duplicar en el emisor que ya actualizó localmente)
      socket.to(room).emit('blueprint-update', { author, name, points: [{ x: point.x, y: point.y }] })
    } catch (e) {
      console.error('[io] draw-event error', e)
    }
  })

  socket.on('disconnect', (reason) => {
    console.log(`[io] disconnected ${socket.id} – ${reason}`)
  })
})

httpServer.listen(PORT, () => {
  console.log(`RT server listening on http://localhost:${PORT}`)
})
