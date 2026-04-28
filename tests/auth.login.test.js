process.env.SESSION_SECRET = 'test-secret'
process.env.WORKOS_API_KEY = 'test-api-key'
process.env.WORKOS_CLIENT_ID = 'test-client-id'

const request = require('supertest')

jest.mock('@workos-inc/node', () => ({
  WorkOS: jest.fn().mockImplementation(() => ({
    userManagement: {
      getAuthorizationUrl: jest.fn().mockReturnValue('https://api.workos.com/sso/authorize?fake=1'),
    },
  })),
}))

const app = require('../bff/server')

test('GET /auth/login redirects to a WorkOS authorization URL', async () => {
  const res = await request(app).get('/auth/login')
  expect(res.status).toBe(302)
  expect(res.headers.location).toBe('https://api.workos.com/sso/authorize?fake=1')
})

test('GET /auth/login stores codeVerifier in session', async () => {
  const agent = request.agent(app)

  app.get('/__test_get_session', (req, res) => {
    res.json({ codeVerifier: req.session.codeVerifier })
  })

  await agent.get('/auth/login')
  const res = await agent.get('/__test_get_session')

  expect(res.body.codeVerifier).toBeDefined()
  expect(typeof res.body.codeVerifier).toBe('string')
  expect(res.body.codeVerifier.length).toBeGreaterThan(0)
})
