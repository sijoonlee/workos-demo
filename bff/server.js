require('dotenv').config()
const express = require('express')
const cors = require('cors')
const session = require('express-session')
const config = require('../shared/config')
const authRouter = require('./routes/auth')

const app = express()

// Trust the X-Forwarded-Proto header from reverse proxies (ngrok, load balancers).
// Without this, req.secure is false on the local HTTP connection even when the
// client connected over HTTPS, and express-session won't set Secure cookies.
if (config.appEnv === 'production') {
  app.set('trust proxy', 1)
}

app.use(cors({
  origin: (origin, callback) => {
    if (origin && config.frontendUrls.includes(origin)) {
      callback(null, origin)
    } else {
      callback(null, false)
    }
  },
  credentials: true,
}))

// To persis session, use a store like Redis in production.
// app.use(session({
//   store: new RedisStore({ client: redisClient }),
//   // ... same cookie config
// }))
app.use(session({
  name: config.cookie.name,
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
  },
}))

app.get('/', (req, res) => {
  res.send('<h1>hello</h1>')
})

app.use('/auth', authRouter)

if (require.main === module) {
  app.listen(3001, () => console.log(`BFF server running on ${config.bffUrl}`))
}

module.exports = app
