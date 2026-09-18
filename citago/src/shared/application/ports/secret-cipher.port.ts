/**
 * Encrypts secrets that must be stored but never kept in plaintext, such as a
 * business's WhatsApp access token.
 *
 * `context` binds a ciphertext to the row it belongs to (e.g. the tenant id):
 * a ciphertext copied into another row fails to decrypt instead of silently
 * handing one business's token to another.
 */
export abstract class SecretCipher {
  abstract encrypt(plaintext: string, context: string): Buffer;

  /** Throws if the ciphertext was tampered with or belongs to another context. */
  abstract decrypt(ciphertext: Buffer, context: string): string;
}
