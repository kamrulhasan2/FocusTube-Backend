# FocusTube Backend

FocusTube is a distraction-free learning platform for YouTube playlists. It removes ads, recommendations, and algorithm noise so learners can focus on courses. The backend powers authentication, playlist enrollment, progress tracking, AI summaries, notes, and billing workflows for premium features.

This repository contains the production-grade API server that manages users, learning state, AI workflows, and integrations with external services such as YouTube, AI providers, and Stripe.

## Key Features

- **JWT-based authentication**: Secure access and refresh token flow for session management.
- **Playlist-based learning system**: Enroll users into playlists and organize learning content around courses.
- **Video progress tracking**: Persist completion state and timestamps per user and video.
- **Timestamped notes**: Attach notes to video timestamps for review and recall.
- **AI-powered summaries**: Generate structured summaries and key points from transcripts.
- **Transcript storage and retrieval**: Store and query transcripts for search and AI features.
- **Subscription billing with Stripe**: Checkout flows, plan handling, and webhook verification.
- **Pro feature access control**: Feature gating by plan or subscription status.
- **Rate limiting and security middleware**: Protect APIs from abuse and common attack patterns.
- **Structured logging**: Consistent logs for observability and debugging.

## Technology Stack

**Backend**

- Node.js
- Express.js
- TypeScript

**Database**

- MongoDB
- Mongoose

**Validation**

- Zod

**Authentication**

- JWT (access + refresh)
- bcrypt

**Testing**

- Vitest
- Supertest
- mongodb-memory-server

**External Integrations**

- YouTube Data API
- AI Provider (e.g., Gemini)
- Stripe

**Security**

- Helmet
- Rate limiting

**Logging**

- Winston

## Project Architecture

This project follows **Vertical Slice Architecture**. Each module encapsulates its own interface, model, validation, service, controller, and routes.

Example structure:

```text
src/
  modules/
    auth/
    user/
    playlist/
    video/
    library/
    note/
    ai/
    billing/

  shared/
    utils/
    middlewares/
    errors/
    constants/

  config/
  routes/
  test/
```

### Folder Responsibilities

- `src/modules/*`: Feature modules with isolated logic and routing
- `src/shared/`: Reusable utilities, middleware, and shared error handling
- `src/config/`: Environment and application configuration
- `src/routes/`: Route registration and API versioning
- `src/test/`: Integration and API tests

## API Overview

High-level API groups (not exhaustive):

**Authentication**

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

**Library & Learning**

- `POST /api/v1/library/enroll`
- `GET /api/v1/my-playlists`
- `PATCH /api/v1/progress/:videoId`

**Notes**

- `POST /api/v1/notes`
- `GET /api/v1/notes/video/:videoId`

**AI**

- `POST /api/v1/ai/summarize`
- `POST /api/v1/ai/chat`

**Billing**

- `GET /api/v1/billing/plans`
- `POST /api/v1/billing/checkout`
- `POST /api/v1/billing/webhook`

## Environment Variables

Create a `.env` file in the project root. The following variables are required:

| Variable                  | Description                               |
| ------------------------- | ----------------------------------------- |
| `PORT`                    | Port for the API server                   |
| `DATABASE_URL`            | MongoDB connection string                 |
| `JWT_SECRET`              | Secret for signing JWT access tokens      |
| `JWT_REFRESH_SECRET`      | Secret for signing JWT refresh tokens     |
| `JWT_ACCESS_EXPIRES_IN`   | Access token lifetime (e.g., `15m`)       |
| `JWT_REFRESH_EXPIRES_IN`  | Refresh token lifetime (e.g., `7d`)       |
| `YOUTUBE_API_KEY`         | YouTube Data API key                      |
| `AI_API_KEY`              | API key for AI provider (e.g., Gemini)    |
| `STRIPE_SECRET_KEY`       | Stripe secret key                         |
| `STRIPE_WEBHOOK_SECRET`   | Stripe webhook signing secret             |
| `RATE_LIMIT_MAX_REQUESTS` | Maximum requests per window               |
| `RATE_LIMIT_WINDOW_MS`    | Rate limit window in milliseconds         |
| `LOG_LEVEL`               | Logging verbosity (e.g., `info`, `debug`) |

## Installation Guide

1. Clone the repository

```bash
git clone https://github.com/kamrulhasan2/FocusTube-Backend.git
```

2. Install dependencies

```bash
npm install
```

3. Create a `.env` file

```bash
cp .env.example .env
```

4. Start the development server

```bash
npm run dev
```

## Development Scripts

| Script               | Description                  |
| -------------------- | ---------------------------- |
| `npm run dev`        | Start the development server |
| `npm run build`      | Build the project            |
| `npm run start`      | Start the production server  |
| `npm run test`       | Run all tests                |
| `npm run test:watch` | Run tests in watch mode      |
| `npm run lint`       | Run linting                  |

## Testing

The test suite is focused on integration testing of API flows.

- **Test runner**: Vitest
- **HTTP testing**: Supertest
- **Database**: mongodb-memory-server

Example structure:

```text
src/
  test/
    auth/
    playlist/
    notes/
    billing/
```

## Security Features

- **Rate limiting** to reduce abuse
- **Helmet** for secure HTTP headers
- **JWT authentication** with access + refresh tokens
- **Stripe webhook verification** for payment integrity
- **Zod input validation** for request safety
- **Structured logging** for security audits and debugging

## Future Improvements

- AI learning assistant with personalized study plans
- Course recommendation engine
- Multi-user team learning
- AI-powered note summarization
- Learning analytics dashboard

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "Add your feature"`
4. Push to your branch: `git push origin feature/your-feature`
5. Open a pull request

## License

MIT License.
