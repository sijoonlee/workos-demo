require('dotenv').config()
const express = require('express')
const cors = require('cors')
const session = require('express-session')
const config = require('../shared/config')
const authRouter = require('./routes/auth')

const app = express()

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

app.use('/auth', authRouter)

if (require.main === module) {
  app.listen(3001, () => console.log(`BFF server running on ${config.bffUrl}`))
}

module.exports = app
