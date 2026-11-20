export function sendError(res, status, code, message) {
  return res.status(status).json({
    error: { code, message },
  });
}

export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}