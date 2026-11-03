import express from "express";
import { MongoClient } from "mongodb";
import cors from "cors";
import "dotenv/config";
import eventRoutes from "./routes/eventRoutes.js";

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    const db = client.db("communitycare");
    app.use("/api/events", eventRoutes(db));
    return client;
  } catch (err) {
    console.dir(err);
  }
}

connectToMongoDB();

// Routes
app.get("/", (req, res) =>
  res.send({ message: "CommunityCare API is running" }),
);

// Start the server
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));
