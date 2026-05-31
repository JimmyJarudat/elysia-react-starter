// Helper functions
export function generateVerificationCode(length: number = 6): string {
    if (length === 6) {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
    
    const characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

// ตรวจสอบว่า email address ถูกต้องหรือไม่
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}