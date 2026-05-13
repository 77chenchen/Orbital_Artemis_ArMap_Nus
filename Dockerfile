FROM node:22-alpine AS frontend
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM golang:1.26-alpine AS backend
WORKDIR /src/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/atlas-api ./cmd/server

FROM alpine:3.22
RUN apk add --no-cache ca-certificates sqlite
WORKDIR /app
COPY --from=backend /out/atlas-api /app/atlas-api
COPY --from=frontend /src/frontend/dist /app/static
ENV PORT=8080
ENV DB_PATH=/data/atlas.db
ENV STATIC_DIR=/app/static
EXPOSE 8080
VOLUME ["/data"]
CMD ["/app/atlas-api"]
