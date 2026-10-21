export abstract class SecretCipher {
  abstract encrypt(plaintext: string, context: string): Buffer;

  abstract decrypt(ciphertext: Buffer, context: string): string;
}
