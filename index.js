import express from "express";
import { MongoClient } from "mongodb";
import cors from "cors";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
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

app.get("/api/health", (req, res) => {
  res.send({ Message: "API is healthy" });
});

// Start the server
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));
