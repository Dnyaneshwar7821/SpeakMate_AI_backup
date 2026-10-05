package com.rslsolution.speakmateai.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import com.rslsolution.speakmateai.dto.response.AchievementResponse;
import com.rslsolution.speakmateai.dto.response.ProgressResponse;
import com.rslsolution.speakmateai.dto.response.StatisticsResponse;
import com.rslsolution.speakmateai.entity.Achievement;
import com.rslsolution.speakmateai.entity.Progress;
import com.rslsolution.speakmateai.entity.SpeakingSession;
import com.rslsolution.speakmateai.entity.User;
import com.rslsolution.speakmateai.enums.Role;
import com.rslsolution.speakmateai.repository.*;
import com.rslsolution.speakmateai.service.impl.AchievementServiceImpl;
import com.rslsolution.speakmateai.service.impl.DashboardServiceImpl;
import com.rslsolution.speakmateai.service.impl.ProgressServiceImpl;

@ExtendWith(MockitoExtension.class)
public class SpeakingSessionProgressSyncTest {

    @Mock private UserRepository userRepository;
    @Mock private ProgressRepository progressRepository;
    @Mock private SpeakingSessionRepository speakingSessionRepository;
    @Mock private VocabularyRepository vocabularyRepository;
    @Mock private GrammarHistoryRepository grammarHistoryRepository;
    @Mock private AchievementRepository achievementRepository;
    @Mock private NotificationService notificationService;
    @Mock private NotificationRepository notificationRepository;
    @Mock private OnboardingRepository onboardingRepository;
    @Mock private ChatHistoryRepository chatHistoryRepository;
    @Mock private LessonRepository lessonRepository;
    @Mock private LessonProgressRepository lessonProgressRepository;
    @Mock private ChatSessionRepository chatSessionRepository;

    private User sampleUser;

    @BeforeEach
    void setUp() {
        sampleUser = User.builder()
                .id(152L)
                .email("rohit.patel@example.com")
                .firstName("Rohit")
                .lastName("Patel")
                .role(Role.STUDENT)
                .build();

        Authentication auth = mock(Authentication.class);
        lenient().when(auth.getName()).thenReturn("rohit.patel@example.com");
        SecurityContext secCtx = mock(SecurityContext.class);
        lenient().when(secCtx.getAuthentication()).thenReturn(auth);
        SecurityContextHolder.setContext(secCtx);

        lenient().when(userRepository.findByEmail("rohit.patel@example.com")).thenReturn(Optional.of(sampleUser));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("ProgressService auto-heals inflated totalSpeakingSessions (81 down to 6 completed)")
    void testProgressService_AutoHealsInflatedCount() {
        ProgressServiceImpl progressService = new ProgressServiceImpl(
                progressRepository, userRepository,
                speakingSessionRepository, vocabularyRepository, grammarHistoryRepository);

        // Progress record currently has inflated 81
        Progress inflatedProgress = Progress.builder()
                .id(1L)
                .user(sampleUser)
                .xp(1000)
                .totalSpeakingSessions(81)
                .totalGrammarChecks(5)
                .totalVocabularyWords(10)
                .build();

        when(progressRepository.findByUser(sampleUser)).thenReturn(Optional.of(inflatedProgress));
        when(progressRepository.save(any(Progress.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Neon DB has 6 completed sessions
        List<SpeakingSession> completedSessions = List.of(
                SpeakingSession.builder().id(1L).scenario("Daily Conversation").duration(120).completed(true).build(),
                SpeakingSession.builder().id(2L).scenario("Daily Conversation").duration(120).completed(true).build(),
                SpeakingSession.builder().id(3L).scenario("Daily Conversation").duration(120).completed(true).build(),
                SpeakingSession.builder().id(4L).scenario("Daily Conversation").duration(120).completed(true).build(),
                SpeakingSession.builder().id(5L).scenario("Show & Tell").duration(120).completed(true).build(),
                SpeakingSession.builder().id(6L).scenario("Show & Tell").duration(120).completed(true).build()
        );
        when(speakingSessionRepository.findByUserAndCompletedTrue(sampleUser)).thenReturn(completedSessions);
        lenient().when(speakingSessionRepository.countByUserAndCompletedTrue(sampleUser)).thenReturn(6L);
        when(vocabularyRepository.countByUser(sampleUser)).thenReturn(10L);
        when(grammarHistoryRepository.countByUserId(152L)).thenReturn(5L);

        ProgressResponse res = progressService.getProgress();

        assertNotNull(res);
        assertEquals(6, res.getTotalSpeakingSessions(), "ProgressService must return verified completed speaking sessions (6), not 81.");
        assertEquals(6, inflatedProgress.getTotalSpeakingSessions(), "Database progress entity must be healed to 6.");
    }

    @Test
    @DisplayName("AchievementService re-locks Confident Conversationalist (needs 5 distinct scenarios) and Level 5 Achiever")
    void testAchievementService_RelocksPrematureAchievements() {
        AchievementServiceImpl achievementService = new AchievementServiceImpl(
                achievementRepository, userRepository, progressRepository,
                notificationService, speakingSessionRepository);

        Progress progress = Progress.builder()
                .id(1L)
                .user(sampleUser)
                .xp(1000)
                .totalSpeakingSessions(6)
                .level(3)
                .build();

        when(progressRepository.findByUser(sampleUser)).thenReturn(Optional.of(progress));
        when(progressRepository.save(any(Progress.class))).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(speakingSessionRepository.countByUserAndCompletedTrue(sampleUser)).thenReturn(6L);

        // 6 sessions across only 2 distinct scenarios: 4x "Daily Conversation", 2x "Show & Tell"
        List<SpeakingSession> completedSessions = List.of(
                SpeakingSession.builder().id(1L).scenario("Daily Conversation").completed(true).build(),
                SpeakingSession.builder().id(2L).scenario("Daily Conversation").completed(true).build(),
                SpeakingSession.builder().id(3L).scenario("Daily Conversation").completed(true).build(),
                SpeakingSession.builder().id(4L).scenario("Daily Conversation").completed(true).build(),
                SpeakingSession.builder().id(5L).scenario("Show & Tell").completed(true).build(),
                SpeakingSession.builder().id(6L).scenario("Show & Tell").completed(true).build()
        );
        when(speakingSessionRepository.findByUserAndCompletedTrue(sampleUser)).thenReturn(completedSessions);

        List<Achievement> existingAchievements = List.of(
                Achievement.builder().id(1L).user(sampleUser).tier(1).title("First Voice Conversation").xpReward(50).unlocked(true).build(),
                Achievement.builder().id(2L).user(sampleUser).tier(2).title("Confident Conversationalist").xpReward(120).unlocked(true).build(),
                Achievement.builder().id(3L).user(sampleUser).tier(3).title("Fluency Champion").xpReward(250).unlocked(true).build(),
                Achievement.builder().id(4L).user(sampleUser).tier(4).title("Orator Supreme").xpReward(500).unlocked(true).build(),
                Achievement.builder().id(5L).user(sampleUser).tier(2).title("Level 5 Achiever").xpReward(200).unlocked(true).build()
        );
        when(achievementRepository.findByUser(sampleUser)).thenReturn(existingAchievements);
        when(achievementRepository.save(any(Achievement.class))).thenAnswer(invocation -> invocation.getArgument(0));

        List<AchievementResponse> results = achievementService.getAllAchievements();

        // 1 session -> Unlocked
        AchievementResponse first = results.stream().filter(a -> a.getTitle().equals("First Voice Conversation")).findFirst().orElseThrow();
        assertTrue(first.getUnlocked(), "1 session target should remain unlocked for 6 completed sessions.");

        // Confident Conversationalist -> Must be re-locked because 2 distinct scenarios < 5!
        AchievementResponse conf = results.stream().filter(a -> a.getTitle().equals("Confident Conversationalist")).findFirst().orElseThrow();
        assertFalse(conf.getUnlocked(), "Confident Conversationalist must be re-locked because user completed only 2 distinct scenarios (target: 5).");

        // Fluency Champion -> Re-locked (6 < 15)
        AchievementResponse fluency = results.stream().filter(a -> a.getTitle().equals("Fluency Champion")).findFirst().orElseThrow();
        assertFalse(fluency.getUnlocked(), "15 sessions target should be re-locked since user has 6 completed sessions.");

        // Orator Supreme -> Re-locked (6 < 30)
        AchievementResponse orator = results.stream().filter(a -> a.getTitle().equals("Orator Supreme")).findFirst().orElseThrow();
        assertFalse(orator.getUnlocked(), "30 sessions target should be re-locked since user has 6 completed sessions.");

        // Level 5 Achiever -> Must be re-locked because user is only level 3 (< 5)!
        AchievementResponse lvl5 = results.stream().filter(a -> a.getTitle().equals("Level 5 Achiever")).findFirst().orElseThrow();
        assertFalse(lvl5.getUnlocked(), "Level 5 Achiever must be re-locked because user level is not 5.");
    }

    @Test
    @DisplayName("DashboardService getStatistics reports completed speaking sessions and distinct scenarios")
    void testDashboardService_StatisticsOnlyCompleted() {
        DashboardServiceImpl dashboardService = new DashboardServiceImpl(
                userRepository, progressRepository, onboardingRepository,
                speakingSessionRepository, vocabularyRepository, grammarHistoryRepository,
                chatHistoryRepository, lessonRepository, lessonProgressRepository,
                achievementRepository, notificationRepository, chatSessionRepository);

        Progress progress = Progress.builder()
                .id(1L)
                .user(sampleUser)
                .xp(1000)
                .totalSpeakingSessions(81) // inflated
                .build();
        when(progressRepository.findByUser(sampleUser)).thenReturn(Optional.of(progress));

        List<SpeakingSession> completedSessions = List.of(
                SpeakingSession.builder().id(1L).scenario("Daily Conversation").overallScore(80.0).duration(120).completed(true).build(),
                SpeakingSession.builder().id(2L).scenario("Daily Conversation").overallScore(85.0).duration(150).completed(true).build(),
                SpeakingSession.builder().id(3L).scenario("Daily Conversation").overallScore(90.0).duration(180).completed(true).build(),
                SpeakingSession.builder().id(4L).scenario("Daily Conversation").overallScore(75.0).duration(200).completed(true).build(),
                SpeakingSession.builder().id(5L).scenario("Show & Tell").overallScore(82.0).duration(160).completed(true).build(),
                SpeakingSession.builder().id(6L).scenario("Show & Tell").overallScore(88.0).duration(140).completed(true).build()
        );
        when(speakingSessionRepository.findByUserAndCompletedTrue(sampleUser)).thenReturn(completedSessions);
        when(vocabularyRepository.findByUser(sampleUser)).thenReturn(List.of());
        when(grammarHistoryRepository.findByUser(sampleUser)).thenReturn(List.of());
        lenient().when(lessonRepository.findByActiveTrue()).thenReturn(List.of());
        when(lessonProgressRepository.findByUserAndCompleted(sampleUser, true)).thenReturn(List.of());

        StatisticsResponse stats = dashboardService.getStatistics();

        assertEquals(6, stats.getSpeakingSessions(), "Dashboard statistics must report 6 completed sessions, not 81 attempted.");
        assertEquals(2, stats.getDistinctScenarios(), "Dashboard statistics must report 2 distinct scenarios.");
    }

    @Test
    @DisplayName("ProgressService recalculateAllUsers heals inflated XP, level, and re-locks unearned badges")
    void testProgressService_RecalculateAllUsers() {
        ProgressServiceImpl progressService = new ProgressServiceImpl(
                progressRepository, userRepository,
                speakingSessionRepository, vocabularyRepository, grammarHistoryRepository,
                lessonProgressRepository, achievementRepository);

        when(userRepository.findAll()).thenReturn(List.of(sampleUser));

        Progress inflatedProgress = Progress.builder()
                .id(1L)
                .user(sampleUser)
                .xp(2000)
                .level(5)
                .totalSpeakingSessions(81)
                .totalPracticeMinutes(500)
                .build();
        when(progressRepository.findByUser(sampleUser)).thenReturn(Optional.of(inflatedProgress));
        when(progressRepository.save(any(Progress.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // 6 sessions across 2 scenarios
        List<SpeakingSession> completedSessions = List.of(
                SpeakingSession.builder().id(1L).scenario("Daily Conversation").xpEarned(20).duration(120).completed(true).build(),
                SpeakingSession.builder().id(2L).scenario("Daily Conversation").xpEarned(20).duration(120).completed(true).build(),
                SpeakingSession.builder().id(3L).scenario("Daily Conversation").xpEarned(20).duration(120).completed(true).build(),
                SpeakingSession.builder().id(4L).scenario("Daily Conversation").xpEarned(20).duration(120).completed(true).build(),
                SpeakingSession.builder().id(5L).scenario("Show & Tell").xpEarned(20).duration(120).completed(true).build(),
                SpeakingSession.builder().id(6L).scenario("Show & Tell").xpEarned(20).duration(120).completed(true).build()
        );
        lenient().when(speakingSessionRepository.countByUserAndCompletedTrue(sampleUser)).thenReturn(6L);
        when(speakingSessionRepository.findByUserAndCompletedTrue(sampleUser)).thenReturn(completedSessions);
        when(lessonProgressRepository.findByUser(sampleUser)).thenReturn(List.of());

        Achievement firstVoice = Achievement.builder().id(1L).user(sampleUser).title("First Voice Conversation").xpReward(50).unlocked(true).build();
        Achievement confident = Achievement.builder().id(2L).user(sampleUser).title("Confident Conversationalist").xpReward(120).unlocked(true).build();
        Achievement fluency = Achievement.builder().id(3L).user(sampleUser).title("Fluency Champion").xpReward(250).unlocked(true).build();
        Achievement level5 = Achievement.builder().id(4L).user(sampleUser).title("Level 5 Achiever").xpReward(200).unlocked(true).build();
        when(achievementRepository.findByUser(sampleUser)).thenReturn(List.of(firstVoice, confident, fluency, level5));

        when(vocabularyRepository.countByUser(sampleUser)).thenReturn(2L);
        when(grammarHistoryRepository.countByUserId(152L)).thenReturn(1L);

        java.util.Map<String, Object> result = progressService.recalculateAllUsers();

        assertNotNull(result);
        assertEquals(true, result.get("success"));
        assertEquals(1, result.get("usersUpdated"));

        // Only firstVoice (1 session) is legitimately earned
        assertTrue(firstVoice.getUnlocked(), "First Voice Conversation remains unlocked.");
        assertFalse(confident.getUnlocked(), "Confident Conversationalist (requires 5 distinct scenarios) must be re-locked (user has 2).");
        assertFalse(fluency.getUnlocked(), "Fluency Champion (15 target) must be re-locked for 6 sessions.");
        assertFalse(level5.getUnlocked(), "Level 5 Achiever must be re-locked because user does not reach 2000 XP / Level 5.");

        // XP breakdown:
        // Speaking: 6 * 20 = 120
        // Achievements: 50 (only First Voice Conversation)
        // Vocab: 2 * 5 = 10
        // Grammar: 1 * 5 = 5
        // Total = 185 XP -> Level 1
        assertEquals(185, inflatedProgress.getXp(), "XP should strictly include legitimate sources: 120 speaking + 50 achievement + 10 vocab + 5 grammar = 185.");
        assertEquals(1, inflatedProgress.getLevel(), "185 XP should correspond to Level 1.");
        assertEquals(6, inflatedProgress.getTotalSpeakingSessions());
    }
}
