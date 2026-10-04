package com.rslsolution.speakmateai.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.rslsolution.speakmateai.entity.Student;
import com.rslsolution.speakmateai.entity.User;
import com.rslsolution.speakmateai.entity.Vocabulary;

@Repository
public interface VocabularyRepository extends JpaRepository<Vocabulary, Long> {

	List<Vocabulary> findByUser(User user);

	List<Vocabulary> findByUserOrderByCreatedAtDesc(User user);

	List<Vocabulary> findByUserAndFavoriteTrue(User user);
	boolean existsByUserAndWordIgnoreCase(User user, String word);

	@org.springframework.data.jpa.repository.Query("SELECT v FROM Vocabulary v WHERE v.user.id = :userId ORDER BY v.createdAt DESC")
	List<Vocabulary> findByUserIdOrderByCreatedAtDesc(@org.springframework.data.repository.query.Param("userId") Long userId);

	@org.springframework.data.jpa.repository.Query("SELECT v FROM Vocabulary v WHERE v.user.id = :userId")
	List<Vocabulary> findByUserId(@org.springframework.data.repository.query.Param("userId") Long userId);

	@org.springframework.data.jpa.repository.Query("SELECT COUNT(v) FROM Vocabulary v WHERE v.user.id = :userId")
	long countByUserId(@org.springframework.data.repository.query.Param("userId") Long userId);

	default List<Vocabulary> findByStudent(Student student) {
		if (student == null) return List.of();
		List<Vocabulary> byId = findByUserId(student.getId());
		return !byId.isEmpty() ? byId : findByUser(student);
	}

	default List<Vocabulary> findByStudentOrderByCreatedAtDesc(Student student) {
		if (student == null) return List.of();
		List<Vocabulary> byId = findByUserIdOrderByCreatedAtDesc(student.getId());
		return !byId.isEmpty() ? byId : findByUserOrderByCreatedAtDesc(student);
	}

	default List<Vocabulary> findByStudentAndFavoriteTrue(Student student) {
		return findByUserAndFavoriteTrue(student);
	}

	@org.springframework.data.jpa.repository.Query("SELECT v FROM Vocabulary v WHERE v.user.id IN :userIds AND v.createdAt >= :since ORDER BY v.createdAt DESC")
	List<Vocabulary> findByUserIdsAndCreatedAtAfter(@org.springframework.data.repository.query.Param("userIds") java.util.Collection<Long> userIds, @org.springframework.data.repository.query.Param("since") java.time.LocalDateTime since);

	long countByUser(User user);
}