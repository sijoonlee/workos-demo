require('dotenv').config()
const express = require('express')
const cors = require('cors')
const session = require('express-session')
const config = require('../shared/config')
const authRouter = require('./routes/auth')

const app = express()

// The `cors` package emits Access-Control-Allow-Credentials: true for all origins,
// but CSRF protection comes from Access-Control-Allow-Origin being pinned to
// frontendUrl — browsers block credentialed requests when the origin doesn't match.
app.use(cors({
  origin: config.frontendUrl,
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
