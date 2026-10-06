package com.rslsolution.speakmateai.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.util.*;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.rslsolution.speakmateai.dto.response.TeacherDashboardResponse;
import com.rslsolution.speakmateai.entity.ClassRoom;
import com.rslsolution.speakmateai.entity.School;
import com.rslsolution.speakmateai.entity.Teacher;
import com.rslsolution.speakmateai.entity.User;
import com.rslsolution.speakmateai.enums.Role;
import com.rslsolution.speakmateai.repository.AchievementRepository;
import com.rslsolution.speakmateai.repository.AdminRepository;
import com.rslsolution.speakmateai.repository.ClassRoomRepository;
import com.rslsolution.speakmateai.repository.ClassStudentRepository;
import com.rslsolution.speakmateai.repository.GrammarHistoryRepository;
import com.rslsolution.speakmateai.repository.LessonProgressRepository;
import com.rslsolution.speakmateai.repository.ProgressRepository;
import com.rslsolution.speakmateai.repository.SchoolRepository;
import com.rslsolution.speakmateai.repository.SettingsRepository;
import com.rslsolution.speakmateai.repository.SpeakingSessionRepository;
import com.rslsolution.speakmateai.repository.StudentRepository;
import com.rslsolution.speakmateai.repository.TeacherRepository;
import com.rslsolution.speakmateai.repository.TeacherStandardDivisionRepository;
import com.rslsolution.speakmateai.repository.UserRepository;
import com.rslsolution.speakmateai.repository.VocabularyRepository;
import com.rslsolution.speakmateai.service.impl.TeacherServiceImpl;

@ExtendWith(MockitoExtension.class)
public class TeacherDashboardSchoolTest {

    @Mock private UserRepository userRepository;
    @Mock private TeacherRepository teacherRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private StudentRepository studentRepository;
    @Mock private AdminRepository adminRepository;
    @Mock private ClassRoomRepository classRoomRepository;
    @Mock private ClassStudentRepository classStudentRepository;
    @Mock private TeacherStandardDivisionRepository teacherStandardDivisionRepository;
    @Mock private ProgressRepository progressRepository;
    @Mock private SpeakingSessionRepository speakingSessionRepository;
    @Mock private GrammarHistoryRepository grammarHistoryRepository;
    @Mock private VocabularyRepository vocabularyRepository;
    @Mock private LessonProgressRepository lessonProgressRepository;
    @Mock private AchievementRepository achievementRepository;
    @Mock private SettingsRepository settingsRepository;
    @Mock private SchoolRepository schoolRepository;

    @InjectMocks
    private TeacherServiceImpl teacherService;

    private User teacherUser;

    @BeforeEach
    void setUp() {
        teacherUser = new User();
        teacherUser.setId(99L);
        teacherUser.setEmail("teacher@school.edu");
        teacherUser.setFirstName("John");
        teacherUser.setLastName("Doe");
        teacherUser.setRole(Role.TEACHER);
        teacherUser.setSchoolId(42L);
        teacherUser.setSchoolName("Greenwood High");

        Authentication auth = mock(Authentication.class);
        when(auth.getName()).thenReturn("teacher@school.edu");
        SecurityContext securityContext = mock(SecurityContext.class);
        when(securityContext.getAuthentication()).thenReturn(auth);
        SecurityContextHolder.setContext(securityContext);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Teacher dashboard response includes schoolName and schoolId from teacher entity")
    void testTeacherDashboardIncludesSchool() {
        when(userRepository.findByEmail("teacher@school.edu")).thenReturn(Optional.of(teacherUser));
        when(classRoomRepository.findByTeacherId(99L)).thenReturn(Collections.emptyList());

        TeacherDashboardResponse response = teacherService.getTeacherDashboard();

        assertNotNull(response);
        assertEquals(42L, response.getSchoolId());
        assertEquals("Greenwood High", response.getSchoolName());
        assertNotNull(response.getTeacherInfo());
        assertEquals(42L, response.getTeacherInfo().getSchoolId());
        assertEquals("Greenwood High", response.getTeacherInfo().getSchoolName());
    }

    @Test
    @DisplayName("Teacher dashboard resolves schoolName from SchoolRepository when missing on entity")
    void testTeacherDashboardResolvesSchoolFromRepository() {
        teacherUser.setSchoolName(null);
        teacherUser.setSchoolId(50L);

        when(userRepository.findByEmail("teacher@school.edu")).thenReturn(Optional.of(teacherUser));
        when(classRoomRepository.findByTeacherId(99L)).thenReturn(Collections.emptyList());

        School school = new School();
        school.setId(50L);
        school.setName("St. Xavier's International School");
        when(schoolRepository.findById(50L)).thenReturn(Optional.of(school));

        TeacherDashboardResponse response = teacherService.getTeacherDashboard();

        assertNotNull(response);
        assertEquals(50L, response.getSchoolId());
        assertEquals("St. Xavier's International School", response.getSchoolName());
        assertEquals("St. Xavier's International School", response.getTeacherInfo().getSchoolName());
    }
}
