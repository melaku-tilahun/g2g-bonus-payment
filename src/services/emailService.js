const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const EmailService = {
  sendOTP: async (to, otp) => {
    const mailOptions = {
      from: `"G2G BonusTracker" <${process.env.EMAIL_FROM}>`,
      to,
      subject: "Your Login OTP - G2G BonusTracker",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #4f46e5; text-align: center;">G2G BonusTracker</h2>
          <p>Hello,</p>
          <p>You requested a login to the G2G Bonus Tracking system. Please use the following One-Time Password (OTP) to complete your sign-in:</p>
          <div style="font-size: 32px; font-weight: bold; text-align: center; padding: 20px; background-color: #f3f4f6; border-radius: 8px; margin: 20px 0; color: #111827;">
            ${otp}
          </div>
          <p style="color: #6b7280; font-size: 14px;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">© 2025 Yango Ride Service Provider - G2G Bonus Management Solution</p>
        </div>
      `,
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log("OTP Email sent:", info.messageId);
      return true;
    } catch (error) {
      console.error("Error sending OTP email:", error);
      return false;
    }
  },

  sendReport: async (recipients, reportName, filePath) => {
    const mailOptions = {
      from: `"G2G BonusTracker" <${process.env.EMAIL_FROM}>`,
      to: recipients.join(", "),
      subject: `Scheduled Report: ${reportName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #4f46e5; text-align: center;">Scheduled Report Delivery</h2>
          <p>Hello,</p>
          <p>The following scheduled report has been generated and is attached to this email:</p>
          <div style="padding: 15px; background-color: #f3f4f6; border-radius: 8px; margin: 20px 0;">
            <strong>Report Name:</strong> ${reportName}<br>
            <strong>Generated On:</strong> ${new Date().toLocaleString()}
          </div>
          <p style="color: #6b7280; font-size: 14px;">Please find the attached file for the full report details.</p>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">© 2025 Yango Ride Service Provider - G2G Bonus Management Solution</p>
        </div>
      `,
      attachments: [
        {
          filename: path.basename(filePath),
          path: filePath,
        },
      ],
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`Report Email sent (${reportName}):`, info.messageId);
      return true;
    } catch (error) {
      console.error(`Error sending report email (${reportName}):`, error);
      return false;
    }
  },
};

module.exports = EmailService;
