package com.rslsolution.speakmateai.service.email;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

import java.time.Year;

/**
 * Service for generating rich, responsive, branded HTML email templates
 * and fallback plain-text messages for SpeakMate AI notifications.
 */
@Service
public class EmailTemplateService {

    @Value("${app.frontend.url:https://speak-mate-ai-nine.vercel.app}")
    private String frontendUrl;

    public String getLoginUrl() {
        String base = (frontendUrl != null && !frontendUrl.isBlank()) ? frontendUrl.trim() : "https://speak-mate-ai-nine.vercel.app";
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return base + "/login";
    }

    public String getTeacherLoginUrl() {
        String base = (frontendUrl != null && !frontendUrl.isBlank()) ? frontendUrl.trim() : "https://speak-mate-ai-nine.vercel.app";
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return base + "/teacher/login";
    }

    public String getSchoolAdminLoginUrl() {
        String base = (frontendUrl != null && !frontendUrl.isBlank()) ? frontendUrl.trim() : "https://speak-mate-ai-nine.vercel.app";
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return base + "/school-admin/login";
    }

    /**
     * Builds a rich Brevo HTML email for a newly registered Student.
     */
    public String buildStudentWelcomeEmailHtml(
            String studentName,
            String email,
            String rawPassword,
            String schoolName,
            String schoolCode,
            String standard,
            String division,
            String rollNumber,
            String assignedTeacher) {

        String safeStudentName = safeHtml(studentName, "Student");
        String safeEmail = safeHtml(email, "");
        String safePassword = safeHtml(rawPassword, "");
        String safeSchoolName = safeHtml(schoolName, "SpeakMate AI Partner School");
        String safeSchoolCode = safeHtml(schoolCode, "N/A");
        String safeRollNumber = safeHtml(rollNumber, "N/A");
        String safeTeacher = safeHtml(assignedTeacher, "Assigned by School");
        String safeClass = safeHtml(
                (standard != null && !standard.isBlank()) ? "Standard " + standard + (division != null && !division.isBlank() ? " (" + division + ")" : "") : "N/A",
                "N/A"
        );
        String loginUrl = getLoginUrl();
        int currentYear = Year.now().getValue();

        return "<!DOCTYPE html>\n"
                + "<html lang='en'>\n"
                + "<head>\n"
                + "  <meta charset='UTF-8'>\n"
                + "  <meta name='viewport' content='width=device-width, initial-scale=1.0'>\n"
                + "  <title>Welcome to SpeakMate AI</title>\n"
                + "  <style>\n"
                + "    body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; }\n"
                + "    .wrapper { width: 100%; background-color: #f1f5f9; padding: 30px 12px; box-sizing: border-box; }\n"
                + "    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; }\n"
                + "    .header { background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 32px 24px; text-align: center; color: #ffffff; }\n"
                + "    .header h1 { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px; }\n"
                + "    .header p { margin: 6px 0 0 0; font-size: 14px; opacity: 0.9; letter-spacing: 0.2px; }\n"
                + "    .content { padding: 32px 28px; }\n"
                + "    .greeting { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 10px 0; }\n"
                + "    .lead-text { font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 22px 0; }\n"
                + "    .card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin-bottom: 22px; }\n"
                + "    .card-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.75px; color: #64748b; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }\n"
                + "    .info-table { width: 100%; border-collapse: collapse; }\n"
                + "    .info-table td { padding: 7px 0; font-size: 14px; vertical-align: top; }\n"
                + "    .info-label { width: 38%; color: #64748b; font-weight: 600; }\n"
                + "    .info-value { width: 62%; color: #0f172a; font-weight: 500; }\n"
                + "    .badge { display: inline-block; background-color: #e0e7ff; color: #3730a3; padding: 3px 8px; border-radius: 4px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 13px; font-weight: 600; }\n"
                + "    .credentials-box { background-color: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 18px 20px; margin: 22px 0; }\n"
                + "    .credential-row { margin: 10px 0; font-size: 14px; }\n"
                + "    .credential-label { font-weight: 600; color: #475569; display: inline-block; width: 110px; }\n"
                + "    .credential-pill { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 15px; font-weight: 700; color: #0f172a; background: #ffffff; border: 1px solid #cbd5e1; padding: 4px 10px; border-radius: 6px; display: inline-block; }\n"
                + "    .btn-container { text-align: center; margin: 30px 0 16px 0; }\n"
                + "    .btn { display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff !important; padding: 13px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; text-decoration: none; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25); }\n"
                + "    .notice { background-color: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #92400e; margin-top: 22px; line-height: 1.5; }\n"
                + "    .footer { background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; }\n"
                + "    .footer p { margin: 4px 0; }\n"
                + "  </style>\n"
                + "</head>\n"
                + "<body>\n"
                + "<div class='wrapper'>\n"
                + "  <div class='email-container'>\n"
                + "    <div class='header'>\n"
                + "      <h1>SpeakMate AI</h1>\n"
                + "      <p>Student Account Registration</p>\n"
                + "    </div>\n"
                + "    <div class='content'>\n"
                + "      <h2 class='greeting'>Hello " + safeStudentName + ",</h2>\n"
                + "      <p class='lead-text'>Your student account has been created by the Super Administrator on SpeakMate AI. Below are your school details and login credentials.</p>\n"
                + "      \n"
                + "      <div class='card'>\n"
                + "        <div class='card-title'>Academic & Institution Details</div>\n"
                + "        <table class='info-table'>\n"
                + "          <tr><td class='info-label'>School Name:</td><td class='info-value'><strong>" + safeSchoolName + "</strong></td></tr>\n"
                + "          <tr><td class='info-label'>School Code:</td><td class='info-value'><span class='badge'>" + safeSchoolCode + "</span></td></tr>\n"
                + "          <tr><td class='info-label'>Class / Division:</td><td class='info-value'>" + safeClass + "</td></tr>\n"
                + "          <tr><td class='info-label'>Roll Number:</td><td class='info-value'><strong>" + safeRollNumber + "</strong></td></tr>\n"
                + "          <tr><td class='info-label'>Teacher:</td><td class='info-value'>" + safeTeacher + "</td></tr>\n"
                + "        </table>\n"
                + "      </div>\n"
                + "      \n"
                + "      <div class='credentials-box'>\n"
                + "        <div class='card-title' style='color:#1e293b; border-bottom:1px solid #cbd5e1;'>Login Credentials</div>\n"
                + "        <div class='credential-row'>\n"
                + "          <span class='credential-label'>Email / ID:</span>\n"
                + "          <span class='credential-pill'>" + safeEmail + "</span>\n"
                + "        </div>\n"
                + "        <div class='credential-row'>\n"
                + "          <span class='credential-label'>Password:</span>\n"
                + "          <span class='credential-pill'>" + safePassword + "</span>\n"
                + "        </div>\n"
                + "      </div>\n"
                + "      \n"
                + "      <div class='btn-container'>\n"
                + "        <a href='" + loginUrl + "' class='btn'>Log In to SpeakMate AI</a>\n"
                + "      </div>\n"
                + "      \n"
                + "      <div class='notice'>\n"
                + "        <strong>Security Notice:</strong> Please keep your login credentials safe and update your password upon your first login.\n"
                + "      </div>\n"
                + "    </div>\n"
                + "    <div class='footer'>\n"
                + "      <p>SpeakMate AI &bull; AI-Powered Interactive English Learning</p>\n"
                + "      <p>&copy; " + currentYear + " SpeakMate AI. All rights reserved.</p>\n"
                + "    </div>\n"
                + "  </div>\n"
                + "</div>\n"
                + "</body>\n"
                + "</html>";
    }

    /**
     * Plain-text alternative for Student welcome email.
     */
    public String buildStudentWelcomeEmailText(
            String studentName,
            String email,
            String rawPassword,
            String schoolName,
            String schoolCode,
            String standard,
            String division,
            String rollNumber,
            String assignedTeacher) {

        String safeClass = (standard != null && !standard.isBlank()) ? "Standard " + standard + (division != null && !division.isBlank() ? " (" + division + ")" : "") : "N/A";
        String loginUrl = getLoginUrl();

        return "Hello " + (studentName != null && !studentName.isBlank() ? studentName : "Student") + ",\n\n"
                + "Your student account has been created on SpeakMate AI.\n\n"
                + "--- School & Academic Details ---\n"
                + "School Name:      " + (schoolName != null ? schoolName : "N/A") + "\n"
                + "School Code:      " + (schoolCode != null ? schoolCode : "N/A") + "\n"
                + "Class / Division: " + safeClass + "\n"
                + "Roll Number:      " + (rollNumber != null ? rollNumber : "N/A") + "\n"
                + "Teacher:          " + (assignedTeacher != null ? assignedTeacher : "Assigned by School") + "\n\n"
                + "--- Login Credentials ---\n"
                + "Portal URL: " + loginUrl + "\n"
                + "Email:      " + email + "\n"
                + "Password:   " + rawPassword + "\n\n"
                + "Security Notice: Please update your password upon your first login.\n\n"
                + "Best regards,\n"
                + "SpeakMate AI Team";
    }

    /**
     * Builds a rich Brevo HTML email for a newly registered Teacher.
     */
    public String buildTeacherWelcomeEmailHtml(
            String teacherName,
            String email,
            String rawPassword,
            String schoolName,
            String schoolCode,
            String department,
            String assignedClasses) {

        String safeTeacherName = safeHtml(teacherName, "Teacher");
        String safeEmail = safeHtml(email, "");
        String safePassword = safeHtml(rawPassword, "");
        String safeSchoolName = safeHtml(schoolName, "SpeakMate AI Partner School");
        String safeSchoolCode = safeHtml(schoolCode, "N/A");
        String safeDepartment = safeHtml(department, "General");
        String safeClasses = safeHtml(assignedClasses, "All Assigned Classes");
        String loginUrl = getTeacherLoginUrl();
        int currentYear = Year.now().getValue();

        return "<!DOCTYPE html>\n"
                + "<html lang='en'>\n"
                + "<head>\n"
                + "  <meta charset='UTF-8'>\n"
                + "  <meta name='viewport' content='width=device-width, initial-scale=1.0'>\n"
                + "  <title>Welcome to SpeakMate AI</title>\n"
                + "  <style>\n"
                + "    body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; }\n"
                + "    .wrapper { width: 100%; background-color: #f1f5f9; padding: 30px 12px; box-sizing: border-box; }\n"
                + "    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; }\n"
                + "    .header { background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 32px 24px; text-align: center; color: #ffffff; }\n"
                + "    .header h1 { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px; }\n"
                + "    .header p { margin: 6px 0 0 0; font-size: 14px; opacity: 0.9; letter-spacing: 0.2px; }\n"
                + "    .content { padding: 32px 28px; }\n"
                + "    .greeting { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 10px 0; }\n"
                + "    .lead-text { font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 22px 0; }\n"
                + "    .card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin-bottom: 22px; }\n"
                + "    .card-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.75px; color: #64748b; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }\n"
                + "    .info-table { width: 100%; border-collapse: collapse; }\n"
                + "    .info-table td { padding: 7px 0; font-size: 14px; vertical-align: top; }\n"
                + "    .info-label { width: 38%; color: #64748b; font-weight: 600; }\n"
                + "    .info-value { width: 62%; color: #0f172a; font-weight: 500; }\n"
                + "    .badge { display: inline-block; background-color: #e0e7ff; color: #3730a3; padding: 3px 8px; border-radius: 4px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 13px; font-weight: 600; }\n"
                + "    .credentials-box { background-color: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 18px 20px; margin: 22px 0; }\n"
                + "    .credential-row { margin: 10px 0; font-size: 14px; }\n"
                + "    .credential-label { font-weight: 600; color: #475569; display: inline-block; width: 110px; }\n"
                + "    .credential-pill { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 15px; font-weight: 700; color: #0f172a; background: #ffffff; border: 1px solid #cbd5e1; padding: 4px 10px; border-radius: 6px; display: inline-block; }\n"
                + "    .btn-container { text-align: center; margin: 30px 0 16px 0; }\n"
                + "    .btn { display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff !important; padding: 13px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; text-decoration: none; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25); }\n"
                + "    .notice { background-color: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #92400e; margin-top: 22px; line-height: 1.5; }\n"
                + "    .footer { background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; }\n"
                + "    .footer p { margin: 4px 0; }\n"
                + "  </style>\n"
                + "</head>\n"
                + "<body>\n"
                + "<div class='wrapper'>\n"
                + "  <div class='email-container'>\n"
                + "    <div class='header'>\n"
                + "      <h1>SpeakMate AI</h1>\n"
                + "      <p>Teacher Portal Access</p>\n"
                + "    </div>\n"
                + "    <div class='content'>\n"
                + "      <h2 class='greeting'>Hello " + safeTeacherName + ",</h2>\n"
                + "      <p class='lead-text'>You have been registered as a Teacher on SpeakMate AI. Below are your school assignment details and login credentials.</p>\n"
                + "      \n"
                + "      <div class='card'>\n"
                + "        <div class='card-title'>Institution & Role Details</div>\n"
                + "        <table class='info-table'>\n"
                + "          <tr><td class='info-label'>School Name:</td><td class='info-value'><strong>" + safeSchoolName + "</strong></td></tr>\n"
                + "          <tr><td class='info-label'>School Code:</td><td class='info-value'><span class='badge'>" + safeSchoolCode + "</span></td></tr>\n"
                + "          <tr><td class='info-label'>Role:</td><td class='info-value'><strong>Teacher</strong></td></tr>\n"
                + "          <tr><td class='info-label'>Department:</td><td class='info-value'>" + safeDepartment + "</td></tr>\n"
                + "          <tr><td class='info-label'>Assigned Classes:</td><td class='info-value'>" + safeClasses + "</td></tr>\n"
                + "        </table>\n"
                + "      </div>\n"
                + "      \n"
                + "      <div class='credentials-box'>\n"
                + "        <div class='card-title' style='color:#1e293b; border-bottom:1px solid #cbd5e1;'>Login Credentials</div>\n"
                + "        <div class='credential-row'>\n"
                + "          <span class='credential-label'>Email / ID:</span>\n"
                + "          <span class='credential-pill'>" + safeEmail + "</span>\n"
                + "        </div>\n"
                + "        <div class='credential-row'>\n"
                + "          <span class='credential-label'>Password:</span>\n"
                + "          <span class='credential-pill'>" + safePassword + "</span>\n"
                + "        </div>\n"
                + "      </div>\n"
                + "      \n"
                + "      <div class='btn-container'>\n"
                + "        <a href='" + loginUrl + "' class='btn'>Log In to Teacher Portal</a>\n"
                + "      </div>\n"
                + "      \n"
                + "      <div class='notice'>\n"
                + "        <strong>Security Notice:</strong> Please keep your credentials secure and update your password upon your first login.\n"
                + "      </div>\n"
                + "    </div>\n"
                + "    <div class='footer'>\n"
                + "      <p>SpeakMate AI &bull; AI-Powered Interactive English Learning</p>\n"
                + "      <p>&copy; " + currentYear + " SpeakMate AI. All rights reserved.</p>\n"
                + "    </div>\n"
                + "  </div>\n"
                + "</div>\n"
                + "</body>\n"
                + "</html>";
    }

    /**
     * Plain-text alternative for Teacher welcome email.
     */
    public String buildTeacherWelcomeEmailText(
            String teacherName,
            String email,
            String rawPassword,
            String schoolName,
            String schoolCode,
            String department,
            String assignedClasses) {

        String loginUrl = getTeacherLoginUrl();

        return "Hello " + (teacherName != null && !teacherName.isBlank() ? teacherName : "Teacher") + ",\n\n"
                + "You have been registered as a Teacher on SpeakMate AI.\n\n"
                + "--- Institution & Assignment Details ---\n"
                + "School Name:      " + (schoolName != null ? schoolName : "N/A") + "\n"
                + "School Code:      " + (schoolCode != null ? schoolCode : "N/A") + "\n"
                + "Role:             Teacher\n"
                + "Department:       " + (department != null ? department : "General") + "\n"
                + "Assigned Classes: " + (assignedClasses != null ? assignedClasses : "General") + "\n\n"
                + "--- Login Credentials ---\n"
                + "Portal URL: " + loginUrl + "\n"
                + "Email:      " + email + "\n"
                + "Password:   " + rawPassword + "\n\n"
                + "Security Notice: Please update your password upon your first login.\n\n"
                + "Best regards,\n"
                + "SpeakMate AI Team";
    }

    /**
     * Builds a rich Brevo HTML email for a newly registered General Platform User.
     */
    public String buildUserWelcomeEmailHtml(
            String userName,
            String email,
            String rawPassword,
            String englishLevel,
            String learningGoal) {

        String safeUserName = safeHtml(userName, "Learner");
        String safeEmail = safeHtml(email, "");
        String safePassword = safeHtml(rawPassword, "");
        String safeLevel = safeHtml(englishLevel, "Not Specified");
        String safeGoal = safeHtml(learningGoal, "English Fluency");
        String loginUrl = getLoginUrl();
        int currentYear = Year.now().getValue();

        return "<!DOCTYPE html>\n"
                + "<html lang='en'>\n"
                + "<head>\n"
                + "  <meta charset='UTF-8'>\n"
                + "  <meta name='viewport' content='width=device-width, initial-scale=1.0'>\n"
                + "  <title>Welcome to SpeakMate AI</title>\n"
                + "  <style>\n"
                + "    body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; }\n"
                + "    .wrapper { width: 100%; background-color: #f1f5f9; padding: 30px 12px; box-sizing: border-box; }\n"
                + "    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; }\n"
                + "    .header { background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 32px 24px; text-align: center; color: #ffffff; }\n"
                + "    .header h1 { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px; }\n"
                + "    .header p { margin: 6px 0 0 0; font-size: 14px; opacity: 0.9; letter-spacing: 0.2px; }\n"
                + "    .content { padding: 32px 28px; }\n"
                + "    .greeting { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 10px 0; }\n"
                + "    .lead-text { font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 22px 0; }\n"
                + "    .card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin-bottom: 22px; }\n"
                + "    .card-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.75px; color: #64748b; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }\n"
                + "    .info-table { width: 100%; border-collapse: collapse; }\n"
                + "    .info-table td { padding: 7px 0; font-size: 14px; vertical-align: top; }\n"
                + "    .info-label { width: 38%; color: #64748b; font-weight: 600; }\n"
                + "    .info-value { width: 62%; color: #0f172a; font-weight: 500; }\n"
                + "    .badge { display: inline-block; background-color: #e0e7ff; color: #3730a3; padding: 3px 8px; border-radius: 4px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 13px; font-weight: 600; }\n"
                + "    .credentials-box { background-color: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 18px 20px; margin: 22px 0; }\n"
                + "    .credential-row { margin: 10px 0; font-size: 14px; }\n"
                + "    .credential-label { font-weight: 600; color: #475569; display: inline-block; width: 110px; }\n"
                + "    .credential-pill { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 15px; font-weight: 700; color: #0f172a; background: #ffffff; border: 1px solid #cbd5e1; padding: 4px 10px; border-radius: 6px; display: inline-block; }\n"
                + "    .btn-container { text-align: center; margin: 30px 0 16px 0; }\n"
                + "    .btn { display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff !important; padding: 13px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; text-decoration: none; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25); }\n"
                + "    .notice { background-color: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #92400e; margin-top: 22px; line-height: 1.5; }\n"
                + "    .footer { background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; }\n"
                + "    .footer p { margin: 4px 0; }\n"
                + "  </style>\n"
                + "</head>\n"
                + "<body>\n"
                + "<div class='wrapper'>\n"
                + "  <div class='email-container'>\n"
                + "    <div class='header'>\n"
                + "      <h1>SpeakMate AI</h1>\n"
                + "      <p>Account Registration</p>\n"
                + "    </div>\n"
                + "    <div class='content'>\n"
                + "      <h2 class='greeting'>Hello " + safeUserName + ",</h2>\n"
                + "      <p class='lead-text'>Your account has been created on SpeakMate AI. Below are your account details and login credentials.</p>\n"
                + "      \n"
                + "      <div class='card'>\n"
                + "        <div class='card-title'>Account Profile</div>\n"
                + "        <table class='info-table'>\n"
                + "          <tr><td class='info-label'>Platform:</td><td class='info-value'><strong>SpeakMate AI</strong></td></tr>\n"
                + "          <tr><td class='info-label'>Account Role:</td><td class='info-value'>Platform Learner</td></tr>\n"
                + "          <tr><td class='info-label'>English Level:</td><td class='info-value'>" + safeLevel + "</td></tr>\n"
                + "          <tr><td class='info-label'>Learning Goal:</td><td class='info-value'>" + safeGoal + "</td></tr>\n"
                + "        </table>\n"
                + "      </div>\n"
                + "      \n"
                + "      <div class='credentials-box'>\n"
                + "        <div class='card-title' style='color:#1e293b; border-bottom:1px solid #cbd5e1;'>Login Credentials</div>\n"
                + "        <div class='credential-row'>\n"
                + "          <span class='credential-label'>Email / ID:</span>\n"
                + "          <span class='credential-pill'>" + safeEmail + "</span>\n"
                + "        </div>\n"
                + "        <div class='credential-row'>\n"
                + "          <span class='credential-label'>Password:</span>\n"
                + "          <span class='credential-pill'>" + safePassword + "</span>\n"
                + "        </div>\n"
                + "      </div>\n"
                + "      \n"
                + "      <div class='btn-container'>\n"
                + "        <a href='" + loginUrl + "' class='btn'>Log In to SpeakMate AI</a>\n"
                + "      </div>\n"
                + "      \n"
                + "      <div class='notice'>\n"
                + "        <strong>Security Notice:</strong> Please keep your credentials secure and change your password upon your first login.\n"
                + "      </div>\n"
                + "    </div>\n"
                + "    <div class='footer'>\n"
                + "      <p>SpeakMate AI &bull; AI-Powered Interactive English Learning</p>\n"
                + "      <p>&copy; " + currentYear + " SpeakMate AI. All rights reserved.</p>\n"
                + "    </div>\n"
                + "  </div>\n"
                + "</div>\n"
                + "</body>\n"
                + "</html>";
    }

    /**
     * Plain-text alternative for General User welcome email.
     */
    public String buildUserWelcomeEmailText(
            String userName,
            String email,
            String rawPassword,
            String englishLevel,
            String learningGoal) {

        String loginUrl = getLoginUrl();

        return "Hello " + (userName != null && !userName.isBlank() ? userName : "Learner") + ",\n\n"
                + "Your account has been created on SpeakMate AI.\n\n"
                + "--- Profile Details ---\n"
                + "Platform:      SpeakMate AI\n"
                + "Account Role:  Platform Learner\n"
                + "English Level: " + (englishLevel != null ? englishLevel : "N/A") + "\n"
                + "Learning Goal: " + (learningGoal != null ? learningGoal : "N/A") + "\n\n"
                + "--- Login Credentials ---\n"
                + "Portal URL: " + loginUrl + "\n"
                + "Email:      " + email + "\n"
                + "Password:   " + rawPassword + "\n\n"
                + "Security Notice: Please update your password upon your first login.\n\n"
                + "Best regards,\n"
                + "SpeakMate AI Team";
    }

    private String safeHtml(String input, String fallback) {
        if (input == null || input.isBlank()) {
            return fallback;
        }
        return HtmlUtils.htmlEscape(input.trim());
    }
}
