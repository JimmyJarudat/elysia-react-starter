// src/services/welcome-email.service.ts
import { EmailManager } from '@/config/smtp.config';
import { APP_NAME, APP_URL } from '@/config/app.config';

export interface WelcomeEmailData {
  username: string;
  email: string;
  temporary_password: string;
  role: string;
  created_at: string;
}

export class WelcomeEmailService {
  
  // ส่งอีเมลต้อนรับผู้ใช้ใหม่
  static async sendWelcomeEmail(userData: WelcomeEmailData): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      console.log('👋 [WELCOME] Sending welcome email to:', userData.email);
      
      const emailSubject = `🎉 ยินดีต้อนรับสู่ ${APP_NAME} - ${userData.username}`;
      const emailBody = this.generateWelcomeEmailTemplate(userData);
      
      const result = await this.sendEmail(
        userData.email,
        userData.username,
        emailSubject,
        emailBody
      );
      
      if (result.success) {
        console.log('✅ [WELCOME] Welcome email sent successfully');
      } else {
        console.error('❌ [WELCOME] Failed to send welcome email:', result.error);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ [WELCOME] Failed to send welcome email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // สร้าง HTML template สำหรับอีเมลต้อนรับ
  private static generateWelcomeEmailTemplate(userData: WelcomeEmailData): string {
    const loginUrl = `${APP_URL}/login`;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ยินดีต้อนรับ</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
    <!-- Container -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 20px 0;">
        <tr>
            <td align="center">
                <!-- Main Content Table -->
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; max-width: 600px;">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background-color: #667eea; padding: 40px 30px; text-align: center;">
                            <h1 style="margin: 0; font-size: 28px; color: #ffffff;">🎉 ยินดีต้อนรับ!</h1>
                            <p style="margin: 15px 0 0 0; color: #ffffff; font-size: 16px;">คุณได้รับสิทธิ์เข้าใช้งาน ${APP_NAME} แล้ว</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="margin: 0 0 20px 0; color: #333333; font-size: 15px; line-height: 1.8;">
                                สวัสดีครับ/ค่ะ คุณ <strong>${userData.username}</strong>
                            </p>
                            <p style="margin: 0 0 25px 0; color: #333333; font-size: 15px; line-height: 1.8;">
                                ยินดีต้อนรับเข้าสู่ระบบ <strong>${APP_NAME}</strong> บัญชีของคุณได้รับการอนุมัติและพร้อมใช้งานแล้ว
                            </p>
                            
                            <!-- Login Info Box -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8f9fa; border: 2px solid #667eea; margin: 25px 0;">
                                <tr>
                                    <td style="padding: 25px;">
                                        <h3 style="margin: 0 0 20px 0; color: #667eea; font-size: 18px; text-align: center;">🔐 ข้อมูลสำหรับเข้าสู่ระบบ</h3>
                                        
                                        <!-- Info Rows -->
                                        <table width="100%" cellpadding="10" cellspacing="0" border="0">
                                            <tr style="border-bottom: 1px solid #e9ecef;">
                                                <td style="color: #495057; font-size: 14px; padding: 12px 0;">
                                                    <strong>👤 ชื่อผู้ใช้:</strong>
                                                </td>
                                                <td style="color: #212529; font-size: 14px; text-align: right; padding: 12px 0;">
                                                    <strong style="background-color: #e9ecef; padding: 6px 12px; border-radius: 6px; font-family: 'Courier New', monospace;">${userData.username}</strong>
                                                </td>
                                            </tr>
                                            <tr style="border-bottom: 1px solid #e9ecef;">
                                                <td style="color: #495057; font-size: 14px; padding: 12px 0;">
                                                    <strong>🔑 รหัสผ่านเริ่มต้น:</strong>
                                                </td>
                                                <td style="color: #212529; font-size: 14px; text-align: right; padding: 12px 0;">
                                                    <strong style="background-color: #fff3cd; padding: 6px 12px; border-radius: 6px; font-family: 'Courier New', monospace; color: #856404;">${userData.temporary_password}</strong>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="color: #495057; font-size: 14px; padding: 12px 0;">
                                                    <strong>🎭 บทบาท:</strong>
                                                </td>
                                                <td style="color: #212529; font-size: 14px; text-align: right; padding: 12px 0;">
                                                    <span style="background-color: #e9ecef; padding: 6px 12px; border-radius: 6px; font-size: 13px;">${userData.role}</span>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Important Notice -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #d1ecf1; border: 2px solid #bee5eb; margin: 25px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0; color: #0c5460; font-size: 14px; line-height: 1.8;">
                                            <strong>ℹ️ ข้อมูลสำคัญ:</strong><br><br>
                                            • เมื่อเข้าสู่ระบบครั้งแรก ระบบจะ<strong>บังคับให้เปลี่ยนรหัสผ่าน</strong>ทันที<br>
                                            • กรุณาเก็บรหัสผ่านเริ่มต้นนี้ไว้เป็นความลับ<br>
                                            • สร้างรหัสผ่านใหม่ที่แข็งแกร่งและจดจำได้ง่าย<br>
                                            • ห้ามแชร์รหัสผ่านกับผู้อื่นเด็ดขาด
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Login Button -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="${loginUrl}" 
                                           style="display: inline-block; background-color: #667eea; color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 30px; font-weight: bold; font-size: 16px;">
                                            🚀 เข้าสู่ระบบทันที
                                        </a>
                                    </td>
                                </tr>
                                <tr>
                                    <td align="center" style="padding-top: 15px;">
                                        <p style="margin: 0; color: #6c757d; font-size: 12px;">
                                            หรือคัดลอก URL: <a href="${loginUrl}" style="color: #667eea; text-decoration: none;">${loginUrl}</a>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Getting Started -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0 0 0;">
                                <tr>
                                    <td style="border-top: 2px solid #e9ecef; padding-top: 25px;">
                                        <h4 style="margin: 0 0 15px 0; color: #667eea; font-size: 16px;">📚 เริ่มต้นใช้งาน</h4>
                                        <table width="100%" cellpadding="8" cellspacing="0" border="0">
                                            <tr>
                                                <td style="vertical-align: top; width: 30px; color: #667eea; font-weight: bold; font-size: 16px;">
                                                    1.
                                                </td>
                                                <td style="color: #495057; font-size: 13px; line-height: 1.6;">
                                                    <strong>เข้าสู่ระบบ</strong> ด้วยชื่อผู้ใช้และรหัสผ่านเริ่มต้นที่ได้รับ
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="vertical-align: top; color: #667eea; font-weight: bold; font-size: 16px;">
                                                    2.
                                                </td>
                                                <td style="color: #495057; font-size: 13px; line-height: 1.6;">
                                                    <strong>เปลี่ยนรหัสผ่าน</strong> เป็นรหัสผ่านใหม่ที่คุณต้องการ
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="vertical-align: top; color: #667eea; font-weight: bold; font-size: 16px;">
                                                    3.
                                                </td>
                                                <td style="color: #495057; font-size: 13px; line-height: 1.6;">
                                                    <strong>เริ่มใช้งาน</strong> ระบบ ${APP_NAME} ได้เลย!
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 25px 30px; text-align: center;">
                            <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 13px;">
                                หากมีคำถามหรือปัญหาในการใช้งาน<br>
                                กรุณาติดต่อทีม IT Support
                            </p>
                            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
                            <p style="margin: 0; color: #999999; font-size: 11px;">
                                © ${new Date().getFullYear()} ${APP_NAME}<br>
                                อีเมลนี้ส่งอัตโนมัติจากระบบ กรุณาอย่าตอบกลับ<br>
                                ส่งเมื่อ ${userData.created_at}
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
  }

  // ✅ ฟังก์ชันส่งอีเมล - ใช้ EmailManager แทน transporter
  private static async sendEmail(
    to: string, 
    recipientName: string, 
    subject: string, 
    htmlContent: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      console.log(`📧 [WELCOME_EMAIL] Preparing to send email to: ${to}`);
      console.log(`📧 [WELCOME_EMAIL] Subject: ${subject}`);

      // ✅ ใช้ EmailManager แทน transporter โดยตรง
      const mailOptions = {
        to: to,
        subject: subject,
        html: htmlContent,
        text: `ยินดีต้อนรับสู่ ${APP_NAME} - ${recipientName}`
      };

      console.log('📤 [WELCOME_EMAIL] Sending via EmailManager...');
      const success = await EmailManager.sendMail(mailOptions);
      
      if (success) {
        console.log(`✅ [WELCOME_EMAIL] Email sent successfully to ${to}`);
        return {
          success: true,
          messageId: 'sent-via-email-manager'
        };
      } else {
        console.error(`❌ [WELCOME_EMAIL] Failed to send email to ${to}`);
        return {
          success: false,
          error: 'EmailManager.sendMail returned false'
        };
      }
      
    } catch (error: any) {
      console.error(`❌ [WELCOME_EMAIL] Failed to send email to ${to}`);
      console.error(`❌ [WELCOME_EMAIL] Error:`, error);
      console.error(`❌ [WELCOME_EMAIL] Error message:`, error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }
}