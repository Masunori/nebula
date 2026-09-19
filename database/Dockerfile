# =============================================================================
# NebulaX Railway Track Access Optimisation
# Database Service Dockerfile (PostgreSQL 16 Alpine)
# =============================================================================
FROM postgres:16-alpine

# Set default PostgreSQL environment variables
ENV POSTGRES_DB=nebula \
    POSTGRES_USER=nebula_user \
    POSTGRES_PASSWORD=nebula_password

# Copy SQL initialization scripts into the docker-entrypoint directory
# Scripts are executed in alphabetical order on first initialization
COPY sql/01_schema.sql /docker-entrypoint-initdb.d/01_schema.sql
COPY sql/02_spatial.sql /docker-entrypoint-initdb.d/02_spatial.sql
COPY sql/03_seed_init.sql /docker-entrypoint-initdb.d/03_seed_init.sql
COPY sql/04_views.sql /docker-entrypoint-initdb.d/04_views.sql
COPY sql/05_seed_output.sql /docker-entrypoint-initdb.d/05_seed_output.sql
COPY sql/06_preprocessed.sql /docker-entrypoint-initdb.d/06_preprocessed.sql

EXPOSE 5432

HEALTHCHECK --interval=5s --timeout=5s --start-period=5s --retries=5 \
    CMD pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB} || exit 1
