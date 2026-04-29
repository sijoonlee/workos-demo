require('dotenv').config()
const express = require('express')
const path = require('path')
const config = require('../shared/config')

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
const port = new URL(frontendUrl).port || 3000

const app = express()

app.get('/env.js', (req, res) => {
  res.type('application/javascript')
  res.send(`window.__APP_CONFIG__ = ${JSON.stringify({ bffUrl: config.bffUrl, frontendUrl })};`)
})

app.use(express.static(path.join(__dirname, 'public')))

if (require.main === module) {
  app.listen(port, () => console.log(`Frontend server running on ${frontendUrl}`))
}

module.exports = app
