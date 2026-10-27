
import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import User from "../models/User.js";
import { requireAuth, signToken } from "../middleware/auth.js";

const router = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many attempts. Please try again in a few minutes.",
  },
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const strs = (...values) =>
  values.every((value) => typeof value === "string");

// REGISTER
router.post("/register", limiter, async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (
      !strs(name, email, password) ||
      !name.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        error: "Name, email and password are required.",
      });
    }

    if (!EMAIL.test(email.trim())) {
      return res.status(400).json({
        error: "Enter a valid email address.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters.",
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: cleanEmail });

    if (existingUser) {
      return res.status(409).json({
        error: "An account with this email already exists. Please log in.",
      });
    }

    const user = new User({
      name: name.trim(),
      email: cleanEmail,
      passwordHash: await bcrypt.hash(password, 12),
      verified: true,
    });

    await user.save();

    const token = signToken(user.id);

    return res.status(201).json({
      message: "Registration successful. You can now use your account.",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);

    return res.status(500).json({
      error: "Could not create the account. Please try again.",
    });
  }
});

// LOGIN
router.post("/login", limiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!strs(email, password)) {
      return res.status(400).json({
        error: "Email and password are required.",
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({
        error: "Invalid email or password.",
      });
    }

    const token = signToken(user.id);

    return res.json({
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      error: "Login failed. Please try again.",
    });
  }
});

// CURRENT USER
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select(
      "name email verified"
    );

    if (!user) {
      return res.status(401).json({
        error: "Please log in again.",
      });
    }

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Profile error:", error);

    return res.status(500).json({
      error: "Could not load your profile.",
    });
  }
});

export default router;
