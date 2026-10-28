

const jwt = require('jsonwebtoken');
const User = require('../models/User');

// exports.protect = async (req, res, next) => {
//   const authorization = req.headers.authorization;

//   if (!authorization?.startsWith('Bearer ')) {
//     return res.status(401).json({
//       success: false,
//       message: 'No token provided.',
//       code: 'TOKEN_MISSING',
//     });
//   }

//   const token = authorization.split(' ')[1];

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);

//     const user = await User.findById(decoded.id)
//       .select('-password');

//     if (!user) {
//       return res.status(401).json({
//         success: false,
//         message: 'User not found.',
//         code: 'USER_NOT_FOUND',
//       });
//     }

//     if (user.isActive === false) {
//       return res.status(403).json({
//         success: false,
//         message: 'User account is deactivated.',
//         code: 'USER_INACTIVE',
//       });
//     }

//     req.user = user;
//     req.token = token;
//     req.tokenDecoded = decoded;

//     next();

//   } catch (error) {
//     if (error.name === 'TokenExpiredError') {
//       return res.status(401).json({
//         success: false,
//         message: 'Token expired.',
//         code: 'TOKEN_EXPIRED',
//       });
//     }

//     if (error.name === 'JsonWebTokenError' ||
//         error.name === 'NotBeforeError') {
//       return res.status(401).json({
//         success: false,
//         message: 'Invalid token.',
//         code: 'TOKEN_INVALID',
//       });
//     }

//     console.error('Auth middleware error:', error);

//     return res.status(500).json({
//       success: false,
//       message: 'Authentication verification failed.',
//     });
//   }
// };

exports.protect = async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "No token provided.",
      code: "TOKEN_MISSING",
    });
  }

  const token = authorization.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found.",
        code: "USER_NOT_FOUND",
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "User account is deactivated.",
        code: "USER_INACTIVE",
      });
    }

    req.user = user;
    req.token = token;
    req.tokenDecoded = decoded;

    // JWT claims, including impersonation information
    req.auth = decoded;

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired.",
        code: "TOKEN_EXPIRED",
      });
    }

    if (
      error.name === "JsonWebTokenError" ||
      error.name === "NotBeforeError"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid token.",
        code: "TOKEN_INVALID",
      });
    }

    console.error("Auth middleware error:", error);

    return res.status(500).json({
      success: false,
      message: "Authentication verification failed.",
    });
  }
};

exports.checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied: Insufficient privileges.' });
    }
    next();
  };
};

exports.checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.user || !req.user.permissions.includes(requiredPermission)) {
      return res.status(403).json({ message: 'Access denied: Permission missing.' });
    }
    next();
  };
};


exports.blockImpersonationWrites = (req, res, next) => {
  if (req.auth?.impersonation === true) {
    return res.status(403).json({
      success: false,
      message: "Changes are disabled while viewing as another user",
      code: "IMPERSONATION_READ_ONLY",
    });
  }

  next();
};