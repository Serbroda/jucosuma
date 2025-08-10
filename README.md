# Jucosuma – Just a Contract and Subscription Manager

Jucosuma (**Ju**st a **Co**ntract and **Su**bscription **Ma**nager) is a lightweight web application for creating, editing, and managing contracts and subscriptions.  
With a Go backend API, a modern **ReactJS** frontend styled with **Tailwind CSS**, Jucosuma delivers a fast and responsive workflow for contract and subscription management.

---

## 🎯 Motivation

Jucosuma is heavily inspired by the excellent iOS app **“Contract”** by Benedikt Betz. While “Contract” offers a beautiful native experience on iOS, I wanted a self-hostable, browser-based solution that multiple household members can access and use without relying on proprietary app stores or individual devices.  
Jucosuma brings the clean contract management concepts of the iOS app to the web, with collaboration in mind.

---

## 🥋 The Sumo Story – Why a Sumo Wrestler Logo?

The name **Jucosuma** is an abbreviation of its functionality – but it also *sounds a lot like* **Yokozuna**, the highest rank in professional sumo wrestling.  
This coincidence inspired the idea for the logo: a sumo wrestler sitting cross-legged, holding a contract. It's a playful nod to the name similarity and gives the app a unique, recognizable mascot.

---

## 📝 Features

- **Contract Management**  
  – Create, edit, and delete contracts  
- **Subscription Tracking**  
  – Monitor durations, costs, and statuses  
- **Icon Selection**  
  – Choose contract icons directly in the UI  
- **Fast & Responsive UI**  
  – Built with ReactJS and Tailwind CSS  
- **Go Backend API**  
  – Lightweight, efficient, self-hostable  

---

## 🔧 Installation

### Prerequisites

- Go 1.20+  
- Node.js 18+ & npm (for React build)  

### Local Setup

1. Clone the repository  
   ```bash
   git clone https://github.com/Serbroda/jucosuma.git
   cd jucosuma
   ```
2. Install Go modules  
   ```bash
   go mod tidy
   ```
3. Install frontend dependencies and build  
   ```bash
   cd ui/v1
   npm install
   npm run build
   cd ../..
   ```
4. Start the application  
   ```bash
   go run cmd/web/main.go
   ```
5. Open in your browser  
   ```
   http://localhost:8080
   ```

### Docker Setup

#### Build docker image

```bash
make docker-build
```

#### Start via docker

```bash
docker run --name jucosuma -d \
  -p 8080:8080 \
  -v /path/to/data:/app/data \
  -v /path/to/uploads:/app/uploads \
  jucosuma:latest
```

---

## 🚀 Usage

- **Create New Contracts:**  
  Click “Add Contract”, fill in the required fields, and choose an icon.  
- **Edit Existing Contracts:**  
  Click “Edit” next to an entry, update fields, and save.  
- **Track Subscriptions:**  
  Manage payment cycles, costs, and renewal dates.

---

## ⚙️ Configuration

| Variable     | Description                       | Example        |
|--------------|-----------------------------------|----------------|
| `DSN`        | SQLite Database connection string | `contracts.db` |
| `ADDR`       | HTTP server address               | `:8080`        |
| `UPLOADS_DIR`| Upload directory for files        | `./uploads`    |

---

## 🤝 Contributing

We welcome contributions:

1. Open an issue – feature request or bug  
2. Fork the repository & create a branch  
3. Submit a pull request with a clear description  

Please follow our [Code of Conduct](CODE_OF_CONDUCT.md) and commit conventions.

---

## 📄 License

Jucosuma is released under the **MIT License**. See [LICENSE](LICENSE) for details.
