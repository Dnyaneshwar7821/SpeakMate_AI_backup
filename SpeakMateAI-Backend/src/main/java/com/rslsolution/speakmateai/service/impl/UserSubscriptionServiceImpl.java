package com.rslsolution.speakmateai.service.impl;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.rslsolution.speakmateai.dto.request.CreateOrderRequest;
import com.rslsolution.speakmateai.dto.request.VerifyPaymentRequest;
import com.rslsolution.speakmateai.dto.response.CreateOrderResponse;
import com.rslsolution.speakmateai.dto.response.SubscriptionStatusResponse;
import com.rslsolution.speakmateai.entity.User;
import com.rslsolution.speakmateai.entity.UserSubscription;
import com.rslsolution.speakmateai.exception.UserNotFoundException;
import com.rslsolution.speakmateai.repository.UserRepository;
import com.rslsolution.speakmateai.repository.UserSubscriptionRepository;
import com.rslsolution.speakmateai.service.UserSubscriptionService;

import com.rslsolution.speakmateai.entity.SubscriptionPlan;
import com.rslsolution.speakmateai.repository.SubscriptionPlanRepository;

import lombok.extern.slf4j.Slf4j;

@Service
@Transactional
@Slf4j
public class UserSubscriptionServiceImpl implements UserSubscriptionService {

	private final UserRepository userRepository;
	private final UserSubscriptionRepository userSubscriptionRepository;
	private final SubscriptionPlanRepository subscriptionPlanRepository;

	@Value("${razorpay.key.id:rzp_test_SpeakMateAiDev}")
	private String razorpayKeyId;

	@Value("${razorpay.key.secret:dummy_secret_for_local_dev}")
	private String razorpayKeySecret;

	public UserSubscriptionServiceImpl(UserRepository userRepository,
			UserSubscriptionRepository userSubscriptionRepository,
			SubscriptionPlanRepository subscriptionPlanRepository) {
		this.userRepository = userRepository;
		this.userSubscriptionRepository = userSubscriptionRepository;
		this.subscriptionPlanRepository = subscriptionPlanRepository;
	}

	private SubscriptionPlan resolveSubscriptionPlan(String planType) {
		if (planType == null || planType.isBlank()) {
			return null;
		}
		Optional<SubscriptionPlan> planOpt = subscriptionPlanRepository.findByPlanNameIgnoreCase(planType.trim());
		if (planOpt.isPresent()) {
			return planOpt.get();
		}
		if ("MONTHLY_PRO".equalsIgnoreCase(planType) || "MONTHLY".equalsIgnoreCase(planType)) {
			return subscriptionPlanRepository.findByPlanNameIgnoreCase("SpeakMate Pro (1 Month Pass)")
					.or(() -> subscriptionPlanRepository.findByPlanNameIgnoreCase("SpeakMate Pro Monthly"))
					.orElse(null);
		} else if ("YEARLY_PRO".equalsIgnoreCase(planType) || "YEARLY".equalsIgnoreCase(planType)) {
			return subscriptionPlanRepository.findByPlanNameIgnoreCase("SpeakMate Pro (1 Year Annual Pass)")
					.or(() -> subscriptionPlanRepository.findByPlanNameIgnoreCase("SpeakMate Pro Annual"))
					.orElse(null);
		}
		return null;
	}


	private User getAuthenticatedUser() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication == null || !authentication.isAuthenticated()) {
			throw new UserNotFoundException("User is not authenticated");
		}
		return userRepository.findByEmail(authentication.getName())
				.orElseThrow(() -> new UserNotFoundException("User not found with email: " + authentication.getName()));
	}

	@Override
	public CreateOrderResponse createOrder(CreateOrderRequest request) {
		User user = getAuthenticatedUser();
		String planType = request.getPlanType();

		BigDecimal amount;
		long amountInPaise;
		String planName;
		String description;

		if ("YEARLY_PRO".equalsIgnoreCase(planType)) {
			planType = "YEARLY_PRO";
			amount = new BigDecimal("1199.00");
			amountInPaise = 119900L;
			planName = "SpeakMate Pro (1 Year Annual Pass)";
			description = "Unlimited AI English conversations, all voice avatars, and full grammar analysis for 1 year.";
		} else {
			planType = "MONTHLY_PRO";
			amount = new BigDecimal("149.00");
			amountInPaise = 14900L;
			planName = "SpeakMate Pro (1 Month Pass)";
			description = "Unlimited AI English conversations and grammar practice for 1 month.";
		}

		String orderId = null;

		// Attempt Razorpay order creation
		boolean isRealCredentials = razorpayKeyId != null && !razorpayKeyId.contains("dummy") && !razorpayKeyId.contains("Dev")
				&& razorpayKeySecret != null && !razorpayKeySecret.contains("dummy");

		if (isRealCredentials) {
			try {
				RazorpayClient razorpay = new RazorpayClient(razorpayKeyId, razorpayKeySecret);
				JSONObject orderRequest = new JSONObject();
				orderRequest.put("amount", amountInPaise);
				orderRequest.put("currency", "INR");
				orderRequest.put("receipt", "rcpt_" + user.getId() + "_" + System.currentTimeMillis());
				
				JSONObject notes = new JSONObject();
				notes.put("userId", user.getId());
				notes.put("userEmail", user.getEmail());
				notes.put("planType", planType);
				orderRequest.put("notes", notes);

				Order order = razorpay.orders.create(orderRequest);
				orderId = order.get("id");
			} catch (Exception e) {
				log.warn("Razorpay API order creation failed, falling back to local order ID: {}", e.getMessage());
				orderId = "order_mock_" + System.currentTimeMillis();
			}
		} else {
			// Dev / sandbox fallback
			orderId = "order_dev_" + System.currentTimeMillis();
		}

		// Save pending subscription
		SubscriptionPlan planEntity = resolveSubscriptionPlan(planType);
		LocalDateTime now = LocalDateTime.now();
		UserSubscription subscription = UserSubscription.builder()
				.user(user)
				.subscriptionPlan(planEntity)
				.planType(planType)
				.status("PENDING")
				.amount(amount)
				.currency("INR")
				.razorpayOrderId(orderId)
				.startDate(now)
				.endDate(planType.contains("YEAR") ? now.plusYears(1) : now.plusMonths(1))
				.build();

		userSubscriptionRepository.save(subscription);

		return CreateOrderResponse.builder()
				.razorpayOrderId(orderId)
				.amount(amount)
				.amountInPaise(amountInPaise)
				.currency("INR")
				.razorpayKeyId(razorpayKeyId)
				.planType(planType)
				.planName(planName)
				.description(description)
				.userEmail(user.getEmail())
				.userName((user.getFirstName() != null ? user.getFirstName() : "") + " " + (user.getLastName() != null ? user.getLastName() : "")).build();
	}

	@Override
	public SubscriptionStatusResponse verifyPayment(VerifyPaymentRequest request) {
		User user = getAuthenticatedUser();
		String orderId = request.getRazorpayOrderId();
		String paymentId = request.getRazorpayPaymentId();
		String signature = request.getRazorpaySignature();
		String planType = request.getPlanType();

		// Verify signature if using real credentials
		boolean isRealCredentials = razorpayKeyId != null && !razorpayKeyId.contains("dummy") && !razorpayKeyId.contains("Dev")
				&& razorpayKeySecret != null && !razorpayKeySecret.contains("dummy");

		boolean isValidSignature = true;

		if (isRealCredentials && !orderId.startsWith("order_mock_") && !orderId.startsWith("order_dev_")) {
			try {
				String generatedSignature = calculateHmacSha256(orderId + "|" + paymentId, razorpayKeySecret);
				isValidSignature = generatedSignature.equals(signature);
			} catch (Exception e) {
				log.error("Signature verification error: {}", e.getMessage());
				isValidSignature = false;
			}
		}

		if (!isValidSignature) {
			throw new IllegalArgumentException("Invalid Razorpay payment signature verification failed");
		}

		// Calculate expiry
		LocalDateTime now = LocalDateTime.now();
		LocalDateTime endDate = "YEARLY_PRO".equalsIgnoreCase(planType) ? now.plusDays(365) : now.plusDays(30);

		// Find existing pending subscription or create new
		BigDecimal planAmount = "YEARLY_PRO".equalsIgnoreCase(planType) ? new BigDecimal("1199.00") : new BigDecimal("149.00");
		Optional<UserSubscription> subOpt = userSubscriptionRepository.findByRazorpayOrderId(orderId);
		UserSubscription subscription = subOpt.orElseGet(() -> UserSubscription.builder()
				.user(user)
				.amount(planAmount)
				.currency("INR")
				.razorpayOrderId(orderId)
				.build());
		subscription.setAmount(planAmount);

		if (subscription.getSubscriptionPlan() == null) {
			SubscriptionPlan plan = resolveSubscriptionPlan(planType);
			if (plan != null) {
				subscription.setSubscriptionPlan(plan);
			}
		}

		subscription.setPlanType(planType);
		subscription.setStatus("ACTIVE");
		subscription.setRazorpayPaymentId(paymentId);
		subscription.setRazorpaySignature(signature);
		subscription.setStartDate(now);
		subscription.setEndDate(endDate);

		userSubscriptionRepository.save(subscription);

		// Update user entity
		user.setSchoolId(null); // Ensure individual subscription flag
		userRepository.save(user);

		return SubscriptionStatusResponse.builder()
				.isPro(true)
				.planType(planType)
				.status("ACTIVE")
				.startDate(now)
				.endDate(endDate)
				.dailyMinutesLimit(9999)
				.dailyMinutesUsed(0)
				.dailyGrammarLimit(9999)
				.dailyGrammarUsed(0)
				.message("Congratulations! You have successfully upgraded to SpeakMate Pro.")
				.build();
	}

	@Override
	public SubscriptionStatusResponse getMySubscription() {
		User user = getAuthenticatedUser();

		// Check if user is a student under an institutional school
		if (user.getSchoolId() != null || "STUDENT".equalsIgnoreCase(user.getSchoolGrade())) {
			return SubscriptionStatusResponse.builder()
					.isPro(true)
					.planType("SCHOOL_INSTITUTIONAL")
					.status("ACTIVE")
					.startDate(user.getCreatedAt())
					.endDate(LocalDateTime.now().plusYears(1))
					.dailyMinutesLimit(9999)
					.dailyMinutesUsed(0)
					.dailyGrammarLimit(9999)
					.dailyGrammarUsed(0)
					.message("Active Institutional Student License via School.")
					.build();
		}

		try {
			// Check latest active subscription
			Optional<UserSubscription> subOpt = userSubscriptionRepository.findFirstByUserAndStatusOrderByCreatedAtDesc(user, "ACTIVE");

			if (subOpt.isPresent()) {
				UserSubscription sub = subOpt.get();
				LocalDateTime now = LocalDateTime.now();

				if (sub.getEndDate() != null && sub.getEndDate().isAfter(now)) {
					return SubscriptionStatusResponse.builder()
							.isPro(true)
							.planType(sub.getPlanType() != null ? sub.getPlanType() : "FREE")
							.status("ACTIVE")
							.startDate(sub.getStartDate())
							.endDate(sub.getEndDate())
							.dailyMinutesLimit(9999)
							.dailyMinutesUsed(0)
							.dailyGrammarLimit(9999)
							.dailyGrammarUsed(0)
							.message("SpeakMate Pro is active.")
							.build();
				} else {
					// Expired
					sub.setStatus("EXPIRED");
					userSubscriptionRepository.save(sub);
				}
			}
		} catch (Exception ex) {
			log.warn("[SubscriptionService] Could not fetch subscription from database, falling back to default plan: {}", ex.getMessage());
		}

		// Default Free Tier
		return SubscriptionStatusResponse.builder()
				.isPro(false)
				.planType("FREE")
				.status("ACTIVE")
				.startDate(user.getCreatedAt())
				.endDate(null)
				.dailyMinutesLimit(15)
				.dailyMinutesUsed(0)
				.dailyGrammarLimit(15)
				.dailyGrammarUsed(0)
				.message("You are currently on the Free Starter plan (15 mins practice per refill).")
				.build();
	}

	@Override
	public SubscriptionStatusResponse cancelSubscription() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User user = userRepository.findByEmail(authentication.getName())
				.orElseThrow(() -> new UserNotFoundException("User not found"));

		try {
			java.util.List<UserSubscription> activeSubs = userSubscriptionRepository.findByUserOrderByCreatedAtDesc(user);
			for (UserSubscription sub : activeSubs) {
				if ("ACTIVE".equalsIgnoreCase(sub.getStatus()) || "PENDING".equalsIgnoreCase(sub.getStatus())) {
					sub.setStatus("CANCELLED");
					userSubscriptionRepository.save(sub);
				}
			}
		} catch (Exception ex) {
			log.warn("[SubscriptionService] Could not cancel subscription records: {}", ex.getMessage());
		}

		return SubscriptionStatusResponse.builder()
				.isPro(false)
				.planType("FREE")
				.status("ACTIVE")
				.startDate(user.getCreatedAt())
				.endDate(null)
				.dailyMinutesLimit(15)
				.dailyMinutesUsed(0)
				.dailyGrammarLimit(15)
				.dailyGrammarUsed(0)
				.message("Your subscription has been cancelled. You are now on the Free Starter plan (15 mins practice per refill).")
				.build();
	}

	private String calculateHmacSha256(String data, String secret) throws Exception {
		Mac sha256_HMAC = Mac.getInstance("HmacSHA256");
		SecretKeySpec secret_key = new SecretKeySpec(secret.getBytes("UTF-8"), "HmacSHA256");
		sha256_HMAC.init(secret_key);
		byte[] bytes = sha256_HMAC.doFinal(data.getBytes("UTF-8"));
		StringBuilder hash = new StringBuilder();
		for (byte b : bytes) {
			String hex = Integer.toHexString(0xff & b);
			if (hex.length() == 1) hash.append('0');
			hash.append(hex);
		}
		return hash.toString();
	}
}
