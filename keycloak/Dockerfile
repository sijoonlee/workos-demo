# Build stage: install envsubst from a UBI image that has a package manager
FROM registry.access.redhat.com/ubi9/ubi-minimal AS tools
RUN microdnf install -y gettext && microdnf clean all

FROM quay.io/keycloak/keycloak:26.6.1

USER root
# Copy envsubst from the build stage — Keycloak's base image (UBI9 micro) has no package manager
COPY --from=tools /usr/bin/envsubst /usr/bin/envsubst

COPY entrypoint.sh /opt/keycloak/bin/entrypoint.sh
RUN chmod +x /opt/keycloak/bin/entrypoint.sh

# Bake the realm template into the image — secrets are injected at runtime
# via environment variables and substituted by entrypoint.sh before import
COPY realm/testrealm.template.json /opt/keycloak/data/import/testrealm.template.json

USER keycloak

ENTRYPOINT ["/opt/keycloak/bin/entrypoint.sh"]
