import express from "express";
import { ObjectId } from "mongodb";
import verifyToken, { sameUser } from "../middleware/verifyToken.js";

const router = express.Router();

// Must match the options in your Create/Update Event dropdown
const EVENT_TYPES = [
  "Cleanup",
  "Plantation",
  "Donation",
  "Winter Relief",
  "Food Drive",
  "Health Camp",
  "Education",
];

const getCollections = (req) => {
  const db = req.app.locals.db;
  return {
    eventsCollection: db.collection("events"),
    registrationsCollection: db.collection("registrations"),
  };
};

const startOfToday = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const isHttpUrl = (value) => {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

// Shared validation for create and update
function validateEvent(body) {
  const errors = [];
  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "").trim();
  const location = String(body.location ?? "").trim();
  const eventType = String(body.eventType ?? "").trim();
  const thumbnail = String(body.thumbnail ?? "").trim();
  const eventDate = new Date(body.eventDate);

  if (title.length < 3 || title.length > 100)
    errors.push("Title must be between 3 and 100 characters");
  if (description.length < 10 || description.length > 2000)
    errors.push("Description must be between 10 and 2000 characters");
  if (location.length < 3 || location.length > 150)
    errors.push("Location must be between 3 and 150 characters");
  if (!EVENT_TYPES.includes(eventType)) errors.push("Invalid event type");
  if (!isHttpUrl(thumbnail)) errors.push("Thumbnail must be a valid URL");

  if (Number.isNaN(eventDate.getTime())) {
    errors.push("Event date is invalid");
  } else {
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 5);
    if (eventDate < startOfToday())
      errors.push("Event date must be in the future");
    else if (eventDate > maxDate)
      errors.push("Event date cannot be more than 5 years ahead");
  }

  return {
    errors,
    data: { title, description, location, eventType, thumbnail, eventDate },
  };
}

// ---------- PUBLIC ROUTES ----------

// GET /api/events - all upcoming events
router.get("/", async (req, res) => {
  try {
    const { eventsCollection } = getCollections(req);
    const events = await eventsCollection
      .find({ eventDate: { $gte: startOfToday() } })
      .sort({ eventDate: 1 })
      .toArray();
    res.status(200).json(events);
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ message: "Failed to fetch events" });
  }
});

// GET /api/events/recent-upcoming - 6 nearest upcoming events
router.get("/recent-upcoming", async (req, res) => {
  try {
    const { eventsCollection } = getCollections(req);
    const events = await eventsCollection
      .find({ eventDate: { $gte: startOfToday() } })
      .sort({ eventDate: 1 })
      .limit(6)
      .toArray();
    res.status(200).json(events);
  } catch (error) {
    console.error("Error fetching recent events:", error);
    res.status(500).json({ message: "Failed to fetch recent events" });
  }
});

// ---------- PRIVATE READ ROUTES ----------

// GET /api/events/organizer/:email - events created by the logged-in user
router.get("/organizer/:email", verifyToken, sameUser, async (req, res) => {
  try {
    const { eventsCollection } = getCollections(req);
    const myEvents = await eventsCollection
      .find({ organizerEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();
    res.status(200).json(myEvents);
  } catch (error) {
    console.error("Error fetching organizer events:", error);
    res.status(500).json({ message: "Failed to fetch organizer events" });
  }
});

// GET /api/events/joined/:email - events joined by the logged-in user.
// Event data is looked up live, so edits and attendee lists stay current.
router.get("/joined/:email", verifyToken, sameUser, async (req, res) => {
  try {
    const { registrationsCollection } = getCollections(req);
    const joined = await registrationsCollection
      .aggregate([
        { $match: { userEmail: req.user.email } },
        {
          $addFields: {
            eventObjectId: {
              $convert: { input: "$eventId", to: "objectId", onError: null },
            },
          },
        },
        {
          $lookup: {
            from: "events",
            localField: "eventObjectId",
            foreignField: "_id",
            as: "eventDetails",
          },
        },
        { $unwind: "$eventDetails" },
        { $project: { eventObjectId: 0 } },
        { $sort: { "eventDetails.eventDate": 1 } },
      ])
      .toArray();
    res.status(200).json(joined);
  } catch (error) {
    console.error("Error fetching joined events:", error);
    res.status(500).json({ message: "Failed to fetch joined events" });
  }
});

// ---------- PRIVATE WRITE ROUTES ----------

// POST /api/events/join - the user comes from the token, not the body
router.post("/join", verifyToken, async (req, res) => {
  try {
    const { eventId } = req.body;
    if (!eventId || !ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    const { registrationsCollection, eventsCollection } = getCollections(req);

    const event = await eventsCollection.findOne({
      _id: new ObjectId(eventId),
    });
    if (!event) return res.status(404).json({ message: "Event not found" });

    if (new Date(event.eventDate) < startOfToday()) {
      return res
        .status(400)
        .json({ message: "This event has already taken place" });
    }

    const userEmail = req.user.email;
    const existing = await registrationsCollection.findOne({
      eventId,
      userEmail,
    });
    if (existing) {
      return res
        .status(400)
        .json({ message: "You have already joined this event" });
    }

    try {
      await registrationsCollection.insertOne({
        eventId,
        userEmail,
        userName: req.user.name || req.body.userName || "",
        joinedAt: new Date(),
      });
    } catch (err) {
      // Unique index hit: two fast clicks
      if (err.code === 11000) {
        return res
          .status(400)
          .json({ message: "You have already joined this event" });
      }
      throw err;
    }

    await eventsCollection.updateOne(
      { _id: new ObjectId(eventId) },
      { $addToSet: { attendees: userEmail } },
    );

    res.status(201).json({ message: "Successfully registered for event" });
  } catch (error) {
    console.error("Error joining event:", error);
    res.status(500).json({ message: "Failed to join event" });
  }
});

// POST /api/events/leave
router.post("/leave", verifyToken, async (req, res) => {
  try {
    const { eventId } = req.body;
    if (!eventId || !ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    const { registrationsCollection, eventsCollection } = getCollections(req);
    const userEmail = req.user.email;

    const result = await registrationsCollection.deleteOne({
      eventId,
      userEmail,
    });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Registration record not found" });
    }

    await eventsCollection.updateOne(
      { _id: new ObjectId(eventId) },
      { $pull: { attendees: userEmail } },
    );

    res.status(200).json({ message: "Successfully left the event" });
  } catch (error) {
    console.error("Error leaving event:", error);
    res.status(500).json({ message: "Failed to cancel registration" });
  }
});

// POST /api/events - create (organizer comes from the token)
router.post("/", verifyToken, async (req, res) => {
  try {
    const { errors, data } = validateEvent(req.body);
    if (errors.length) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const newEvent = {
      ...data,
      organizerEmail: req.user.email,
      organizerName: req.user.name || req.body.organizerName || "",
      organizerImage: req.user.image || req.body.organizerImage || "",
      attendees: [],
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

// POST /api/events/sync-profile - keep organizer name/photo on my events up to date
router.post("/sync-profile", verifyToken, async (req, res) => {
  try {
    const name = String(req.body.name ?? "").trim();
    const image = String(req.body.image ?? "").trim();

    if (name.length < 2 || name.length > 50) {
      return res
        .status(400)
        .json({ message: "Name must be between 2 and 50 characters" });
    }
    if (image && !isHttpUrl(image)) {
      return res.status(400).json({ message: "Photo must be a valid URL" });
    }

    const { eventsCollection, registrationsCollection } = getCollections(req);

    // The user is identified by the token, so only their own events change
    const result = await eventsCollection.updateMany(
      { organizerEmail: req.user.email },
      { $set: { organizerName: name, organizerImage: image } },
    );
    await registrationsCollection.updateMany(
      { userEmail: req.user.email },
      { $set: { userName: name } },
    );

    res
      .status(200)
      .json({ message: "Profile synced", updated: result.modifiedCount });
  } catch (error) {
    console.error("Error syncing profile:", error);
    res.status(500).json({ message: "Failed to sync profile" });
  }
});

// ---------- /:id ROUTES ----------

// GET /api/events/:id - public event details
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid event ID format" });
    }
    const { eventsCollection } = getCollections(req);
    const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.status(200).json(event);
  } catch (error) {
    console.error("Error fetching event details:", error);
    res.status(500).json({ message: "Failed to fetch event details" });
  }
});

// PUT /api/events/:id - update (creator only)
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid event ID format" });
    }

    const { eventsCollection } = getCollections(req);
    const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (event.organizerEmail !== req.user.email) {
      return res
        .status(403)
        .json({ message: "You can only update your own events" });
    }

    // If the form doesn't send a thumbnail, keep the existing one
    const body = { ...req.body };
    if (body.thumbnail === undefined || body.thumbnail === "") {
      body.thumbnail = event.thumbnail;
    }

    const { errors, data } = validateEvent(body);
    if (errors.length) {
      return res.status(400).json({ message: errors[0], errors });
    }

    await eventsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...data, updatedAt: new Date() } },
    );

    res.status(200).json({ message: "Event updated successfully" });
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({ message: "Failed to update event" });
  }
});

// DELETE /api/events/:id - delete (creator only)
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid event ID format" });
    }

    const { eventsCollection, registrationsCollection } = getCollections(req);
    const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (event.organizerEmail !== req.user.email) {
      return res
        .status(403)
        .json({ message: "You can only delete your own events" });
    }

    await eventsCollection.deleteOne({ _id: new ObjectId(id) });
    await registrationsCollection.deleteMany({ eventId: id });

    res.status(200).json({ message: "Event deleted successfully" });
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({ message: "Failed to delete event" });
  }
});

export default router;
