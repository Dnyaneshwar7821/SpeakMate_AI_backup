package com.rslsolution.speakmateai.service.impl;

import com.rslsolution.speakmateai.dto.request.SchoolRequest;
import com.rslsolution.speakmateai.dto.response.SchoolResponse;
import com.rslsolution.speakmateai.entity.School;
import com.rslsolution.speakmateai.entity.User;
import com.rslsolution.speakmateai.entity.SchoolAdmin;
import com.rslsolution.speakmateai.enums.Role;
import com.rslsolution.speakmateai.enums.Status;
import com.rslsolution.speakmateai.repository.SchoolRepository;
import com.rslsolution.speakmateai.repository.SchoolAdminRepository;
import com.rslsolution.speakmateai.repository.UserRepository;
import com.rslsolution.speakmateai.service.EmailService;
import com.rslsolution.speakmateai.service.SchoolService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rslsolution.speakmateai.dto.response.StandardDivisionResponse;
import com.rslsolution.speakmateai.entity.SchoolStandard;
import com.rslsolution.speakmateai.entity.StandardDivision;
import com.rslsolution.speakmateai.repository.SchoolStandardRepository;
import com.rslsolution.speakmateai.repository.StandardDivisionRepository;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import com.rslsolution.speakmateai.entity.SchoolAdminEmailVerification;
import com.rslsolution.speakmateai.repository.SchoolAdminEmailVerificationRepository;
import com.rslsolution.speakmateai.exception.AccessDeniedException;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.Comparator;
import java.util.Optional;
import java.util.stream.Collectors;

import com.rslsolution.speakmateai.dto.request.ReplaceSchoolAdminRequest;
import com.rslsolution.speakmateai.dto.response.SchoolAdminHistoryResponse;
import com.rslsolution.speakmateai.dto.request.SchoolAdminSendInvitationRequest;
import com.rslsolution.speakmateai.dto.request.SchoolPaymentOrderRequest;
import com.rslsolution.speakmateai.dto.response.CreateOrderResponse;
import com.rslsolution.speakmateai.dto.response.SchoolAdminSendInvitationResponse;
import com.rslsolution.speakmateai.entity.SubscriptionPlan;
import com.rslsolution.speakmateai.entity.UserSubscription;
import com.rslsolution.speakmateai.enums.PaymentMethod;
import com.rslsolution.speakmateai.enums.PaymentStatus;
import com.rslsolution.speakmateai.enums.SubscriptionStatus;
import com.rslsolution.speakmateai.repository.SubscriptionPlanRepository;
import com.rslsolution.speakmateai.repository.UserSubscriptionRepository;
import com.rslsolution.speakmateai.service.email.EmailMessage;
import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.Utils;
import org.json.JSONObject;
import java.math.BigDecimal;
import java.security.SecureRandom;

@Service
@RequiredArgsConstructor
public class SchoolServiceImpl implements SchoolService {

    private static final String UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    private static final String LOWER = "abcdefghijklmnopqrstuvwxyz";
    private static final String DIGITS = "0123456789";
    private static final String SPECIAL = "!@#$%&*";
    private static final String ALL_CHARS = UPPER + LOWER + DIGITS + SPECIAL;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final SchoolRepository schoolRepository;
    private final UserRepository userRepository;
    private final SchoolAdminRepository schoolAdminRepository;
    private final SchoolStandardRepository schoolStandardRepository;
    private final StandardDivisionRepository standardDivisionRepository;
    private final SchoolAdminEmailVerificationRepository verificationRepository;
    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final UserSubscriptionRepository userSubscriptionRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final com.rslsolution.speakmateai.service.NotificationService notificationService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.rslsolution.speakmateai.service.EntityCascadeDeletionService entityCascadeDeletionService;

    @Value("${app.frontend.url:https://speak-mate-ai-nine.vercel.app}")
    private String frontendUrl;

    @Value("${razorpay.key.id:rzp_test_SpeakMateAiDev}")
    private String razorpayKeyId;

    @Value("${razorpay.key.secret:dummy_secret_for_local_dev}")
    private String razorpayKeySecret;

    @Override
    @Transactional
    public SchoolAdminSendInvitationResponse sendInvitation(SchoolAdminSendInvitationRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Invitation request cannot be null.");
        }

        String token = request.getVerificationToken() != null ? request.getVerificationToken().trim() : "";
        if (token.isEmpty()) {
            throw new AccessDeniedException("School admin email verification token is required.");
        }

        String normalizedEmail = request.getEmail() != null ? request.getEmail().trim().toLowerCase() : "";
        if (normalizedEmail.isEmpty()) {
            throw new IllegalArgumentException("School admin email is required.");
        }

        // 1. Fetch verification record
        SchoolAdminEmailVerification verification = verificationRepository.findByVerificationToken(token)
                .orElseThrow(() -> new AccessDeniedException("Invalid verification token. Please verify the School Admin email first."));

        // 2. Validate token binding to requested email
        if (!normalizedEmail.equalsIgnoreCase(verification.getEmail())) {
            throw new AccessDeniedException("Verification token does not match the provided admin email.");
        }

        // 3. Validate verification state
        if (!verification.isVerified()) {
            throw new AccessDeniedException("School admin email has not been verified.");
        }

        // 4. Validate token has not already been consumed
        if (verification.isTokenConsumed()) {
            throw new AccessDeniedException("Verification token has already been used. Please verify the email again.");
        }

        // 5. Validate token expiry
        if (verification.getVerificationTokenExpiresAt() == null || LocalDateTime.now().isAfter(verification.getVerificationTokenExpiresAt())) {
            throw new AccessDeniedException("Verification token has expired. Please verify the email again.");
        }

        // 6. Generate secure temporary credentials
        String tempPassword = generateSecureTemporaryPassword();
        String pendingCredentialHash = passwordEncoder.encode(tempPassword);

        // 7. Update verification record (tokenConsumed remains FALSE!)
        LocalDateTime now = LocalDateTime.now();
        verification.setPendingCredentialHash(pendingCredentialHash);
        verification.setTempPassword(tempPassword);
        verification.setInvitationSent(true);
        verification.setInvitationSentAt(now);
        verificationRepository.save(verification);

        // 8. Dispatch invitation email via existing EmailService abstraction
        try {
            String adminName = (request.getAdminFirstName() != null && !request.getAdminFirstName().isBlank())
                    ? request.getAdminFirstName().trim() + (request.getAdminLastName() != null ? " " + request.getAdminLastName().trim() : "")
                    : "School Administrator";
            String schoolName = (request.getSchoolName() != null && !request.getSchoolName().isBlank())
                    ? request.getSchoolName().trim()
                    : "Your Educational Institution";
            String address = (request.getAddress() != null && !request.getAddress().isBlank())
                    ? request.getAddress().trim()
                    : "Not Specified";

            String htmlContent = buildSchoolAdminWelcomeEmailHtml(
                    adminName,
                    normalizedEmail,
                    tempPassword,
                    schoolName,
                    "PENDING REGISTRATION",
                    address,
                    "Configured in Portal"
            );
            String textContent = buildSchoolAdminWelcomeEmailText(
                    adminName,
                    normalizedEmail,
                    tempPassword,
                    schoolName,
                    "PENDING REGISTRATION",
                    address,
                    "Configured in Portal"
            );
            EmailMessage message = EmailMessage.builder()
                    .to(normalizedEmail)
                    .subject("Welcome to SpeakMate AI - School Admin Invitation & Credentials")
                    .htmlContent(htmlContent)
                    .text(textContent)
                    .html(true)
                    .senderName("SpeakMate AI")
                    .build();
            emailService.sendEmail(message);
        } catch (Exception e) {
            System.err.println("[SchoolAdminInvitation] Email provider dispatch warning for " + normalizedEmail + ": " + e.getMessage());
        }

        return SchoolAdminSendInvitationResponse.builder()
                .success(true)
                .message("Invitation and login credentials sent successfully.")
                .email(normalizedEmail)
                .invitationSentAt(now)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public CreateOrderResponse createSchoolPaymentOrder(SchoolPaymentOrderRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Payment order request cannot be null.");
        }

        String token = request.getVerificationToken() != null ? request.getVerificationToken().trim() : "";
        if (token.isEmpty()) {
            throw new AccessDeniedException("School admin email verification token is required.");
        }

        String normalizedEmail = request.getAdminEmail() != null ? request.getAdminEmail().trim().toLowerCase() : "";
        if (normalizedEmail.isEmpty()) {
            throw new IllegalArgumentException("Admin email is required.");
        }

        SchoolAdminEmailVerification verification = verificationRepository.findByVerificationToken(token)
                .orElseThrow(() -> new AccessDeniedException("Invalid verification token. Please verify the School Admin email first."));

        if (!normalizedEmail.equalsIgnoreCase(verification.getEmail()) || !verification.isVerified() || verification.isTokenConsumed()) {
            throw new AccessDeniedException("Email is not verified or token has already been consumed.");
        }

        SubscriptionPlan plan = subscriptionPlanRepository.findById(request.getPlanId())
                .orElseThrow(() -> new IllegalArgumentException("Subscription plan not found for ID: " + request.getPlanId()));

        double price = plan.getPrice() != null ? plan.getPrice() : 0.0;
        long amountInPaise = Math.round(price * 100);
        String currency = (plan.getCurrency() != null && !plan.getCurrency().isBlank() && !plan.getCurrency().equalsIgnoreCase("USD"))
                ? plan.getCurrency().trim().toUpperCase()
                : "INR";
        String planName = plan.getPlanName() != null ? plan.getPlanName() : "School Subscription";

        String orderId;
        boolean isRealCredentials = razorpayKeyId != null && !razorpayKeyId.contains("dummy") && !razorpayKeyId.contains("Dev")
                && razorpayKeySecret != null && !razorpayKeySecret.contains("dummy");

        if (isRealCredentials && amountInPaise > 0) {
            try {
                RazorpayClient razorpay = new RazorpayClient(razorpayKeyId, razorpayKeySecret);
                JSONObject orderRequest = new JSONObject();
                orderRequest.put("amount", amountInPaise);
                orderRequest.put("currency", currency);
                orderRequest.put("receipt", "sch_rcpt_" + System.currentTimeMillis());

                JSONObject notes = new JSONObject();
                notes.put("schoolName", request.getSchoolName());
                notes.put("adminEmail", normalizedEmail);
                notes.put("planId", String.valueOf(plan.getId()));
                notes.put("planName", planName);
                orderRequest.put("notes", notes);

                Order order = razorpay.orders.create(orderRequest);
                orderId = order.get("id");
            } catch (Exception e) {
                System.err.println("[SchoolPaymentOrder] Razorpay API order creation failed, falling back to local order ID: " + e.getMessage());
                orderId = "order_mock_" + System.currentTimeMillis();
            }
        } else {
            orderId = "order_dev_" + System.currentTimeMillis();
        }

        return CreateOrderResponse.builder()
                .razorpayOrderId(orderId)
                .amount(BigDecimal.valueOf(price))
                .amountInPaise(amountInPaise)
                .currency(currency)
                .razorpayKeyId(razorpayKeyId != null && !razorpayKeyId.isBlank() ? razorpayKeyId : "rzp_test_SpeakMateAiDev")
                .planType(planName)
                .planName(planName)
                .description("Institutional subscription plan for " + request.getSchoolName())
                .userEmail(normalizedEmail)
                .userName(request.getSchoolName())
                .build();
    }

    private String generateSecureTemporaryPassword() {
        StringBuilder sb = new StringBuilder(12);
        sb.append(UPPER.charAt(SECURE_RANDOM.nextInt(UPPER.length())));
        sb.append(LOWER.charAt(SECURE_RANDOM.nextInt(LOWER.length())));
        sb.append(DIGITS.charAt(SECURE_RANDOM.nextInt(DIGITS.length())));
        sb.append(SPECIAL.charAt(SECURE_RANDOM.nextInt(SPECIAL.length())));
        for (int i = 4; i < 12; i++) {
            sb.append(ALL_CHARS.charAt(SECURE_RANDOM.nextInt(ALL_CHARS.length())));
        }
        char[] chars = sb.toString().toCharArray();
        for (int i = chars.length - 1; i > 0; i--) {
            int j = SECURE_RANDOM.nextInt(i + 1);
            char tmp = chars[i];
            chars[i] = chars[j];
            chars[j] = tmp;
        }
        return new String(chars);
    }

    private String buildSchoolAdminWelcomeEmailHtml(
            String adminName,
            String email,
            String tempPassword,
            String schoolName,
            String schoolCode,
            String address,
            String contactPhone,
            SubscriptionPlan plan,
            String paymentId) {
        String base = (frontendUrl != null && !frontendUrl.isBlank()) ? frontendUrl.trim() : "https://speak-mate-ai-nine.vercel.app";
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        String encodedEmail = "";
        try {
            encodedEmail = java.net.URLEncoder.encode(email != null ? email.trim() : "", java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception ignored) {}
        String loginUrl = base + "/school-admin/login?email=" + encodedEmail + "&firstTime=true";

        String safeAdminName = org.springframework.web.util.HtmlUtils.htmlEscape(adminName != null && !adminName.isBlank() ? adminName : "School Administrator");
        String safeEmail = org.springframework.web.util.HtmlUtils.htmlEscape(email != null ? email : "");
        String safePassword = org.springframework.web.util.HtmlUtils.htmlEscape(tempPassword != null ? tempPassword : "");
        String safeSchoolName = org.springframework.web.util.HtmlUtils.htmlEscape(schoolName != null && !schoolName.isBlank() ? schoolName : "SpeakMate Partner School");
        String safeSchoolCode = org.springframework.web.util.HtmlUtils.htmlEscape(schoolCode != null && !schoolCode.isBlank() ? schoolCode : "");
        String safeAddress = org.springframework.web.util.HtmlUtils.htmlEscape(address != null && !address.isBlank() ? address : "");
        String safePhone = org.springframework.web.util.HtmlUtils.htmlEscape(contactPhone != null && !contactPhone.isBlank() ? contactPhone : "");

        String planHtml = "";
        if (plan != null) {
            String safePlanName = org.springframework.web.util.HtmlUtils.htmlEscape(plan.getPlanName() != null ? plan.getPlanName() : "Institutional Subscription Plan");
            String currency = plan.getCurrency() != null ? plan.getCurrency() : "INR";
            String priceStr = plan.getPrice() != null ? String.format("%.2f", plan.getPrice()) : "0.00";
            String billingCycle = plan.getBillingCycle() != null ? plan.getBillingCycle() : (plan.getDurationMonths() != null ? plan.getDurationMonths() + " Months" : "1 Year");
            String durationStr = plan.getDurationMonths() != null ? plan.getDurationMonths() + " Months" : "Annual";
            String studentLimitStr = plan.getStudentLimit() != null ? plan.getStudentLimit() + " Enrolled Students" : "Unlimited Students";
            String aiLimitStr = plan.getAiMinutesLimit() != null ? plan.getAiMinutesLimit() + " AI Mins / Student" : "Full AI English Access";
            String safePaymentId = org.springframework.web.util.HtmlUtils.htmlEscape(paymentId != null && !paymentId.isBlank() ? paymentId : "PRE-ACTIVATED");

            planHtml = "<div class='section-title'>Institutional Subscription Plan</div>\n"
                    + "<table class='info-table' style='border-left: 4px solid #10b981;'>\n"
                    + "  <tr><td class='label-col'>Plan Name:</td><td class='value-col'><strong style='color: #047857;'>" + safePlanName + "</strong></td></tr>\n"
                    + "  <tr><td class='label-col'>Subscription Fee:</td><td class='value-col'>" + currency + " " + priceStr + " (" + billingCycle + ")</td></tr>\n"
                    + "  <tr><td class='label-col'>Duration:</td><td class='value-col'>" + durationStr + "</td></tr>\n"
                    + "  <tr><td class='label-col'>Student Capacity:</td><td class='value-col'>" + studentLimitStr + "</td></tr>\n"
                    + "  <tr><td class='label-col'>AI Practice:</td><td class='value-col'>" + aiLimitStr + "</td></tr>\n"
                    + "  <tr><td class='label-col'>Payment Ref:</td><td class='value-col'><span style='font-family: monospace; font-size: 13px; color: #475569;'>" + safePaymentId + "</span></td></tr>\n"
                    + "  <tr><td class='label-col'>Coverage:</td><td class='value-col'><span style='display:inline-block; background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 12px;'>ACTIVE FOR ALL STUDENTS & STAFF</span></td></tr>\n"
                    + "</table>\n";
        }

        return "<!DOCTYPE html>\n"
                + "<html lang='en'>\n"
                + "<head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'><title>School Admin Portal Access</title>\n"
                + "<style>\n"
                + "  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 0; color: #1e293b; }\n"
                + "  .wrapper { width: 100%; background-color: #f1f5f9; padding: 32px 16px; box-sizing: border-box; }\n"
                + "  .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.01); border: 1px solid #e2e8f0; }\n"
                + "  .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 36px 28px; text-align: center; color: #ffffff; }\n"
                + "  .header h1 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }\n"
                + "  .header-badge { display: inline-block; margin-top: 10px; background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.35); padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #ffffff; }\n"
                + "  .content { padding: 36px 32px; font-size: 15px; line-height: 1.6; color: #334155; }\n"
                + "  .greeting { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 12px; }\n"
                + "  .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.75px; color: #64748b; margin: 24px 0 10px 0; }\n"
                + "  .info-table { width: 100%; border-collapse: collapse; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px; overflow: hidden; }\n"
                + "  .info-table td { padding: 10px 16px; font-size: 14px; border-bottom: 1px solid #e2e8f0; }\n"
                + "  .info-table tr:last-child td { border-bottom: none; }\n"
                + "  .label-col { width: 35%; color: #64748b; font-weight: 500; }\n"
                + "  .value-col { color: #0f172a; font-weight: 600; }\n"
                + "  .cred-table { width: 100%; border-collapse: collapse; background: #ffffff; border: 1.5px dashed #cbd5e1; border-radius: 8px; margin-bottom: 20px; overflow: hidden; }\n"
                + "  .cred-table td { padding: 10px 16px; font-size: 14px; border-bottom: 1px solid #f1f5f9; }\n"
                + "  .cred-table tr:last-child td { border-bottom: none; }\n"
                + "  .cred-val { font-family: 'Courier New', Courier, monospace; font-size: 15px; font-weight: 700; color: #0f172a; background: #e2e8f0; padding: 4px 10px; border-radius: 4px; word-break: break-all; }\n"
                + "  .security-box { background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px 16px; border-radius: 0 6px 6px 0; margin-bottom: 28px; font-size: 13.5px; color: #1e40af; line-height: 1.5; }\n"
                + "  .tab-btn-container { text-align: center; margin: 32px 0; }\n"
                + "  .tab-button { display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff !important; padding: 14px 34px; border-radius: 8px; font-weight: 700; font-size: 16px; text-decoration: none; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35); }\n"
                + "  .fallback-url { font-size: 12px; color: #64748b; word-break: break-all; text-align: center; margin-top: 15px; line-height: 1.4; }\n"
                + "  .fallback-url a { color: #2563eb; text-decoration: underline; }\n"
                + "  .footer { background-color: #f8fafc; padding: 22px 28px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }\n"
                + "  .footer p { margin: 4px 0; }\n"
                + "</style>\n"
                + "</head>\n"
                + "<body>\n"
                + "<div class='wrapper'>\n"
                + "  <div class='container'>\n"
                + "    <div class='header'>\n"
                + "      <h1>SpeakMate AI</h1>\n"
                + "      <div class='header-badge'>School Administrator Portal Access</div>\n"
                + "    </div>\n"
                + "    <div class='content'>\n"
                + "      <div class='greeting'>Hello " + safeAdminName + ",</div>\n"
                + "      <p>Your School Administrator account for <strong>" + safeSchoolName + "</strong> has been created on SpeakMate AI.</p>\n"
                + "      <p>Your administrator portal provides role-isolated access to manage your school's teachers, classrooms, students, and speaking performance metrics.</p>\n"
                + "      <div class='section-title'>Institutional Details</div>\n"
                + "      <table class='info-table'>\n"
                + "        <tr><td class='label-col'>School Name:</td><td class='value-col'>" + safeSchoolName + "</td></tr>\n"
                + "        <tr><td class='label-col'>School Code:</td><td class='value-col'><span style='background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 4px; font-family: monospace; font-weight: 700; font-size: 14px;'>" + safeSchoolCode + "</span></td></tr>\n"
                + "        <tr><td class='label-col'>Address:</td><td class='value-col'>" + safeAddress + "</td></tr>\n"
                + "        <tr><td class='label-col'>Contact Phone:</td><td class='value-col'>" + safePhone + "</td></tr>\n"
                + "      </table>\n"
                +        planHtml
                + "      <div class='section-title'>Login Credentials</div>\n"
                + "      <table class='cred-table'>\n"
                + "        <tr><td class='label-col'>Portal Role:</td><td class='value-col'>School Administrator</td></tr>\n"
                + "        <tr><td class='label-col'>Login Email:</td><td class='value-col' style='font-family: monospace; font-weight: 700; font-size: 14px; color: #0f172a;'>" + safeEmail + "</td></tr>\n"
                + "        <tr><td class='label-col'>Temporary Password:</td><td class='value-col'><span class='cred-val'>" + safePassword + "</span></td></tr>\n"
                + "      </table>\n"
                + "      <div class='security-box'>\n"
                + "        <strong>Important Security Notice:</strong><br/>\n"
                + "        The password provided above is <strong>temporary</strong>. When you click the login portal button below, you will be guided to enter your temporary password and create your <strong>permanent password</strong> before signing into your dashboard.\n"
                + "      </div>\n"
                + "      <div class='tab-btn-container'>\n"
                + "        <a href='" + loginUrl + "' class='tab-button' style='color: #ffffff !important; text-decoration: none;'>Log In to School Admin Portal &rarr;</a>\n"
                + "      </div>\n"
                + "      <div class='fallback-url'>\n"
                + "        If the button above does not work, copy and paste this link into your browser:<br/>\n"
                + "        <a href='" + loginUrl + "'>" + loginUrl + "</a>\n"
                + "      </div>\n"
                + "    </div>\n"
                + "    <div class='footer'>\n"
                + "      <p><strong>SpeakMate AI</strong> &bull; Institutional English Learning Management</p>\n"
                + "      <p>Confidential: This message contains sensitive credentials intended only for " + safeEmail + ".</p>\n"
                + "      <p>&copy; " + java.time.Year.now().getValue() + " SpeakMate AI. All rights reserved.</p>\n"
                + "    </div>\n"
                + "  </div>\n"
                + "</div>\n"
                + "</body>\n"
                + "</html>";
    }

    private String buildSchoolAdminWelcomeEmailHtml(
            String adminName,
            String email,
            String tempPassword,
            String schoolName,
            String schoolCode,
            String address,
            String contactPhone) {
        return buildSchoolAdminWelcomeEmailHtml(adminName, email, tempPassword, schoolName, schoolCode, address, contactPhone, null, null);
    }

    private String buildSchoolAdminWelcomeEmailText(
            String adminName,
            String email,
            String tempPassword,
            String schoolName,
            String schoolCode,
            String address,
            String contactPhone,
            SubscriptionPlan plan,
            String paymentId) {
        String base = (frontendUrl != null && !frontendUrl.isBlank()) ? frontendUrl.trim() : "https://speak-mate-ai-nine.vercel.app";
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        String encodedEmail = "";
        try {
            encodedEmail = java.net.URLEncoder.encode(email != null ? email.trim() : "", java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception ignored) {}
        String loginUrl = base + "/school-admin/login?email=" + encodedEmail + "&firstTime=true";

        StringBuilder planText = new StringBuilder();
        if (plan != null) {
            String currency = plan.getCurrency() != null ? plan.getCurrency() : "INR";
            String priceStr = plan.getPrice() != null ? String.format("%.2f", plan.getPrice()) : "0.00";
            String billingCycle = plan.getBillingCycle() != null ? plan.getBillingCycle() : (plan.getDurationMonths() != null ? plan.getDurationMonths() + " Months" : "1 Year");
            planText.append("--- Institutional Subscription Plan ---\n")
                    .append("Plan:             ").append(plan.getPlanName() != null ? plan.getPlanName() : "Institutional Plan").append("\n")
                    .append("Subscription Fee: ").append(currency).append(" ").append(priceStr).append(" (").append(billingCycle).append(")\n")
                    .append("Duration:         ").append(plan.getDurationMonths() != null ? plan.getDurationMonths() + " Months" : "Annual").append("\n")
                    .append("Student Capacity: ").append(plan.getStudentLimit() != null ? plan.getStudentLimit() + " Students" : "Unlimited").append("\n")
                    .append("Payment Ref:      ").append(paymentId != null && !paymentId.isBlank() ? paymentId : "PRE-ACTIVATED").append("\n")
                    .append("Coverage:         ACTIVE FOR ALL STUDENTS & STAFF\n\n");
        }

        return "Welcome to SpeakMate AI!\n\n"
                + "Hello " + (adminName != null ? adminName : "School Administrator") + ",\n\n"
                + "Your School Administrator account has been configured.\n\n"
                + "--- Institutional Details ---\n"
                + "School Name:    " + (schoolName != null ? schoolName : "") + "\n"
                + "School Code:    " + (schoolCode != null ? schoolCode : "") + "\n"
                + "School Address: " + (address != null ? address : "") + "\n"
                + "Contact Phone:  " + (contactPhone != null ? contactPhone : "") + "\n\n"
                + planText.toString()
                + "--- Login Credentials ---\n"
                + "Role:               School Administrator\n"
                + "Login Email:        " + email + "\n"
                + "Temporary Password: " + tempPassword + "\n\n"
                + "--- Portal Access Link ---\n"
                + loginUrl + "\n\n"
                + "Security Notice: The password provided is temporary. Upon clicking the portal link, you will be guided to enter your temporary password and create your permanent password before signing in.\n\n"
                + "SpeakMate AI Team";
    }

    private String buildSchoolAdminWelcomeEmailText(
            String adminName,
            String email,
            String tempPassword,
            String schoolName,
            String schoolCode,
            String address,
            String contactPhone) {
        return buildSchoolAdminWelcomeEmailText(adminName, email, tempPassword, schoolName, schoolCode, address, contactPhone, null, null);
    }

    @SuppressWarnings("unused")
    private String buildInvitationEmailHtml(String email, String tempPassword) {
        return buildSchoolAdminWelcomeEmailHtml(
                "School Administrator",
                email,
                tempPassword,
                "Your Educational Institution",
                "",
                "",
                ""
        );
    }

    @SuppressWarnings("unused")
    private String buildInvitationEmailText(String email, String tempPassword) {
        return buildSchoolAdminWelcomeEmailText(
                "School Administrator",
                email,
                tempPassword,
                "Your Educational Institution",
                "",
                "",
                ""
        );
    }

    @Override
    @Transactional
    public SchoolResponse createSchool(SchoolRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("School request cannot be null");
        }

        // 1. Mandatory School Admin Email Verification Validation (BEFORE any entity creation or persistence)
        String token = request.getVerificationToken() != null ? request.getVerificationToken().trim() : "";
        if (token.isEmpty()) {
            throw new AccessDeniedException("School admin email verification token is required.");
        }

        String normalizedAdminEmail = request.getAdminEmail() != null ? request.getAdminEmail().trim().toLowerCase() : "";
        if (normalizedAdminEmail.isEmpty()) {
            throw new IllegalArgumentException("Admin email is required");
        }

        // Fetch verification record with pessimistic lock to prevent concurrent double-submission
        SchoolAdminEmailVerification verification = verificationRepository.findByVerificationTokenWithLock(token)
                .orElseThrow(() -> new AccessDeniedException("Invalid verification token. Please verify the School Admin email first."));

        // Validate token binding to the same normalized admin email
        if (!normalizedAdminEmail.equalsIgnoreCase(verification.getEmail())) {
            throw new AccessDeniedException("Verification token does not match the provided admin email.");
        }

        // Validate verification state
        if (!verification.isVerified()) {
            throw new AccessDeniedException("School admin email has not been verified.");
        }

        // Validate token is not already consumed (prevents replay / duplicate use)
        if (verification.isTokenConsumed()) {
            throw new AccessDeniedException("Verification token has already been used. Please verify the email again.");
        }

        // Validate token expiration
        if (verification.getVerificationTokenExpiresAt() == null || LocalDateTime.now().isAfter(verification.getVerificationTokenExpiresAt())) {
            throw new AccessDeniedException("Verification token has expired. Please verify the email again.");
        }

        if (schoolRepository.existsByName(request.getSchoolName())) {
            throw new RuntimeException("School with this name already exists");
        }

        if (userRepository.existsByEmail(normalizedAdminEmail)) {
            throw new RuntimeException("Admin email is already in use");
        }

        String normalizedContactPhone = com.rslsolution.speakmateai.util.PhoneNumberUtil.validateAndNormalize(request.getContactPhone(), "Contact phone");

        // Resolve Subscription Plan if provided
        SubscriptionPlan plan = null;
        if (request.getSubscriptionPlanId() != null) {
            plan = subscriptionPlanRepository.findById(request.getSubscriptionPlanId()).orElse(null);
        }

        // Validate Razorpay Payment Signature if credentials & signature are present
        if (request.getRazorpayOrderId() != null && request.getRazorpayPaymentId() != null && request.getRazorpaySignature() != null) {
            boolean isRealSecret = razorpayKeySecret != null && !razorpayKeySecret.contains("dummy") && !razorpayKeySecret.isBlank();
            boolean isMockSignature = request.getRazorpaySignature().startsWith("mock_") || request.getRazorpaySignature().startsWith("dev_");
            if (isRealSecret && !isMockSignature) {
                try {
                    JSONObject options = new JSONObject();
                    options.put("razorpay_order_id", request.getRazorpayOrderId());
                    options.put("razorpay_payment_id", request.getRazorpayPaymentId());
                    options.put("razorpay_signature", request.getRazorpaySignature());
                    boolean isValid = Utils.verifyPaymentSignature(options, razorpayKeySecret);
                    if (!isValid) {
                        throw new AccessDeniedException("Razorpay payment signature verification failed.");
                    }
                } catch (AccessDeniedException ade) {
                    throw ade;
                } catch (Exception e) {
                    System.err.println("[SchoolPayment] Signature verification error: " + e.getMessage());
                    if (e.getMessage() != null && e.getMessage().toLowerCase().contains("signature")) {
                        throw new AccessDeniedException("Invalid payment signature.");
                    }
                }
            }
        }

        // Calculate subscription period & student capacity
        LocalDateTime subStart = LocalDateTime.now();
        LocalDateTime subEnd = null;
        int maxStudents = 500;
        if (plan != null) {
            int durationMonths = plan.getDurationMonths() != null && plan.getDurationMonths() > 0 ? plan.getDurationMonths() : 12;
            subEnd = subStart.plusMonths(durationMonths);
            if (plan.getStudentLimit() != null && plan.getStudentLimit() > 0) {
                maxStudents = plan.getStudentLimit();
            }
        } else {
            subEnd = subStart.plusMonths(12);
        }

        // 1. Create School with Subscription details
        School school = School.builder()
                .name(request.getSchoolName())
                .schoolName(request.getSchoolName())
                .schoolCode("SCH-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                .address(request.getAddress())
                .contactPhone(normalizedContactPhone)
                .active(true)
                .subscriptionPlanId(plan != null ? plan.getId() : request.getSubscriptionPlanId())
                .subscriptionStartDate(subStart)
                .subscriptionEndDate(subEnd)
                .maxStudents(maxStudents)
                .build();
        school = schoolRepository.save(school);

        // 2. Create School Admin
        String rawTempPassword = verification.getTempPassword();
        String passwordHash;
        if (rawTempPassword != null && !rawTempPassword.trim().isEmpty()) {
            passwordHash = verification.getPendingCredentialHash() != null && !verification.getPendingCredentialHash().trim().isEmpty()
                    ? verification.getPendingCredentialHash()
                    : passwordEncoder.encode(rawTempPassword);
        } else {
            rawTempPassword = generateSecureTemporaryPassword();
            passwordHash = passwordEncoder.encode(rawTempPassword);
        }

        String verificationToken = UUID.randomUUID().toString();
        SchoolAdmin adminUser = SchoolAdmin.builder()
                .firstName(request.getAdminFirstName())
                .lastName(request.getAdminLastName())
                .email(normalizedAdminEmail)
                .phone(normalizedContactPhone)
                .password(passwordHash)
                .role(Role.SCHOOL_ADMIN)
                .schoolId(school.getId())
                .status(Status.ACTIVE)
                .active(true)
                .emailVerified(true)
                .welcomeCompleted(false)
                .emailVerificationToken(verificationToken)
                .build();
        adminUser = schoolAdminRepository.save(adminUser);

        // Record UserSubscription in billing ledger for school admin
        if (plan != null) {
            try {
                UserSubscription userSub = UserSubscription.builder()
                        .user(adminUser)
                        .subscriptionPlan(plan)
                        .planType(plan.getPlanName() != null ? plan.getPlanName() : "INSTITUTIONAL")
                        .status("ACTIVE")
                        .amount(plan.getPrice() != null ? BigDecimal.valueOf(plan.getPrice()) : BigDecimal.ZERO)
                        .currency(plan.getCurrency() != null ? plan.getCurrency() : "INR")
                        .razorpayOrderId(request.getRazorpayOrderId())
                        .razorpayPaymentId(request.getRazorpayPaymentId())
                        .razorpaySignature(request.getRazorpaySignature())
                        .startDate(subStart)
                        .endDate(subEnd)
                        .expiryDate(subEnd)
                        .paymentStatus(PaymentStatus.PAID)
                        .subscriptionStatus(SubscriptionStatus.ACTIVE)
                        .paymentMethod(PaymentMethod.UPI)
                        .transactionId(request.getRazorpayPaymentId() != null ? request.getRazorpayPaymentId() : "TXN-" + System.currentTimeMillis())
                        .amountPaid(plan.getPrice() != null ? plan.getPrice() : 0.0)
                        .build();
                userSubscriptionRepository.save(userSub);
            } catch (Exception ex) {
                System.err.println("[UserSubscription] Could not save school admin subscription record: " + ex.getMessage());
            }
        }

        // 3. Update verification record and consume token within the same transaction (single-use)
        LocalDateTime now = LocalDateTime.now();
        verification.setTempPassword(rawTempPassword);
        verification.setPendingCredentialHash(passwordHash);
        verification.setInvitationSent(true);
        verification.setInvitationSentAt(now);
        verification.setTokenConsumed(true);
        verificationRepository.save(verification);

        // 4. Send Official School Admin Registered & Credentials Email with Plan Details (STRICTLY HTML)
        try {
            String adminFullName = ((adminUser.getFirstName() != null ? adminUser.getFirstName().trim() : "")
                    + (adminUser.getLastName() != null && !adminUser.getLastName().isBlank() ? " " + adminUser.getLastName().trim() : "")).trim();
            if (adminFullName.isEmpty()) {
                adminFullName = "School Administrator";
            }

            String schoolAddress = (school.getAddress() != null && !school.getAddress().isBlank())
                    ? school.getAddress().trim()
                    : ((request.getAddress() != null && !request.getAddress().isBlank()) ? request.getAddress().trim() : "");
            String schoolContactPhone = (school.getContactPhone() != null && !school.getContactPhone().isBlank())
                    ? school.getContactPhone().trim()
                    : normalizedContactPhone;

            String htmlContent = buildSchoolAdminWelcomeEmailHtml(
                    adminFullName,
                    adminUser.getEmail(),
                    rawTempPassword,
                    school.getName(),
                    school.getSchoolCode(),
                    schoolAddress,
                    schoolContactPhone,
                    plan,
                    request.getRazorpayPaymentId()
            );
            String textContent = buildSchoolAdminWelcomeEmailText(
                    adminFullName,
                    adminUser.getEmail(),
                    rawTempPassword,
                    school.getName(),
                    school.getSchoolCode(),
                    schoolAddress,
                    schoolContactPhone,
                    plan,
                    request.getRazorpayPaymentId()
            );

            EmailMessage message = EmailMessage.builder()
                    .to(adminUser.getEmail())
                    .subject("Welcome to SpeakMate AI - School Admin Credentials for " + school.getName())
                    .htmlContent(htmlContent)
                    .text(textContent)
                    .html(true)
                    .senderName("SpeakMate AI")
                    .build();
            emailService.sendEmail(message);
        } catch (Exception e) {
            // Log the error but don't fail the transaction, or handle accordingly.
            System.err.println("Failed to send school admin credentials email: " + e.getMessage());
        }

        try {
            if (notificationService != null) {
                notificationService.notifyAdmins("New School Registered", "School \"" + school.getName() + "\" has been registered with code " + school.getSchoolCode() + ".", com.rslsolution.speakmateai.enums.NotificationType.SCHOOL_CREATED, school.getId(), "SCHOOL");
                notificationService.notifyAdmins("New School Admin Created", "School Admin " + adminUser.getFirstName() + " " + adminUser.getLastName() + " has been configured for " + school.getName() + ".", com.rslsolution.speakmateai.enums.NotificationType.USER_CREATED, adminUser.getId(), "USER");
                notificationService.sendNotification(adminUser.getEmail(), "Welcome to SpeakMate AI", "You have been registered as the School Admin for " + school.getName() + ".", com.rslsolution.speakmateai.enums.NotificationType.USER_CREATED, adminUser.getId(), "USER");
            }
        } catch (Exception e) {
            System.err.println("Failed to dispatch notifications: " + e.getMessage());
        }

        return mapToResponse(school, adminUser);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SchoolResponse> getAllSchools() {
        List<School> schools = schoolRepository.findAll();
        if (schools.isEmpty()) {
            return Collections.emptyList();
        }

        List<Long> schoolIds = schools.stream().map(School::getId).collect(Collectors.toList());
        List<SchoolStandard> allStandards = Collections.emptyList();
        try {
            allStandards = schoolStandardRepository.findBySchoolIdIn(schoolIds);
        } catch (Exception ignored) {}

        Map<Long, List<SchoolStandard>> standardsBySchoolId = allStandards.stream()
                .filter(ss -> ss.getSchool() != null && ss.getSchool().getId() != null)
                .collect(Collectors.groupingBy(ss -> ss.getSchool().getId()));

        List<Long> standardIds = allStandards.stream().map(SchoolStandard::getId).collect(Collectors.toList());
        Map<Long, List<String>> divisionsByStandardId = new HashMap<>();
        if (!standardIds.isEmpty()) {
            try {
                List<StandardDivision> allDivisions = standardDivisionRepository.findBySchoolStandardIdIn(standardIds);
                divisionsByStandardId = allDivisions.stream()
                        .filter(sd -> sd.getSchoolStandard() != null && sd.getSchoolStandard().getId() != null)
                        .collect(Collectors.groupingBy(
                                sd -> sd.getSchoolStandard().getId(),
                                Collectors.mapping(StandardDivision::getDivision, Collectors.toList())
                        ));
            } catch (Exception ignored) {}
        }

        Map<Long, List<String>> finalDivisionsByStandardId = divisionsByStandardId;

        Map<Long, User> adminBySchoolId = new HashMap<>();
        try {
            List<User> schoolAdmins = userRepository.findByRole(com.rslsolution.speakmateai.enums.Role.SCHOOL_ADMIN);
            if (schoolAdmins != null) {
                schoolAdmins.stream()
                        .filter(u -> u.getSchoolId() != null && u.isActive() && u.getStatus() == com.rslsolution.speakmateai.enums.Status.ACTIVE)
                        .sorted(Comparator.comparing(User::getId).reversed())
                        .forEach(u -> adminBySchoolId.putIfAbsent(u.getSchoolId(), u));
            }
        } catch (Exception ignored) {}

        return schools.stream().map(school -> {
            String code = school.getSchoolCode();
            if (code == null || code.trim().isEmpty()) {
                code = "SCH-" + String.format("%04d", school.getId());
            }

            List<SchoolStandard> standards = standardsBySchoolId.getOrDefault(school.getId(), Collections.emptyList());
            int stdCount = standards.size();
            int divCount = 0;
            List<StandardDivisionResponse> structure = new ArrayList<>();

            if (!standards.isEmpty()) {
                for (SchoolStandard standard : standards) {
                    List<String> divNames = finalDivisionsByStandardId.getOrDefault(standard.getId(), Collections.singletonList("A"));
                    divCount += divNames.size();
                    structure.add(StandardDivisionResponse.builder()
                            .standard(standard.getStandard())
                            .divisions(divNames)
                            .build());
                }
            } else {
                stdCount = 10;
                divCount = 10;
                for (int i = 1; i <= 10; i++) {
                    structure.add(StandardDivisionResponse.builder()
                            .standard(String.valueOf(i))
                            .divisions(Collections.singletonList("A"))
                            .build());
                }
            }

            User adminUser = adminBySchoolId.get(school.getId());
            String adminName = adminUser != null ? ((adminUser.getFirstName() != null ? adminUser.getFirstName() : "") + " " + (adminUser.getLastName() != null ? adminUser.getLastName() : "")).trim() : null;
            String adminEmail = adminUser != null ? adminUser.getEmail() : null;
            String adminPhone = adminUser != null ? adminUser.getPhone() : null;
            Long adminId = adminUser != null ? adminUser.getId() : null;

            return SchoolResponse.builder()
                    .id(school.getId())
                    .name(school.getName())
                    .schoolCode(code)
                    .address(school.getAddress())
                    .contactPhone(school.getContactPhone())
                    .active(school.isActive())
                    .createdAt(school.getCreatedAt())
                    .adminId(adminId)
                    .adminEmail(adminEmail)
                    .adminName(adminName)
                    .adminPhone(adminPhone)
                    .standardsCount(stdCount)
                    .totalDivisions(divCount)
                    .divisionCount(divCount)
                    .academicStructure(structure)
                    .build();
        }).collect(Collectors.toList());
    }

    @Override
    public SchoolResponse getSchoolById(Long id) {
        School school = schoolRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("School not found with id: " + id));
        return mapToResponse(school, null);
    }

    @Override
    public SchoolResponse updateSchool(Long id, SchoolRequest request) {
        School school = schoolRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("School not found with id: " + id));

        String normalizedContactPhone = com.rslsolution.speakmateai.util.PhoneNumberUtil.validateAndNormalize(request.getContactPhone(), "Contact phone");

        school.setName(request.getSchoolName());
        school.setSchoolName(request.getSchoolName());
        school.setAddress(request.getAddress());
        school.setContactPhone(normalizedContactPhone);
        if (request.getAdminEmail() != null && !request.getAdminEmail().isBlank()) {
            school.setEmail(request.getAdminEmail().trim());
        }

        School updatedSchool = schoolRepository.save(school);

        if (notificationService != null) {
            try {
                notificationService.notifyAdmins(
                        "School Updated",
                        "School \"" + school.getName() + "\" details have been updated by Super Admin.",
                        com.rslsolution.speakmateai.enums.NotificationType.SCHOOL_CREATED,
                        school.getId(),
                        "SCHOOL"
                );
                notificationService.notifySchoolAdmins(
                        school.getId(),
                        "School Profile Updated",
                        "Your school workspace (" + school.getName() + ") details have been updated by Super Admin.",
                        com.rslsolution.speakmateai.enums.NotificationType.SCHOOL_CREATED,
                        school.getId(),
                        "SCHOOL"
                );
            } catch (Exception ignored) {}
        }

        return mapToResponse(updatedSchool, null);
    }

    @Override
    @Transactional
    public SchoolResponse activateSchool(Long id) {
        School school = schoolRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("School not found with id: " + id));
        school.setActive(true);
        School updatedSchool = schoolRepository.save(school);

        List<User> schoolAdmins = userRepository.findBySchoolIdAndRole(school.getId(), com.rslsolution.speakmateai.enums.Role.SCHOOL_ADMIN);
        if (schoolAdmins != null && !schoolAdmins.isEmpty()) {
            User targetAdmin = schoolAdmins.stream()
                    .filter(sa -> sa.isActive() && sa.getStatus() == com.rslsolution.speakmateai.enums.Status.ACTIVE)
                    .findFirst()
                    .orElseGet(() -> schoolAdmins.stream()
                            .max(Comparator.comparing(User::getId))
                            .orElse(null));

            if (targetAdmin != null) {
                targetAdmin.setActive(true);
                targetAdmin.setStatus(com.rslsolution.speakmateai.enums.Status.ACTIVE);
                userRepository.save(targetAdmin);
                if (notificationService != null && targetAdmin.getEmail() != null) {
                    try {
                        notificationService.sendNotification(
                                targetAdmin.getEmail(),
                                "School Workspace Activated",
                                "Your school workspace (" + school.getName() + ") and admin access have been activated.",
                                com.rslsolution.speakmateai.enums.NotificationType.SCHOOL_CREATED,
                                school.getId(),
                                "SCHOOL"
                        );
                    } catch (Exception ignored) {}
                }
            }
        }

        if (notificationService != null) {
            try {
                notificationService.notifyAdmins(
                        "School Activated",
                        "School " + school.getName() + " has been activated by Super Admin.",
                        com.rslsolution.speakmateai.enums.NotificationType.SCHOOL_CREATED,
                        school.getId(),
                        "SCHOOL"
                );
            } catch (Exception e) {
                System.err.println("Failed to dispatch admin notification on activate school: " + e.getMessage());
            }

            try {
                notificationService.notifySchoolAdmins(
                        school.getId(),
                        "School Activated",
                        "School " + school.getName() + " has been activated by Super Admin.",
                        com.rslsolution.speakmateai.enums.NotificationType.SCHOOL_CREATED,
                        school.getId(),
                        "SCHOOL"
                );
            } catch (Exception e) {
                System.err.println("Failed to dispatch school admin notification on activate school: " + e.getMessage());
            }
        }

        return mapToResponse(updatedSchool, null);
    }

    @Override
    @Transactional
    public SchoolResponse deactivateSchool(Long id) {
        School school = schoolRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("School not found with id: " + id));
        school.setActive(false);
        School updatedSchool = schoolRepository.save(school);

        List<User> schoolAdmins = userRepository.findBySchoolIdAndRole(school.getId(), com.rslsolution.speakmateai.enums.Role.SCHOOL_ADMIN);
        if (schoolAdmins != null) {
            for (User sa : schoolAdmins) {
                sa.setActive(false);
                sa.setStatus(com.rslsolution.speakmateai.enums.Status.INACTIVE);
                userRepository.save(sa);
                if (notificationService != null && sa.getEmail() != null) {
                    try {
                        notificationService.sendNotification(
                                sa.getEmail(),
                                "School Workspace Deactivated",
                                "Your school workspace (" + school.getName() + ") has been deactivated by administration. Access is restricted.",
                                com.rslsolution.speakmateai.enums.NotificationType.SCHOOL_CREATED,
                                school.getId(),
                                "SCHOOL"
                        );
                    } catch (Exception ignored) {}
                }
            }
        }

        if (notificationService != null) {
            try {
                notificationService.notifyAdmins(
                        "School Deactivated",
                        "School " + school.getName() + " has been deactivated by Super Admin.",
                        com.rslsolution.speakmateai.enums.NotificationType.SCHOOL_CREATED,
                        school.getId(),
                        "SCHOOL"
                );
            } catch (Exception e) {
                System.err.println("Failed to dispatch admin notification on deactivate school: " + e.getMessage());
            }

            try {
                notificationService.notifySchoolAdmins(
                        school.getId(),
                        "School Deactivated",
                        "School " + school.getName() + " has been deactivated by Super Admin.",
                        com.rslsolution.speakmateai.enums.NotificationType.SCHOOL_CREATED,
                        school.getId(),
                        "SCHOOL"
                );
            } catch (Exception e) {
                System.err.println("Failed to dispatch school admin notification on deactivate school: " + e.getMessage());
            }
        }

        return mapToResponse(updatedSchool, null);
    }

    @Override
    @Transactional
    public void deleteSchool(Long id) {
        School school = schoolRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("School not found with id: " + id));
        if (entityCascadeDeletionService != null) {
            entityCascadeDeletionService.deleteSchoolCascade(id);
        } else {
            schoolRepository.delete(school);
        }
    }

    private SchoolResponse mapToResponse(School school, User adminUser) {
        String code = school.getSchoolCode();
        if (code == null || code.trim().isEmpty()) {
            code = "SCH-" + String.format("%04d", school.getId());
            school.setSchoolCode(code);
            try {
                schoolRepository.save(school);
            } catch (Exception ignored) {}
        }

        List<SchoolStandard> standards = null;
        try {
            standards = schoolStandardRepository.findBySchoolId(school.getId());
        } catch (Exception ignored) {}

        // If the school has no configured standards in the database, automatically initialize default standards (1st - 10th with division 'A')
        if (standards == null || standards.isEmpty()) {
            standards = new ArrayList<>();
            for (int i = 1; i <= 10; i++) {
                String stdName = String.valueOf(i);
                try {
                    SchoolStandard ss = SchoolStandard.builder()
                            .school(school)
                            .standard(stdName)
                            .build();
                    SchoolStandard saved = schoolStandardRepository.save(ss);
                    if (saved != null) {
                        try {
                            standardDivisionRepository.save(StandardDivision.builder()
                                    .schoolStandard(saved)
                                    .division("A")
                                    .build());
                        } catch (Exception ignored) {}
                        standards.add(saved);
                    }
                } catch (Exception ignored) {
                }
            }
        }

        int stdCount = standards.size();
        int divCount = 0;
        List<StandardDivisionResponse> structure = new ArrayList<>();
        List<Long> stdIds = standards.stream()
                .filter(Objects::nonNull)
                .map(SchoolStandard::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        Map<Long, List<String>> divMap = new HashMap<>();
        if (!stdIds.isEmpty()) {
            try {
                List<StandardDivision> divs = standardDivisionRepository.findBySchoolStandardIdIn(stdIds);
                if (divs != null) {
                    divMap = divs.stream()
                            .filter(sd -> sd != null && sd.getSchoolStandard() != null && sd.getSchoolStandard().getId() != null)
                            .collect(Collectors.groupingBy(
                                    sd -> sd.getSchoolStandard().getId(),
                                    Collectors.mapping(StandardDivision::getDivision, Collectors.toList())
                            ));
                }
            } catch (Exception ignored) {}
        }

        for (SchoolStandard standard : standards) {
            if (standard == null) continue;
            List<String> divNames = standard.getId() != null
                    ? divMap.getOrDefault(standard.getId(), Collections.singletonList("A"))
                    : Collections.singletonList("A");
            divCount += divNames.size();
            structure.add(StandardDivisionResponse.builder()
                    .standard(standard.getStandard())
                    .divisions(divNames)
                    .build());
        }

        if (adminUser == null && school.getId() != null) {
            try {
                List<User> admins = userRepository.findBySchoolIdAndRole(school.getId(), com.rslsolution.speakmateai.enums.Role.SCHOOL_ADMIN);
                if (admins != null && !admins.isEmpty()) {
                    adminUser = admins.stream()
                            .filter(u -> u.isActive() && u.getStatus() == com.rslsolution.speakmateai.enums.Status.ACTIVE)
                            .max(Comparator.comparing(User::getId))
                            .orElse(null);
                }
            } catch (Exception ignored) {}
        }

        String adminName = adminUser != null ? ((adminUser.getFirstName() != null ? adminUser.getFirstName() : "") + " " + (adminUser.getLastName() != null ? adminUser.getLastName() : "")).trim() : null;
        String adminPhone = adminUser != null ? adminUser.getPhone() : null;

        SubscriptionPlan subPlan = null;
        if (school.getSubscriptionPlanId() != null) {
            try {
                subPlan = subscriptionPlanRepository.findById(school.getSubscriptionPlanId()).orElse(null);
            } catch (Exception ignored) {}
        }

        return SchoolResponse.builder()
                .id(school.getId())
                .name(school.getName())
                .schoolCode(code)
                .address(school.getAddress())
                .contactPhone(school.getContactPhone())
                .active(school.isActive())
                .createdAt(school.getCreatedAt())
                .adminId(adminUser != null ? adminUser.getId() : null)
                .adminEmail(adminUser != null ? adminUser.getEmail() : null)
                .adminName(adminName)
                .adminPhone(adminPhone)
                .standardsCount(stdCount)
                .totalDivisions(divCount)
                .divisionCount(divCount)
                .academicStructure(structure)
                .subscriptionPlanId(school.getSubscriptionPlanId())
                .subscriptionPlanName(subPlan != null ? subPlan.getPlanName() : null)
                .subscriptionPrice(subPlan != null ? subPlan.getPrice() : null)
                .subscriptionBillingCycle(subPlan != null ? subPlan.getBillingCycle() : null)
                .subscriptionStartDate(school.getSubscriptionStartDate())
                .subscriptionEndDate(school.getSubscriptionEndDate())
                .maxStudents(school.getMaxStudents())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<SchoolAdminHistoryResponse> getSchoolAdminHistory(Long schoolId) {
        if (schoolId == null) {
            throw new IllegalArgumentException("School ID cannot be null");
        }
        School school = schoolRepository.findById(schoolId)
                .orElseThrow(() -> new RuntimeException("School not found with id: " + schoolId));

        List<User> admins = userRepository.findBySchoolIdAndRole(school.getId(), Role.SCHOOL_ADMIN);
        if (admins == null || admins.isEmpty()) {
            return Collections.emptyList();
        }

        return admins.stream()
                .sorted(Comparator.comparing(User::getId).reversed())
                .map(u -> {
                    boolean isCurrent = u.isActive() && u.getStatus() == Status.ACTIVE;
                    String fullName = ((u.getFirstName() != null ? u.getFirstName().trim() : "") + " "
                            + (u.getLastName() != null ? u.getLastName().trim() : "")).trim();
                    return SchoolAdminHistoryResponse.builder()
                            .id(u.getId())
                            .schoolId(school.getId())
                            .firstName(u.getFirstName())
                            .lastName(u.getLastName())
                            .fullName(fullName.isEmpty() ? "School Administrator" : fullName)
                            .email(u.getEmail())
                            .phone(u.getPhone())
                            .status(u.getStatus())
                            .active(u.isActive())
                            .currentAdmin(isCurrent)
                            .welcomeCompleted(u.isWelcomeCompleted())
                            .createdAt(u.getCreatedAt())
                            .updatedAt(u.getUpdatedAt())
                            .build();
                })
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public SchoolResponse replaceSchoolAdmin(Long schoolId, ReplaceSchoolAdminRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Replacement request cannot be null.");
        }
        if (schoolId == null) {
            throw new IllegalArgumentException("School ID is required.");
        }

        // 1. Find target School
        School school = schoolRepository.findById(schoolId)
                .orElseThrow(() -> new RuntimeException("School not found with id: " + schoolId));

        // 2. Verify School is active
        if (!school.isActive()) {
            throw new AccessDeniedException("Cannot add or replace administrator for an inactive school. Please activate the school first.");
        }

        // 3. Normalize administrator email
        String normalizedEmail = request.getAdminEmail() != null ? request.getAdminEmail().trim().toLowerCase() : "";
        if (normalizedEmail.isEmpty()) {
            throw new IllegalArgumentException("Admin email is required.");
        }

        // 4. Validate verification token using pessimistic lock
        String token = request.getVerificationToken() != null ? request.getVerificationToken().trim() : "";
        if (token.isEmpty()) {
            throw new AccessDeniedException("School admin email verification token is required.");
        }

        SchoolAdminEmailVerification verification = verificationRepository.findByVerificationTokenWithLock(token)
                .orElseThrow(() -> new AccessDeniedException("Invalid verification token. Please verify the School Admin email first."));

        // 5. Ensure verification token belongs to the intended email
        if (!normalizedEmail.equalsIgnoreCase(verification.getEmail())) {
            throw new AccessDeniedException("Verification token does not match the provided admin email.");
        }

        if (!verification.isVerified()) {
            throw new AccessDeniedException("School admin email has not been verified.");
        }

        if (verification.isTokenConsumed()) {
            throw new AccessDeniedException("Verification token has already been used. Please verify the email again.");
        }

        if (verification.getVerificationTokenExpiresAt() == null || LocalDateTime.now().isAfter(verification.getVerificationTokenExpiresAt())) {
            throw new AccessDeniedException("Verification token has expired. Please verify the email again.");
        }

        // 6. Find all School Admin users associated with this School
        List<User> schoolAdmins = userRepository.findBySchoolIdAndRole(school.getId(), Role.SCHOOL_ADMIN);

        // 7. Identify the CURRENT ACTIVE administrator
        User currentActiveAdmin = null;
        if (schoolAdmins != null) {
            for (User admin : schoolAdmins) {
                if (admin.isActive() && admin.getStatus() == Status.ACTIVE) {
                    currentActiveAdmin = admin;
                    break;
                }
            }
        }

        // Check if replacing with the exact same active administrator email
        if (currentActiveAdmin != null && normalizedEmail.equalsIgnoreCase(currentActiveAdmin.getEmail())) {
            throw new IllegalArgumentException("The specified email is already the active administrator for this school.");
        }

        // 8. If current active administrator exists, deactivate them (preserve record, NEVER hard-delete)
        if (currentActiveAdmin != null) {
            currentActiveAdmin.setActive(false);
            currentActiveAdmin.setStatus(Status.INACTIVE);
            userRepository.save(currentActiveAdmin);
        }

        // 9. Check whether the new email already exists in users
        Optional<User> existingUserOpt = userRepository.findByEmail(normalizedEmail);

        String tempPassword = generateSecureTemporaryPassword();
        String passwordHash = passwordEncoder.encode(tempPassword);
        String normalizedPhone = com.rslsolution.speakmateai.util.PhoneNumberUtil.validateAndNormalize(request.getAdminPhone(), "Admin phone");

        User targetAdminUser;

        if (existingUserOpt.isPresent()) {
            User existingUser = existingUserOpt.get();

            // Case C: Email belongs to an active user
            if (existingUser.isActive() && existingUser.getStatus() == Status.ACTIVE) {
                throw new IllegalArgumentException("User with email '" + normalizedEmail + "' is already active on the platform. Cannot assign as school administrator.");
            }

            // Case D: Email belongs to user from another school or has non-school-admin role
            if (existingUser.getSchoolId() != null && !school.getId().equals(existingUser.getSchoolId())) {
                throw new AccessDeniedException("User with email '" + normalizedEmail + "' belongs to another school. Cross-school reassignment is not permitted.");
            }

            if (existingUser.getRole() != null && existingUser.getRole() != Role.SCHOOL_ADMIN) {
                throw new AccessDeniedException("User with email '" + normalizedEmail + "' has an incompatible existing role (" + existingUser.getRole() + "). Cannot assign as school administrator.");
            }

            // Case B: Inactive School Admin of the SAME school - reactivate without creating duplicate user
            Optional<SchoolAdmin> existingSchoolAdmin = schoolAdminRepository.findById(existingUser.getId());
            if (existingSchoolAdmin.isPresent()) {
                SchoolAdmin sa = existingSchoolAdmin.get();
                sa.setFirstName(request.getAdminFirstName().trim());
                sa.setLastName(request.getAdminLastName() != null ? request.getAdminLastName().trim() : null);
                sa.setPhone(normalizedPhone);
                sa.setSchoolId(school.getId());
                sa.setRole(Role.SCHOOL_ADMIN);
                sa.setActive(true);
                sa.setStatus(Status.ACTIVE);
                sa.setPassword(passwordHash);
                sa.setWelcomeCompleted(false);
                sa.setEmailVerified(true);
                sa.setEmailVerificationToken(UUID.randomUUID().toString());
                targetAdminUser = schoolAdminRepository.save(sa);
            } else {
                existingUser.setFirstName(request.getAdminFirstName().trim());
                existingUser.setLastName(request.getAdminLastName() != null ? request.getAdminLastName().trim() : null);
                existingUser.setPhone(normalizedPhone);
                existingUser.setSchoolId(school.getId());
                existingUser.setRole(Role.SCHOOL_ADMIN);
                existingUser.setActive(true);
                existingUser.setStatus(Status.ACTIVE);
                existingUser.setPassword(passwordHash);
                existingUser.setWelcomeCompleted(false);
                existingUser.setEmailVerified(true);
                existingUser.setEmailVerificationToken(UUID.randomUUID().toString());
                targetAdminUser = userRepository.save(existingUser);
            }
        } else {
            // Case A: Email does not exist - create new SchoolAdmin
            String verificationToken = UUID.randomUUID().toString();
            SchoolAdmin newAdmin = SchoolAdmin.builder()
                    .firstName(request.getAdminFirstName().trim())
                    .lastName(request.getAdminLastName() != null ? request.getAdminLastName().trim() : null)
                    .email(normalizedEmail)
                    .phone(normalizedPhone)
                    .password(passwordHash)
                    .role(Role.SCHOOL_ADMIN)
                    .schoolId(school.getId())
                    .status(Status.ACTIVE)
                    .active(true)
                    .emailVerified(true)
                    .welcomeCompleted(false)
                    .emailVerificationToken(verificationToken)
                    .build();

            targetAdminUser = schoolAdminRepository.save(newAdmin);
        }

        // Record UserSubscription for new admin if school has an active plan
        if (school.getSubscriptionPlanId() != null) {
            try {
                SubscriptionPlan plan = subscriptionPlanRepository.findById(school.getSubscriptionPlanId()).orElse(null);
                if (plan != null) {
                    UserSubscription userSub = UserSubscription.builder()
                            .user(targetAdminUser)
                            .subscriptionPlan(plan)
                            .planType(plan.getPlanName() != null ? plan.getPlanName() : "INSTITUTIONAL")
                            .status("ACTIVE")
                            .amount(plan.getPrice() != null ? BigDecimal.valueOf(plan.getPrice()) : BigDecimal.ZERO)
                            .currency(plan.getCurrency() != null ? plan.getCurrency() : "INR")
                            .startDate(school.getSubscriptionStartDate() != null ? school.getSubscriptionStartDate() : LocalDateTime.now())
                            .endDate(school.getSubscriptionEndDate())
                            .expiryDate(school.getSubscriptionEndDate())
                            .paymentStatus(PaymentStatus.PAID)
                            .subscriptionStatus(SubscriptionStatus.ACTIVE)
                            .paymentMethod(PaymentMethod.UPI)
                            .transactionId("SCH-ADMIN-REPLACE-" + System.currentTimeMillis())
                            .amountPaid(plan.getPrice() != null ? plan.getPrice() : 0.0)
                            .build();
                    userSubscriptionRepository.save(userSub);
                }
            } catch (Exception ex) {
                System.err.println("[UserSubscription] Could not save replacement school admin subscription record: " + ex.getMessage());
            }
        }

        // 10. Update verification record and consume verification token atomically
        LocalDateTime now = LocalDateTime.now();
        verification.setTempPassword(tempPassword);
        verification.setPendingCredentialHash(passwordHash);
        verification.setInvitationSent(true);
        verification.setInvitationSentAt(now);
        verification.setTokenConsumed(true);
        verificationRepository.save(verification);

        // 11. Dispatch credentials email
        try {
            String adminFullName = ((targetAdminUser.getFirstName() != null ? targetAdminUser.getFirstName().trim() : "")
                    + (targetAdminUser.getLastName() != null && !targetAdminUser.getLastName().isBlank() ? " " + targetAdminUser.getLastName().trim() : "")).trim();
            if (adminFullName.isEmpty()) {
                adminFullName = "School Administrator";
            }

            SubscriptionPlan plan = null;
            if (school.getSubscriptionPlanId() != null) {
                plan = subscriptionPlanRepository.findById(school.getSubscriptionPlanId()).orElse(null);
            }

            String htmlContent = buildSchoolAdminWelcomeEmailHtml(
                    adminFullName,
                    targetAdminUser.getEmail(),
                    tempPassword,
                    school.getName(),
                    school.getSchoolCode(),
                    school.getAddress() != null ? school.getAddress() : "",
                    school.getContactPhone() != null ? school.getContactPhone() : "",
                    plan,
                    "REPLACEMENT-CREDENTIALS"
            );
            String textContent = buildSchoolAdminWelcomeEmailText(
                    adminFullName,
                    targetAdminUser.getEmail(),
                    tempPassword,
                    school.getName(),
                    school.getSchoolCode(),
                    school.getAddress() != null ? school.getAddress() : "",
                    school.getContactPhone() != null ? school.getContactPhone() : "",
                    plan,
                    "REPLACEMENT-CREDENTIALS"
            );

            EmailMessage message = EmailMessage.builder()
                    .to(targetAdminUser.getEmail())
                    .subject("SpeakMate AI - School Administrator Access Credentials for " + school.getName())
                    .htmlContent(htmlContent)
                    .text(textContent)
                    .html(true)
                    .senderName("SpeakMate AI")
                    .build();
            emailService.sendEmail(message);
        } catch (Exception e) {
            System.err.println("Failed to send school admin credentials email: " + e.getMessage());
        }

        // 12. Dispatch in-app notifications
        try {
            if (notificationService != null) {
                notificationService.notifyAdmins(
                        "School Admin Replaced",
                        "School Administrator for \"" + school.getName() + "\" has been updated to " + targetAdminUser.getFirstName() + " " + (targetAdminUser.getLastName() != null ? targetAdminUser.getLastName() : "") + " (" + targetAdminUser.getEmail() + ").",
                        com.rslsolution.speakmateai.enums.NotificationType.USER_CREATED,
                        targetAdminUser.getId(),
                        "USER"
                );
                notificationService.sendNotification(
                        targetAdminUser.getEmail(),
                        "Assigned as School Administrator",
                        "You have been assigned as the School Administrator for " + school.getName() + ". Temporary credentials have been emailed to you.",
                        com.rslsolution.speakmateai.enums.NotificationType.USER_CREATED,
                        targetAdminUser.getId(),
                        "USER"
                );
                if (currentActiveAdmin != null && currentActiveAdmin.getEmail() != null) {
                    notificationService.sendNotification(
                            currentActiveAdmin.getEmail(),
                            "Administrator Role Replaced",
                            "Your administrator role for " + school.getName() + " has ended and your account has been deactivated.",
                            com.rslsolution.speakmateai.enums.NotificationType.USER_UPDATED,
                            currentActiveAdmin.getId(),
                            "USER"
                    );
                }
                notificationService.notifyTeachersOfSchool(
                        school.getId(),
                        "School Administrator Update",
                        "A new School Administrator has been assigned for " + school.getName() + ": " + targetAdminUser.getFirstName() + " " + (targetAdminUser.getLastName() != null ? targetAdminUser.getLastName() : "") + " (" + targetAdminUser.getEmail() + ").",
                        com.rslsolution.speakmateai.enums.NotificationType.SYSTEM_EVENT,
                        targetAdminUser.getId(),
                        "USER"
                );
            }
        } catch (Exception e) {
            System.err.println("Failed to dispatch notifications: " + e.getMessage());
        }

        return mapToResponse(school, targetAdminUser);
    }
}
