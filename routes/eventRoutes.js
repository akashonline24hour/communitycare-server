import express from "express";
import { ObjectId } from "mongodb";
import { jwtVerify } from "jose";

export default function eventRoutes(db) {
  const router = express.Router();
  const eventsCollection = db.collection("events");
  const joinedEventsCollection = db.collection("joinedEvents");

  // Middleware to verify JWT token from headers
  const verifyJWT = async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized access: No token provided" });
      }
      const token = authHeader.split(" ")[1];
      const secret = new TextEncoder().encode(process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET);
      
      const { payload } = await jwtVerify(token, secret);
      req.user = payload;
      next();
    } catch (err) {
      return res.status(403).json({ error: "Forbidden: Invalid or expired token" });
    }
  };

  // 1. GET: 6 Recent Upcoming Events (for Home Page using .limit())[cite: 4]
  router.get("/recent-upcoming", async (req, res) => {
    try {
      const today = new Date();
      const recentEvents = await eventsCollection
        .find({ eventDate: { $gte: today.toISOString() } })
        .sort({ eventDate: 1 })
        .limit(6)
        .toArray();
      res.status(200).json(recentEvents);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch recent upcoming events" });
    }
  });

  // 2. GET: All Upcoming Events (filter out past dates)[cite: 5]
  router.get("/", async (req, res) => {
    try {
      const today = new Date();
      const events = await eventsCollection
        .find({ eventDate: { $gte: today.toISOString() } })
        .sort({ eventDate: 1 })
        .toArray();
      res.status(200).json(events);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  // 3. GET: Single Event Details by ID
  router.get("/:id", async (req, res) => {
    try {
      const id = req.params.id;
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid event ID format" });
      }
      const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
      if (!event) return res.status(404).json({ error: "Event not found" });
      res.status(200).json(event);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch event details" });
    }
  });

  // 4. POST: Create a New Event (Protected Route)[cite: 4, 7]
  router.post("/", verifyJWT, async (req, res) => {
    try {
      const { title, description, eventType, thumbnail, location, eventDate } = req.body;

      // Ensure date is in the future[cite: 5]
      if (new Date(eventDate) <= new Date()) {
        return res.status(400).json({ error: "Event date must be in the future" });
      }

      const newEvent = {
        title,
        description,
        eventType,
        thumbnail,
        location,
        eventDate,
        createdBy: req.user.email || req.user.id, // Track ownership[cite: 5]
        createdAt: new Date(),
      };

      const result = await eventsCollection.insertOne(newEvent);
      res.status(201).json({ message: "Event created successfully", insertedId: result.insertedId });
    } catch (err) {
      res.status(400).json({ error: "Failed to create event" });
    }
  });

  // 5. PUT: Update an Event (Protected - Creator Only)[cite: 6, 7]
  router.put("/:id", verifyJWT, async (req, res) => {
    try {
      const id = req.params.id;
      if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid event ID" });

      const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
      if (!event) return res.status(404).json({ error: "Event not found" });

      // Validate ownership[cite: 6]
      const userIdentifier = req.user.email || req.user.id;
      if (event.createdBy !== userIdentifier) {
        return res.status(403).json({ error: "Unauthorized: You can only update your own events" });
      }

      const { title, description, eventType, thumbnail, location, eventDate } = req.body;
      const updatedData = {
        ...(title && { title }),
        ...(description && { description }),
        ...(eventType && { eventType }),
        ...(thumbnail && { thumbnail }),
        ...(location && { location }),
        ...(eventDate && { eventDate }),
      };

      await eventsCollection.updateOne({ _id: new ObjectId(id) }, { $set: updatedData });
      res.status(200).json({ message: "Event updated successfully" });
    } catch (err) {
      res.status(500).json({ error: "Failed to update event" });
    }
  });

  // 6. DELETE: Delete an Event (Protected - Creator Only)[cite: 6, 7]
  router.delete("/:id", verifyJWT, async (req, res) => {
    try {
      const id = req.params.id;
      if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid event ID" });

      const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
      if (!event) return res.status(404).json({ error: "Event not found" });

      const userIdentifier = req.user.email || req.user.id;
      if (event.createdBy !== userIdentifier) {
        return res.status(403).json({ error: "Unauthorized: You can only delete your own events" });
      }

      await eventsCollection.deleteOne({ _id: new ObjectId(id) });
      await joinedEventsCollection.deleteMany({ eventId: id });

      res.status(200).json({ message: "Event deleted successfully" });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete event" });
    }
  });

  // 7. POST: Join an Event (Protected Route)[cite: 5, 7]
  router.post("/join", verifyJWT, async (req, res) => {
    try {
      const { eventId } = req.body;
      const userEmail = req.user.email || req.user.id;

      const existingJoin = await joinedEventsCollection.findOne({ eventId, userEmail });
      if (existingJoin) {
        return res.status(400).json({ error: "You have already joined this event" });
      }

      await joinedEventsCollection.insertOne({
        eventId,
        userEmail,
        joinedAt: new Date(),
      });

      res.status(201).json({ message: "Successfully joined the event!" });
    } catch (err) {
      res.status(500).json({ error: "Failed to join event" });
    }
  });

  // 8. GET: Get Events Created by Logged-in User (Manage Events Page)[cite: 6]
  router.get("/user/created", verifyJWT, async (req, res) => {
    try {
      const userIdentifier = req.user.email || req.user.id;
      const events = await eventsCollection
        .find({ createdBy: userIdentifier })
        .sort({ eventDate: 1 })
        .toArray();
      res.status(200).json(events);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch user events" });
    }
  });

  // 9. GET: Get Events Joined by Logged-in User (Sorted by Event Date)[cite: 6]
  router.get("/user/joined", verifyJWT, async (req, res) => {
    try {
      const userEmail = req.user.email || req.user.id;
      const joinedRecords = await joinedEventsCollection.find({ userEmail }).toArray();
      const eventIds = joinedRecords.map((r) => new ObjectId(r.eventId));

      if (eventIds.length === 0) {
        return res.status(200).json([]);
      }

      const events = await eventsCollection
        .find({ _id: { $in: eventIds } })
        .sort({ eventDate: 1 })
        .toArray();

      res.status(200).json(events);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch joined events" });
    }
  });

  return router;
}