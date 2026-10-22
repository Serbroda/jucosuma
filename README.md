# Jucosuma – Just a Contract and Subscription Manager

Jucosuma (**Ju**st a **Co**ntract and **Su**bscription **Ma**nager) started as a contract manager and has grown into a
self-hosted **household budget book**: plan income, costs, transfers and savings for a household, keep an eye on
contracts and cancellation deadlines, and compare plan and reality once a month.

It is a single Go binary with an embedded **React** frontend (Tailwind CSS) and a **SQLite** database.

---

## 🎯 Motivation

Jucosuma is heavily inspired by the excellent iOS app **“Contract”** by Benedikt Betz. While “Contract” offers a
beautiful native experience on iOS, I wanted a self-hostable, browser-based solution that multiple household members
can use without relying on proprietary app stores or individual devices.

Over time the question changed from *“which contracts do we have?”* to *“where does our money go each month?”* –
so Jucosuma now covers the whole household budget, with shared and private money, while keeping the clean contract
overview it started with.

---

## 🥋 The Sumo Story – Why a Sumo Wrestler Logo?

The name **Jucosuma** is an abbreviation of its functionality – but it also *sounds a lot like* **Yokozuna**, the
highest rank in professional sumo wrestling. This coincidence inspired the logo: a sumo wrestler sitting
cross-legged, holding a contract. It's a playful nod to the name similarity and gives the app a recognizable mascot.

---

## 📝 Features

**Planning**
- **Income, expenses and transfers** as recurring or one-off entries (weekly to every two years), with category,
  account, start and end date. Quick entry dialog for everyday use, full form for details.
- **Amount history** – an entry can change its amount from a date on (insurance increase, new grocery budget,
  pay rise). Every month is calculated with the amount valid then; past months stay correct.
- **Who pays, who carries** – expenses can be split between household members and external people (e.g. a family
  plan shared with friends). Only the household's share counts.
- **Earner** – income belongs to the person who earns it, independent of the account it is paid into.

**Overview**
- **Pots** – money belongs to the pot of its account: the shared household budget and one pot per person.
  The overview shows income → costs → savings → *available per month* for each pot or in total.
- **Charts** – costs by category (donut), money flow (Sankey), last six months.
- **Fixed vs. variable costs** – entries marked as contract are fixed costs, everything else is variable.

**Contracts & insurances**
- Contract overview with provider, contract number, documents, term, notice period and the computed
  **cancellation deadline**, plus upcoming deadlines on the dashboard.

**Savings**
- Savings goals with target amount and date, monthly rate from transfers, projected “reached on” date.
- Accounts can count as savings (overnight money, depots, a buffer account).
- Every transfer has a type – **saving**, **withdrawal** or **move** – suggested from the accounts and the goal,
  so it is visible what counts as savings rate and what only shifts money between accounts or pots.

**Monthly closing (plan vs. actual)**
- Once a month enter what you really spent on variable costs – optionally also the account balances.
- Plan vs. actual per category, and with balances per pot.
- **Last 12 months**: shares, actual vs. plan per month, trend and a suggested monthly budget per category.

**Reminders**
- Cancellation deadlines (30 and 7 days before), contracts running out, large non-monthly payments,
  planned amount changes, open monthly closings and – for admins – failed backups.
- Delivered to a personal **bell** in the app and to own channels: **ntfy** and **email**. Every person
  chooses per reminder and channel what they get; private entries only ever reach their owner.
- Channels are pluggable (`internal/notify`), so further kinds like browser push can be added.

**Household**
- Logins per person, admin and user roles, persons linked to logins.
- **Private entries** are only visible to their owner – also not to admins.
- Categories with colour and icon, accounts with owner, balance and an optional own icon.
- Icons from built-in symbols, an app logo search, an uploaded file or an image address – images from an address
  are downloaded by the server, checked to really be an image (PNG, JPEG, GIF, WebP) and stored with the entry.
- German and English, chosen per user; light and dark mode; works on phones.
- CSV/JSON export and import.

---

## 🔧 Installation

### Docker

Build the image:

```bash
make build-docker
```

Run it:

```bash
docker run --name jucosuma -d \
  -p 8080:8080 \
  -v /path/to/data:/app/data \
  -v /path/to/uploads:/app/uploads \
  jucosuma:latest
```

or with the included `docker-compose.yml`:

```bash
docker compose up -d
```

### From source

Prerequisites: Go 1.27+, Node.js 24 (LTS) and npm.

```bash
git clone https://github.com/Serbroda/jucosuma.git
cd jucosuma

# build the frontend (it is embedded into the Go binary)
cd ui/v1 && npm install && npm run build && cd ../..

# run
go run ./cmd/web
```

Then open <http://localhost:8080>.

`make build` builds the frontend and binaries for macOS, Linux and Windows into `bin/`.

### First login

On the first start with an empty database an **admin** user is created with a random password, written to
`admin_password.txt` in the working directory (in Docker: `docker exec jucosuma cat /app/admin_password.txt`).
You have to change it on the first login. Then create persons and logins for your household under
*Persons* and *Users*.

Database migrations run automatically on start-up.

---

## ⚙️ Configuration

Every setting can be passed as flag or environment variable.

| Flag            | Variable      | Description                 | Default       |
|-----------------|---------------|-----------------------------|---------------|
| `--addr`        | `ADDR`        | HTTP server address         | `:8080`       |
| `--db-path`     | `DB_PATH`     | SQLite database file        | `jucosuma.db` |
| `--uploads-dir` | `UPLOADS_DIR` | Directory for uploaded files| `./uploads`   |
| `--backup-dir`  | `BACKUP_DIR`  | Directory for daily database backups | `backups` next to the database |
| `--backup-keep` | `BACKUP_KEEP` | Number of backups to keep, `0` disables backups | `14` |

In the Docker image the database lives in `/app/data/jucosuma.db` and uploads in `/app/uploads`.

### Reminders

Reminders are checked every hour. Admins set up under *Settings → General*:

- **Address of the app** – used for links in ntfy messages and emails.
- **ntfy server** – default for channels without their own server (`https://ntfy.sh` if empty).
- **SMTP** – server, port, encryption, login and sender; required before anybody can add an email channel.

Every person then adds channels and picks what they want under *Settings → Notifications*.

### Backups

Jucosuma writes a backup of the database once a day (`backups/jucosuma-YYYY-MM-DD-HHMMSS.db`, in Docker
`/app/data/backups`, or the directory in `BACKUP_DIR`) and keeps the newest 14. The copy is consistent even while
the app is running. A daily backup is only written if the data changed since the last one, so a longer break
does not push older states out of the retention.
Admins can switch backups on and off, change how many are kept and create a backup right away under
*Settings → General*; these settings override `--backup-keep`/`BACKUP_KEEP`.
Backups contain all entries, including private ones, and are only readable by the owner of the file.

To restore, stop the app, replace the database file with a backup and start it again:

```bash
docker stop jucosuma
cp /path/to/data/backups/jucosuma-2026-10-22-030000.db /path/to/data/jucosuma.db
docker start jucosuma
```

Uploaded documents are not part of the database backup – back up the uploads directory as well.

---

## 🛠️ Development

| Part      | Stack                                                                  |
|-----------|------------------------------------------------------------------------|
| Backend   | Go, echo, SQLite, goose migrations, sqlc                               |
| Frontend  | React 19, React Router, Tailwind CSS 4, Catalyst UI, zustand, i18next  |
| Glue      | tygo generates the TypeScript types from the Go DTOs                   |

Run backend and frontend dev server side by side:

```bash
go run ./cmd/web                 # API on :8080
cd ui/v1 && npm run dev          # frontend with hot reload, talks to :8080 (see ui/v1/.env)
```

Code generation after changing SQL queries or DTOs:

```bash
go generate ./...                # sqlc (internal/db/sqlc) and TypeScript types (ui)
```

Tests and checks:

```bash
make test                        # Go tests and the frontend calculation tests (vitest)
cd ui/v1 && npx tsc -b && npx eslint src
```

Useful scripts:

- `scripts/seed-demo.py` – fills an empty instance with a complete demo household (see the script header).
- `scripts/pull-db.sh` – replaces the local `jucosuma.db` with a copy from the server (keeps a backup).

Planned work is tracked in [ROADMAP.md](ROADMAP.md).

---

## 🤝 Contributing

Contributions are welcome:

1. Open an issue – feature request or bug
2. Fork the repository & create a branch
3. Submit a pull request with a clear description

---

## 📄 License

Jucosuma is released under the **MIT License**. See [LICENSE](LICENSE) for details.
