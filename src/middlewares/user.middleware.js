import jwt from "jsonwebtoken";

export async function isAuth(req, res, next) {
  try {
    let token;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }
    if (!token) {
      return res.status(401).json({ msg: "Unauthorized! Token not found" });
    }
    const decoded = jwt.verify(String(token), process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      console.error("Token expired at: ", error.expiredAt);
    } else if (error.name === "JsonWebTokenError") {
      console.error("Invalid JWT: ", error.message);
    } else {
      console.error("Unknown JWT error: ", error);
    }

    return res.status(403).json({
      msg: "Unauthorized! Invalid or expired token",
    });
  }
}
