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
public class TeacherDashboardResponse {
	private ProfileResponse teacherInfo;
	private Long schoolId;
	private String schoolName;
	private List<AssignedClassResponse> assignedClasses;
	private List<String> assignedStandards;
	private List<String> assignedDivisions;
	private String assignedStandardString;
	private Integer totalStudents;
	private Double averageProgress;
	private List<WeeklyProgressResponse> weeklyCompletion;
	private Integer completedStudents;
	private SkillPerformanceSummaryResponse skillPerformance;
	private List<StudentAttentionItemResponse> studentsRequiringAttention;
	private List<RecentActivityResponse> recentActivity;
}
