# ⚙️ CommunityCare Server (Backend API)

> Express.js and MongoDB REST API for the **CommunityCare (Hermione Community Events)** platform. It stores events and registrations, and it protects private actions by verifying JWTs issued by the client app.

## 🌐 Live Application and Repositories

| Resource             | URL                                                       |
| :------------------- | :-------------------------------------------------------- |
| 🚀 Live Site         | https://communitycare-client.vercel.app                   |
| 💻 Client Repository | https://github.com/akashonline24hour/communitycare-client |
| ⚙️ Server Repository | https://github.com/akashonline24hour/communitycare-server |

---

## ✨ Key Features

- **🔐 JWT verification**: Private endpoints accept only a valid `Authorization: Bearer <token>`, checked against the public keys of the client app.
- **🛡️ Identity from the token**: The user's email always comes from the verified token, never from the request body, so users can only read and change their own data.
- **✅ Ownership rules**: Only the creator of an event can update or delete it.
- **📅 Upcoming events only**: Public lists exclude events whose date has passed, and the home route returns the six nearest events with `.limit(6)`.
- **🧾 Server-side validation**: Event fields, event types, the thumbnail URL and the date are validated on create and update, and past dates are rejected.
- **🚫 No duplicate joins**: A unique database index stops the same user from registering for the same event twice.

---

## 🛠️ Tech Stack

| Area               | Technology                        |
| :----------------- | :-------------------------------- |
| Runtime            | Node.js                           |
| Framework          | Express.js 5                      |
| Database           | MongoDB (native `mongodb` driver) |
| Token verification | `jose` (JWT and JWKS)             |
| Other              | `cors`, `dotenv`                  |
| Hosting            | Vercel                            |

---

## 🔑 How Authentication Works

1. Users sign up and log in on the client app, where Better Auth manages accounts and sessions.
2. For every private request, the client gets a short-lived JWT from Better Auth and sends it in the `Authorization` header.
3. This server downloads the public keys from `<AUTH_URL>/api/auth/jwks` and verifies the token's signature, issuer and audience.
4. The verified email is attached to the request (`req.user`) and used for every private action.

Missing or invalid tokens get `401`. Trying to read or change someone else's data gets `403`.

---

## 🔌 REST API Endpoints

Base path: `/api/events`

### Public

| Method | Endpoint                      | Description                                   |
| :----- | :---------------------------- | :-------------------------------------------- |
| `GET`  | `/api/events`                 | All upcoming events, sorted by date           |
| `GET`  | `/api/events/recent-upcoming` | The six nearest upcoming events (`.limit(6)`) |
| `GET`  | `/api/events/:id`             | Details of a single event                     |

### Protected (JWT required)

| Method   | Endpoint                       | Description                                                                                    |
| :------- | :----------------------------- | :--------------------------------------------------------------------------------------------- |
| `POST`   | `/api/events`                  | Create an event. The organizer comes from the token.                                           |
| `GET`    | `/api/events/organizer/:email` | Events created by you. The email must be your own.                                             |
| `GET`    | `/api/events/joined/:email`    | Events you joined, sorted by event date. The email must be your own.                           |
| `POST`   | `/api/events/join`             | Join an event. Body: `{ "eventId": "..." }`                                                    |
| `POST`   | `/api/events/leave`            | Leave an event. Body: `{ "eventId": "..." }`                                                   |
| `PUT`    | `/api/events/:id`              | Update an event (creator only)                                                                 |
| `DELETE` | `/api/events/:id`              | Delete an event and its registrations (creator only)                                           |
| `POST`   | `/api/events/sync-profile`     | Update your organizer name and photo on your events. Body: `{ "name": "...", "image": "..." }` |

### Validation rules (create and update)

| Field         | Rule                                                                                     |
| :------------ | :--------------------------------------------------------------------------------------- |
| `title`       | 3 to 100 characters                                                                      |
| `description` | 10 to 2000 characters                                                                    |
| `location`    | 3 to 150 characters                                                                      |
| `eventType`   | One of: Donation, Cleanup, Plantation, Winter Relief, Food Drive, Health Camp, Education |
| `thumbnail`   | A valid `http` or `https` URL                                                            |
| `eventDate`   | Today or later, and at most five years ahead                                             |

### Responses

| Status       | Meaning                                               |
| :----------- | :---------------------------------------------------- |
| `200`, `201` | Success                                               |
| `400`        | Invalid input (the response has a `message` field)    |
| `401`        | Missing or invalid token                              |
| `403`        | Not allowed, for example editing someone else's event |
| `404`        | Event or registration not found                       |
| `500`        | Server error                                          |

---

## 🗄️ Data

Database name: `communitycare`

- **`events`**: `title`, `description`, `location`, `eventType`, `thumbnail`, `eventDate`, `organizerEmail`, `organizerName`, `organizerImage`, `attendees` (list of emails), `createdAt`, `updatedAt`
- **`registrations`**: `eventId`, `userEmail`, `userName`, `joinedAt`, with a unique index on `eventId` and `userEmail`

Better Auth keeps its own user, session and key collections in the same database, created by the client app.

---

## 🚀 Getting Started Locally

### 1. Requirements

- Node.js 18 or newer
- A MongoDB database (a free MongoDB Atlas cluster works)
- The [client app](https://github.com/akashonline24hour/communitycare-client) running at `http://localhost:3000`, because this server reads its public keys

### 2. Clone and install

```bash
git clone https://github.com/akashonline24hour/communitycare-server.git
cd communitycare-server
npm install
```

### 3. Environment variables

Create a `.env` file in the project root. **Never commit this file.**

```env
# MongoDB connection string
MONGODB_URI=your_mongodb_connection_string

# URL of the client app. It must exactly match BETTER_AUTH_URL in the client,
# with no trailing slash.
AUTH_URL=http://localhost:3000

# Optional (defaults to 5000)
PORT=5000
```

### 4. Run

```bash
npm run dev   # development with auto-reload (nodemon)
npm start     # production
```

The API runs at `http://localhost:5000`.

### Quick check

```bash
curl http://localhost:5000/api/events/recent-upcoming   # returns a JSON list
curl http://localhost:5000/api/events/joined/a@b.com    # returns 401 without a token
```

---

## ☁️ Deployment (Vercel)

1. Import this repository into Vercel.
2. Add the environment variables `MONGODB_URI` and `AUTH_URL` (the live client URL, with no trailing slash).
3. Redeploy after any change to environment variables.
4. In the client project, set `NEXT_PUBLIC_API_URL` to this server's URL followed by `/api`.
5. If you add a custom domain for the client, add it to the allowed origins in `index.js`.

---

## 📁 Project Structure

```
├── index.js                  # App setup, CORS, cached database connection, error handlers
├── middleware/
│   └── verifyToken.js        # JWT verification and same-user check
└── routes/
    └── events.js             # Events and registration endpoints
```

---

## 👨‍💻 Author

Built by [akashonline24hour](https://github.com/akashonline24hour).
