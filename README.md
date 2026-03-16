# ✨ Welcome to Your Spark Template

You've just launched your brand-new Spark Template Codespace — everything’s fired up and ready for you to explore, build, and create with Spark!

This template is your blank canvas. It comes with a minimal setup to help you get started quickly with Spark development.

🚀 What's Inside?

- A clean, minimal Spark environment
- Pre-configured for local development
- Ready to scale with your ideas

🧠 What Can You Do?

Right now, this is just a starting point — the perfect place to begin building and testing your Spark applications.

🧹 Just Exploring?
No problem! If you were just checking things out and don’t need to keep this code:

- Simply delete your Spark.
- Everything will be cleaned up — no traces left behind.

📄 License For Spark Template Resources

The Spark Template files and resources from GitHub are licensed under the terms of the MIT license, Copyright GitHub, Inc.

## Preview Test Data

This app supports preview-only fake data seeding for broad scenario testing.

### Enable seed data (safe mode)

Run the app with the URL query parameter:

- `?previewSeed=full`

Behavior:

- Seeds a deterministic dataset when core stores are empty
- Does not overwrite existing core data in the browser
- Includes users, trainers, sessions, courses, enrollments, certifications, wellness check-ins, recovery plans, templates, notifications, and risk history snapshots

### Force reseed (overwrite mode)

Use:

- `?previewSeed=force`

Behavior:

- Replaces existing stored data with the preview dataset
- Useful when you want to reset the app to a known testing baseline

### Optional environment toggle

You can also set:

- `VITE_PREVIEW_SEED=full`
- `VITE_PREVIEW_SEED=force`

The URL parameter takes precedence over env settings.
