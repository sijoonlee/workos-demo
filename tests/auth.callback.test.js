process.env.SESSION_SECRET = 'test-secret'
process.env.WORKOS_API_KEY = 'test-api-key'
process.env.WORKOS_CLIENT_ID = 'test-client-id'

const request = require('supertest')

const mockAuthenticateWithCodeAndVerifier = jest.fn()

jest.mock('@workos-inc/node', () => ({
  WorkOS: jest.fn().mockImplementation(() => ({
    userManagement: {
      getAuthorizationUrl: jest.fn().mockReturnValue('https://api.workos.com/sso/authorize?fake=1'),
      authenticateWithCodeAndVerifier: mockAuthenticateWithCodeAndVerifier,
    },
  })),
}))

const app = require('../bff/server')

app.get('/__test_set_verifier', (req, res) => {
  req.session.codeVerifier = 'test-verifier'
  req.session.returnTo = 'http://localhost:3000'
  res.sendStatus(200)
})

app.get('/__test_get_session', (req, res) => {
  res.json({ user: req.session.user, codeVerifier: req.session.codeVerifier, returnTo: req.session.returnTo })
})

test('GET /auth/callback returns 400 when code is missing', async () => {
  const res = await request(app).get('/auth/callback')
  expect(res.status).toBe(400)
  expect(res.text).toMatch(/missing authorization code/i)
})

test('GET /auth/callback returns 400 when codeVerifier is missing from session', async () => {
  const res = await request(app).get('/auth/callback?code=abc123')
  expect(res.status).toBe(400)
  expect(res.text).toMatch(/missing code verifier/i)
})

test('GET /auth/callback returns 400 when returnTo is missing from session', async () => {
  const agent = request.agent(app)
  app.get('/__test_set_verifier_only', (req, res) => {
    req.session.codeVerifier = 'test-verifier'
    res.sendStatus(200)
  })
  await agent.get('/__test_set_verifier_only')
  const res = await agent.get('/auth/callback?code=abc123')
  expect(res.status).toBe(400)
  expect(res.text).toMatch(/missing return url/i)
})

test('GET /auth/callback stores user in session and redirects to returnTo on success', async () => {
  mockAuthenticateWithCodeAndVerifier.mockResolvedValueOnce({
    user: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
  })

  const agent = request.agent(app)
  await agent.get('/__test_set_verifier')
  const res = await agent.get('/auth/callback?code=valid-code')

  expect(res.status).toBe(302)
  expect(res.headers.location).toBe('http://localhost:3000/profile.html')
})

test('GET /auth/callback clears codeVerifier and returnTo after successful exchange', async () => {
  mockAuthenticateWithCodeAndVerifier.mockResolvedValueOnce({
    user: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
  })

  const agent = request.agent(app)
  await agent.get('/__test_set_verifier')
  await agent.get('/auth/callback?code=valid-code')
  const res = await agent.get('/__test_get_session')

  expect(res.body.codeVerifier).toBeUndefined()
  expect(res.body.returnTo).toBeUndefined()
  expect(res.body.user.email).toBe('jane@example.com')
})
