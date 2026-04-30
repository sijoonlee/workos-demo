# Keycloak Magic Link / Email OTP — Setup Guide

## Overview

Add email OTP as an alternative login method alongside Google OAuth.
The login page will offer two paths:
- Sign in with Google (existing)
- Enter email → receive a one-time code → sign in (new)

---

## Prerequisites

A transactional email service with SMTP credentials. Options:
- **Mailchimp Transactional (Mandrill)** — smtp.mandrillapp.com
- **SendGrid** — smtp.sendgrid.net (free tier available)
- **Mailgun** — smtp.mailgun.org (free tier available)
- **AWS SES** — email-smtp.<region>.amazonaws.com

---

## Step 1 — Configure SMTP in Keycloak

1. Go to `http://localhost:8080/admin` → **testrealm** → **Realm settings** → **Email** tab
2. Fill in your SMTP credentials:
   ```
   Host:       smtp.mandrillapp.com        (or your provider's host)
   Port:       587
   Encryption: STARTTLS
   Username:   your account email
   Password:   your API key
   From:       noreply@yourdomain.com
   ```
3. Click **Test connection** to verify, then **Save**

To automate this via `keycloak/realm/testrealm.json`, add the following to the realm JSON:

```json
"smtpServer": {
  "host": "${env.SMTP_HOST}",
  "port": "${env.SMTP_PORT}",
  "from": "${env.SMTP_FROM}",
  "auth": "true",
  "user": "${env.SMTP_USER}",
  "password": "${env.SMTP_PASSWORD}",
  "starttls": "true"
}
```

And add the corresponding variables to `keycloak/.env`:
```
SMTP_HOST=smtp.mandrillapp.com
SMTP_PORT=587
SMTP_FROM=noreply@yourdomain.com
SMTP_USER=your_account_email
SMTP_PASSWORD=your_api_key
```

---

## Step 2 — Add the magic-link extension to Docker

The `keycloak-magic-link` extension is provided by Phase Two (p2-inc). It is distributed via Maven Central as `io.phasetwo.keycloak:keycloak-magic-link`.

Create `keycloak/Dockerfile`:

```dockerfile
FROM quay.io/keycloak/keycloak:26.6.1

# Download the magic-link provider JAR — check latest version compatible with
# Keycloak 26.x at https://central.sonatype.com/artifact/io.phasetwo.keycloak/keycloak-magic-link/versions
ADD --chown=keycloak:keycloak \
  https://repo1.maven.org/maven2/io/phasetwo/keycloak/keycloak-magic-link/<VERSION>/keycloak-magic-link-<VERSION>.jar \
  /opt/keycloak/providers/

RUN /opt/keycloak/bin/kc.sh build
```

Update `keycloak/docker-compose.yml` to build from the Dockerfile instead of pulling the image directly:

```yaml
services:
  keycloak:
    build: .                          # was: image: quay.io/keycloak/keycloak:26.6.1
    command: start-dev --import-realm
    ports:
      - "8080:8080"
    environment:
      KC_BOOTSTRAP_ADMIN_USERNAME: admin
      KC_BOOTSTRAP_ADMIN_PASSWORD: admin
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      KEYCLOAK_CLIENT_SECRET: ${KEYCLOAK_CLIENT_SECRET}
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT}
      SMTP_FROM: ${SMTP_FROM}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASSWORD: ${SMTP_PASSWORD}
    volumes:
      - ./theme/google-only:/opt/keycloak/themes/google-only
      - ./realm:/opt/keycloak/data/import
```

---

## Step 3 — Configure the authentication flow

After starting Keycloak with the extension installed:

1. Go to **Authentication** → **Flows** → **browser** → **Duplicate**  
   Name it `browser-with-magic-link`

2. Structure the flow as follows:
   ```
   Cookie                              (Alternative)
   Identity Provider Redirector        (Alternative)  ← Google button
   Magic Link Or Password sub-flow     (Alternative)
     └─ Magic Link Form                (Required)
   ```

3. Go to **Authentication** → **Bindings** → set **Browser Flow** to `browser-with-magic-link`

The exact execution names depend on the extension version — refer to the
[p2-inc/keycloak-magic-link README](https://github.com/p2-inc/keycloak-magic-link) for the
current flow configuration steps.

---

## Step 4 — Update the login theme

The custom `login.ftl` currently only shows the Google button. It needs to be extended to also show the magic link email input form alongside the Google button.

The magic-link extension provides its own FreeMarker template variables. Refer to the extension's
documentation for the correct template structure, then update
`keycloak/theme/google-only/login/login.ftl` accordingly.

---

## Summary of files to create/update

| File | Action |
|---|---|
| `keycloak/Dockerfile` | Create — adds magic-link JAR to the image |
| `keycloak/docker-compose.yml` | Update — use `build: .`, add SMTP env vars |
| `keycloak/.env` | Update — add SMTP credentials |
| `keycloak/realm/testrealm.json` | Update — add `smtpServer` block |
| `keycloak/theme/google-only/login/login.ftl` | Update — add email OTP form |
