package com.rslsolution.speakmateai.service.impl;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rslsolution.speakmateai.dto.request.OnboardingRequest;
import com.rslsolution.speakmateai.dto.response.OnboardingResponse;
import com.rslsolution.speakmateai.entity.Onboarding;
import com.rslsolution.speakmateai.entity.User;
import com.rslsolution.speakmateai.exception.OnboardingNotFoundException;
import com.rslsolution.speakmateai.exception.UserNotFoundException;
import com.rslsolution.speakmateai.repository.OnboardingRepository;
import com.rslsolution.speakmateai.repository.UserRepository;
import com.rslsolution.speakmateai.service.OnboardingService;

@Service
@Transactional
public class OnboardingServiceImpl implements OnboardingService {

	private final OnboardingRepository onboardingRepository;
	private final UserRepository userRepository;

	public OnboardingServiceImpl(OnboardingRepository onboardingRepository, UserRepository userRepository) {
		this.onboardingRepository = onboardingRepository;
		this.userRepository = userRepository;
	}

	@Override
	public OnboardingResponse createOnboarding(OnboardingRequest request) {

		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

		User user = userRepository.findByEmail(authentication.getName())
				.orElseThrow(() -> new UserNotFoundException("User not found"));

		String resolvedGrade = resolveGrade(request.getSchoolGrade(), request.getEnglishLevel());
		String resolvedLevel = (resolvedGrade != null && !resolvedGrade.trim().isEmpty()) ? null
				: request.getEnglishLevel();

		Onboarding onboarding = Onboarding.builder().user(user)
				.englishLevel(resolvedLevel)
				.learningGoal(request.getLearningGoal() != null ? request.getLearningGoal()
						: "Improve English speaking skills")
				.dailyGoalMinutes(request.getDailyGoalMinutes() != null ? request.getDailyGoalMinutes() : 15)
				.nativeLanguage(request.getNativeLanguage() != null ? request.getNativeLanguage() : "English")
				.preferredLearningTime(
						request.getPreferredLearningTime() != null ? request.getPreferredLearningTime() : "Morning")
				.interests(request.getInterests() != null ? request.getInterests() : "General")
				.ageGroup(request.getAgeGroup() != null ? request.getAgeGroup() : "Professional")
				.schoolGrade(resolvedGrade)
				.onboardingCompleted(
						request.getOnboardingCompleted() != null ? request.getOnboardingCompleted() : false)
				.build();

		Onboarding savedOnboarding = onboardingRepository.save(onboarding);
		syncUserOnboarding(user, request);

		return mapToResponse(savedOnboarding);
	}

	@Override
	public OnboardingResponse getOnboarding() {

		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

		User user = userRepository.findByEmail(authentication.getName())
				.orElseThrow(() -> new UserNotFoundException("User not found"));

		// For a brand-new user who has not yet completed the onboarding flow,
		// auto-create a default Onboarding record instead of returning 404.
		Onboarding onboarding = onboardingRepository.findByUser(user)
				.orElseGet(() -> {
					Onboarding defaultOnboarding = Onboarding.builder()
							.user(user)
							.englishLevel("Beginner")
							.learningGoal("Improve English speaking skills")
							.dailyGoalMinutes(15)
							.nativeLanguage("English")
							.preferredLearningTime("Morning")
							.interests("General")
							.ageGroup("Professional")
							.schoolGrade(null)
							.onboardingCompleted(false)
							.build();
					return onboardingRepository.save(defaultOnboarding);
				});

		return mapToResponse(onboarding);
	}

	@Override
	public OnboardingResponse updateOnboarding(OnboardingRequest request) {

		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

		User user = userRepository.findByEmail(authentication.getName())
				.orElseThrow(() -> new UserNotFoundException("User not found"));

		// Create-then-update pattern: never throw 404 for a missing onboarding record.
		Onboarding onboarding = onboardingRepository.findByUser(user)
				.orElseGet(() -> {
					Onboarding defaultOnboarding = Onboarding.builder()
							.user(user)
							.englishLevel("Beginner")
							.learningGoal("Improve English speaking skills")
							.dailyGoalMinutes(15)
							.nativeLanguage("English")
							.preferredLearningTime("Morning")
							.interests("General")
							.ageGroup("Professional")
							.schoolGrade(null)
							.onboardingCompleted(false)
							.build();
					return onboardingRepository.save(defaultOnboarding);
				});

		if (request.getLearningGoal() != null)
			onboarding.setLearningGoal(request.getLearningGoal());
		if (request.getDailyGoalMinutes() != null)
			onboarding.setDailyGoalMinutes(request.getDailyGoalMinutes());
		if (request.getNativeLanguage() != null)
			onboarding.setNativeLanguage(request.getNativeLanguage());
		if (request.getPreferredLearningTime() != null)
			onboarding.setPreferredLearningTime(request.getPreferredLearningTime());
		if (request.getInterests() != null)
			onboarding.setInterests(request.getInterests());
		if (request.getAgeGroup() != null)
			onboarding.setAgeGroup(request.getAgeGroup());

		String resolvedGrade = resolveGrade(request.getSchoolGrade(), request.getEnglishLevel());
		if (resolvedGrade != null && !resolvedGrade.trim().isEmpty()) {
			onboarding.setSchoolGrade(resolvedGrade);
		}
		if (request.getEnglishLevel() != null) {
			onboarding.setEnglishLevel(request.getEnglishLevel());
		}

		if (request.getOnboardingCompleted() != null)
			onboarding.setOnboardingCompleted(request.getOnboardingCompleted());

		Onboarding updatedOnboarding = onboardingRepository.save(onboarding);
		syncUserOnboarding(user, request);

		return mapToResponse(updatedOnboarding);
	}

	@Override
	public void deleteOnboarding() {

		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

		User user = userRepository.findByEmail(authentication.getName())
				.orElseThrow(() -> new UserNotFoundException("User not found"));

		Onboarding onboarding = onboardingRepository.findByUser(user)
				.orElseThrow(() -> new OnboardingNotFoundException("Onboarding not found"));

		onboardingRepository.delete(onboarding);
	}

	private OnboardingResponse mapToResponse(Onboarding onboarding) {
		String effectiveGrade = resolveGrade(onboarding.getSchoolGrade(), onboarding.getEnglishLevel());
		String effectiveLevel = (effectiveGrade != null && !effectiveGrade.trim().isEmpty()) ? null
				: onboarding.getEnglishLevel();

		return OnboardingResponse.builder().id(onboarding.getId()).englishLevel(effectiveLevel)
				.learningGoal(onboarding.getLearningGoal()).dailyGoalMinutes(onboarding.getDailyGoalMinutes())
				.nativeLanguage(onboarding.getNativeLanguage())
				.preferredLearningTime(onboarding.getPreferredLearningTime()).interests(onboarding.getInterests())
				.ageGroup(onboarding.getAgeGroup())
				.schoolGrade(effectiveGrade)
				.onboardingCompleted(onboarding.getOnboardingCompleted()).createdAt(onboarding.getCreatedAt())
				.updatedAt(onboarding.getUpdatedAt()).build();
	}

	private void syncUserOnboarding(User user, OnboardingRequest request) {

		if (request.getNativeLanguage() != null)
			user.setNativeLanguage(request.getNativeLanguage());
		if (request.getLearningGoal() != null)
			user.setLearningGoal(request.getLearningGoal());
		if (request.getDailyGoalMinutes() != null)
			user.setDailyGoalMinutes(request.getDailyGoalMinutes());
		if (request.getPreferredVoice() != null)
			user.setPreferredVoice(request.getPreferredVoice());
		if (request.getPreferredAccent() != null)
			user.setPreferredAccent(request.getPreferredAccent());
		if (request.getAgeGroup() != null)
			user.setAgeGroup(request.getAgeGroup());

		String resolvedGrade = resolveGrade(request.getSchoolGrade(), request.getEnglishLevel());
		user.setSchoolGrade(resolvedGrade);
		if (resolvedGrade != null && !resolvedGrade.trim().isEmpty()) {
			user.setEnglishLevel(null);
		} else if (request.getEnglishLevel() != null) {
			user.setEnglishLevel(request.getEnglishLevel());
		}

		if (request.getInterests() != null)
			user.setInterests(request.getInterests());
		if (request.getOnboardingCompleted() != null)
			user.setOnboardingCompleted(Boolean.TRUE.equals(request.getOnboardingCompleted()));
		userRepository.save(user);
	}

	private String resolveGrade(String schoolGrade, String englishLevel) {
		if (schoolGrade != null && !schoolGrade.trim().isEmpty()) {
			return schoolGrade;
		}
		return null;
	}
}
