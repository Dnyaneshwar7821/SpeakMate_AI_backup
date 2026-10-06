package com.rslsolution.speakmateai.service;

import java.util.List;

import com.rslsolution.speakmateai.dto.request.ChatRenameRequest;
import com.rslsolution.speakmateai.dto.request.ChatSessionMessageRequest;
import com.rslsolution.speakmateai.dto.request.ChatStartRequest;
import com.rslsolution.speakmateai.dto.response.ChatMessageResponse;
import com.rslsolution.speakmateai.dto.response.ChatSessionDetailResponse;
import com.rslsolution.speakmateai.dto.response.ChatSessionFinishResponse;
import com.rslsolution.speakmateai.dto.response.ChatSessionResponse;

public interface AIChatService {

	List<ChatSessionResponse> getChatHistory();

	ChatSessionDetailResponse getSessionDetail(Long id);

	ChatSessionResponse startSession(ChatStartRequest request);

	ChatMessageResponse processMessage(ChatSessionMessageRequest request);

	void deleteSession(Long id);

	ChatSessionResponse renameSession(Long id, ChatRenameRequest request);

	boolean toggleBookmark(Long messageId);

	List<ChatMessageResponse> getBookmarkedMessages();

	List<String> getHints(Long id);

	ChatSessionFinishResponse finishSession(Long id);
}
