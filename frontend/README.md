# Cloudcam Frontend

The web dashboard and user interface for the **Cloudcam** cloud operations, infrastructure simulation, and AI observability platform. Built with Next.js (App Router), React, TypeScript, and Tailwind CSS.

## Features

- **Cloud Infrastructure Monitoring**: Real-time visualization and metrics for AWS, Azure, and GCP resources.
- **AI Observability**: Detailed tracing, token usage, latency tracking, and cost analytics for LLM applications.
- **Infrastructure Simulation & Canvas**: Visual topology design and Terraform code generation.
- **Alerting & Watchdog**: Incident management, automated rule evaluation, and notification routing.
- **VPS Logs & Agent Telemetry**: Live stream viewer and metrics aggregation.

## Getting Started

### Prerequisites

- Node.js 20 or newer
- npm

### Installation

```bash
cd frontend
npm install
```

### Environment Configuration

Create a `.env.local` or `.env` file in the `frontend` directory using `.env.example` as a template:

```bash
cp .env.example .env.local
```

Configure your environment variables:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_APP_ENV=development
```

> **Security Note**: Never commit actual API keys, secrets, or credential tokens to version control. Keep `.env` and `.env.local` files gitignored.

### Development Server

Start the local development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to view the application.

## Available Scripts

- `npm run dev` - Starts the Next.js development server with hot reload.
- `npm run build` - Creates an optimized production build.
- `npm run start` - Starts the Next.js production server.
- `npm run lint` - Runs ESLint to inspect code quality.

## Architecture

- **`src/app/`**: Next.js App Router pages and layouts.
- **`src/modules/`**: Modular feature components (AI Observability, Simulation, Settings, VPS Logs, Watchdog, etc.).
- **`src/components/`**: Reusable UI components and design system elements.
- **`src/lib/`**: Utility functions, API clients, and application state stores.

