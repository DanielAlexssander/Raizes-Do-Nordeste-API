function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  res.status(status).json({
    error: err.code || 'ERRO_INTERNO',
    message: err.message || 'Erro interno do servidor.',
    details: err.details || [],
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  });
}

class AppError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

module.exports = { errorHandler, AppError };
