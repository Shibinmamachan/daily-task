import jwt from "jsonwebtoken";

export const signToken = (userId) => jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });

export function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Please log in to continue." });
  try {
    req.userId = jwt.verify(token, process.env.JWT_SECRET).sub;
    next();
  } catch {
    res.status(401).json({ error: "Your session expired. Please log in again." });
  }
}
