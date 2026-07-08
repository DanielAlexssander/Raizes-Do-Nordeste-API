const jwt = require('jsonwebtoken');

function autenticar(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'NAO_AUTENTICADO',
      message: 'Token não fornecido ou inválido.',
      details: [],
      timestamp: new Date().toISOString(),
      path: req.originalUrl
    });
  }
  try {
    const token = header.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload;
    next();
  } catch {
    return res.status(401).json({
      error: 'TOKEN_INVALIDO',
      message: 'Token expirado ou inválido.',
      details: [],
      timestamp: new Date().toISOString(),
      path: req.originalUrl
    });
  }
}

function autorizar(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.role)) {
      return res.status(403).json({
        error: 'SEM_PERMISSAO',
        message: 'Você não tem permissão para acessar este recurso.',
        details: [],
        timestamp: new Date().toISOString(),
        path: req.originalUrl
      });
    }
    next();
  };
}

module.exports = { autenticar, autorizar };
