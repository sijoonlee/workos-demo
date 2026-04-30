# Keycloak Custom Theme — Google-Only Login Page

## Goal

Replace the default Keycloak login page (username/password + Google button) with a page that shows **only the Google button**.

## Why a custom theme is needed

The Google button is rendered by Keycloak's `login.ftl` template, which is part of the Username Password Form execution in the browser flow. The Identity Provider Redirector execution handles silent redirects (via `kc_idp_hint`) but renders nothing visible. So the only way to show just the Google button is to keep the Username Password Form in the flow and override its template to hide the form fields.

---

## 1. Create the theme files

```
keycloak-theme/
  google-only/
    login/
      theme.properties
      login.ftl
```

### `keycloak-theme/google-only/login/theme.properties`

```properties
parent=keycloak
```

### `keycloak-theme/google-only/login/login.ftl`

```html
<#import "template.ftl" as layout>
<@layout.registrationLayout displayInfo=social.displayInfo; section>
    <#if section = "title">
        ${msg("loginTitle",(realm.displayName!''))}
    <#elseif section = "form">
        <#if social.providers??>
            <div id="kc-social-providers" class="${properties.kcFormSocialAccountListClass!}">
                <#list social.providers as p>
                    <a id="social-${p.alias}"
                       class="${properties.kcFormSocialAccountListButtonClass!}"
                       href="${p.loginUrl}">
                        <#if p.iconClasses?has_content>
                            <i class="${properties.kcCommonLogoIdP!} ${p.iconClasses!}" aria-hidden="true"></i>
                            <span class="${properties.kcFormSocialAccountNameClass!} kc-social-icon-text">${p.displayName!}</span>
                        <#else>
                            <span class="${properties.kcFormSocialAccountNameClass!}">${p.displayName!}</span>
                        </#if>
                    </a>
                </#list>
            </div>
        </#if>
    </#if>
</@layout.registrationLayout>
```

---

## 2. Mount the theme into Docker

Create a `docker-compose.yml` in the project root:

```yaml
services:
  keycloak:
    image: quay.io/keycloak/keycloak:26.6.1
    command: start-dev
    ports:
      - "8080:8080"
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
    volumes:
      - ./keycloak-theme:/opt/keycloak/themes/google-only
```

Start with:
```bash
docker compose up -d
```

To apply to the existing running container without restarting (one-off):
```bash
docker cp keycloak-theme/google-only eloquent_carver:/opt/keycloak/themes/
```

---

## 3. Activate the theme in Keycloak admin

1. Go to `http://localhost:8080/admin` → select **testrealm**
2. **Realm settings** → **Themes** tab
3. Set **Login theme** to `google-only`
4. Click **Save**

---

## 4. Browser flow (no changes needed)

Keep the default browser flow intact (Username Password Form must remain so the login page is rendered). The custom `login.ftl` hides the form fields — it does not remove the execution from the flow.

```
Cookie                          (Alternative)
Identity Provider Redirector    (Alternative)
  └─ Username Password Form     (Required)   ← renders the page; login.ftl hides the fields
```
