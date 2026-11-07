import { createRemoteJWKSet, jwtVerify } from "jose";
import "dotenv/config";

let jwks;

export default async function verifyToken(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  console.log("Verifying token:", token);

  try {
    jwks ??= createRemoteJWKSet(
      new URL(`${process.env.AUTH_URL}/api/auth/jwks`),
    );

    const { payload } = await jwtVerify(token, jwks, {
      issuer: process.env.AUTH_URL,
      audience: process.env.AUTH_URL,
    });

    console.log("Token payload:", payload);

    if (!payload.email) throw new Error("Token has no email");

    req.user = {
      id: payload.id ?? payload.sub,
      email: payload.email,
      name: payload.name || "",
      image: payload.image || "",
    };
    next();
  } catch (err) {
    console.error("Token verification failed:", err.message);
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

// Allows access only when the :email in the URL is the logged-in user's own email
export const sameUser = (req, res, next) =>
  req.user.email.toLowerCase() === req.params.email.toLowerCase()
    ? next()
    : res.status(403).json({ message: "Forbidden" });
