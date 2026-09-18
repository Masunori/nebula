# Nebula

Next.js client and FastAPI server. Run the commands below from the repository root with Docker Engine and Docker Compose v2 or newer installed.

## Local development

```sh
docker compose -f compose.local.yaml up --build
```

- Client: http://localhost:3000
- API docs: http://localhost:8000/docs
- API health: http://localhost:8000/health

Both services reload when source files change. Client dependencies and Next.js build output live in Docker volumes, separate from host files. The client runs `npm ci` at startup to synchronize dependencies with the lockfile; restart the client after dependency changes. Rebuild the server after changing `server/requirements.txt`.

```sh
docker compose -f compose.local.yaml down
```

## Production

```sh
docker compose -f compose.prod.yaml up --build -d --wait
docker compose -f compose.prod.yaml logs -f
docker compose -f compose.prod.yaml down
```

Production uses multi-stage builds, non-root users, health checks, restart policies, and no source mounts. The client runs Next.js standalone output; the server runs Uvicorn without reload.

Both stacks bind host ports to loopback. For a public deployment, place a TLS reverse proxy in front of ports 3000 and 8000 and configure API CORS for your frontend origin. The server currently retains its development CORS policy. Set `CLIENT_PORT` and `SERVER_PORT` to override the host ports; local and production stacks need different ports if run simultaneously.

Inside the client container, `API_INTERNAL_URL=http://server:8000` is available for future server-side API requests. Browser requests must use a publicly reachable API URL (locally, `http://localhost:8000`); Docker service names are only resolvable inside Docker. No API calls or proxy routes are added by this setup.

Build contexts exclude local dependencies, generated files, and `.env` files. Configure runtime secrets through your deployment environment. Python dependency ranges and base image tags allow updates on rebuild; lock dependencies and pin image digests when establishing a release process.

The production client follows [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output); the API image follows [FastAPI container deployment](https://fastapi.tiangolo.com/deployment/docker/).
