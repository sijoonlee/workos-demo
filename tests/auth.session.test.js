process.env.SESSION_SECRET = 'test-secret'
process.env.WORKOS_API_KEY = 'test-api-key'
process.env.WORKOS_CLIENT_ID = 'test-client-id'

const request = require('supertest')
const app = require('../bff/server')

test('GET /auth/session returns authenticated:false when no session', async () => {
  const res = await request(app).get('/auth/session')
  expect(res.status).toBe(200)
  expect(res.body).toEqual({ authenticated: false })
})

test('GET /auth/session returns authenticated:true with user when session exists', async () => {
  const agent = request.agent(app)

  // Manually plant a session by hitting an internal test route
  // Instead, use the agent to set session via a lightweight injection approach:
  // We monkey-patch by making a request that sets session, then check.
  // Since we have no login route yet, we inject via a temporary route on the app.
  const express = require('express')
  app.get('/__test_set_session', (req, res) => {
    req.session.user = { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' }
    res.sendStatus(200)
  })

  await agent.get('/__test_set_session')
  const res = await agent.get('/auth/session')

  expect(res.status).toBe(200)
  expect(res.body).toEqual({
    authenticated: true,
    user: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
  })
})
