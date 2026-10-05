package com.rslsolution.speakmateai.dto.response;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DashboardSummaryResponse {

	private String rank;
	private ProfileResponse profile;
	private ProgressResponse progress;
	private DailyGoalResponse dailyGoal;
	private List<WeeklyProgressResponse> weeklyProgress;
	private StatisticsResponse statistics;
	private QuoteResponse quote;
	private List<RecentActivityResponse> recentActivity;
	private List<LessonResponse> activeLessons;
	private List<LessonResponse> upcomingLessons;
	private Integer unreadNotificationsCount;
	private ContinueLearningResponse continueLearning;
	private WordOfTheDayResponse wordOfTheDay;
	private String englishTip;
	private List<RecommendationResponse> recommendations;
	private List<AchievementResponse> achievements;
	private List<NotificationResponse> notifications;
	private Integer badgesUnlocked;

	public Integer getBadgesUnlocked() { return badgesUnlocked; }
	public void setBadgesUnlocked(Integer badgesUnlocked) { this.badgesUnlocked = badgesUnlocked; }

	public String getRank() { return rank; }
	public void setRank(String rank) { this.rank = rank; }

	public ProfileResponse getProfile() { return profile; }
	public void setProfile(ProfileResponse profile) { this.profile = profile; }

	public ProgressResponse getProgress() { return progress; }
	public void setProgress(ProgressResponse progress) { this.progress = progress; }

	public DailyGoalResponse getDailyGoal() { return dailyGoal; }
	public void setDailyGoal(DailyGoalResponse dailyGoal) { this.dailyGoal = dailyGoal; }

	public List<WeeklyProgressResponse> getWeeklyProgress() { return weeklyProgress; }
	public void setWeeklyProgress(List<WeeklyProgressResponse> weeklyProgress) { this.weeklyProgress = weeklyProgress; }

	public StatisticsResponse getStatistics() { return statistics; }
	public void setStatistics(StatisticsResponse statistics) { this.statistics = statistics; }

	public QuoteResponse getQuote() { return quote; }
	public void setQuote(QuoteResponse quote) { this.quote = quote; }

	public List<RecentActivityResponse> getRecentActivity() { return recentActivity; }
	public void setRecentActivity(List<RecentActivityResponse> recentActivity) { this.recentActivity = recentActivity; }

	public List<LessonResponse> getActiveLessons() { return activeLessons; }
	public void setActiveLessons(List<LessonResponse> activeLessons) { this.activeLessons = activeLessons; }

	public List<LessonResponse> getUpcomingLessons() { return upcomingLessons; }
	public void setUpcomingLessons(List<LessonResponse> upcomingLessons) { this.upcomingLessons = upcomingLessons; }

	public Integer getUnreadNotificationsCount() { return unreadNotificationsCount; }
	public void setUnreadNotificationsCount(Integer unreadNotificationsCount) { this.unreadNotificationsCount = unreadNotificationsCount; }

	public ContinueLearningResponse getContinueLearning() { return continueLearning; }
	public void setContinueLearning(ContinueLearningResponse continueLearning) { this.continueLearning = continueLearning; }

	public WordOfTheDayResponse getWordOfTheDay() { return wordOfTheDay; }
	public void setWordOfTheDay(WordOfTheDayResponse wordOfTheDay) { this.wordOfTheDay = wordOfTheDay; }

	public String getEnglishTip() { return englishTip; }
	public void setEnglishTip(String englishTip) { this.englishTip = englishTip; }

	public List<RecommendationResponse> getRecommendations() { return recommendations; }
	public void setRecommendations(List<RecommendationResponse> recommendations) { this.recommendations = recommendations; }

	public List<AchievementResponse> getAchievements() { return achievements; }
	public void setAchievements(List<AchievementResponse> achievements) { this.achievements = achievements; }

	public List<NotificationResponse> getNotifications() { return notifications; }
	public void setNotifications(List<NotificationResponse> notifications) { this.notifications = notifications; }

	public static DashboardSummaryResponseBuilder builder() {
		return new DashboardSummaryResponseBuilder();
	}

	public static class DashboardSummaryResponseBuilder {
		private String rank;
		private ProfileResponse profile;
		private ProgressResponse progress;
		private DailyGoalResponse dailyGoal;
		private List<WeeklyProgressResponse> weeklyProgress;
		private StatisticsResponse statistics;
		private QuoteResponse quote;
		private List<RecentActivityResponse> recentActivity;
		private List<LessonResponse> activeLessons;
		private List<LessonResponse> upcomingLessons;
		private Integer unreadNotificationsCount;
		private ContinueLearningResponse continueLearning;
		private WordOfTheDayResponse wordOfTheDay;
		private String englishTip;
		private List<RecommendationResponse> recommendations;
		private List<AchievementResponse> achievements;
		private List<NotificationResponse> notifications;
		private Integer badgesUnlocked;

		public DashboardSummaryResponseBuilder badgesUnlocked(Integer badgesUnlocked) { this.badgesUnlocked = badgesUnlocked; return this; }
		public DashboardSummaryResponseBuilder rank(String rank) { this.rank = rank; return this; }
		public DashboardSummaryResponseBuilder profile(ProfileResponse profile) { this.profile = profile; return this; }
		public DashboardSummaryResponseBuilder progress(ProgressResponse progress) { this.progress = progress; return this; }
		public DashboardSummaryResponseBuilder dailyGoal(DailyGoalResponse dailyGoal) { this.dailyGoal = dailyGoal; return this; }
		public DashboardSummaryResponseBuilder weeklyProgress(List<WeeklyProgressResponse> weeklyProgress) { this.weeklyProgress = weeklyProgress; return this; }
		public DashboardSummaryResponseBuilder statistics(StatisticsResponse statistics) { this.statistics = statistics; return this; }
		public DashboardSummaryResponseBuilder quote(QuoteResponse quote) { this.quote = quote; return this; }
		public DashboardSummaryResponseBuilder recentActivity(List<RecentActivityResponse> recentActivity) { this.recentActivity = recentActivity; return this; }
		public DashboardSummaryResponseBuilder activeLessons(List<LessonResponse> activeLessons) { this.activeLessons = activeLessons; return this; }
		public DashboardSummaryResponseBuilder upcomingLessons(List<LessonResponse> upcomingLessons) { this.upcomingLessons = upcomingLessons; return this; }
		public DashboardSummaryResponseBuilder unreadNotificationsCount(Integer unreadNotificationsCount) { this.unreadNotificationsCount = unreadNotificationsCount; return this; }
		public DashboardSummaryResponseBuilder continueLearning(ContinueLearningResponse continueLearning) { this.continueLearning = continueLearning; return this; }
		public DashboardSummaryResponseBuilder wordOfTheDay(WordOfTheDayResponse wordOfTheDay) { this.wordOfTheDay = wordOfTheDay; return this; }
		public DashboardSummaryResponseBuilder englishTip(String englishTip) { this.englishTip = englishTip; return this; }
		public DashboardSummaryResponseBuilder recommendations(List<RecommendationResponse> recommendations) { this.recommendations = recommendations; return this; }
		public DashboardSummaryResponseBuilder achievements(List<AchievementResponse> achievements) { this.achievements = achievements; return this; }
		public DashboardSummaryResponseBuilder notifications(List<NotificationResponse> notifications) { this.notifications = notifications; return this; }

		public DashboardSummaryResponse build() {
            DashboardSummaryResponse obj = new DashboardSummaryResponse();
            obj.setRank(rank);
            obj.setProfile(profile);
            obj.setProgress(progress);
            obj.setDailyGoal(dailyGoal);
            obj.setWeeklyProgress(weeklyProgress);
            obj.setStatistics(statistics);
            obj.setQuote(quote);
            obj.setRecentActivity(recentActivity);
            obj.setActiveLessons(activeLessons);
            obj.setUpcomingLessons(upcomingLessons);
            obj.setUnreadNotificationsCount(unreadNotificationsCount);
            obj.setContinueLearning(continueLearning);
            obj.setWordOfTheDay(wordOfTheDay);
            obj.setEnglishTip(englishTip);
            obj.setRecommendations(recommendations);
            obj.setAchievements(achievements);
            obj.setNotifications(notifications);
            obj.setBadgesUnlocked(badgesUnlocked);
            return obj;
        }
	}
}
