const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const db = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/healthz", (req, res) => {
  res.status(200).json({ ok: true });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.post("/api/pastes", (req, res) => {
  const { content, ttl_seconds, max_views } = req.body;

  // 1. Validate content
  if (!content || typeof content !== "string" || content.trim() === "") {
    return res.status(400).json({ error: "Content is required" });
  }

  // 2. Validate ttl_seconds
  if (ttl_seconds !== undefined) {
    if (!Number.isInteger(ttl_seconds) || ttl_seconds < 1) {
      return res.status(400).json({ error: "ttl_seconds must be integer >= 1" });
    }
  }

  // 3. Validate max_views
  if (max_views !== undefined) {
    if (!Number.isInteger(max_views) || max_views < 1) {
      return res.status(400).json({ error: "max_views must be integer >= 1" });
    }
  }

  const id = uuidv4();
  const now = Date.now();

  // 4. Calculate expiry time
  const expiresAt = ttl_seconds ? now + ttl_seconds * 1000 : null;

  // 5. Insert into DB
  db.run(
    `INSERT INTO pastes (id, content, expires_at, max_views, views)
     VALUES (?, ?, ?, ?, 0)`,
    [id, content, expiresAt, max_views || null],
    (err) => {
      if (err) {
        return res.status(500).json({ error: "Database error" });
      }

      // 6. Return response
      res.status(201).json({
        id,
        url: `${req.protocol}://${req.get("host")}/p/${id}`
      });
    }
  );
});


app.get("/api/pastes/:id", (req, res) => {
  const { id } = req.params;

  db.get(`SELECT * FROM pastes WHERE id = ?`, [id], (err, paste) => {
    if (err || !paste) {
      return res.status(404).json({ error: "Paste not found" });
    }

    // Determine current time (test-friendly)
    const now = req.headers["x-test-now-ms"]
      ? Number(req.headers["x-test-now-ms"])
      : Date.now();

    // 1. Check TTL expiry
    if (paste.expires_at && now > paste.expires_at) {
      return res.status(404).json({ error: "Paste expired" });
    }

    // 2. Check view limit
    if (paste.max_views && paste.views >= paste.max_views) {
      return res.status(404).json({ error: "View limit exceeded" });
    }

    // 3. Increment views
    db.run(
      `UPDATE pastes SET views = views + 1 WHERE id = ?`,
      [id],
      (updateErr) => {
        if (updateErr) {
          return res.status(500).json({ error: "Failed to update views" });
        }

        const remainingViews = paste.max_views
          ? paste.max_views - paste.views - 1
          : null;

        res.status(200).json({
          content: paste.content,
          remaining_views: remainingViews,
          expires_at: paste.expires_at
            ? new Date(paste.expires_at).toISOString()
            : null
        });
      }
    );
  });
});


app.get("/p/:id", (req, res) => {
  const { id } = req.params;

  db.get(`SELECT * FROM pastes WHERE id = ?`, [id], (err, paste) => {
    if (err || !paste) {
      return res.status(404).send("Paste not found");
    }

    // Determine current time (test-friendly)
    const now = req.headers["x-test-now-ms"]
      ? Number(req.headers["x-test-now-ms"])
      : Date.now();

    // 1. Check TTL expiry
    if (paste.expires_at && now > paste.expires_at) {
      return res.status(404).send("Paste expired");
    }

    // 2. Check view limit
    if (paste.max_views && paste.views >= paste.max_views) {
      return res.status(404).send("View limit exceeded");
    }

    // 3. Increment views
    db.run(
      `UPDATE pastes SET views = views + 1 WHERE id = ?`,
      [id],
      (updateErr) => {
        if (updateErr) {
          return res.status(500).send("Failed to update views");
        }

        // 4. Render HTML safely
        const safeContent = paste.content
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

        res.status(200).send(`
          <html>
            <head>
              <title>Paste</title>
            </head>
            <body>
              <pre>${safeContent}</pre>
            </body>
          </html>
        `);
      }
    );
  });
});
