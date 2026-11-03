import express from "express";
import { ObjectId } from "mongodb";

const router = express.Router();

// Helper function to inject database connection from app
const getCollections = (req) => {
  const db = req.app.locals.db;
  return {
    eventsCollection: db.collection("events"),
    registrationsCollection: db.collection("registrations"),
  };
};

// 1. GET /events - Fetch all upcoming events (sorted by date ascending)
router.get("/", async (req, res) => {
  try {
    const { eventsCollection } = getCollections(req);
    const events = await eventsCollection
      .find({})
      .sort({ eventDate: 1 })
      .toArray();

    res.status(200).json(events);
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ message: "Failed to fetch events" });
  }
});

// 2. GET /events/recent-upcoming - Fetch top 6 upcoming events for Homepage
router.get("/recent-upcoming", async (req, res) => {
  try {
    const { eventsCollection } = getCollections(req);
    const events = await eventsCollection
      .find({})
      .sort({ eventDate: 1 })
      .limit(6)
      .toArray();

    res.status(200).json(events);
  } catch (error) {
    console.error("Error fetching recent events:", error);
    res.status(500).json({ message: "Failed to fetch recent events" });
  }
});

// 3. GET /events/:id - Fetch single event by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid event ID format" });
    }

    const { eventsCollection } = getCollections(req);
    const event = await eventsCollection.findOne({ _id: new ObjectId(id) });

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    res.status(200).json(event);
  } catch (error) {
    console.error("Error fetching event details:", error);
    res.status(500).json({ message: "Failed to fetch event details" });
  }
});

// 4. POST /events - Create a new community event
router.post("/", async (req, res) => {
  try {
    const {
      title,
      description,
      location,
      eventDate,
      thumbnail,
      organizerEmail,
      organizerName,
    } = req.body;

    if (!title || !location || !eventDate || !organizerEmail) {
      return res.status(400).json({ message: "Missing required event fields" });
    }

    const newEvent = {
      title,
      description,
      location,
      eventDate: new Date(eventDate),
      thumbnail,
      organizerEmail,
      organizerName,
      createdAt: new Date(),
    };

    const { eventsCollection } = getCollections(req);
    const result = await eventsCollection.insertOne(newEvent);

    res.status(201).json({
      message: "Event created successfully",
      eventId: result.insertedId,
    });
  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({ message: "Failed to create event" });
  }
});

// 5. GET /events/organizer/:email - Fetch events created by specific user
router.get("/organizer/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const { eventsCollection } = getCollections(req);

    const myEvents = await eventsCollection
      .find({ organizerEmail: email })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(myEvents);
  } catch (error) {
    console.error("Error fetching organizer events:", error);
    res.status(500).json({ message: "Failed to fetch organizer events" });
  }
});

// 6. DELETE /events/:id - Delete an event by ID
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid event ID format" });
    }

    const { eventsCollection, registrationsCollection } = getCollections(req);

    // Remove event and any associated user registrations
    const deleteResult = await eventsCollection.deleteOne({
      _id: new ObjectId(id),
    });
    await registrationsCollection.deleteMany({ eventId: id });

    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({ message: "Event not found" });
    }

    res.status(200).json({ message: "Event deleted successfully" });
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({ message: "Failed to delete event" });
  }
});

// 7. POST /events/join - Join/Register for an event
router.post("/join", async (req, res) => {
  try {
    const { eventId, userEmail, userName } = req.body;

    if (!eventId || !userEmail) {
      return res
        .status(400)
        .json({ message: "Missing event ID or user email" });
    }

    const { registrationsCollection, eventsCollection } = getCollections(req);

    // Check if user already joined
    const existingRegistration = await registrationsCollection.findOne({
      eventId,
      userEmail,
    });

    if (existingRegistration) {
      return res
        .status(400)
        .json({ message: "You have already joined this event" });
    }

    // Fetch details to attach snapshot for quick retrieval
    const event = await eventsCollection.findOne({
      _id: new ObjectId(eventId),
    });
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const registration = {
      eventId,
      userEmail,
      userName,
      eventDetails: event,
      joinedAt: new Date(),
    };

    await registrationsCollection.insertOne(registration);

    res.status(201).json({ message: "Successfully registered for event" });
  } catch (error) {
    console.error("Error joining event:", error);
    res.status(500).json({ message: "Failed to join event" });
  }
});

// 8. GET /events/joined/:email - Fetch all events joined by user
router.get("/joined/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const { registrationsCollection } = getCollections(req);

    const joinedEvents = await registrationsCollection
      .find({ userEmail: email })
      .sort({ joinedAt: -1 })
      .toArray();

    res.status(200).json(joinedEvents);
  } catch (error) {
    console.error("Error fetching joined events:", error);
    res.status(500).json({ message: "Failed to fetch joined events" });
  }
});

// 9. POST /events/leave - Cancel user registration for an event
router.post("/leave", async (req, res) => {
  try {
    const { eventId, userEmail } = req.body;

    if (!eventId || !userEmail) {
      return res
        .status(400)
        .json({ message: "Missing event ID or user email" });
    }

    const { registrationsCollection } = getCollections(req);
    const result = await registrationsCollection.deleteOne({
      eventId,
      userEmail,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Registration record not found" });
    }

    res.status(200).json({ message: "Successfully left the event" });
  } catch (error) {
    console.error("Error leaving event:", error);
    res.status(500).json({ message: "Failed to cancel registration" });
  }
});

export default router;
