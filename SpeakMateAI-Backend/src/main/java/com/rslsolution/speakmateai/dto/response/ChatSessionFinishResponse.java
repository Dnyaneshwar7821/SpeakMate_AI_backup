package com.rslsolution.speakmateai.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatSessionFinishResponse {

	private Long sessionId;
	private String mode;
	private String title;
	private Integer userMessageCount;
	private Integer totalWords;
	private Integer xpEarned;
	private String feedback;
	private boolean eligibleForXp;

	public Long getSessionId() { return sessionId; }
	public void setSessionId(Long sessionId) { this.sessionId = sessionId; }

	public String getMode() { return mode; }
	public void setMode(String mode) { this.mode = mode; }

	public String getTitle() { return title; }
	public void setTitle(String title) { this.title = title; }

	public Integer getUserMessageCount() { return userMessageCount; }
	public void setUserMessageCount(Integer userMessageCount) { this.userMessageCount = userMessageCount; }

	public Integer getTotalWords() { return totalWords; }
	public void setTotalWords(Integer totalWords) { this.totalWords = totalWords; }

	public Integer getXpEarned() { return xpEarned; }
	public void setXpEarned(Integer xpEarned) { this.xpEarned = xpEarned; }

	public String getFeedback() { return feedback; }
	public void setFeedback(String feedback) { this.feedback = feedback; }

	public boolean isEligibleForXp() { return eligibleForXp; }
	public void setEligibleForXp(boolean eligibleForXp) { this.eligibleForXp = eligibleForXp; }

	public static ChatSessionFinishResponseBuilder builder() {
		return new ChatSessionFinishResponseBuilder();
	}

	public static class ChatSessionFinishResponseBuilder {
		private Long sessionId;
		private String mode;
		private String title;
		private Integer userMessageCount;
		private Integer totalWords;
		private Integer xpEarned;
		private String feedback;
		private boolean eligibleForXp;

		public ChatSessionFinishResponseBuilder sessionId(Long sessionId) { this.sessionId = sessionId; return this; }
		public ChatSessionFinishResponseBuilder mode(String mode) { this.mode = mode; return this; }
		public ChatSessionFinishResponseBuilder title(String title) { this.title = title; return this; }
		public ChatSessionFinishResponseBuilder userMessageCount(Integer userMessageCount) { this.userMessageCount = userMessageCount; return this; }
		public ChatSessionFinishResponseBuilder totalWords(Integer totalWords) { this.totalWords = totalWords; return this; }
		public ChatSessionFinishResponseBuilder xpEarned(Integer xpEarned) { this.xpEarned = xpEarned; return this; }
		public ChatSessionFinishResponseBuilder feedback(String feedback) { this.feedback = feedback; return this; }
		public ChatSessionFinishResponseBuilder eligibleForXp(boolean eligibleForXp) { this.eligibleForXp = eligibleForXp; return this; }

		public ChatSessionFinishResponse build() {
			ChatSessionFinishResponse obj = new ChatSessionFinishResponse();
			obj.setSessionId(sessionId);
			obj.setMode(mode);
			obj.setTitle(title);
			obj.setUserMessageCount(userMessageCount);
			obj.setTotalWords(totalWords);
			obj.setXpEarned(xpEarned);
			obj.setFeedback(feedback);
			obj.setEligibleForXp(eligibleForXp);
			return obj;
		}
	}
}
