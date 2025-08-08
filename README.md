# Jucoma – Just a Contract Manager

Jucosuma (**Ju**st a **Co**ntract and **Su**bscription **Ma**nager) is a lightweight web application for creating, editing, and managing contracts and subscriptions. With a Go backend API, HTMX dialogs for icon selection, and a responsive Tailwind CSS interface, Jucoma delivers a modern, dynamic workflow for contract and subscription management.

---

## 🎯 Motivation

Jucosuma is heavily inspired by the excellent iOS app **“Contract”** by Benedikt Betz. While “Contract” offers a beautiful native experience on iOS, I wanted a self-hostable, browser-based solution that multiple household members can access and use without relying on proprietary app stores or individual devices. Jucoma brings the clean contract management concepts of the iOS app to the web, with collaboration in mind.

---

## 📝 Features

- **Contract Management**  
  – Create, edit, and delete contracts  
- **Subscription Tracking**  
  – Monitor durations, costs, and statuses  
- **Icon Selection**  
  – Dynamic logo search via HTMX dialog  
- **Reactive UI**  
  – Partial renders without full page reloads  
- **Go + HTMX**  
  – Lightweight backend with minimal JavaScript  
- **Tailwind CSS**  
  – Fast, responsive design  

---

## 🔧 Installation

### Prerequisites

- Go 1.20+  
- Node.js 16+ & npm (for Tailwind build)  

### Local Setup

1. Clone the repository  
   ```bash
   git clone https://github.com/Serbroda/jucoma.git
   cd jucoma
   ```
2. Install Go modules  
   ```bash
   go mod tidy
   ```
3. Start the application  
   ```bash
   go run cmd/web/main.go
   ```
4. Open in your browser  
   ```
   http://localhost:8080
   ```

---

## 🚀 Usage

- **Create New Contracts:**  
  Click “Add Contract”, fill in the required fields, and choose an icon via the search dialog.  
- **Edit Existing Contracts:**  
  Click “Edit” next to an entry, update fields, and save with “Save”.  
- **Icon Search:**  
  Type a keyword in the dialog, HTMX loads icons after a debounce, and click to select.

---

## ⚙️ Configuration

| Variable | Description                       | Example        |
|----------|-----------------------------------|----------------|
| `DSN`    | SQLite Database connection string | `contracts.db` |
| `ADDR`   | HTTP server address               | `:8080`        |


---

## 🤝 Contributing

We welcome contributions:

1. Open an issue – feature request or bug  
2. Fork the repository & create a branch  
3. Submit a pull request with a clear description  

Please follow our [Code of Conduct](CODE_OF_CONDUCT.md) and commit conventions.

---

## 📄 License

Jucoma is released under the **MIT License**. See [LICENSE](LICENSE) for details.
