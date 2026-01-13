const jwt = require("jsonwebtoken");
const AppError = require("../utils/appError");
const RequestContext = require("../utils/requestContext");
require("dotenv").config();

const authenticate = (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return next(
      new AppError("Authentication token missing. Please log in.", 401)
    );
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Sync to RequestContext
    const context = RequestContext.get();
    if (context) {
      context.userId = decoded.id;
    }

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(
        new AppError("Your token has expired! Please log in again.", 401)
      );
    }
    return next(
      new AppError("Invalid or corrupted token. Please log in again.", 401)
    );
  }
};

module.exports = authenticate;
