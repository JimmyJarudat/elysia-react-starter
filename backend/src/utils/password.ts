// common/password.ts  
import bcrypt from 'bcryptjs';

export class PasswordUtil {
  static async hash(password: string): Promise<string> {
    return await bcrypt.hash(password, 10);
  }

  static async compare(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  static validate(password: string): { isValid: boolean; message?: string } {
    if (password.length < 8) {
      return { isValid: false, message: "Password must be at least 8 characters" };
    }
    return { isValid: true };
  }
}