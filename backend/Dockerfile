# ==============================================================================
# MahaSetu Trusted Backend API Server — Production / Judge Dockerfile
# ==============================================================================
# Containerizes the MahaSetu Node.js Backend only (NOT the React Native app).
# External services (Firebase, Twilio, Gemini) are accessed over HTTPS at runtime.
# ==============================================================================

FROM node:22-alpine

WORKDIR /app

# Install dependencies using deterministic lockfile
COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci

# Copy backend source code
COPY backend ./backend

# Default backend configuration inside container
ENV HOST=0.0.0.0
ENV PORT=8000
ENV NODE_ENV=production

EXPOSE 8000

# Execute MahaSetu backend API server
CMD ["npm", "run", "backend"]
