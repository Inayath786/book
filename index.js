const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const client = require("./db/redisClient");
const rateLimit = require('express-rate-limit'); // Redis client file

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // ⏱️ 15 minutes
  max: 100, // 💥 Limit each IP to 100 requests per `window`
  message: "⚠️ Too many requests from this IP. Please try again after 15 minutes.",
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit headers
});

app.use(limiter);

// MongoDB (Replica Set) Connection
mongoose.connect(
  "mongodb://localhost:27017/bookstore",
  { useNewUrlParser: true, useUnifiedTopology: true }
).then(() => {
  console.log("✅ MongoDB replica set connected");
}).catch((err) => {
  console.error("❌ MongoDB connection error:", err.message);
});




// ----------------------
// Mongoose Models
// ----------------------

// Admin Schema
const AdminSchema = new mongoose.Schema({
  name: String,
  phone: Number,
  email: String,
  password: String,
});
const Admin = mongoose.model("Admin", AdminSchema);

// Book Schema
const bookSchema = new mongoose.Schema({
  title: String,
  author: String,
  description: String,
  genre: String,
});

// Indexes
bookSchema.index({ genre: 1 });
bookSchema.index({ title: "text" });
bookSchema.index({ genre: 1, author: 1 });

const Book = mongoose.model("Book", bookSchema);

// ----------------------
// Routes
// ----------------------

// Add Admin
app.post("/api/admin", async (req, res) => {
  try {
    const { name, phone, email, password } = req.body;
    const newAdmin = new Admin({ name, phone, email, password });
    const savedAdmin = await newAdmin.save();
    res.status(200).json({ message: "Data added successfully", data: savedAdmin });
  } catch (err) {
    console.error("Admin insert error:", err);
    res.status(500).json({ message: "Error occurred while submitting data" });
  }
});
app.get("/api/books/:genre", async (req, res) => {
  const genre = req.params.genre.trim();
  const cacheKey = genre.toLowerCase();

  try {
    const cachedData = await client.get(cacheKey); // wait for Redis

    if (cachedData) {
      console.log("✅ Served from Redis");
      return res.json({ books: JSON.parse(cachedData) });
    }

    const books = await Book.find({
      genre: { $regex: `^${genre}$`, $options: "i" }
    });

    if (books.length === 0) {
      return res.status(404).json({ message: "No books found", books: [] });
    }

    await client.setEx(cacheKey, 3600, JSON.stringify(books)); // cache the result
    res.json({ books });

  } catch (err) {
    console.error("❌ Error in /api/books/:genre route:", err);
    res.status(500).json({ message: "Server error" });
  }
});



// Search Books (title, author, description, genre)
app.get("/api/books/search", async (req, res) => {
  const query = req.query.query;

  if (!query) {
    return res.status(400).json({ message: "Query is required" });
  }

  try {
    const books = await Book.find({
      $or: [
        { title: { $regex: query, $options: "i" } },
        { author: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
        { genre: { $regex: query, $options: "i" } },
      ],
    });

    res.json({ books });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Test route to check MongoDB
app.get("/api/test", async (req, res) => {
  try {
    const books = await Book.find();
    res.json({ count: books.length, books });
  } catch (err) {
    res.status(500).json({ message: "Test failed", error: err.message });
  }
});

app.get("/health", (req, res) => {
  res.send(`✅ Server running on PORT ${process.env.PORT || 5000}`);
});

// ----------------------
// Start Server
// ----------------------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
