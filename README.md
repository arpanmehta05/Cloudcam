# Cloudcam

Cloudcam is a cloud operations and AI observability platform. It provides a web dashboard and API for monitoring cloud environments, managing integrations, running infrastructure workflows, and collecting LLM traces, costs, tokens, latency, and errors.

## Repository Layout

| Directory | Purpose |
| --- | --- |
| `backend/` | TypeScript API, integrations, jobs, infrastructure workflows, and observability services |
| `frontend/` | Next.js dashboard |
| `sdk/js/` | JavaScript/TypeScript AI observability SDK |
| `sdk/python/` | Python AI observability SDK |
| `sdk/vps-agent/` | VPS monitoring agent |
| `templates/` | Cloud onboarding templates |

## Prerequisites

- Node.js 20 or newer
- npm
- Python 3.8 or newer for the Python SDK
- MongoDB for local backend development
- Prometheus if metrics features are enabled

## Local Development

Install dependencies independently in each Node workspace:

```bash
cd backend
npm install

cd ../frontend
npm install
```

Create `backend/.env`. The backend uses `http://localhost:4000`, MongoDB at `mongodb://localhost:27017/rabbittize`, and Prometheus at `http://localhost:9090` by default. Set credentials and service-specific values in the environment rather than committing them.

For the frontend, create `frontend/.env.local` when the API is not using its default URL:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

Start the API and dashboard in separate terminals:

```bash
# Terminal 1
cd backend
npm run dev

# Terminal 2
cd frontend
npm run dev
```

The dashboard is available at [http://localhost:3000](http://localhost:3000) and the API at [http://localhost:4000](http://localhost:4000).

## Useful Commands

### Backend

```bash
npm run dev       # Start the API with watch mode
npm run build     # Compile TypeScript
npm run start     # Run the compiled API
```

### Frontend

```bash
npm run dev       # Start Next.js development mode
npm run lint      # Run ESLint
npm run build     # Create an optimized production build
npm run start     # Serve the production build
```

### SDKs

The SDKs have their own installation and usage documentation:

- [JavaScript SDK](sdk/js/README.md)
- [Python SDK](sdk/python/README.md)
- [VPS agent](sdk/vps-agent/README.md)

Build the JavaScript SDK from `sdk/js` with `npm install && npm run build`. Install the Python SDK locally from `sdk/python` with `pip install .`.

## Configuration and Security

The backend supports cloud provider credentials, OAuth providers, JWT authentication, email notifications, AI observability, and infrastructure runners. Review `backend/src/config/env.ts` for the complete configuration surface.

Never commit `.env` files, cloud credentials, private keys, API keys, JWT secrets, or generated Terraform state. The repository-level [`.gitignore`](.gitignore) excludes these files and common build artifacts.

## Contributing

Keep changes scoped to the relevant workspace, run the applicable build or lint command before opening a pull request, and update the corresponding SDK or API documentation when public behavior changes.
