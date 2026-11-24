export class DatabaseInitializationError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'DatabaseInitializationError';
  }
}

export class DatabaseRecoveryRequiredError extends DatabaseInitializationError {
  constructor(cause: Error) {
    super('Your local records are still here, but their profile is missing (DB-VERIFY). Recover the records and set up your profile again.', cause);
    this.name = 'DatabaseRecoveryRequiredError';
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

