package com.rslsolution.speakmateai.service.impl;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rslsolution.speakmateai.dto.request.ForgotPasswordRequest;
import com.rslsolution.speakmateai.dto.request.LoginRequest;
import com.rslsolution.speakmateai.dto.request.RegisterRequest;
import com.rslsolution.speakmateai.dto.request.ResetPasswordRequest;
import com.rslsolution.speakmateai.dto.request.SendRegistrationOtpRequest;
import com.rslsolution.speakmateai.dto.request.VerifyOtpRequest;
import com.rslsolution.speakmateai.dto.response.AuthResponse;
import com.rslsolution.speakmateai.dto.response.UserResponse;
import com.rslsolution.speakmateai.dto.response.VerifyOtpResponse;
import com.rslsolution.speakmateai.entity.Onboarding;
import com.rslsolution.speakmateai.entity.Progress;
import com.rslsolution.speakmateai.entity.Settings;
import com.rslsolution.speakmateai.entity.User;
import com.rslsolution.speakmateai.enums.Role;
import com.rslsolution.speakmateai.exception.DuplicateEmailException;
import com.rslsolution.speakmateai.exception.InvalidCredentialsException;
import com.rslsolution.speakmateai.exception.UserNotFoundException;
import com.rslsolution.speakmateai.repository.OnboardingRepository;
import com.rslsolution.speakmateai.repository.ProgressRepository;
import com.rslsolution.speakmateai.repository.SettingsRepository;
import com.rslsolution.speakmateai.repository.UserRepository;
import com.rslsolution.speakmateai.service.UserService;
import com.rslsolution.speakmateai.util.JwtUtil;
import com.rslsolution.speakmateai.util.ValidationUtils;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import jakarta.mail.internet.MimeMessage;

@Service
@Transactional
public class UserServiceImpl implements UserService {

	@jakarta.persistence.PersistenceContext
	private jakarta.persistence.EntityManager entityManager;

	@Autowired(required = false)
	private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ProgressRepository progressRepository;

	@Autowired
	private SettingsRepository settingsRepository;

	@Autowired
	private OnboardingRepository onboardingRepository;

	@Autowired(required = false)
	private com.rslsolution.speakmateai.repository.UserSubscriptionRepository userSubscriptionRepository;

	@Autowired(required = false)
	private com.rslsolution.speakmateai.repository.SchoolRepository schoolRepository;

	@Autowired(required = false)
	private com.rslsolution.speakmateai.repository.SchoolAdminRepository schoolAdminRepository;

	@Autowired(required = false)
	private com.rslsolution.speakmateai.repository.TeacherRepository teacherRepository;

	@Autowired(required = false)
	private com.rslsolution.speakmateai.repository.StudentRepository studentRepository;

	@Autowired(required = false)
	private com.rslsolution.speakmateai.repository.AdminRepository adminRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Autowired
	private JwtUtil jwtUtil;

	@Autowired(required = false)
	private JavaMailSender mailSender;

	@Value("${brevo.api.key:${BREVO_API_KEY:}}")
	private String configuredBrevoApiKey;

	private static final java.security.SecureRandom SECURE_RANDOM = new java.security.SecureRandom();
	private static final int MAX_OTP_ATTEMPTS = 5;
	private static final int OTP_COOLDOWN_SECONDS = 30;
	private static final java.util.Map<String, LocalDateTime> otpCooldownMap = new java.util.concurrent.ConcurrentHashMap<>();

	private static final java.util.Map<String, RegistrationOtpDetails> registrationOtpMap = new java.util.concurrent.ConcurrentHashMap<>();
	private static final java.util.Map<String, RegistrationOtpDetails> deleteAccountOtpMap = new java.util.concurrent.ConcurrentHashMap<>();

	private static class RegistrationOtpDetails {
		private final String otp;
		private final LocalDateTime expiry;
		private int attempts = 0;

		public RegistrationOtpDetails(String otp, LocalDateTime expiry) {
			this.otp = otp;
			this.expiry = expiry;
			this.attempts = 0;
		}

		public String getOtp() { return otp; }
		public LocalDateTime getExpiry() { return expiry; }
		public int getAttempts() { return attempts; }
		public int incrementAttempts() { return ++this.attempts; }
	}

	private String generateSecureOtp() {
		return String.format("%06d", SECURE_RANDOM.nextInt(1000000));
	}

	private void checkOtpCooldown(String email) {
		if (email == null || email.isBlank()) return;
		String key = email.trim().toLowerCase();
		LocalDateTime lastSent = otpCooldownMap.get(key);
		if (lastSent != null && lastSent.plusSeconds(OTP_COOLDOWN_SECONDS).isAfter(LocalDateTime.now())) {
			long wait = java.time.Duration.between(LocalDateTime.now(), lastSent.plusSeconds(OTP_COOLDOWN_SECONDS)).getSeconds();
			throw new IllegalArgumentException("Please wait " + Math.max(1, wait) + " seconds before requesting another verification code.");
		}
		otpCooldownMap.put(key, LocalDateTime.now());
	}

	@Override
	public void sendRegistrationOtp(SendRegistrationOtpRequest request) {
		String cleanEmail = ValidationUtils.normalizeEmail(request.getEmail());
		if (cleanEmail == null || cleanEmail.isEmpty()) {
			throw new IllegalArgumentException("Email is required.");
		}

		if (userRepository.existsByEmail(cleanEmail) || userRepository.existsByEmailIgnoreCase(cleanEmail)) {
			throw new DuplicateEmailException("Email is already registered. Please sign in instead.");
		}

		checkOtpCooldown(cleanEmail);

		String otp = generateSecureOtp();
		registrationOtpMap.put(cleanEmail, new RegistrationOtpDetails(otp, LocalDateTime.now().plusMinutes(10)));

		String htmlContent = String.format(
			"<!DOCTYPE html>\n" +
			"<html>\n" +
			"<head>\n" +
			"    <style>\n" +
			"        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 20px; }\n" +
			"        .container { max-width: 600px; background-color: #FFFFFF; border-radius: 16px; padding: 40px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); }\n" +
			"        .logo { font-size: 28px; font-weight: 900; color: #4F46E5; text-align: center; margin-bottom: 24px; }\n" +
			"        h1 { font-size: 22px; font-weight: 700; color: #0F172A; margin-bottom: 16px; text-align: center; }\n" +
			"        p { font-size: 15px; color: #64748B; line-height: 24px; margin-bottom: 24px; }\n" +
			"        .otp-box { background-color: #EEF2FF; border: 2px dashed #6366F1; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }\n" +
			"        .otp-code { font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #4F46E5; margin: 0; }\n" +
			"        .footer { text-align: center; font-size: 13px; color: #94A3B8; margin-top: 32px; border-top: 1px solid #E2E8F0; padding-top: 20px; }\n" +
			"    </style>\n" +
			"</head>\n" +
			"<body>\n" +
			"    <div class=\"container\">\n" +
			"        <div class=\"logo\">SpeakMateAI</div>\n" +
			"        <h1>Verify Your Email Address</h1>\n" +
			"        <p>Thank you for signing up for SpeakMateAI! Please use the 6-digit Verification Code below to complete your registration:</p>\n" +
			"        <div class=\"otp-box\">\n" +
			"            <h2 class=\"otp-code\">%s</h2>\n" +
			"        </div>\n" +
			"        <p>This code is valid for <strong>10 minutes</strong>. If you did not request this registration, please ignore this email.</p>\n" +
			"        <div class=\"footer\">\n" +
			"            Welcome aboard,<br/><strong>SpeakMateAI Team</strong>\n" +
			"        </div>\n" +
			"    </div>\n" +
			"</body>\n" +
			"</html>", otp);

		sendAsyncEmail(cleanEmail, "Verify Your Email - SpeakMateAI Registration", htmlContent, otp);
	}

	@Override
	public VerifyOtpResponse verifyRegistrationOtp(VerifyOtpRequest request) {
		String email = ValidationUtils.normalizeEmail(request.getEmail());
		String otp = request.getOtp() != null ? request.getOtp().trim() : "";

		if (email == null || email.isEmpty()) {
			throw new IllegalArgumentException("Email is required.");
		}
		if (otp.isEmpty()) {
			throw new IllegalArgumentException("OTP verification code is required.");
		}

		RegistrationOtpDetails otpDetails = registrationOtpMap.get(email);
		if (otpDetails == null) {
			throw new IllegalArgumentException("No OTP verification code requested for this email or it has expired. Please tap Send OTP again.");
		}

		if (otpDetails.getExpiry().isBefore(LocalDateTime.now())) {
			registrationOtpMap.remove(email);
			throw new IllegalArgumentException("OTP verification code has expired. Please request a new code.");
		}

		if (otpDetails.getAttempts() >= MAX_OTP_ATTEMPTS) {
			registrationOtpMap.remove(email);
			throw new IllegalArgumentException("Maximum verification attempts exceeded. Please request a new verification code.");
		}

		if (!otpDetails.getOtp().trim().equals(otp)) {
			int currentAttempts = otpDetails.incrementAttempts();
			if (currentAttempts >= MAX_OTP_ATTEMPTS) {
				registrationOtpMap.remove(email);
				throw new IllegalArgumentException("Maximum verification attempts exceeded. Please request a new verification code.");
			}
			throw new IllegalArgumentException("Invalid OTP verification code. Please check your email and try again.");
		}

		return VerifyOtpResponse.builder()
				.message("Email verified successfully!")
				.build();
	}

	@Override
	public UserResponse register(RegisterRequest request) {
		String cleanEmail = ValidationUtils.normalizeEmail(request.getEmail());

		if (userRepository.existsByEmail(cleanEmail) || userRepository.existsByEmailIgnoreCase(cleanEmail)) {
			throw new DuplicateEmailException("Email already exists.");
		}

		ValidationUtils.validateName(request.getFirstName());
		ValidationUtils.validateName(request.getLastName());

		if (request.getConfirmPassword() == null || !request.getConfirmPassword().equals(request.getPassword())) {
			throw new IllegalArgumentException("Passwords do not match.");
		}

		// Verify registration OTP
		RegistrationOtpDetails otpDetails = registrationOtpMap.get(cleanEmail);
		String inputOtp = request.getOtp() != null ? request.getOtp().trim() : "";
		if (otpDetails == null) {
			throw new IllegalArgumentException("No OTP verification code requested for this email or it has expired. Please tap Send OTP again.");
		}

		if (otpDetails.getExpiry().isBefore(LocalDateTime.now())) {
			registrationOtpMap.remove(cleanEmail);
			throw new IllegalArgumentException("OTP verification code has expired. Please request a new code.");
		}

		if (otpDetails.getAttempts() >= MAX_OTP_ATTEMPTS) {
			registrationOtpMap.remove(cleanEmail);
			throw new IllegalArgumentException("Maximum verification attempts exceeded. Please request a new verification code.");
		}

		if (!otpDetails.getOtp().trim().equals(inputOtp)) {
			int currentAttempts = otpDetails.incrementAttempts();
			if (currentAttempts >= MAX_OTP_ATTEMPTS) {
				registrationOtpMap.remove(cleanEmail);
				throw new IllegalArgumentException("Maximum verification attempts exceeded. Please request a new verification code.");
			}
			throw new IllegalArgumentException("Invalid OTP verification code. Please check your email and try again.");
		}

		// Invalidate OTP after successful registration
		registrationOtpMap.remove(cleanEmail);

		validatePasswordStrength(request.getPassword());

		boolean isStudent = "STUDENT".equalsIgnoreCase(request.getAccountType())
				|| (request.getSchoolCode() != null && !request.getSchoolCode().trim().isEmpty())
				|| (request.getSchoolGrade() != null && !request.getSchoolGrade().trim().isEmpty());

		User user = User.builder()
				.firstName(request.getFirstName() != null ? request.getFirstName().trim() : null)
				.lastName(request.getLastName() != null ? request.getLastName().trim() : null)
				.email(cleanEmail)
				.password(passwordEncoder.encode(request.getPassword()))
				.role(isStudent ? Role.STUDENT : Role.USER)
				.active(true)
				.welcomeCompleted(false)
				.onboardingCompleted(false)
				.authProvider("LOCAL")
				.schoolGrade(isStudent ? (request.getSchoolGrade() != null ? request.getSchoolGrade().trim() : null) : null)
				.schoolName(isStudent && request.getSchoolCode() != null && !request.getSchoolCode().trim().isEmpty() ? request.getSchoolCode().trim().toUpperCase() : null)
				.build();

		User savedUser = userRepository.save(user);

		// Remove OTP after successful registration
		registrationOtpMap.remove(cleanEmail);

		// ── Auto-provision all default user-related records so that dashboard APIs
		// ── always return valid data for a brand-new user (never 404).
		provisionDefaultUserData(savedUser);

		return mapToUserResponse(savedUser);
	}

	/**
	 * Creates default Progress, Settings, and Onboarding records for a newly
	 * registered user. This is idempotent — it only inserts if the record does not
	 * already exist, preventing duplicates if called more than once.
	 */
	private void provisionDefaultUserData(User user) {

		// Default Progress: XP=0, Level=1, all streaks and counters at zero.
		if (!progressRepository.findByUser(user).isPresent()) {
			Progress defaultProgress = Progress.builder()
					.user(user)
					.xp(0)
					.level(1)
					.currentStreak(0)
					.longestStreak(0)
					.totalPracticeMinutes(0)
					.totalSpeakingSessions(0)
					.totalGrammarChecks(0)
					.totalVocabularyWords(0)
					.build();
			try {
				progressRepository.save(defaultProgress);
			} catch (Exception ex) {
				System.err.println("[Provision Warning] Default progress save: " + ex.getMessage());
			}
		}

		// Default Settings: all @Builder.Default values on the entity are used.
		if (!settingsRepository.findByUser(user).isPresent()) {
			Settings defaultSettings = Settings.builder()
					.user(user)
					.build();
			try {
				settingsRepository.save(defaultSettings);
			} catch (Exception ex) {
				System.err.println("[Provision Warning] Default settings save: " + ex.getMessage());
			}
		}

		// Default Onboarding: sensible defaults, marked as not yet completed.
		if (!onboardingRepository.findByUser(user).isPresent()) {
			Onboarding defaultOnboarding = Onboarding.builder()
					.user(user)
					.englishLevel("Beginner")
					.learningGoal("Improve English speaking skills")
					.dailyGoalMinutes(15)
					.nativeLanguage("English")
					.preferredLearningTime("Morning")
					.interests("General")
					.onboardingCompleted(false)
					.build();
			try {
				onboardingRepository.save(defaultOnboarding);
			} catch (Exception ex) {
				System.err.println("[Provision Warning] Default onboarding save: " + ex.getMessage());
			}
		}
	}

	private void validateUserAndSchoolActive(User user) {
		if (user == null || user.getRole() == Role.SUPER_ADMIN) {
			return;
		}
		if (!user.isActive() || user.getStatus() == com.rslsolution.speakmateai.enums.Status.INACTIVE) {
			throw new InvalidCredentialsException("Your account has been deactivated. Access is restricted. Please contact your administrator for assistance.");
		}
		if (user.getSchoolId() != null && schoolRepository != null) {
			schoolRepository.findById(user.getSchoolId()).ifPresent(school -> {
				if (!school.isActive()) {
					throw new InvalidCredentialsException("Your school workspace has been deactivated. Access is restricted. Please contact your administrator for assistance.");
				}
			});
		}
	}

	@Override
	public AuthResponse login(LoginRequest request) {
		String cleanEmail = ValidationUtils.normalizeEmail(request.getEmail());
		String cleanSchoolCode = request.getSchoolCode() != null ? request.getSchoolCode().trim() : "";
		String portalType = request.getPortalType() != null ? request.getPortalType().trim() : "";
		String loginType = request.getLoginType() != null ? request.getLoginType().trim() : "";

		boolean isStudentLogin = !cleanSchoolCode.isEmpty()
				|| "STUDENT".equalsIgnoreCase(portalType)
				|| "SCHOOL".equalsIgnoreCase(portalType)
				|| "STUDENT".equalsIgnoreCase(loginType)
				|| "SCHOOL".equalsIgnoreCase(loginType);

		String lookupEmail = cleanEmail != null ? cleanEmail : "";
		User user = userRepository.findByEmailIgnoreCase(lookupEmail)
				.orElseGet(() -> userRepository.findByEmail(lookupEmail)
						.orElseThrow(() -> new InvalidCredentialsException("No account found with this email address. Please check your email or register.")));

		validateUserAndSchoolActive(user);

		boolean isUserStudent = (user.getRole() == Role.STUDENT)
				|| (user.getSchoolId() != null)
				|| (user.getRole() != null && user.getRole().name().contains("STUDENT"));

		// 1. Personal / Individual user attempting Student Login mode -> MUST FAIL
		if (isStudentLogin && !isUserStudent) {
			throw new InvalidCredentialsException("This account is registered as an Individual Learner. Please use the Standard Login tab.");
		}

		// 2. Student user attempting Standard Login mode -> MUST FAIL
		if (!isStudentLogin && isUserStudent) {
			throw new InvalidCredentialsException("This account is registered as a School Student. Please use the Student Login tab with your School Code.");
		}

		// 3. Password verification
		if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
			throw new InvalidCredentialsException("Incorrect password");
		}

		// 4. Student Login school code validation: MUST match the student's actual associated school
		if (isStudentLogin) {
			if (cleanSchoolCode.isEmpty()) {
				throw new InvalidCredentialsException("Invalid student login details or school code.");
			}

			boolean schoolMatched = false;
			if (schoolRepository != null) {
				java.util.Optional<com.rslsolution.speakmateai.entity.School> schoolOpt = 
						schoolRepository.findBySchoolCodeIgnoreCase(cleanSchoolCode);
				if (schoolOpt.isPresent()) {
					com.rslsolution.speakmateai.entity.School school = schoolOpt.get();
					if (user.getSchoolId() != null && user.getSchoolId().equals(school.getId())) {
						schoolMatched = true;
					} else if (user.getSchoolName() != null && (
							user.getSchoolName().equalsIgnoreCase(school.getName()) ||
							user.getSchoolName().equalsIgnoreCase(school.getSchoolCode()))) {
						schoolMatched = true;
					}
				}
			}

			// Direct fallback: if student's schoolName directly matches the school code
			if (!schoolMatched && user.getSchoolName() != null && !user.getSchoolName().trim().isEmpty()) {
				if (user.getSchoolName().trim().equalsIgnoreCase(cleanSchoolCode)) {
					schoolMatched = true;
				}
			}

			if (!schoolMatched) {
				throw new InvalidCredentialsException("Invalid student login details or school code.");
			}
		}

		String token = (request.getClientType() != null && !request.getClientType().isBlank())
				? jwtUtil.generateToken(user.getEmail(), request.getClientType())
				: jwtUtil.generateToken(user.getEmail());

		return AuthResponse.builder().token(token).user(mapToUserResponse(user)).build();
	}

	@Override
	public AuthResponse loginSchoolAdmin(LoginRequest request) {
		String email = request.getEmail() != null ? request.getEmail().trim() : "";
		User user = (schoolAdminRepository != null ? schoolAdminRepository.findByEmail(email).map(sa -> (User) sa) : java.util.Optional.<User>empty())
				.or(() -> userRepository.findByEmail(email).filter(u -> u.getRole() == Role.SCHOOL_ADMIN))
				.orElseThrow(() -> new InvalidCredentialsException("No account found with this email address. Please check your email or register."));

		validateUserAndSchoolActive(user);
		if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
			throw new InvalidCredentialsException("Incorrect password");
		}
		String token = (request.getClientType() != null && !request.getClientType().isBlank())
				? jwtUtil.generateUserToken(user.getEmail(), "SCHOOL_ADMIN", request.getClientType())
				: jwtUtil.generateUserToken(user.getEmail(), "SCHOOL_ADMIN");
		return AuthResponse.builder().token(token).user(mapToUserResponse(user)).build();
	}

	@Override
	public AuthResponse loginTeacher(LoginRequest request) {
		String email = request.getEmail() != null ? request.getEmail().trim() : "";
		User user = (teacherRepository != null ? teacherRepository.findByEmail(email).map(t -> (User) t) : java.util.Optional.<User>empty())
				.or(() -> userRepository.findByEmail(email).filter(u -> u.getRole() == Role.TEACHER))
				.orElseThrow(() -> new InvalidCredentialsException("No account found with this email address. Please check your email or register."));

		validateUserAndSchoolActive(user);
		if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
			throw new InvalidCredentialsException("Incorrect password");
		}
		String token = (request.getClientType() != null && !request.getClientType().isBlank())
				? jwtUtil.generateUserToken(user.getEmail(), "TEACHER", request.getClientType())
				: jwtUtil.generateUserToken(user.getEmail(), "TEACHER");
		return AuthResponse.builder().token(token).user(mapToUserResponse(user)).build();
	}

	@Override
	public AuthResponse loginStudent(LoginRequest request) {
		String email = request.getEmail() != null ? request.getEmail().trim() : "";
		User user = (studentRepository != null ? studentRepository.findByEmail(email).map(s -> (User) s) : java.util.Optional.<User>empty())
				.or(() -> userRepository.findByEmail(email).filter(u -> u.getRole() == Role.STUDENT))
				.orElseThrow(() -> new InvalidCredentialsException("No account found with this email address. Please check your email or register."));

		validateUserAndSchoolActive(user);
		if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
			throw new InvalidCredentialsException("Incorrect password");
		}
		String token = (request.getClientType() != null && !request.getClientType().isBlank())
				? jwtUtil.generateUserToken(user.getEmail(), "STUDENT", request.getClientType())
				: jwtUtil.generateUserToken(user.getEmail(), "STUDENT");
		return AuthResponse.builder().token(token).user(mapToUserResponse(user)).build();
	}

	@Override
	public AuthResponse loginUser(LoginRequest request) {
		String email = request.getEmail() != null ? request.getEmail().trim() : "";
		User user = userRepository.findByEmail(email)
				.orElseThrow(() -> new InvalidCredentialsException("No account found with this email address. Please check your email or register."));

		if (user.getRole() != Role.USER && user.getRole() != Role.STUDENT) {
			throw new InvalidCredentialsException("This endpoint is for individual users and students only.");
		}
		validateUserAndSchoolActive(user);
		if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
			throw new InvalidCredentialsException("Incorrect password");
		}
		String tokenRole = user.getRole() == Role.STUDENT ? "STUDENT" : "USER";
		String token = (request.getClientType() != null && !request.getClientType().isBlank())
				? jwtUtil.generateUserToken(user.getEmail(), tokenRole, request.getClientType())
				: jwtUtil.generateUserToken(user.getEmail(), tokenRole);
		return AuthResponse.builder().token(token).user(mapToUserResponse(user)).build();
	}

	@Override
	public void resetPasswordWithTemporary(com.rslsolution.speakmateai.dto.request.ResetWithTemporaryPasswordRequest request) {
		String email = request.getEmail() != null ? request.getEmail().trim().toLowerCase() : "";
		if (email.isEmpty()) {
			throw new IllegalArgumentException("Email is required.");
		}
		String tempPassword = request.getTemporaryPassword() != null ? request.getTemporaryPassword().trim() : "";
		if (tempPassword.isEmpty()) {
			throw new IllegalArgumentException("Temporary password is required.");
		}
		String newPassword = request.getNewPassword() != null ? request.getNewPassword() : "";
		if (newPassword.isEmpty()) {
			throw new IllegalArgumentException("New password is required.");
		}
		if (tempPassword.equals(newPassword)) {
			throw new IllegalArgumentException("New password must be different from the temporary password.");
		}

		validatePasswordStrength(newPassword);

		User user = (schoolAdminRepository != null ? schoolAdminRepository.findByEmail(email).map(sa -> (User) sa) : java.util.Optional.<User>empty())
				.or(() -> (teacherRepository != null ? teacherRepository.findByEmail(email).map(t -> (User) t) : java.util.Optional.<User>empty()))
				.or(() -> userRepository.findByEmail(email))
				.orElse(null);

		if (user != null) {
			if (user.getRole() != Role.SUPER_ADMIN && (!user.isActive() || user.getStatus() == com.rslsolution.speakmateai.enums.Status.INACTIVE)) {
				throw new IllegalArgumentException("Your account has been deactivated. Access is restricted. Please contact your administrator for assistance.");
			}
			if (!passwordEncoder.matches(tempPassword, user.getPassword())) {
				throw new IllegalArgumentException("The temporary password entered is incorrect. Please check your credentials and try again.");
			}
			user.setPassword(passwordEncoder.encode(newPassword));
			user.setWelcomeCompleted(true);
			user.setResetPasswordToken(null);
			user.setResetPasswordTokenExpiry(null);
			user.setResetOtp(null);
			user.setResetOtpExpiry(null);
			user.setResetOtpAttempts(0);
			userRepository.save(user);
			return;
		}

		if (adminRepository != null) {
			com.rslsolution.speakmateai.entity.Admin admin = adminRepository.findByEmail(email).orElse(null);
			if (admin != null) {
				if (!passwordEncoder.matches(tempPassword, admin.getPassword())) {
					throw new IllegalArgumentException("The temporary password entered is incorrect. Please check your credentials and try again.");
				}
				admin.setPassword(passwordEncoder.encode(newPassword));
				admin.setResetOtp(null);
				admin.setResetOtpExpiry(null);
				adminRepository.save(admin);
				return;
			}
		}

		throw new IllegalArgumentException("No account found with the provided email.");
	}

	@Override
	public boolean checkNeedsFirstTimePasswordSetup(String email) {
		if (email == null || email.trim().isEmpty()) {
			return false;
		}
		String normalizedEmail = email.trim().toLowerCase();
		User user = (schoolAdminRepository != null ? schoolAdminRepository.findByEmail(normalizedEmail).map(sa -> (User) sa) : java.util.Optional.<User>empty())
				.or(() -> (teacherRepository != null ? teacherRepository.findByEmail(normalizedEmail).map(t -> (User) t) : java.util.Optional.<User>empty()))
				.or(() -> userRepository.findByEmail(normalizedEmail))
				.orElse(null);

		if (user != null) {
			return !user.isWelcomeCompleted();
		}
		return false;
	}

	private void validatePasswordStrength(String password) {
		if (password == null || password.isEmpty() || password.trim().isEmpty()) {
			throw new IllegalArgumentException("Password cannot be empty or whitespace only");
		}
		if (password.length() < 8) {
			throw new IllegalArgumentException("Password must be at least 8 characters");
		}
		if (password.length() > 128) {
			throw new IllegalArgumentException("Password must not exceed 128 characters");
		}
		boolean hasUpper = false;
		boolean hasLower = false;
		boolean hasDigit = false;
		boolean hasSpecial = false;
		String specialChars = "!@#$%^&*()_+-=[]{}|;':\",./<>?~`";
		for (char c : password.toCharArray()) {
			if (Character.isUpperCase(c)) {
				hasUpper = true;
			} else if (Character.isLowerCase(c)) {
				hasLower = true;
			} else if (Character.isDigit(c)) {
				hasDigit = true;
			} else if (specialChars.indexOf(c) >= 0 || !Character.isLetterOrDigit(c)) {
				hasSpecial = true;
			}
		}
		if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
			throw new IllegalArgumentException("Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character");
		}
	}

	@Override
	public UserResponse getCurrentUser() {

		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equals(authentication.getName())) {
			throw new UserNotFoundException("User not authenticated");
		}

		User user = userRepository.findByEmail(authentication.getName())
				.orElseThrow(() -> new UserNotFoundException("User not found"));

		return mapToUserResponse(user);
	}

	@Override
	public void forgotPassword(ForgotPasswordRequest request) {
		String cleanEmail = ValidationUtils.normalizeEmail(request.getEmail());
		String lookupEmail = cleanEmail != null ? cleanEmail : "";

		User user = userRepository.findByEmailIgnoreCase(lookupEmail)
				.orElseThrow(() -> new IllegalArgumentException("No registered account found with email: " + lookupEmail));

		checkOtpCooldown(lookupEmail);

		String otp = generateSecureOtp();
		user.setResetOtp(otp);
		user.setResetOtpExpiry(LocalDateTime.now().plusMinutes(10));
		user.setResetOtpAttempts(0);
		userRepository.save(user);

		// Send branded HTML OTP email using Spring Boot Mail
		String htmlContent = String.format(
			"<!DOCTYPE html>\n" +
			"<html>\n" +
			"<head>\n" +
			"    <style>\n" +
			"        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 20px; }\n" +
			"        .container { max-width: 600px; background-color: #FFFFFF; border-radius: 16px; padding: 40px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); }\n" +
			"        .logo { font-size: 28px; font-weight: 900; color: #4F46E5; text-align: center; margin-bottom: 24px; }\n" +
			"        h1 { font-size: 22px; font-weight: 700; color: #0F172A; margin-bottom: 16px; text-align: center; }\n" +
			"        p { font-size: 15px; color: #64748B; line-height: 24px; margin-bottom: 24px; }\n" +
			"        .otp-box { background-color: #EEF2FF; border: 2px dashed #6366F1; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }\n" +
			"        .otp-code { font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #4F46E5; margin: 0; }\n" +
			"        .footer { text-align: center; font-size: 13px; color: #94A3B8; margin-top: 32px; border-top: 1px solid #E2E8F0; padding-top: 20px; }\n" +
			"    </style>\n" +
			"</head>\n" +
			"<body>\n" +
			"    <div class=\"container\">\n" +
			"        <div class=\"logo\">SpeakMateAI</div>\n" +
			"        <h1>Password Reset OTP</h1>\n" +
			"        <p>Hello %s,</p>\n" +
			"        <p>We received a request to reset your SpeakMateAI password. Use the Verification Code below to complete your reset request:</p>\n" +
			"        <div class=\"otp-box\">\n" +
			"            <h2 class=\"otp-code\">%s</h2>\n" +
			"        </div>\n" +
			"        <p>This OTP code is valid for <strong>10 minutes</strong>. Do not share this OTP with anyone.</p>\n" +
			"        <p>If you did not request a password reset, please ignore this message.</p>\n" +
			"        <div class=\"footer\">\n" +
			"            Regards,<br/><strong>SpeakMateAI Team</strong>\n" +
			"        </div>\n" +
			"    </div>\n" +
			"</body>\n" +
			"</html>", user.getFirstName(), otp);

		sendAsyncEmail(user.getEmail(), "Your SpeakMateAI Password Reset OTP", htmlContent, otp);
	}

	@Override
	public UserResponse completeOnboarding(com.rslsolution.speakmateai.dto.request.CompleteOnboardingRequest request) {
		String currentUserEmail = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
		User user = userRepository.findByEmail(currentUserEmail)
				.orElseThrow(() -> new IllegalArgumentException("User not found"));
		
		user.setOnboardingCompleted(true);
		
		com.rslsolution.speakmateai.entity.Onboarding onboarding = onboardingRepository.findByUser(user).orElse(new com.rslsolution.speakmateai.entity.Onboarding());
		onboarding.setUser(user);
		if (request.getNativeLanguage() != null) onboarding.setNativeLanguage(request.getNativeLanguage());
		if (request.getGoal() != null) onboarding.setLearningGoal(request.getGoal());
		if (request.getAgeGroup() != null) onboarding.setAgeGroup(request.getAgeGroup());
		if (request.getSchoolGrade() != null && !request.getSchoolGrade().trim().isEmpty()) {
			onboarding.setSchoolGrade(request.getSchoolGrade().trim());
			user.setSchoolGrade(request.getSchoolGrade().trim());
		}
		if (request.getEnglishLevel() != null && !request.getEnglishLevel().trim().isEmpty()) {
			onboarding.setEnglishLevel(request.getEnglishLevel().trim());
			user.setEnglishLevel(request.getEnglishLevel().trim());
		}
		if (request.getInterests() != null) onboarding.setInterests(String.join(",", request.getInterests()));
		if (request.getAiVoice() != null) onboarding.setAiVoice(request.getAiVoice());
		if (request.getCommitment() != null) onboarding.setDailyGoalMinutes(Integer.parseInt(request.getCommitment().replaceAll("[^0-9]", "")));
		onboarding.setOnboardingCompleted(true);
		onboardingRepository.save(onboarding);

		userRepository.save(user);

		return mapToUserResponse(user);
	}

	@Override
	public VerifyOtpResponse verifyOtp(VerifyOtpRequest request) {

		String cleanEmail = ValidationUtils.normalizeEmail(request.getEmail());
		String lookupEmail = cleanEmail != null ? cleanEmail : "";
		User user = userRepository.findByEmailIgnoreCase(lookupEmail)
				.orElseGet(() -> userRepository.findByEmail(lookupEmail)
						.orElseThrow(() -> new IllegalArgumentException("Invalid email or user not found.")));

		int attempts = user.getResetOtpAttempts() != null ? user.getResetOtpAttempts() : 0;
		if (attempts >= MAX_OTP_ATTEMPTS) {
			user.setResetOtp(null);
			user.setResetOtpExpiry(null);
			user.setResetOtpAttempts(0);
			userRepository.save(user);
			throw new IllegalArgumentException("Maximum OTP verification attempts exceeded. Please request a new OTP.");
		}

		if (user.getResetOtpExpiry() == null || user.getResetOtpExpiry().isBefore(LocalDateTime.now())) {
			user.setResetOtp(null);
			user.setResetOtpExpiry(null);
			user.setResetOtpAttempts(0);
			userRepository.save(user);
			throw new IllegalArgumentException("OTP code has expired. Please request a new OTP.");
		}

		String inputOtp = request.getOtp() != null ? request.getOtp().trim() : "";
		if (user.getResetOtp() == null || !user.getResetOtp().equals(inputOtp)) {
			int updatedAttempts = attempts + 1;
			user.setResetOtpAttempts(updatedAttempts);
			if (updatedAttempts >= MAX_OTP_ATTEMPTS) {
				user.setResetOtp(null);
				user.setResetOtpExpiry(null);
			}
			userRepository.save(user);
			if (updatedAttempts >= MAX_OTP_ATTEMPTS) {
				throw new IllegalArgumentException("Maximum OTP verification attempts exceeded. Please request a new OTP.");
			}
			throw new IllegalArgumentException("Invalid OTP code. Please check your email and try again.");
		}

		// Generate session token for reset password
		String token = UUID.randomUUID().toString();
		user.setResetPasswordToken(token);
		user.setResetPasswordTokenExpiry(LocalDateTime.now().plusMinutes(15));
		// Clear OTP once verified
		user.setResetOtp(null);
		user.setResetOtpExpiry(null);
		user.setResetOtpAttempts(0);
		userRepository.save(user);

		return VerifyOtpResponse.builder()
				.token(token)
				.message("OTP verified successfully.")
				.build();
	}

	@Override
	public void resetPassword(ResetPasswordRequest request) {

		if (request.getToken() == null || request.getToken().trim().isEmpty()) {
			throw new IllegalArgumentException("Invalid or expired reset token.");
		}

		User user = userRepository.findByResetPasswordToken(request.getToken().trim())
				.orElseThrow(() -> new IllegalArgumentException("Invalid or expired reset token."));

		if (user.getResetPasswordTokenExpiry() == null || user.getResetPasswordTokenExpiry().isBefore(LocalDateTime.now())) {
			throw new IllegalArgumentException("Reset token has expired.");
		}

		validatePasswordStrength(request.getNewPassword());

		if (request.getConfirmPassword() != null && !request.getConfirmPassword().equals(request.getNewPassword())) {
			throw new IllegalArgumentException("Passwords do not match.");
		}

		if (passwordEncoder.matches(request.getNewPassword(), user.getPassword())) {
			throw new IllegalArgumentException("New password cannot be the same as your old password.");
		}

		user.setPassword(passwordEncoder.encode(request.getNewPassword()));
		user.setResetPasswordToken(null);
		user.setResetPasswordTokenExpiry(null);
		user.setResetOtpAttempts(0);
		userRepository.save(user);
	}

	private void validateUserOwnershipOrAdmin(User targetUser) {
		Authentication auth = SecurityContextHolder.getContext().getAuthentication();
		if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getName())) {
			throw new org.springframework.security.access.AccessDeniedException("Authentication required.");
		}
		boolean isAdmin = auth.getAuthorities().stream().anyMatch(a ->
				"ROLE_SUPER_ADMIN".equals(a.getAuthority()) || "ROLE_ADMIN".equals(a.getAuthority())
		);
		if (!isAdmin) {
			String currentEmail = auth.getName();
			if (targetUser.getEmail() == null || !targetUser.getEmail().equalsIgnoreCase(currentEmail)) {
				throw new org.springframework.security.access.AccessDeniedException("You do not have permission to access or modify this user account.");
			}
		}
	}

	@Override
	public List<UserResponse> getAllUsers() {
		Authentication auth = SecurityContextHolder.getContext().getAuthentication();
		if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName())) {
			boolean isAdmin = auth.getAuthorities().stream().anyMatch(a ->
					"ROLE_SUPER_ADMIN".equals(a.getAuthority()) || "ROLE_ADMIN".equals(a.getAuthority())
			);
			if (!isAdmin) {
				throw new org.springframework.security.access.AccessDeniedException("Access denied: only administrators can list all users.");
			}
		}

		List<User> users = userRepository.findAll();

		return users.stream()
				.map(user -> {
					UserResponse response = mapToUserResponse(user);
					response.setAvatar(null);
					return response;
				})
				.toList();
	}

	@Override
	public UserResponse getUserById(Long id) {
		User user = userRepository.findById(id).orElseThrow(() -> new UserNotFoundException("User not found"));
		validateUserOwnershipOrAdmin(user);
		return mapToUserResponse(user);
	}

	@Override
	public UserResponse updateUser(Long id, RegisterRequest request) {
		User user = userRepository.findById(id).orElseThrow(() -> new UserNotFoundException("User not found"));
		validateUserOwnershipOrAdmin(user);

		if (!user.getEmail().equalsIgnoreCase(request.getEmail()) && userRepository.existsByEmail(request.getEmail())) {
			throw new DuplicateEmailException("Email already exists.");
		}

		user.setFirstName(request.getFirstName());
		user.setLastName(request.getLastName());
		user.setEmail(request.getEmail());

		if (request.getPassword() != null && !request.getPassword().isBlank()) {
			Authentication auth = SecurityContextHolder.getContext().getAuthentication();
			boolean isAdmin = auth != null && auth.getAuthorities().stream().anyMatch(a ->
					"ROLE_SUPER_ADMIN".equals(a.getAuthority()) || "ROLE_ADMIN".equals(a.getAuthority())
			);
			if (isAdmin) {
				validatePasswordStrength(request.getPassword());
				user.setPassword(passwordEncoder.encode(request.getPassword()));
			} else {
				throw new IllegalArgumentException("Password changes cannot be performed via profile update. Please use the change password endpoint.");
			}
		}

		User updatedUser = userRepository.save(user);

		return mapToUserResponse(updatedUser);
	}

	public static String formatStandardToGrade(String standard) {
		return com.rslsolution.speakmateai.util.StandardDivisionUtil.formatStandardToGrade(standard);
	}

	private UserResponse mapToUserResponse(User user) {
		String effectiveGrade = user.getSchoolGrade();
		String effectiveAge = user.getAgeGroup();
		java.util.Optional<Onboarding> ob = onboardingRepository.findByUser(user);
		if (effectiveGrade == null || effectiveGrade.trim().isEmpty()) {
			if (ob.isPresent() && ob.get().getSchoolGrade() != null && !ob.get().getSchoolGrade().trim().isEmpty()) {
				effectiveGrade = ob.get().getSchoolGrade();
			} else if (user.getStandard() != null && !user.getStandard().trim().isEmpty()) {
				effectiveGrade = formatStandardToGrade(user.getStandard());
			}
		}
		if (effectiveAge == null || effectiveAge.trim().isEmpty() || "Professional".equalsIgnoreCase(effectiveAge)) {
			if (ob.isPresent() && ob.get().getAgeGroup() != null && !ob.get().getAgeGroup().trim().isEmpty()) {
				effectiveAge = ob.get().getAgeGroup();
			}
		}
		String effectiveLevel = (user.getEnglishLevel() != null && !user.getEnglishLevel().trim().isEmpty())
				? user.getEnglishLevel()
				: (ob.isPresent() ? ob.get().getEnglishLevel() : null);
		boolean isCompleted = user.isOnboardingCompleted() || 
				(ob.isPresent() && Boolean.TRUE.equals(ob.get().getOnboardingCompleted()));

		boolean isStudent = (user.getSchoolId() != null) ||
				(user.getRole() != null && user.getRole().name().contains("STUDENT")) ||
				(effectiveGrade != null && !effectiveGrade.trim().isEmpty()) ||
				(effectiveAge != null && effectiveAge.toLowerCase().contains("school"));

		boolean isPro = false;
		String subPlan = "FREE";

		if (!isStudent && userSubscriptionRepository != null) {
			try {
				java.util.Optional<com.rslsolution.speakmateai.entity.UserSubscription> subOpt = 
						userSubscriptionRepository.findFirstByUserAndStatusOrderByCreatedAtDesc(user, "ACTIVE");
				if (subOpt.isPresent()) {
					com.rslsolution.speakmateai.entity.UserSubscription sub = subOpt.get();
					if (sub.getEndDate() != null && sub.getEndDate().isAfter(java.time.LocalDateTime.now())) {
						isPro = true;
						subPlan = sub.getPlanType() != null ? sub.getPlanType() : "MONTHLY_PRO";
					}
				}
			} catch (Exception e) {
				// fallback
			}
		}

		String resolvedSchoolName = user.getSchoolName();
		if ((resolvedSchoolName == null || resolvedSchoolName.trim().isEmpty()) && user.getSchoolId() != null && schoolRepository != null) {
			resolvedSchoolName = schoolRepository.findById(user.getSchoolId())
					.map(s -> s.getName() != null && !s.getName().trim().isEmpty() ? s.getName() : s.getSchoolName())
					.orElse(null);
		}

		String effectiveVoice = user.getPreferredVoice();
		if (settingsRepository != null) {
			try {
				var optSettings = settingsRepository.findByUser(user);
				if (optSettings.isPresent()) {
					String sVoice = optSettings.get().getAiVoice();
					if (sVoice != null && !sVoice.isBlank()) {
						effectiveVoice = sVoice;
					}
				}
			} catch (Exception e) {}
		}

		return UserResponse.builder().id(user.getId()).firstName(user.getFirstName()).lastName(user.getLastName())
				.email(user.getEmail()).role(user.getRole()).avatar(user.getAvatar()).active(user.isActive())
				.isPro(isPro).subscriptionPlan(subPlan)
				.createdAt(user.getCreatedAt()).welcomeCompleted(user.isWelcomeCompleted())
				.onboardingCompleted(isCompleted)
				.authProvider(user.getAuthProvider()).nativeLanguage(user.getNativeLanguage())
				.englishLevel(effectiveLevel).learningGoal(user.getLearningGoal())
				.dailyGoalMinutes(user.getDailyGoalMinutes()).preferredVoice(effectiveVoice)
				.aiVoice(effectiveVoice)
				.preferredAccent(user.getPreferredAccent()).ageGroup(effectiveAge).schoolGrade(effectiveGrade)
				.standard(user.getStandard()).interests(user.getInterests())
				.schoolId(user.getSchoolId()).schoolName(resolvedSchoolName).isSchoolStudent(isStudent)
				.accountType(isStudent ? "STUDENT" : "INDIVIDUAL")
				.build();
	}


	@Override
	public void sendDeleteAccountOtp(com.rslsolution.speakmateai.dto.request.SendDeleteAccountOtpRequest request) {
		String email = ValidationUtils.normalizeEmail(request.getEmail());
		String lookupEmail = email != null ? email : "";
		User user = userRepository.findByEmailIgnoreCase(lookupEmail)
				.orElseThrow(() -> new UserNotFoundException("No account found registered with email: " + lookupEmail));

		checkOtpCooldown(lookupEmail);

		String otp = generateSecureOtp();
		deleteAccountOtpMap.put(user.getEmail().trim().toLowerCase(), new RegistrationOtpDetails(otp, LocalDateTime.now().plusMinutes(10)));

		String htmlContent = String.format(
			"<!DOCTYPE html>\n" +
			"<html>\n" +
			"<head>\n" +
			"    <style>\n" +
			"        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 20px; }\n" +
			"        .container { max-width: 600px; background-color: #FFFFFF; border-radius: 16px; padding: 40px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); }\n" +
			"        .logo { font-size: 28px; font-weight: 900; color: #EF4444; text-align: center; margin-bottom: 24px; }\n" +
			"        h1 { font-size: 22px; font-weight: 700; color: #0F172A; margin-bottom: 16px; text-align: center; }\n" +
			"        p { font-size: 15px; color: #64748B; line-height: 24px; margin-bottom: 24px; }\n" +
			"        .otp-box { background-color: #FEF2F2; border: 2px dashed #EF4444; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }\n" +
			"        .otp-code { font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #DC2626; margin: 0; }\n" +
			"        .footer { text-align: center; font-size: 13px; color: #94A3B8; margin-top: 32px; border-top: 1px solid #E2E8F0; padding-top: 20px; }\n" +
			"    </style>\n" +
			"</head>\n" +
			"<body>\n" +
			"    <div class=\"container\">\n" +
			"        <div class=\"logo\">SpeakMateAI</div>\n" +
			"        <h1>Account Deletion Verification Code</h1>\n" +
			"        <p>Hello %s,</p>\n" +
			"        <p>We received a request to permanently delete your SpeakMateAI account. Enter the verification code below to authorize account deletion. This code is valid for <strong>10 minutes</strong>.</p>\n" +
			"        <div class=\"otp-box\">\n" +
			"            <h2 class=\"otp-code\">%s</h2>\n" +
			"        </div>\n" +
			"        <p>If you did not request to delete your account, please ignore this email and your account will remain safe.</p>\n" +
			"        <div class=\"footer\">\n" +
			"            &copy; 2026 SpeakMateAI. All rights reserved.\n" +
			"        </div>\n" +
			"    </div>\n" +
			"</body>\n" +
			"</html>",
			user.getFirstName() != null ? user.getFirstName() : "User",
			otp
		);

		sendAsyncEmail(lookupEmail, "Confirm Account Deletion - SpeakMateAI", htmlContent, otp);
	}

	@Override
	public VerifyOtpResponse verifyDeleteAccountOtp(VerifyOtpRequest request) {
		String email = ValidationUtils.normalizeEmail(request.getEmail());
		String otp = request.getOtp() != null ? request.getOtp().trim() : "";

		if (email == null || email.isEmpty()) {
			throw new IllegalArgumentException("Email is required.");
		}
		if (otp.isEmpty()) {
			throw new IllegalArgumentException("OTP code is required.");
		}

		String lookupEmail = email;
		User user = userRepository.findByEmailIgnoreCase(lookupEmail)
				.orElseGet(() -> userRepository.findByEmail(lookupEmail)
						.orElseThrow(() -> new IllegalArgumentException("No account found registered with email: " + lookupEmail)));

		RegistrationOtpDetails otpDetails = deleteAccountOtpMap.get(user.getEmail().trim().toLowerCase());
		if (otpDetails == null) {
			throw new IllegalArgumentException("No active OTP code found for this email. Please tap 'Send Code' to receive a code.");
		}

		if (LocalDateTime.now().isAfter(otpDetails.getExpiry())) {
			deleteAccountOtpMap.remove(user.getEmail().trim().toLowerCase());
			throw new IllegalArgumentException("The OTP verification code has expired. Please tap 'Resend Code' to get a new code.");
		}

		if (otpDetails.getAttempts() >= MAX_OTP_ATTEMPTS) {
			deleteAccountOtpMap.remove(user.getEmail().trim().toLowerCase());
			throw new IllegalArgumentException("Maximum verification attempts exceeded. Please request a new code.");
		}

		if (!otpDetails.getOtp().trim().equals(otp)) {
			int currentAttempts = otpDetails.incrementAttempts();
			if (currentAttempts >= MAX_OTP_ATTEMPTS) {
				deleteAccountOtpMap.remove(user.getEmail().trim().toLowerCase());
				throw new IllegalArgumentException("Maximum verification attempts exceeded. Please request a new code.");
			}
			throw new IllegalArgumentException("The 6-digit OTP code is incorrect. Please check your email.");
		}

		return VerifyOtpResponse.builder()
				.message("Code verified successfully.")
				.build();
	}

	@Override
	public void deleteAccountWithOtp(com.rslsolution.speakmateai.dto.request.DeleteAccountRequest request) {
		String email = ValidationUtils.normalizeEmail(request.getEmail());
		String lookupEmail = email != null ? email : "";
		String otp = request.getOtp() != null ? request.getOtp().trim() : "";

		RegistrationOtpDetails otpDetails = deleteAccountOtpMap.get(lookupEmail);

		if (otpDetails == null) {
			throw new InvalidCredentialsException("No active OTP code found for this email. Please tap 'Send OTP' to receive a code.");
		}

		if (LocalDateTime.now().isAfter(otpDetails.getExpiry())) {
			deleteAccountOtpMap.remove(lookupEmail);
			throw new InvalidCredentialsException("The OTP verification code has expired. Please tap 'Send OTP' to get a new code.");
		}

		if (otpDetails.getAttempts() >= MAX_OTP_ATTEMPTS) {
			deleteAccountOtpMap.remove(lookupEmail);
			throw new InvalidCredentialsException("Maximum verification attempts exceeded. Please request a new code.");
		}

		if (!otpDetails.getOtp().trim().equals(otp)) {
			int currentAttempts = otpDetails.incrementAttempts();
			if (currentAttempts >= MAX_OTP_ATTEMPTS) {
				deleteAccountOtpMap.remove(lookupEmail);
				throw new InvalidCredentialsException("Maximum verification attempts exceeded. Please request a new code.");
			}
			throw new InvalidCredentialsException("The 6-digit OTP code is incorrect. Please check your email.");
		}

		User user = userRepository.findByEmailIgnoreCase(lookupEmail)
				.orElseThrow(() -> new UserNotFoundException("No account found with email: " + lookupEmail));

		deleteUser(user.getId());
		deleteAccountOtpMap.remove(lookupEmail);
	}

	@Override
	@org.springframework.transaction.annotation.Transactional(rollbackFor = Exception.class)
	public void deleteUser(Long id) {
		User targetUser = userRepository.findById(id)
				.orElseThrow(() -> new UserNotFoundException("User not found with id: " + id));

		Authentication auth = SecurityContextHolder.getContext().getAuthentication();
		if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName())) {
			boolean isAdmin = auth.getAuthorities().stream().anyMatch(a ->
					"ROLE_SUPER_ADMIN".equals(a.getAuthority()) || "ROLE_ADMIN".equals(a.getAuthority())
			);
			if (!isAdmin) {
				String currentEmail = auth.getName();
				if (targetUser.getEmail() == null || !targetUser.getEmail().equalsIgnoreCase(currentEmail)) {
					throw new org.springframework.security.access.AccessDeniedException("You do not have permission to delete this user account.");
				}
			}
		}

		java.util.Set<String> existingTables = new java.util.HashSet<>();
		java.util.Map<String, java.util.Set<String>> tableColumns = new java.util.HashMap<>();

		if (jdbcTemplate != null) {
			try {
				jdbcTemplate.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'", rs -> {
					String tbl = rs.getString("table_name").toLowerCase();
					String col = rs.getString("column_name").toLowerCase();
					existingTables.add(tbl);
					tableColumns.computeIfAbsent(tbl, k -> new java.util.HashSet<>()).add(col);
				});
			} catch (Exception e) {
				System.err.println("[Delete User] Notice: Could not read information_schema: " + e.getMessage());
			}
		}

		// 1. Delete grandchildren first (sessions' message and feedback records)
		executeDeleteIfParentExists(existingTables, tableColumns, "conversation_feedbacks", "session_id", "speaking_sessions", "user_id", id);
		executeDeleteIfParentExists(existingTables, tableColumns, "conversation_messages", "session_id", "speaking_sessions", "user_id", id);
		executeDeleteIfParentExists(existingTables, tableColumns, "chat_messages", "session_id", "chat_sessions", "user_id", id);

		// 2. Delete direct session tables
		executeDeleteIfColumnExists(existingTables, tableColumns, "speaking_sessions", "user_id", id);
		executeDeleteIfColumnExists(existingTables, tableColumns, "chat_sessions", "user_id", id);

		// 3. Delete user direct learning and profile records
		executeDeleteIfColumnExists(existingTables, tableColumns, "chat_history", "user_id", id);
		executeDeleteIfColumnExists(existingTables, tableColumns, "chat_bookmarks", "user_id", id);
		executeDeleteIfColumnExists(existingTables, tableColumns, "vocabulary", "user_id", id);
		executeDeleteIfColumnExists(existingTables, tableColumns, "lesson_progress", "user_id", id);
		executeDeleteIfColumnExists(existingTables, tableColumns, "achievement", "user_id", id);
		executeDeleteIfColumnExists(existingTables, tableColumns, "progress", "user_id", id);
		executeDeleteIfColumnExists(existingTables, tableColumns, "settings", "user_id", id);
		executeDeleteIfColumnExists(existingTables, tableColumns, "onboarding", "user_id", id);
		executeDeleteIfColumnExists(existingTables, tableColumns, "user_subscriptions", "user_id", id);
		executeDeleteIfColumnExists(existingTables, tableColumns, "grammar_history", "user_id", id);
		executeDeleteIfColumnExists(existingTables, tableColumns, "notification", "user_id", id);
		executeDeleteIfColumnExists(existingTables, tableColumns, "ai_usage_logs", "user_id", id);
		executeDeleteIfColumnExists(existingTables, tableColumns, "audit_logs", "user_id", id);

		// 4. Delete school / role records if applicable
		executeDeleteIfColumnExists(existingTables, tableColumns, "assignment_progress", "student_id", id);
		executeDeleteIfColumnExists(existingTables, tableColumns, "class_students", "student_id", id);
		executeDeleteIfColumnExists(existingTables, tableColumns, "assignments", "teacher_id", id);
		executeNullifyIfColumnExists(existingTables, tableColumns, "class_rooms", "teacher_id", id);

		// 5. Optional / legacy tables (only if they exist in schema)
		executeDeleteIfColumnExists(existingTables, tableColumns, "payments", "user_id", id);
		executeDeleteIfColumnExists(existingTables, tableColumns, "results", "student_id", id);
		executeDeleteIfColumnExists(existingTables, tableColumns, "certificates", "user_id", id);
		executeDeleteIfColumnExists(existingTables, tableColumns, "school_admins", "user_id", id);
		executeDeleteIfColumnExists(existingTables, tableColumns, "teachers", "id", id);
		executeDeleteIfColumnExists(existingTables, tableColumns, "students", "id", id);

		// 6. Delete the user record itself and ensure exactly 1 row was affected
		int deletedRows = 0;
		if (jdbcTemplate != null) {
			deletedRows = jdbcTemplate.update("DELETE FROM users WHERE id = ?", id);
		} else {
			deletedRows = entityManager.createNativeQuery("DELETE FROM users WHERE id = :id")
					.setParameter("id", id)
					.executeUpdate();
		}

		if (deletedRows == 0) {
			throw new IllegalStateException("Failed to delete user with ID " + id + ": No record found in users table.");
		}

		if (entityManager != null) {
			entityManager.flush();
			entityManager.clear();
		}

		System.out.println("[User Deleted] Permanently removed user ID: " + id + " and all associated records.");
	}

	private void executeDeleteIfColumnExists(
			java.util.Set<String> existingTables,
			java.util.Map<String, java.util.Set<String>> tableColumns,
			String tableName,
			String columnName,
			Long id) {
		String tblLower = tableName.toLowerCase();
		String colLower = columnName.toLowerCase();

		if (!existingTables.isEmpty()) {
			if (!existingTables.contains(tblLower)) return;
			java.util.Set<String> cols = tableColumns.get(tblLower);
			if (cols == null || !cols.contains(colLower)) return;
		}

		String sql = "DELETE FROM " + tableName + " WHERE " + columnName + " = " + id;
		try {
			if (jdbcTemplate != null) {
				jdbcTemplate.execute(sql);
			} else {
				entityManager.createNativeQuery(sql).executeUpdate();
			}
		} catch (Exception e) {
			System.err.println("[Delete User SQL Error] " + sql + " -> " + e.getMessage());
			throw new RuntimeException("Failed to delete user records from " + tableName + ": " + e.getMessage(), e);
		}
	}

	private void executeDeleteIfParentExists(
			java.util.Set<String> existingTables,
			java.util.Map<String, java.util.Set<String>> tableColumns,
			String childTable,
			String childCol,
			String parentTable,
			String parentCol,
			Long id) {
		String childLower = childTable.toLowerCase();
		String parentLower = parentTable.toLowerCase();

		if (!existingTables.isEmpty()) {
			if (!existingTables.contains(childLower) || !existingTables.contains(parentLower)) return;
			java.util.Set<String> childCols = tableColumns.get(childLower);
			if (childCols == null || !childCols.contains(childCol.toLowerCase())) return;
			java.util.Set<String> parentCols = tableColumns.get(parentLower);
			if (parentCols == null || !parentCols.contains(parentCol.toLowerCase())) return;
		}

		String sql = "DELETE FROM " + childTable + " WHERE " + childCol + " IN (SELECT id FROM " + parentTable + " WHERE " + parentCol + " = " + id + ")";
		try {
			if (jdbcTemplate != null) {
				jdbcTemplate.execute(sql);
			} else {
				entityManager.createNativeQuery(sql).executeUpdate();
			}
		} catch (Exception e) {
			System.err.println("[Delete User SQL Error] " + sql + " -> " + e.getMessage());
			throw new RuntimeException("Failed to delete records from " + childTable + ": " + e.getMessage(), e);
		}
	}

	private void executeNullifyIfColumnExists(
			java.util.Set<String> existingTables,
			java.util.Map<String, java.util.Set<String>> tableColumns,
			String tableName,
			String columnName,
			Long id) {
		String tblLower = tableName.toLowerCase();
		String colLower = columnName.toLowerCase();

		if (!existingTables.isEmpty()) {
			if (!existingTables.contains(tblLower)) return;
			java.util.Set<String> cols = tableColumns.get(tblLower);
			if (cols == null || !cols.contains(colLower)) return;
		}

		String sql = "UPDATE " + tableName + " SET " + columnName + " = NULL WHERE " + columnName + " = " + id;
		try {
			if (jdbcTemplate != null) {
				jdbcTemplate.execute(sql);
			} else {
				entityManager.createNativeQuery(sql).executeUpdate();
			}
		} catch (Exception e) {
			System.err.println("[Nullify User Reference SQL Error] " + sql + " -> " + e.getMessage());
			throw new RuntimeException("Failed to nullify reference in " + tableName + ": " + e.getMessage(), e);
		}
	}

	private void sendAsyncEmail(String toEmail, String subject, String htmlContent, String otp) {
		java.util.concurrent.CompletableFuture.runAsync(() -> {
			String brevoApiKey = (configuredBrevoApiKey != null && !configuredBrevoApiKey.isBlank()) ? configuredBrevoApiKey.trim() : System.getenv("BREVO_API_KEY");
			if (brevoApiKey != null && !brevoApiKey.isBlank()) {
				try {
					java.net.http.HttpClient client = java.net.http.HttpClient.newHttpClient();
					String escapedHtml = htmlContent.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "").replace("\t", " ");
					String jsonBody = "{"
						+ "\"sender\":{\"name\":\"SpeakMateAI\",\"email\":\"dnyaneshwaralgule2003@gmail.com\"},"
						+ "\"to\":[{\"email\":\"" + toEmail + "\"}],"
						+ "\"subject\":\"" + subject.replace("\"", "\\\"") + "\","
						+ "\"htmlContent\":\"" + escapedHtml + "\""
						+ "}";
					java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
						.uri(java.net.URI.create("https://api.brevo.com/v3/smtp/email"))
						.header("api-key", brevoApiKey.trim())
						.header("Content-Type", "application.json")
						.header("accept", "application.json")
						.POST(java.net.http.HttpRequest.BodyPublishers.ofString(jsonBody, java.nio.charset.StandardCharsets.UTF_8))
						.build();
					java.net.http.HttpResponse<String> response = client.send(request, java.net.http.HttpResponse.BodyHandlers.ofString());
					System.out.println("[Brevo Email Sent to " + toEmail + "] Status: " + response.statusCode() + " Response: " + response.body());
					if (response.statusCode() >= 200 && response.statusCode() < 300) {
						return;
					}
				} catch (Exception ex) {
					System.err.println("[Brevo Email Error for " + toEmail + "] " + ex.getMessage());
				}
			}

			String resendApiKey = System.getenv("RESEND_API_KEY");
			if (resendApiKey != null && !resendApiKey.isBlank()) {
				try {
					java.net.http.HttpClient client = java.net.http.HttpClient.newHttpClient();
					String escapedHtml = htmlContent.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "");
					String jsonBody = "{\"from\":\"SpeakMateAI <onboarding@resend.dev>\",\"to\":[\"" + toEmail + "\"],\"subject\":\"" + subject + "\",\"html\":\"" + escapedHtml + "\"}";
					java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
						.uri(java.net.URI.create("https://api.resend.com/emails"))
						.header("Authorization", "Bearer " + resendApiKey)
						.header("Content-Type", "application.json")
						.POST(java.net.http.HttpRequest.BodyPublishers.ofString(jsonBody, java.nio.charset.StandardCharsets.UTF_8))
						.build();
					java.net.http.HttpResponse<String> response = client.send(request, java.net.http.HttpResponse.BodyHandlers.ofString());
					System.out.println("[Resend Email Sent] Status: " + response.statusCode() + " Response: " + response.body());
					if (response.statusCode() >= 200 && response.statusCode() < 300) {
						return;
					}
				} catch (Exception ex) {
					System.err.println("[Resend Email Error] " + ex.getMessage());
				}
			}

			try {
				if (mailSender != null) {
					MimeMessage message = mailSender.createMimeMessage();
					MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
					helper.setFrom("dnyaneshwaralgule2003@gmail.com", "SpeakMateAI");
					helper.setTo(toEmail);
					helper.setSubject(subject);
					helper.setText(htmlContent, true);
					mailSender.send(message);
					System.out.println("[SMTP Email Sent] Successfully sent to: " + toEmail);
				} else {
					System.out.println("[SMTP Offline] Email sender not configured; cannot deliver verification message to: " + toEmail);
				}
			} catch (Exception ex) {
				System.err.println("[SMTP Error] Failed to send email to " + toEmail + ": " + ex.getMessage());
				System.out.println("[Fallback Log] Email delivery failed for: " + toEmail);
			}
		});
	}

}
