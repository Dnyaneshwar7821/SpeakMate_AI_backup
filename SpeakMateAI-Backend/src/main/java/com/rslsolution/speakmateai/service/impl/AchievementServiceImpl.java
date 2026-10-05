package com.rslsolution.speakmateai.service.impl;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rslsolution.speakmateai.dto.request.AchievementRequest;
import com.rslsolution.speakmateai.dto.response.AchievementResponse;
import com.rslsolution.speakmateai.entity.Achievement;
import com.rslsolution.speakmateai.entity.SpeakingSession;
import com.rslsolution.speakmateai.entity.User;
import com.rslsolution.speakmateai.exception.AchievementNotFoundException;
import com.rslsolution.speakmateai.exception.UserNotFoundException;
import com.rslsolution.speakmateai.repository.AchievementRepository;
import com.rslsolution.speakmateai.repository.UserRepository;
import com.rslsolution.speakmateai.service.AchievementService;
import com.rslsolution.speakmateai.service.NotificationService;

@Service
@Transactional
public class AchievementServiceImpl implements AchievementService {

	private final AchievementRepository achievementRepository;
	private final UserRepository userRepository;
	private final com.rslsolution.speakmateai.repository.ProgressRepository progressRepository;
	private final NotificationService notificationService;
	private final com.rslsolution.speakmateai.repository.SpeakingSessionRepository speakingSessionRepository;

	public AchievementServiceImpl(AchievementRepository achievementRepository, UserRepository userRepository,
			com.rslsolution.speakmateai.repository.ProgressRepository progressRepository,
			NotificationService notificationService,
			com.rslsolution.speakmateai.repository.SpeakingSessionRepository speakingSessionRepository) {
		this.achievementRepository = achievementRepository;
		this.userRepository = userRepository;
		this.progressRepository = progressRepository;
		this.notificationService = notificationService;
		this.speakingSessionRepository = speakingSessionRepository;
	}

	@Override
	public AchievementResponse createAchievement(AchievementRequest request) {

		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

		User user = userRepository.findByEmail(authentication.getName())
				.orElseThrow(() -> new UserNotFoundException("User not found"));

		Achievement achievement = Achievement.builder().user(user).title(request.getTitle())
				.description(request.getDescription()).xpReward(request.getXpReward())
				.tier(request.getTier() != null ? request.getTier() : 1)
				.unlocked(request.getUnlocked())
				.unlockedAt(request.getUnlocked() ? LocalDateTime.now() : null).build();

		Achievement savedAchievement = achievementRepository.save(achievement);

		return AchievementResponse.builder().id(savedAchievement.getId()).title(savedAchievement.getTitle())
				.description(savedAchievement.getDescription()).xpReward(savedAchievement.getXpReward())
				.tier(savedAchievement.getTier())
				.unlocked(savedAchievement.getUnlocked()).unlockedAt(savedAchievement.getUnlockedAt())
				.createdAt(savedAchievement.getCreatedAt()).build();
	}

	@Override
	public List<AchievementResponse> getAllAchievements() {

		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

		User user = userRepository.findByEmail(authentication.getName())
				.orElseThrow(() -> new UserNotFoundException("User not found"));

		List<Achievement> userAchievements = new ArrayList<>(achievementRepository.findByUser(user));

		// Seed or backfill standard 18 Master Achievements if missing
		List<Achievement> masterCatalog = generateTierAchievements(user, 1);
		for (Achievement masterItem : masterCatalog) {
			boolean exists = userAchievements.stream().anyMatch(a -> a.getTitle().equalsIgnoreCase(masterItem.getTitle()));
			if (!exists) {
				Achievement saved = achievementRepository.save(masterItem);
				userAchievements.add(saved);
			}
		}

		com.rslsolution.speakmateai.entity.Progress progress = progressRepository.findByUser(user)
				.orElseGet(() -> com.rslsolution.speakmateai.entity.Progress.builder().user(user).xp(0).level(1).currentStreak(0).longestStreak(0).totalPracticeMinutes(0).totalSpeakingSessions(0).totalGrammarChecks(0).totalVocabularyWords(0).build());

		// Synchronize speaking sessions with verified completed sessions count
		int liveSpeakingSessions = 0;
		int distinctScenarios = 0;
		if (speakingSessionRepository != null) {
			List<SpeakingSession> completed = speakingSessionRepository.findByUserAndCompletedTrue(user);
			liveSpeakingSessions = completed != null ? completed.size() : 0;
			if (completed != null) {
				distinctScenarios = (int) completed.stream()
						.map(s -> {
							String sc = s.getScenario() != null && !s.getScenario().trim().isEmpty() ? s.getScenario() : s.getTopic();
							return sc != null ? sc.trim().toLowerCase() : "";
						})
						.filter(sc -> !sc.isEmpty())
						.distinct()
						.count();
			}
			if (progress.getTotalSpeakingSessions() == null || !progress.getTotalSpeakingSessions().equals(liveSpeakingSessions)) {
				progress.setTotalSpeakingSessions(liveSpeakingSessions);
				progressRepository.save(progress);
			}
		}

		boolean progressUpdated = false;

		for (Achievement achievement : userAchievements) {
			boolean conditionMet = checkUnlockCondition(achievement, progress, distinctScenarios);

			if (Boolean.TRUE.equals(achievement.getUnlocked())) {
				// Re-validate in case achievement was falsely unlocked without satisfying targets
				if (!conditionMet && isProgressDependent(achievement, progress, distinctScenarios)) {
					achievement.setUnlocked(false);
					achievement.setUnlockedAt(null);
					achievementRepository.save(achievement);
					int reward = achievement.getXpReward() == null ? 50 : achievement.getXpReward();
					int currentXp = progress.getXp() == null ? 0 : progress.getXp();
					progress.setXp(Math.max(0, currentXp - reward));
					progressUpdated = true;
				}
			} else {
				if (conditionMet) {
					achievement.setUnlocked(true);
					achievement.setUnlockedAt(LocalDateTime.now());
					achievementRepository.save(achievement);

					int reward = achievement.getXpReward() == null ? 50 : achievement.getXpReward();
					int currentXp = progress.getXp() == null ? 0 : progress.getXp();
					progress.setXp(currentXp + reward);
					progressUpdated = true;

					try {
						notificationService.createSystemNotification(user,
								"Achievement Unlocked! 🏆",
								"You earned: \"" + achievement.getTitle() + "\" — " + achievement.getDescription()
										+ " (+" + achievement.getXpReward() + " XP)");
					} catch (Exception ignored) {}
				}
			}
		}

		if (progressUpdated) {
			int finalXp = progress.getXp() == null ? 0 : progress.getXp();
			progress.setLevel(Math.max(1, (finalXp / 500) + 1));
			progressRepository.save(progress);
		}

		return userAchievements.stream()
				.map(achievement -> AchievementResponse.builder()
						.id(achievement.getId())
						.title(achievement.getTitle())
						.description(achievement.getDescription())
						.xpReward(achievement.getXpReward())
						.tier(achievement.getTier() != null ? achievement.getTier() : 1)
						.unlocked(achievement.getUnlocked())
						.unlockedAt(achievement.getUnlockedAt())
						.createdAt(achievement.getCreatedAt())
						.build())
				.toList();
	}

	private List<Achievement> generateTierAchievements(User user, int tier) {
		return List.of(
			// Speaking & Fluency
			Achievement.builder().user(user).tier(1).title("First Voice Conversation").description("Complete your very 1st AI speaking practice session.").xpReward(50).unlocked(false).build(),
			Achievement.builder().user(user).tier(2).title("Confident Conversationalist").description("Complete 5 distinct AI speaking conversations.").xpReward(120).unlocked(false).build(),
			Achievement.builder().user(user).tier(3).title("Fluency Champion").description("Complete 15 speaking sessions across various scenarios.").xpReward(250).unlocked(false).build(),
			Achievement.builder().user(user).tier(4).title("Orator Supreme").description("Complete 30 speaking sessions with high conversational stamina.").xpReward(500).unlocked(false).build(),

			// Grammar & Accuracy
			Achievement.builder().user(user).tier(1).title("Grammar Inspector").description("Perform your first instant sentence grammar analysis.").xpReward(40).unlocked(false).build(),
			Achievement.builder().user(user).tier(2).title("Syntax Detective").description("Complete 10 sentence grammar checks and error corrections.").xpReward(100).unlocked(false).build(),
			Achievement.builder().user(user).tier(3).title("Tense Master").description("Analyze 25 sentences and explore handbook rules.").xpReward(200).unlocked(false).build(),
			Achievement.builder().user(user).tier(4).title("Grammar Scholar").description("Complete 50 comprehensive grammar checks.").xpReward(450).unlocked(false).build(),

			// Vocabulary & Word Bank
			Achievement.builder().user(user).tier(1).title("Word Collector").description("Save and master 5 vocabulary words in your word bank.").xpReward(50).unlocked(false).build(),
			Achievement.builder().user(user).tier(2).title("Lexicon Expander").description("Master 20 vocabulary flashcards and collocations.").xpReward(120).unlocked(false).build(),
			Achievement.builder().user(user).tier(3).title("Vocabulary Maestro").description("Build an active lexicon of 50 mastered words.").xpReward(300).unlocked(false).build(),

			// Streaks & Consistency
			Achievement.builder().user(user).tier(1).title("3-Day Habit Starter").description("Maintain a consecutive 3-day learning streak.").xpReward(60).unlocked(false).build(),
			Achievement.builder().user(user).tier(2).title("7-Day Week Warrior").description("Complete daily practice for 7 days in a row.").xpReward(150).unlocked(false).build(),
			Achievement.builder().user(user).tier(3).title("14-Day Dedication").description("Maintain an unbroken 14-day study streak.").xpReward(300).unlocked(false).build(),
			Achievement.builder().user(user).tier(4).title("30-Day Legend").description("Achieve a monumental 30-day streak of daily English growth.").xpReward(600).unlocked(false).build(),

			// Mastery & Experience
			Achievement.builder().user(user).tier(1).title("XP Explorer").description("Earn a total of 250 XP across all learning activities.").xpReward(75).unlocked(false).build(),
			Achievement.builder().user(user).tier(2).title("Level 5 Achiever").description("Reach Level 5 Learner status by accumulating 2,000 XP.").xpReward(200).unlocked(false).build(),
			Achievement.builder().user(user).tier(4).title("Mastery Grandmaster").description("Accumulate 2,000 XP to establish true English mastery.").xpReward(1000).unlocked(false).build()
		);
	}

	private boolean checkUnlockCondition(Achievement achievement, com.rslsolution.speakmateai.entity.Progress progress, int distinctScenarios) {
		String title = achievement.getTitle();
		if (title == null || progress == null) return false;

		int speaking = progress.getTotalSpeakingSessions() != null ? progress.getTotalSpeakingSessions() : 0;
		int grammar = progress.getTotalGrammarChecks() != null ? progress.getTotalGrammarChecks() : 0;
		int vocab = progress.getTotalVocabularyWords() != null ? progress.getTotalVocabularyWords() : 0;
		int streak = progress.getCurrentStreak() != null ? progress.getCurrentStreak() : (progress.getLongestStreak() != null ? progress.getLongestStreak() : 0);
		int xp = progress.getXp() != null ? progress.getXp() : 0;
		int userLevel = progress.getLevel() != null ? progress.getLevel() : Math.max(1, (xp / 500) + 1);

		// Speaking
		if ("First Voice Conversation".equalsIgnoreCase(title)) return speaking >= 1;
		if ("Confident Conversationalist".equalsIgnoreCase(title)) return distinctScenarios >= 5;
		if ("Fluency Champion".equalsIgnoreCase(title)) return speaking >= 15;
		if ("Orator Supreme".equalsIgnoreCase(title)) return speaking >= 30;

		// Grammar
		if ("Grammar Inspector".equalsIgnoreCase(title)) return grammar >= 1;
		if ("Syntax Detective".equalsIgnoreCase(title)) return grammar >= 10;
		if ("Tense Master".equalsIgnoreCase(title)) return grammar >= 25;
		if ("Grammar Scholar".equalsIgnoreCase(title)) return grammar >= 50;

		// Vocabulary
		if ("Word Collector".equalsIgnoreCase(title)) return vocab >= 5;
		if ("Lexicon Expander".equalsIgnoreCase(title)) return vocab >= 20;
		if ("Vocabulary Maestro".equalsIgnoreCase(title)) return vocab >= 50;

		// Streaks
		if ("3-Day Habit Starter".equalsIgnoreCase(title)) return streak >= 3;
		if ("7-Day Week Warrior".equalsIgnoreCase(title)) return streak >= 7;
		if ("14-Day Dedication".equalsIgnoreCase(title)) return streak >= 14;
		if ("30-Day Legend".equalsIgnoreCase(title)) return streak >= 30;

		// Mastery
		if ("XP Explorer".equalsIgnoreCase(title)) return xp >= 250;
		if ("Level 5 Achiever".equalsIgnoreCase(title)) return userLevel >= 5;
		if ("Mastery Grandmaster".equalsIgnoreCase(title)) return xp >= 2000;

		return false;
	}

	private boolean isProgressDependent(Achievement achievement, com.rslsolution.speakmateai.entity.Progress progress, int distinctScenarios) {
		String title = achievement.getTitle();
		if (title == null || progress == null) return false;
		int speaking = progress.getTotalSpeakingSessions() != null ? progress.getTotalSpeakingSessions() : 0;
		int xp = progress.getXp() != null ? progress.getXp() : 0;
		int userLevel = progress.getLevel() != null ? progress.getLevel() : Math.max(1, (xp / 500) + 1);
		int vocab = progress.getTotalVocabularyWords() != null ? progress.getTotalVocabularyWords() : 0;
		int grammar = progress.getTotalGrammarChecks() != null ? progress.getTotalGrammarChecks() : 0;
		int streak = Math.max(progress.getCurrentStreak() != null ? progress.getCurrentStreak() : 0,
				progress.getLongestStreak() != null ? progress.getLongestStreak() : 0);

		// Speaking
		if ("First Voice Conversation".equalsIgnoreCase(title) && speaking < 1) return true;
		if ("Confident Conversationalist".equalsIgnoreCase(title) && distinctScenarios < 5) return true;
		if ("Fluency Champion".equalsIgnoreCase(title) && speaking < 15) return true;
		if ("Orator Supreme".equalsIgnoreCase(title) && speaking < 30) return true;

		// Grammar
		if ("Grammar Inspector".equalsIgnoreCase(title) && grammar < 1) return true;
		if ("Syntax Detective".equalsIgnoreCase(title) && grammar < 10) return true;
		if ("Tense Master".equalsIgnoreCase(title) && grammar < 25) return true;
		if ("Grammar Scholar".equalsIgnoreCase(title) && grammar < 50) return true;

		// Vocabulary
		if ("Word Collector".equalsIgnoreCase(title) && vocab < 5) return true;
		if ("Lexicon Expander".equalsIgnoreCase(title) && vocab < 20) return true;
		if ("Vocabulary Maestro".equalsIgnoreCase(title) && vocab < 50) return true;

		// Streaks
		if ("3-Day Habit Starter".equalsIgnoreCase(title) && streak < 3) return true;
		if ("7-Day Week Warrior".equalsIgnoreCase(title) && streak < 7) return true;
		if ("14-Day Dedication".equalsIgnoreCase(title) && streak < 14) return true;
		if ("30-Day Legend".equalsIgnoreCase(title) && streak < 30) return true;

		// Mastery
		if ("XP Explorer".equalsIgnoreCase(title) && xp < 250) return true;
		if ("Level 5 Achiever".equalsIgnoreCase(title) && userLevel < 5 && xp < 2000) return true;
		if ("Mastery Grandmaster".equalsIgnoreCase(title) && xp < 2000) return true;

		return false;
	}

	@Override
	public AchievementResponse getAchievementById(Long id) {

		Achievement achievement = achievementRepository.findById(id)
				.orElseThrow(() -> new AchievementNotFoundException("Achievement not found"));

		return AchievementResponse.builder().id(achievement.getId()).title(achievement.getTitle())
				.description(achievement.getDescription()).xpReward(achievement.getXpReward())
				.unlocked(achievement.getUnlocked()).unlockedAt(achievement.getUnlockedAt())
				.createdAt(achievement.getCreatedAt()).build();
	}

	@Override
	public List<AchievementResponse> getUnlockedAchievements() {

		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

		User user = userRepository.findByEmail(authentication.getName())
				.orElseThrow(() -> new UserNotFoundException("User not found"));

		return achievementRepository.findByUserAndUnlockedTrue(user).stream()
				.map(achievement -> AchievementResponse.builder().id(achievement.getId()).title(achievement.getTitle())
						.description(achievement.getDescription()).xpReward(achievement.getXpReward())
						.unlocked(achievement.getUnlocked()).unlockedAt(achievement.getUnlockedAt())
						.createdAt(achievement.getCreatedAt()).build())
				.toList();
	}

	@Override
	public void deleteAchievementById(Long id) {

		Achievement achievement = achievementRepository.findById(id)
				.orElseThrow(() -> new AchievementNotFoundException("Achievement not found"));

		achievementRepository.delete(achievement);
	}
}