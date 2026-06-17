# Feature Flag Lite

A lightweight feature flag backend API built with TypeScript and Express. Supports creating, listing, updating, and evaluating feature flags with deterministic percentage rollout, user allowlists, and clear evaluation reasons.

Built as a clean, production-style portfolio project demonstrating layered architecture, property-based testing, and CI/CD best practices.

## Features

- CRUD operations for feature flags
- Deterministic percentage rollout using SHA-256 hashing
- User allowlists for targeted flag access
- Clear evaluation reasons in every response
- Consistent JSON error handling
- Property-based testing with fast-check
- Docker support with multi-stage builds
- GitHub Actions CI pipeline

## Tech Stack

- **Runtime**: Node.js 20 + TypeScript
- **Framework**: Express
- **Testing**: Jest, fast-check, supertest
- **Containerization**: Docker
- **CI**: GitHub Actions

## Prerequisites

- Node.js 20+
- npm 9+
- Docker (optional, for containerized runs)

## Getting Started

```bash
# Clone the repository
git clone https://github.com/your-username/feature-flag-lite.git
cd feature-flag-lite

# Install dependencies
npm install

# Start in development mode
npm run dev

# Build for production
npm run build
npm start
```

The server starts on port 3000 by default. Set the `PORT` environment variable to change it.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /flags | Create a new feature flag |
| GET | /flags | List all feature flags |
| GET | /flags/:key | Get a feature flag by key |
| PATCH | /flags/:key | Partially update a feature flag |
| GET | /flags/:key/evaluate?userId=user-123 | Evaluate a flag for a user |

## API Examples

### Create a flag

```bash
curl -X POST http://localhost:3000/flags \
  -H "Content-Type: application/json" \
  -d '{
    "flagKey": "dark-mode",
    "enabled": true,
    "allowlist": ["user-1", "user-2"],
    "rolloutPercentage": 50
  }'
```

**Response** (201):
```json
{
  "flagKey": "dark-mode",
  "enabled": true,
  "allowlist": ["user-1", "user-2"],
  "rolloutPercentage": 50
}
```

### List all flags

```bash
curl http://localhost:3000/flags
```

**Response** (200):
```json
[
  {
    "flagKey": "dark-mode",
    "enabled": true,
    "allowlist": ["user-1", "user-2"],
    "rolloutPercentage": 50
  }
]
```

### Get a flag by key

```bash
curl http://localhost:3000/flags/dark-mode
```

**Response** (200):
```json
{
  "flagKey": "dark-mode",
  "enabled": true,
  "allowlist": ["user-1", "user-2"],
  "rolloutPercentage": 50
}
```

### Update a flag

```bash
curl -X PATCH http://localhost:3000/flags/dark-mode \
  -H "Content-Type: application/json" \
  -d '{
    "rolloutPercentage": 75
  }'
```

**Response** (200):
```json
{
  "flagKey": "dark-mode",
  "enabled": true,
  "allowlist": ["user-1", "user-2"],
  "rolloutPercentage": 75
}
```

### Evaluate a flag

```bash
curl "http://localhost:3000/flags/dark-mode/evaluate?userId=user-123"
```

**Response** (200):
```json
{
  "result": true,
  "reason": "user_in_percentage_rollout"
}
```

## Evaluation Logic

Flags are evaluated in strict priority order:

1. **Disabled** → If the flag is disabled, return `false` with reason `flag_disabled`
2. **Allowlist** → If the user is in the allowlist, return `true` with reason `user_allowlisted`
3. **Percentage rollout** →
   - 100% → `true` with reason `full_rollout`
   - 0% → `false` with reason `not_in_rollout`
   - 1-99% → Deterministic hash of `flagKey + userId` decides inclusion

The percentage rollout is deterministic: the same user always gets the same result for a given flag, regardless of when or how many times the evaluation runs.

## Testing

```bash
# Run all tests
npm test

# Unit tests only
npm run test:unit

# Property-based tests only
npm run test:prop

# Integration tests only
npm run test:int

# Tests with coverage
npm run test:coverage
```

## Docker

```bash
# Build the image
docker build -t feature-flag-lite .

# Run the container
docker run -p 3000:3000 feature-flag-lite

# Run with a custom port
docker run -e PORT=8080 -p 8080:8080 feature-flag-lite
```

## Project Structure

```
src/
├── controllers/     # HTTP request handling and validation
├── services/        # Business logic and flag evaluation
├── repositories/    # Data access layer (in-memory for MVP)
├── routes/          # Express route definitions
├── middleware/      # Error handling, not-found handler
├── types/           # TypeScript interfaces and error classes
├── utils/           # Hash utility for deterministic rollout
├── app.ts           # Express app configuration
└── server.ts        # Server entry point
tests/
├── unit/            # Unit tests for service and hash logic
├── property/        # Property-based tests (fast-check)
└── integration/     # HTTP endpoint tests (supertest)
docs/
├── system-design.md # Architecture and evaluation flow
└── tradeoffs.md     # Design decisions and alternatives
```

## Error Responses

All errors follow a consistent format:

```json
{
  "error": "Human-readable error message"
}
```

| Status | Meaning |
|--------|---------|
| 400 | Validation error or malformed request |
| 404 | Flag not found or route not found |
| 409 | Flag key already exists |
| 500 | Internal server error |

## License

MIT
