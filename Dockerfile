# ─────────────────────────────────────────────
# Stage 1: Build Frontend (Vite + Bun)
# ─────────────────────────────────────────────
FROM oven/bun:1-alpine AS frontend-builder

WORKDIR /frontend

COPY frontend/package.json frontend/bun.lock* ./
RUN bun install --frozen-lockfile

COPY frontend/ .
RUN rm -f .env.development .env.local .env*.local .env*.production
RUN bun run build


# ─────────────────────────────────────────────
# Stage 2: Build Backend (Elysia + Bun + Prisma)
# ─────────────────────────────────────────────
FROM oven/bun:1-alpine AS backend-builder

WORKDIR /backend

COPY backend/package.json backend/bun.lock* ./
COPY backend/patches ./patches
RUN bun install --frozen-lockfile

COPY backend/ .

# Generate Prisma Client สำหรับ linux-musl (Alpine)
RUN bunx prisma generate


# ─────────────────────────────────────────────
# Stage 3: Runner (nginx + bun)
# ─────────────────────────────────────────────
FROM oven/bun:1-alpine AS runner

# ติดตั้ง nginx + bash + openssl + gettext + tzdata + nodejs
# nodejs จำเป็นสำหรับ FTPS storage adapter (ftp-worker.mjs subprocess)
# เพราะ Bun เองมีบั๊ก TLS session resumption ที่ทำให้ FTPS ใช้งานไม่ได้
RUN apk add --no-cache nginx bash openssl gettext tzdata nodejs
ENV TZ=Asia/Bangkok

WORKDIR /app

# Copy frontend build → nginx serve
COPY --from=frontend-builder /frontend/dist /usr/share/nginx/html

# Copy backend
COPY --from=backend-builder /backend /app

# Copy nginx config และ entrypoint
COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]