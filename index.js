import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) =>
  res.send({ message: "CommunityCare API is running" }),
);

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));
