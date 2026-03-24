module.exports = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role))
    return res.status(403).json({ error: `Access restricted to: ${roles.join(', ')}` });
  next();
};
