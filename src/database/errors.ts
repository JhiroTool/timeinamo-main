export class DatabaseInitializationError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'DatabaseInitializationError';
  }
}

export class DatabaseOperationError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'DatabaseOperationError';
  }
}

export class AttendanceConflictError extends DatabaseOperationError {
  constructor(
    message = 'An attendance session already exists for this workday, or another session is active.',
    cause?: unknown,
  ) {
    super(message, cause);
    this.name = 'AttendanceConflictError';
  }
}

