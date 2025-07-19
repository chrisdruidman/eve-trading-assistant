import nodemailer from 'nodemailer';
import { Notification } from '../../../shared/src/types';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendNotification(
    notification: Notification,
    recipientEmail: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const template = this.getTemplate(notification);

      const mailOptions = {
        from: process.env.FROM_EMAIL || 'noreply@eve-trading-assistant.com',
        to: recipientEmail,
        subject: template.subject,
        text: template.text,
        html: template.html,
      };

      await this.transporter.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      console.error('Email sending failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendBatchNotifications(
    notifications: Notification[],
    recipientEmail: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const template = this.getBatchTemplate(notifications);

      const mailOptions = {
        from: process.env.FROM_EMAIL || 'noreply@eve-trading-assistant.com',
        to: recipientEmail,
        subject: template.subject,
        text: template.text,
        html: template.html,
      };

      await this.transporter.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      console.error('Batch email sending failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private getTemplate(notification: Notification): EmailTemplate {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    switch (notification.type) {
      case 'MARKET_ALERT':
        return {
          subject: `Market Alert: ${notification.title}`,
          text: `
${notification.title}

${notification.message}

View details: ${baseUrl}/notifications/${notification.id}

---
EVE Trading Assistant
          `.trim(),
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2c3e50;">Market Alert</h2>
              <h3>${notification.title}</h3>
              <p>${notification.message}</p>
              <a href="${baseUrl}/notifications/${notification.id}" 
                 style="background-color: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                View Details
              </a>
              <hr style="margin: 20px 0;">
              <p style="color: #7f8c8d; font-size: 12px;">EVE Trading Assistant</p>
            </div>
          `,
        };

      case 'TRADING_OPPORTUNITY':
        return {
          subject: `Trading Opportunity: ${notification.title}`,
          text: `
${notification.title}

${notification.message}

View opportunity: ${baseUrl}/trading/opportunities

---
EVE Trading Assistant
          `.trim(),
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #27ae60;">Trading Opportunity</h2>
              <h3>${notification.title}</h3>
              <p>${notification.message}</p>
              <a href="${baseUrl}/trading/opportunities" 
                 style="background-color: #27ae60; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                View Opportunity
              </a>
              <hr style="margin: 20px 0;">
              <p style="color: #7f8c8d; font-size: 12px;">EVE Trading Assistant</p>
            </div>
          `,
        };

      case 'SYSTEM_UPDATE':
        return {
          subject: `System Update: ${notification.title}`,
          text: `
${notification.title}

${notification.message}

---
EVE Trading Assistant
          `.trim(),
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #f39c12;">System Update</h2>
              <h3>${notification.title}</h3>
              <p>${notification.message}</p>
              <hr style="margin: 20px 0;">
              <p style="color: #7f8c8d; font-size: 12px;">EVE Trading Assistant</p>
            </div>
          `,
        };

      case 'ACCOUNT_NOTICE':
        return {
          subject: `Account Notice: ${notification.title}`,
          text: `
${notification.title}

${notification.message}

Manage account: ${baseUrl}/account

---
EVE Trading Assistant
          `.trim(),
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #e74c3c;">Account Notice</h2>
              <h3>${notification.title}</h3>
              <p>${notification.message}</p>
              <a href="${baseUrl}/account" 
                 style="background-color: #e74c3c; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                Manage Account
              </a>
              <hr style="margin: 20px 0;">
              <p style="color: #7f8c8d; font-size: 12px;">EVE Trading Assistant</p>
            </div>
          `,
        };

      default:
        return {
          subject: notification.title,
          text: `
${notification.title}

${notification.message}

---
EVE Trading Assistant
          `.trim(),
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h3>${notification.title}</h3>
              <p>${notification.message}</p>
              <hr style="margin: 20px 0;">
              <p style="color: #7f8c8d; font-size: 12px;">EVE Trading Assistant</p>
            </div>
          `,
        };
    }
  }

  private getBatchTemplate(notifications: Notification[]): EmailTemplate {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const count = notifications.length;

    const textContent = notifications.map(n => `• ${n.title}: ${n.message}`).join('\n');

    const htmlContent = notifications
      .map(n => `<li><strong>${n.title}</strong>: ${n.message}</li>`)
      .join('');

    return {
      subject: `EVE Trading Assistant - ${count} New Notifications`,
      text: `
You have ${count} new notifications:

${textContent}

View all notifications: ${baseUrl}/notifications

---
EVE Trading Assistant
      `.trim(),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">You have ${count} new notifications</h2>
          <ul style="list-style-type: none; padding: 0;">
            ${htmlContent}
          </ul>
          <a href="${baseUrl}/notifications" 
             style="background-color: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            View All Notifications
          </a>
          <hr style="margin: 20px 0;">
          <p style="color: #7f8c8d; font-size: 12px;">EVE Trading Assistant</p>
        </div>
      `,
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Email service connection test failed:', error);
      return false;
    }
  }
}
