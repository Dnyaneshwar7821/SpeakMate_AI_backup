package com.rslsolution.speakmateai.entity;

import java.time.LocalDateTime;
import java.util.List;

import com.rslsolution.speakmateai.enums.Role;
import com.rslsolution.speakmateai.util.ValidationUtils;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Inheritance;
import jakarta.persistence.InheritanceType;
import com.rslsolution.speakmateai.enums.Status;
import com.rslsolution.speakmateai.enums.UserType;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "users")
@Inheritance(strategy = InheritanceType.JOINED)
@Data
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class User {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@NotBlank(message = "First name is required")
	@Column(nullable = false)
	private String firstName;

	@NotBlank(message = "Last name is required")
	@Column(nullable = false)
	private String lastName;

	@NotBlank(message = "Email is required")
	@Email(message = "Invalid email format")
	@Column(nullable = false, unique = true)
	private String email;

	@NotBlank(message = "Password is required")
	@Size(min = 8, message = "Password must be at least 8 characters")
	@Column(nullable = false)
	private String password;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private Role role;

	@Column(columnDefinition = "TEXT")
	private String avatar;

	@Builder.Default
	@Column(nullable = false)
	private boolean active = true;

	@Column(nullable = false, updatable = false)
	private LocalDateTime createdAt;

	@Column(nullable = false)
	private LocalDateTime updatedAt;

	@PrePersist
	public void onCreate() {
		createdAt = LocalDateTime.now();
		updatedAt = LocalDateTime.now();
		if (this.email != null) {
			this.email = ValidationUtils.normalizeEmail(this.email);
		}
	}

	@PreUpdate
	public void onUpdate() {
		updatedAt = LocalDateTime.now();
		if (this.email != null) {
			this.email = ValidationUtils.normalizeEmail(this.email);
		}
	}

	private boolean welcomeCompleted;

	private boolean onboardingCompleted;

	private String authProvider; // LOCAL or GOOGLE

	private String resetPasswordToken;

	private LocalDateTime resetPasswordTokenExpiry;

	private String resetOtp;

	private LocalDateTime resetOtpExpiry;

	@Builder.Default
	private Integer resetOtpAttempts = 0;

	// Onboarding fields
	private String nativeLanguage;

	private String englishLevel;

	private String learningGoal;

	private Integer dailyGoalMinutes;

	private String preferredVoice;

	private String preferredAccent;

	private String ageGroup;

	private String schoolGrade;

	private Long schoolId;

	private String schoolName;

	private String interests;

	private String phone;

	private String standard;

	private String division;

	private String rollNumber;

	private String parentName;

	private String parentPhone;

	private boolean emailVerified;

	private String emailVerificationToken;

	@Builder.Default
	@Enumerated(EnumType.STRING)
	private Status status = Status.ACTIVE;

	@Builder.Default
	@Enumerated(EnumType.STRING)
	private UserType userType = UserType.STANDARD;

	@OneToMany(mappedBy = "user")
	private List<Progress> progressList;

	/** Expo push notification token — updated from the mobile app on every launch */
	@Column(length = 500)
	private String expoPushToken;

	@OneToMany(mappedBy = "user")
	private List<Settings> settingsList;

	@OneToMany(mappedBy = "user")
	private List<Onboarding> onboardingList;

	@OneToMany(mappedBy = "user")
	private List<Vocabulary> vocabularyList;

	@OneToMany(mappedBy = "user")
	private List<ChatSession> chatSessions;

	@OneToMany(mappedBy = "user")
	private List<SpeakingSession> speakingSessions;

	@OneToMany(mappedBy = "user")
	private List<GrammarHistory> grammarHistories;

	@OneToMany(mappedBy = "user")
	private List<LessonProgress> lessonProgresses;

	@OneToMany(mappedBy = "user")
	private List<Notification> notifications;

	@OneToMany(mappedBy = "user")
	private List<ChatBookmark> chatBookmarks;

	@OneToMany(mappedBy = "user")
	private List<Achievement> achievements;

	public Long getId() { return id; }
	public void setId(Long id) { this.id = id; }

	public String getFirstName() { return firstName; }
	public void setFirstName(String firstName) { this.firstName = firstName; }

	public String getLastName() { return lastName; }
	public void setLastName(String lastName) { this.lastName = lastName; }

	public String getEmail() { return email; }
	public void setEmail(String email) { this.email = ValidationUtils.normalizeEmail(email); }

	public String getPassword() { return password; }
	public void setPassword(String password) { this.password = password; }

	public Role getRole() { return role; }
	public void setRole(Role role) { this.role = role; }

	public String getAvatar() { return avatar; }
	public void setAvatar(String avatar) { this.avatar = avatar; }

	public boolean isActive() { return active; }
	public void setActive(boolean active) { this.active = active; }

	public LocalDateTime getCreatedAt() { return createdAt; }
	public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

	public LocalDateTime getUpdatedAt() { return updatedAt; }
	public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

	public boolean isWelcomeCompleted() { return welcomeCompleted; }
	public void setWelcomeCompleted(boolean welcomeCompleted) { this.welcomeCompleted = welcomeCompleted; }

	public boolean isOnboardingCompleted() { return onboardingCompleted; }
	public void setOnboardingCompleted(boolean onboardingCompleted) { this.onboardingCompleted = onboardingCompleted; }

	public String getAuthProvider() { return authProvider; }
	public void setAuthProvider(String authProvider) { this.authProvider = authProvider; }

	public String getResetPasswordToken() { return resetPasswordToken; }
	public void setResetPasswordToken(String resetPasswordToken) { this.resetPasswordToken = resetPasswordToken; }

	public LocalDateTime getResetPasswordTokenExpiry() { return resetPasswordTokenExpiry; }
	public void setResetPasswordTokenExpiry(LocalDateTime resetPasswordTokenExpiry) { this.resetPasswordTokenExpiry = resetPasswordTokenExpiry; }

	public String getResetOtp() { return resetOtp; }
	public void setResetOtp(String resetOtp) { this.resetOtp = resetOtp; }

	public LocalDateTime getResetOtpExpiry() { return resetOtpExpiry; }
	public void setResetOtpExpiry(LocalDateTime resetOtpExpiry) { this.resetOtpExpiry = resetOtpExpiry; }

	public Integer getResetOtpAttempts() { return resetOtpAttempts != null ? resetOtpAttempts : 0; }
	public void setResetOtpAttempts(Integer resetOtpAttempts) { this.resetOtpAttempts = resetOtpAttempts; }

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

	public String getAgeGroup() { return ageGroup; }
	public void setAgeGroup(String ageGroup) { this.ageGroup = ageGroup; }

	public String getSchoolGrade() { return schoolGrade; }
	public void setSchoolGrade(String schoolGrade) { this.schoolGrade = schoolGrade; }

	public String getInterests() { return interests; }
	public void setInterests(String interests) { this.interests = interests; }

	public String getExpoPushToken() { return expoPushToken; }
	public void setExpoPushToken(String expoPushToken) { this.expoPushToken = expoPushToken; }

	public String getPhone() { return phone; }
	public void setPhone(String phone) { this.phone = phone; }

	public String getStandard() { return standard; }
	public void setStandard(String standard) { this.standard = standard; }

	public String getDivision() { return division; }
	public void setDivision(String division) { this.division = division; }

	public String getRollNumber() { return rollNumber; }
	public void setRollNumber(String rollNumber) { this.rollNumber = rollNumber; }

	public String getParentName() { return parentName; }
	public void setParentName(String parentName) { this.parentName = parentName; }

	public String getParentPhone() { return parentPhone; }
	public void setParentPhone(String parentPhone) { this.parentPhone = parentPhone; }

	public boolean isEmailVerified() { return emailVerified; }
	public void setEmailVerified(boolean emailVerified) { this.emailVerified = emailVerified; }

	public String getEmailVerificationToken() { return emailVerificationToken; }
	public void setEmailVerificationToken(String emailVerificationToken) { this.emailVerificationToken = emailVerificationToken; }

	public Status getStatus() { return status; }
	public void setStatus(Status status) { this.status = status; }

	public UserType getUserType() { return userType; }
	public void setUserType(UserType userType) { this.userType = userType; }

	public Long getSchoolId() { return schoolId; }
	public void setSchoolId(Long schoolId) { this.schoolId = schoolId; }

	public String getSchoolName() { return schoolName; }
	public void setSchoolName(String schoolName) { this.schoolName = schoolName; }

	public String getPreferredAccent() { return preferredAccent; }
	public void setPreferredAccent(String preferredAccent) { this.preferredAccent = preferredAccent; }

	public List<Progress> getProgressList() { return progressList; }
	public void setProgressList(List<Progress> progressList) { this.progressList = progressList; }

	public List<Vocabulary> getVocabularyList() { return vocabularyList; }
	public void setVocabularyList(List<Vocabulary> vocabularyList) { this.vocabularyList = vocabularyList; }

	public List<ChatSession> getChatSessions() { return chatSessions; }
	public void setChatSessions(List<ChatSession> chatSessions) { this.chatSessions = chatSessions; }

	public List<SpeakingSession> getSpeakingSessions() { return speakingSessions; }
	public void setSpeakingSessions(List<SpeakingSession> speakingSessions) { this.speakingSessions = speakingSessions; }

	public List<GrammarHistory> getGrammarHistories() { return grammarHistories; }
	public void setGrammarHistories(List<GrammarHistory> grammarHistories) { this.grammarHistories = grammarHistories; }

	public List<LessonProgress> getLessonProgresses() { return lessonProgresses; }
	public void setLessonProgresses(List<LessonProgress> lessonProgresses) { this.lessonProgresses = lessonProgresses; }

	public List<Notification> getNotifications() { return notifications; }
	public void setNotifications(List<Notification> notifications) { this.notifications = notifications; }

	public List<ChatBookmark> getChatBookmarks() { return chatBookmarks; }
	public void setChatBookmarks(List<ChatBookmark> chatBookmarks) { this.chatBookmarks = chatBookmarks; }

	public List<Achievement> getAchievements() { return achievements; }
	public void setAchievements(List<Achievement> achievements) { this.achievements = achievements; }

	public Progress getProgress() {
		return (progressList != null && !progressList.isEmpty()) ? progressList.get(0) : null;
	}

	public static abstract class UserBuilder<C extends User, B extends UserBuilder<C, B>> {
		public B email(String email) {
			this.email = ValidationUtils.normalizeEmail(email);
			return self();
		}
	}
}
