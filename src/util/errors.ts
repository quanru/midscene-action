export class ActionError extends Error {
  constructor(
    message: string,
    /** Hint shown under the message, e.g. a documentation link. */
    readonly hint?: string,
  ) {
    super(message);
    this.name = 'ActionError';
  }
}
