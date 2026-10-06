package com.rslsolution.speakmateai.dto.response;

import java.time.LocalDateTime;

import com.rslsolution.speakmateai.enums.Role;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.fasterxml.jackson.annotation.JsonProperty;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserResponse {

	private Long id;

	private String firstName;

	private String lastName;

	private String email;

	private Role role;

	private String avatar;

	private boolean active;

	@JsonProperty("isPro")
	private boolean isPro;

	@JsonProperty("pro")
	public boolean getPro() {
		return isPro;
	}

	private String subscriptionPlan; // FREE, MONTHLY_PRO, YEARLY_PRO

	private LocalDateTime createdAt;

	private boolean welcomeCompleted;

	private boolean onboardingCompleted;

	private String authProvider;

	private String nativeLanguage;

	private String englishLevel;

	private String learningGoal;

	private Integer dailyGoalMinutes;

	private String preferredVoice;

	private String preferredAccent;

	private String ageGroup;

	private String schoolGrade;

	private String standard;

	private String interests;

	private Long schoolId;

	private String schoolName;

	private Boolean isSchoolStudent;

	private String accountType;

	public Long getId() { return id; }
	public void setId(Long id) { this.id = id; }

	public String getFirstName() { return firstName; }
	public void setFirstName(String firstName) { this.firstName = firstName; }

	public String getLastName() { return lastName; }
	public void setLastName(String lastName) { this.lastName = lastName; }

	public String getEmail() { return email; }
	public void setEmail(String email) { this.email = email; }

	public Role getRole() { return role; }
	public void setRole(Role role) { this.role = role; }

	public String getAvatar() { return avatar; }
	public void setAvatar(String avatar) { this.avatar = avatar; }

	public boolean isActive() { return active; }
	public void setActive(boolean active) { this.active = active; }

	public LocalDateTime getCreatedAt() { return createdAt; }
	public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

	public boolean isWelcomeCompleted() { return welcomeCompleted; }
	public void setWelcomeCompleted(boolean welcomeCompleted) { this.welcomeCompleted = welcomeCompleted; }

	public boolean isOnboardingCompleted() { return onboardingCompleted; }
	public void setOnboardingCompleted(boolean onboardingCompleted) { this.onboardingCompleted = onboardingCompleted; }

	public String getAuthProvider() { return authProvider; }
	public void setAuthProvider(String authProvider) { this.authProvider = authProvider; }

	public String getNativeLanguage() { return nativeLanguage; }
	public void setNativeLanguage(String nativeLanguage) { this.nativeLanguage = nativeLanguage; }

	public String getEnglishLevel() { return englishLevel; }
	public void setEnglishLevel(String englishLevel) { this.englishLevel = englishLevel; }

	public String getLearningGoal() { return learningGoal; }
	public void setLearningGoal(String learningGoal) { this.learningGoal = learningGoal; }

	public Integer getDailyGoalMinutes() { return dailyGoalMinutes; }
	public void setDailyGoalMinutes(Integer dailyGoalMinutes) { this.dailyGoalMinutes = dailyGoalMinutes; }

	public String getPreferredVoice() { return preferredVoice; }
	public void setPreferredVoice(String preferredVoice) { this.preferredVoice = preferredVoice; }

	public String getPreferredAccent() { return preferredAccent; }
	public void setPreferredAccent(String preferredAccent) { this.preferredAccent = preferredAccent; }

	public String getAgeGroup() { return ageGroup; }
	public void setAgeGroup(String ageGroup) { this.ageGroup = ageGroup; }

	public String getSchoolGrade() { return schoolGrade; }
	public void setSchoolGrade(String schoolGrade) { this.schoolGrade = schoolGrade; }

	public String getStandard() { return standard; }
	public void setStandard(String standard) { this.standard = standard; }

	public String getInterests() { return interests; }
	public void setInterests(String interests) { this.interests = interests; }

	public Long getSchoolId() { return schoolId; }
	public void setSchoolId(Long schoolId) { this.schoolId = schoolId; }

	public String getSchoolName() { return schoolName; }
	public void setSchoolName(String schoolName) { this.schoolName = schoolName; }

	public Boolean getIsSchoolStudent() { return isSchoolStudent; }
	public void setIsSchoolStudent(Boolean isSchoolStudent) { this.isSchoolStudent = isSchoolStudent; }

	public String getAccountType() { return accountType; }
	public void setAccountType(String accountType) { this.accountType = accountType; }

	public boolean isPro() { return isPro; }
	public void setPro(boolean isPro) { this.isPro = isPro; }

	public String getSubscriptionPlan() { return subscriptionPlan; }
	public void setSubscriptionPlan(String subscriptionPlan) { this.subscriptionPlan = subscriptionPlan; }

	public static UserResponseBuilder builder() {
		return new UserResponseBuilder();
	}

	public static class UserResponseBuilder {
		private Long id;
		private String firstName;
		private String lastName;
		private String email;
		private Role role;
		private String avatar;
		private boolean active;
		private boolean isPro;
		private String subscriptionPlan;
		private LocalDateTime createdAt;
		private boolean welcomeCompleted;
		private boolean onboardingCompleted;
		private String authProvider;
		private String nativeLanguage;
		private String englishLevel;
		private String learningGoal;
		private Integer dailyGoalMinutes;
		private String preferredVoice;
		private String preferredAccent;
		private String ageGroup;
		private String schoolGrade;
		private String standard;
		private String interests;
		private Long schoolId;
		private String schoolName;
		private Boolean isSchoolStudent;
		private String accountType;

		public UserResponseBuilder id(Long id) { this.id = id; return this; }
		public UserResponseBuilder firstName(String firstName) { this.firstName = firstName; return this; }
		public UserResponseBuilder lastName(String lastName) { this.lastName = lastName; return this; }
		public UserResponseBuilder email(String email) { this.email = email; return this; }
		public UserResponseBuilder role(Role role) { this.role = role; return this; }
		public UserResponseBuilder avatar(String avatar) { this.avatar = avatar; return this; }
		public UserResponseBuilder active(boolean active) { this.active = active; return this; }
		public UserResponseBuilder isPro(boolean isPro) { this.isPro = isPro; return this; }
		public UserResponseBuilder pro(boolean isPro) { this.isPro = isPro; return this; }
		public UserResponseBuilder subscriptionPlan(String subscriptionPlan) { this.subscriptionPlan = subscriptionPlan; return this; }
		public UserResponseBuilder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }
		public UserResponseBuilder welcomeCompleted(boolean welcomeCompleted) { this.welcomeCompleted = welcomeCompleted; return this; }
		public UserResponseBuilder onboardingCompleted(boolean onboardingCompleted) { this.onboardingCompleted = onboardingCompleted; return this; }
		public UserResponseBuilder authProvider(String authProvider) { this.authProvider = authProvider; return this; }
		public UserResponseBuilder nativeLanguage(String nativeLanguage) { this.nativeLanguage = nativeLanguage; return this; }
		public UserResponseBuilder englishLevel(String englishLevel) { this.englishLevel = englishLevel; return this; }
		public UserResponseBuilder learningGoal(String learningGoal) { this.learningGoal = learningGoal; return this; }
		public UserResponseBuilder dailyGoalMinutes(Integer dailyGoalMinutes) { this.dailyGoalMinutes = dailyGoalMinutes; return this; }
		public UserResponseBuilder preferredVoice(String preferredVoice) { this.preferredVoice = preferredVoice; return this; }
		public UserResponseBuilder preferredAccent(String preferredAccent) { this.preferredAccent = preferredAccent; return this; }
		public UserResponseBuilder ageGroup(String ageGroup) { this.ageGroup = ageGroup; return this; }
		public UserResponseBuilder schoolGrade(String schoolGrade) { this.schoolGrade = schoolGrade; return this; }
		public UserResponseBuilder standard(String standard) { this.standard = standard; return this; }
		public UserResponseBuilder interests(String interests) { this.interests = interests; return this; }
		public UserResponseBuilder schoolId(Long schoolId) { this.schoolId = schoolId; return this; }
		public UserResponseBuilder schoolName(String schoolName) { this.schoolName = schoolName; return this; }
		public UserResponseBuilder isSchoolStudent(Boolean isSchoolStudent) { this.isSchoolStudent = isSchoolStudent; return this; }
		public UserResponseBuilder accountType(String accountType) { this.accountType = accountType; return this; }

		public UserResponse build() {
            UserResponse obj = new UserResponse();
            obj.setId(id);
            obj.setFirstName(firstName);
            obj.setLastName(lastName);
            obj.setEmail(email);
            obj.setRole(role);
            obj.setAvatar(avatar);
            obj.setActive(active);
            obj.setPro(isPro);
            obj.setSubscriptionPlan(subscriptionPlan);
            obj.setCreatedAt(createdAt);
            obj.setWelcomeCompleted(welcomeCompleted);
            obj.setOnboardingCompleted(onboardingCompleted);
            obj.setAuthProvider(authProvider);
            obj.setNativeLanguage(nativeLanguage);
            obj.setEnglishLevel(englishLevel);
            obj.setLearningGoal(learningGoal);
            obj.setDailyGoalMinutes(dailyGoalMinutes);
            obj.setPreferredVoice(preferredVoice);
            obj.setPreferredAccent(preferredAccent);
            obj.setAgeGroup(ageGroup);
            obj.setSchoolGrade(schoolGrade);
            obj.setStandard(standard);
            obj.setInterests(interests);
            obj.setSchoolId(schoolId);
            obj.setSchoolName(schoolName);
            obj.setIsSchoolStudent(isSchoolStudent);
            obj.setAccountType(accountType);
            return obj;
        }
	}
}