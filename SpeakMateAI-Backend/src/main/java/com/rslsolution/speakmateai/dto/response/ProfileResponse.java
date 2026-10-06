package com.rslsolution.speakmateai.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProfileResponse {

	private Long id;

	private String firstName;

	private String lastName;

	private String email;

	private String role;

	private String avatar;

	private String englishLevel;

	private String learningGoal;

	private String ageGroup;

	private String schoolGrade;

	private Long schoolId;

	private String schoolName;

	private Boolean isSchoolStudent;

	private Integer xp;

	private Integer level;

	private Integer currentStreak;

	private Integer longestStreak;

	private Integer totalPracticeMinutes;

	private Integer totalSpeakingSessions;

	private Integer totalGrammarChecks;
	private Integer totalVocabularyWords;

	private com.rslsolution.speakmateai.enums.Status status;

	private Boolean active;

	public com.rslsolution.speakmateai.enums.Status getStatus() {
		return status;
	}

	public void setStatus(com.rslsolution.speakmateai.enums.Status status) {
		this.status = status;
	}

	public Boolean getActive() {
		return active;
	}

	public void setActive(Boolean active) {
		this.active = active;
	}

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public String getFirstName() {
		return firstName;
	}

	public void setFirstName(String firstName) {
		this.firstName = firstName;
	}

	public String getLastName() {
		return lastName;
	}

	public void setLastName(String lastName) {
		this.lastName = lastName;
	}

	public String getEmail() {
		return email;
	}

	public void setEmail(String email) {
		this.email = email;
	}

	public String getRole() {
		return role;
	}

	public void setRole(String role) {
		this.role = role;
	}

	public String getAvatar() {
		return avatar;
	}

	public void setAvatar(String avatar) {
		this.avatar = avatar;
	}

	public String getEnglishLevel() {
		return englishLevel;
	}

	public void setEnglishLevel(String englishLevel) {
		this.englishLevel = englishLevel;
	}

	public String getLearningGoal() {
		return learningGoal;
	}

	public void setLearningGoal(String learningGoal) {
		this.learningGoal = learningGoal;
	}

	public Integer getXp() {
		return xp;
	}

	public void setXp(Integer xp) {
		this.xp = xp;
	}

	public Integer getLevel() {
		return level;
	}

	public void setLevel(Integer level) {
		this.level = level;
	}

	public Integer getCurrentStreak() {
		return currentStreak;
	}

	public void setCurrentStreak(Integer currentStreak) {
		this.currentStreak = currentStreak;
	}

	public Integer getLongestStreak() {
		return longestStreak;
	}

	public void setLongestStreak(Integer longestStreak) {
		this.longestStreak = longestStreak;
	}

	public Integer getTotalPracticeMinutes() {
		return totalPracticeMinutes;
	}

	public void setTotalPracticeMinutes(Integer totalPracticeMinutes) {
		this.totalPracticeMinutes = totalPracticeMinutes;
	}

	public Integer getTotalSpeakingSessions() {
		return totalSpeakingSessions;
	}

	public void setTotalSpeakingSessions(Integer totalSpeakingSessions) {
		this.totalSpeakingSessions = totalSpeakingSessions;
	}

	public Integer getTotalGrammarChecks() {
		return totalGrammarChecks;
	}

	public void setTotalGrammarChecks(Integer totalGrammarChecks) {
		this.totalGrammarChecks = totalGrammarChecks;
	}

	public Integer getTotalVocabularyWords() {
		return totalVocabularyWords;
	}

	public Long getSchoolId() {
		return schoolId;
	}

	public void setSchoolId(Long schoolId) {
		this.schoolId = schoolId;
	}

	public String getSchoolName() {
		return schoolName;
	}

	public void setSchoolName(String schoolName) {
		this.schoolName = schoolName;
	}

	public static ProfileResponseBuilder builder() {
		return new ProfileResponseBuilder();
	}

	public static class ProfileResponseBuilder {
		private Long id;
		private String firstName;
		private String lastName;
		private String email;
		private String role;
		private String avatar;
		private String englishLevel;
		private String learningGoal;
		private Long schoolId;
		private String schoolName;
		private Integer xp;
		private Integer level;
		private Integer currentStreak;
		private Integer longestStreak;
		private Integer totalPracticeMinutes;
		private Integer totalSpeakingSessions;
		private Integer totalGrammarChecks;
		private Integer totalVocabularyWords;
		private com.rslsolution.speakmateai.enums.Status status;
		private Boolean active;

		public ProfileResponseBuilder id(Long id) {
			this.id = id;
			return this;
		}

		public ProfileResponseBuilder firstName(String firstName) {
			this.firstName = firstName;
			return this;
		}

		public ProfileResponseBuilder lastName(String lastName) {
			this.lastName = lastName;
			return this;
		}

		public ProfileResponseBuilder email(String email) {
			this.email = email;
			return this;
		}

		public ProfileResponseBuilder role(String role) {
			this.role = role;
			return this;
		}

		public ProfileResponseBuilder avatar(String avatar) {
			this.avatar = avatar;
			return this;
		}

		public ProfileResponseBuilder englishLevel(String englishLevel) {
			this.englishLevel = englishLevel;
			return this;
		}

		public ProfileResponseBuilder learningGoal(String learningGoal) {
			this.learningGoal = learningGoal;
			return this;
		}

		public ProfileResponseBuilder schoolId(Long schoolId) {
			this.schoolId = schoolId;
			return this;
		}

		public ProfileResponseBuilder schoolName(String schoolName) {
			this.schoolName = schoolName;
			return this;
		}

		public ProfileResponseBuilder xp(Integer xp) {
			this.xp = xp;
			return this;
		}

		public ProfileResponseBuilder level(Integer level) {
			this.level = level;
			return this;
		}

		public ProfileResponseBuilder currentStreak(Integer currentStreak) {
			this.currentStreak = currentStreak;
			return this;
		}

		public ProfileResponseBuilder longestStreak(Integer longestStreak) {
			this.longestStreak = longestStreak;
			return this;
		}

		public ProfileResponseBuilder totalPracticeMinutes(Integer totalPracticeMinutes) {
			this.totalPracticeMinutes = totalPracticeMinutes;
			return this;
		}

		public ProfileResponseBuilder totalSpeakingSessions(Integer totalSpeakingSessions) {
			this.totalSpeakingSessions = totalSpeakingSessions;
			return this;
		}

		public ProfileResponseBuilder totalGrammarChecks(Integer totalGrammarChecks) {
			this.totalGrammarChecks = totalGrammarChecks;
			return this;
		}

		public ProfileResponseBuilder totalVocabularyWords(Integer totalVocabularyWords) {
			this.totalVocabularyWords = totalVocabularyWords;
			return this;
		}

		public ProfileResponseBuilder status(com.rslsolution.speakmateai.enums.Status status) {
			this.status = status;
			return this;
		}

		public ProfileResponseBuilder active(Boolean active) {
			this.active = active;
			return this;
		}

		public ProfileResponse build() {
			ProfileResponse obj = new ProfileResponse();
			obj.setId(id);
			obj.setFirstName(firstName);
			obj.setLastName(lastName);
			obj.setEmail(email);
			obj.setRole(role);
			obj.setAvatar(avatar);
			obj.setEnglishLevel(englishLevel);
			obj.setLearningGoal(learningGoal);
			obj.setSchoolId(schoolId);
			obj.setSchoolName(schoolName);
			obj.setXp(xp);
			obj.setLevel(level);
			obj.setCurrentStreak(currentStreak);
			obj.setLongestStreak(longestStreak);
			obj.setTotalPracticeMinutes(totalPracticeMinutes);
			obj.setTotalSpeakingSessions(totalSpeakingSessions);
			obj.setTotalGrammarChecks(totalGrammarChecks);
			obj.setTotalVocabularyWords(totalVocabularyWords);
			obj.setStatus(status);
			obj.setActive(active);
			return obj;
		}
	}
}