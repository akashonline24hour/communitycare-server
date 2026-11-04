# ⚙️ CommunityCare Server (Backend API)

> Express.js & MongoDB REST API server providing authentication, user management, and event organization endpoints for the **CommunityCare** platform.

---

## 🌐 Live Application & Repositories

| Resource | Description | URL |
| :--- | :--- | :--- |
| 🚀 **Live Application** | Production Deployment | `https://communitycare-client.vercel.app` |
| 💻 **Frontend Repo** | Client Source Code | `https://github.com/akashonline24hour/communitycare-client` |
| ⚙️ **Backend Repo** | Server API Source Code | `https://github.com/akashonline24hour/communitycare-server` |

---

## 🛠️ Backend Tech Stack

* **Runtime Environment**: Node.js
* **Web Framework**: Express.js
* **Database System**: MongoDB (via native `mongodb` Node.js Driver with `ObjectId` validation)
* **Authentication**: Better-Auth (MongoDB Adapter & Social OAuth Integration)
* **Authorization & Security**: JSON Web Tokens (JWT) for secure route protection
* **Cross-Origin & Config**: `cors`, `dotenv`

---

## 🔌 REST API Endpoints

### **Public Endpoints**

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/events` | Fetch all active upcoming community events |
| `GET` | `/api/events/recent` | Fetch 6 recent upcoming events (`.limit(6)`) |
| `GET` | `/api/events/:id` | Fetch detailed information for a single event |

### **Protected Endpoints (JWT / Session Required)**

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/events` | Create a new community event initiative |
| `POST` | `/api/events/join` | Join an upcoming community drive |
| `POST` | `/api/events/leave` | Leave a joined community drive |
| `PUT` | `/api/events/:id` | Update event details (creator only) |
| `DELETE` | `/api/events/:id` | Delete an event (creator only) |
| `GET` | `/api/events/user/:email` | Get all events created by a specific user |
| `GET` | `/api/events/joined/:email` | Get all events joined by a specific user |

---