FROM node:18-alpine AS build-ui

WORKDIR /build

COPY ./ui/v1/package.json .

RUN npm install

COPY ./ui/v1/ .

RUN npm run build


FROM golang:1.24-alpine AS build-go

# Install make
RUN apk add  --no-cache make

ARG VERSION
ENV APP_VERSION=${VERSION}

WORKDIR /build

COPY go.mod ./
COPY go.sum ./
RUN go mod download

COPY . .
RUN rm -rf ui/v1
COPY --from=build-ui /build/dist ./ui/v1/dist

RUN CGO_ENABLED=0 \
    go build \
      -ldflags="-X main.Version=${APP_VERSION}" \
      -o bin/jucosuma-linux-amd64 \
      ./cmd/web

FROM alpine:3.22 AS run

ARG DEFAULT_ADDR=":8080"
ARG DEFAULT_DB_PATH="./data/jucosuma.db"
ARG DEFAULT_UPLOADS_DIR="./uploads"

WORKDIR /app
COPY --from=build-go /build/bin/jucosuma-linux-amd64 ./jucosuma

ENV ADDR=${DEFAULT_ADDR}
ENV DB_PATH=${DEFAULT_DB_PATH}
ENV UPLOADS_DIR=${DEFAULT_UPLOADS_DIR}

# Entrypoint-Skript einfügen
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/app/entrypoint.sh"]
CMD []
