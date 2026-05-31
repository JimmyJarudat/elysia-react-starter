import CryptoJS from 'crypto-js';

// กำหนด secret key (ต้องตรงกับ Frontend)
const ENCRYPTION_KEY = process.env.ENCRYPTION_SECRET || '';
if(!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_SECRET is required');
}

/**
 * เข้ารหัสข้อมูล
 * @param {string} text - ข้อความที่ต้องการเข้ารหัส
 * @returns {string} - ข้อความที่เข้ารหัสแล้ว (Base64)
 */
export const encryptText = (text: string): string => {
    try {
        if (!text || typeof text !== 'string') {
            throw new Error('Input must be a non-empty string');
        }
        
        // console.log('🔐 Backend: Encrypting text length:', text.length);
        const encrypted = CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
        // console.log('✅ Backend: Encryption successful');
        return encrypted;
    } catch (error) {
        console.error('❌ Backend: Encryption failed:', error);
        throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * ถอดรหัสข้อมูล
 * @param {string} encryptedText - ข้อความที่เข้ารหัสแล้ว
 * @returns {string} - ข้อความที่ถอดรหัสแล้ว
 */
export const decryptText = (encryptedText: string): string => {
    try {
        if (!encryptedText || typeof encryptedText !== 'string') {
            throw new Error('Encrypted text must be a non-empty string');
        }
        
        // console.log('🔓 Backend: Decrypting text...');
        const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        
        if (!decrypted) {
            throw new Error('Decryption failed - invalid key or corrupted data');
        }
        
        // console.log('✅ Backend: Decryption successful, length:', decrypted.length);
        return decrypted;
    } catch (error) {
        console.error('❌ Backend: Decryption failed:', error);
        throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * ทดสอบการเข้ารหัสและถอดรหัส
 * @param {string} testText - ข้อความทดสอบ
 * @returns {boolean} - ผลการทดสอบ
 */
export const testEncryption = (testText: string = "ทดสอบภาษาไทย ABC 123"): boolean => {
    try {
        console.log('🧪 Backend: Testing encryption with:', testText);
        
        const encrypted = encryptText(testText);
        console.log('Encrypted result:', encrypted);
        
        const decrypted = decryptText(encrypted);
        console.log('Decrypted result:', decrypted);
        
        const isMatch = testText === decrypted;
        console.log('Test result:', isMatch ? '✅ PASS' : '❌ FAIL');
        
        return isMatch;
    } catch (error) {
        console.error('🚨 Backend: Test failed:', error);
        return false;
    }
};