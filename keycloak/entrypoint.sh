#!/bin/bash
# Substitute env vars into the realm template before Keycloak imports it.
# Keycloak's built-in ${env.X} substitution does not work for identity
# provider config fields, so we do it ourselves here at container startup.
envsubst < /opt/keycloak/data/import/testrealm.template.json \
         > /opt/keycloak/data/import/testrealm.json

exec /opt/keycloak/bin/kc.sh start-dev --import-realm
