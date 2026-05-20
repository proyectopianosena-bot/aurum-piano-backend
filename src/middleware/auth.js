const jwt = require("jsonwebtoken");

function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, error: "No autorizado." });
  }

  try {
    const token = header.slice(7);
    req.user = jwt.verify(token, process.env.JWT_SECRET || "aurum_dev_secret");
    next();
  } catch {
    return res.status(401).json({ ok: false, error: "Sesión inválida o expirada." });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ ok: false, error: "Acceso denegado." });
    }
    next();
  };
}

module.exports = { authRequired, requireRole };
