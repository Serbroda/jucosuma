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

RUN apk update

WORKDIR /app

COPY --from=build-go /build/bin/jucosuma-linux-amd64 ./jucomo

EXPOSE 8080

CMD ["/app/jucomo"]
