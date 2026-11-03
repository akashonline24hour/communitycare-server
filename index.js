import express from "express";
import { MongoClient } from "mongodb";
import cors from "cors";
import "dotenv/config";
import eventRoutes from "./routes/events.js";

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);

async function startServer() {
  try {
    await client.connect();
    console.log("Connected successfully to MongoDB!");

    // Attach database connection globally to express app
    app.locals.db = client.db("communitycare");

    // Register routes
    app.use("/api/events", eventRoutes);

    app.get("/", (req, res) => {
      res.send({ message: "CommunityCare API is running" });
    });

    app.listen(port, () => console.log(`Server running on port ${port}`));
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  }
}

startServer();
