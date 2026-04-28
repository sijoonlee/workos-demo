require('dotenv').config()
const express = require('express')
const path = require('path')
const config = require('../shared/config')

const app = express()

app.get('/env.js', (req, res) => {
  res.type('application/javascript')
  res.send(`window.__APP_CONFIG__ = ${JSON.stringify({ bffUrl: config.bffUrl })};`)
})

app.use(express.static(path.join(__dirname, 'public')))

if (require.main === module) {
  app.listen(3000, () => console.log(`Frontend server running on ${config.frontendUrl}`))
}

module.exports = app
