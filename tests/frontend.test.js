process.env.SESSION_SECRET = 'test-secret'
process.env.WORKOS_API_KEY = 'test-api-key'
process.env.WORKOS_CLIENT_ID = 'test-client-id'

const request = require('supertest')
const app = require('../frontend/server')

test('GET /env.js returns JS that sets window.__APP_CONFIG__ with bffUrl', async () => {
  const res = await request(app).get('/env.js')
  expect(res.status).toBe(200)
  expect(res.type).toMatch(/javascript/)
  expect(res.text).toContain('window.__APP_CONFIG__')
  expect(res.text).toContain('bffUrl')
  expect(res.text).toContain('http://localhost:3001')
})

test('GET / serves index.html with 200', async () => {
  const res = await request(app).get('/')
  expect(res.status).toBe(200)
  expect(res.type).toMatch(/html/)
})

test('GET /profile.html serves profile page with 200', async () => {
  const res = await request(app).get('/profile.html')
  expect(res.status).toBe(200)
  expect(res.type).toMatch(/html/)
})
