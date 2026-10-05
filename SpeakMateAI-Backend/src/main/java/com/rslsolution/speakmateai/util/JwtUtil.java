package com.rslsolution.speakmateai.util;

import java.security.Key;
import java.util.Date;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;

@Component
public class JwtUtil {

	@Value("${jwt.secret:SpeakMateAISecretKeyForJWTAuthentication2026}")
	private String secretKey;

	@Value("${jwt.expiration:86400000}")
	private long jwtExpiration;

	// 10 years in milliseconds for mobile apps: 10 * 365.25 * 24 * 60 * 60 * 1000 = 315,576,000,000 ms
	public static final long MOBILE_JWT_EXPIRATION = 315576000000L;

	public long getExpirationForClient(String clientType) {
		if (clientType != null && clientType.trim().equalsIgnoreCase("MOBILE")) {
			return MOBILE_JWT_EXPIRATION;
		}
		return jwtExpiration; // 24 hours for WEB and default
	}

	private Key getSigningKey() {
		return Keys.hmacShaKeyFor(secretKey.getBytes());
	}

	public String generateToken(String email) {
		return generateToken(email, "WEB");
	}

	public String generateToken(String email, String clientType) {
		long expirationMs = getExpirationForClient(clientType);
		String platform = (clientType != null && clientType.trim().equalsIgnoreCase("MOBILE")) ? "MOBILE" : "WEB";
		return Jwts.builder()
				.setSubject(email)
				.claim("platform", platform)
				.setIssuedAt(new Date())
				.setExpiration(new Date(System.currentTimeMillis() + expirationMs))
				.signWith(getSigningKey(), SignatureAlgorithm.HS256)
				.compact();
	}

	public String generateUserToken(String email, String type) {
		return generateUserToken(email, type, "WEB");
	}

	public String generateUserToken(String email, String type, String clientType) {
		long expirationMs = getExpirationForClient(clientType);
		String platform = (clientType != null && clientType.trim().equalsIgnoreCase("MOBILE")) ? "MOBILE" : "WEB";
		return Jwts.builder()
				.setSubject(email)
				.claim("type", type)
				.claim("platform", platform)
				.setIssuedAt(new Date())
				.setExpiration(new Date(System.currentTimeMillis() + expirationMs))
				.signWith(getSigningKey(), SignatureAlgorithm.HS256)
				.compact();
	}

	public String generateAdminToken(String email, String role, Long adminId) {
		return Jwts.builder()
				.setSubject(email)
				.claim("role", role)
				.claim("adminId", adminId)
				.claim("type", "ADMIN")
				.setIssuedAt(new Date())
				.setExpiration(new Date(System.currentTimeMillis() + jwtExpiration))
				.signWith(getSigningKey(), SignatureAlgorithm.HS256)
				.compact();
	}

	public String extractEmail(String token) {
		return extractClaims(token).getSubject();
	}

	public boolean isTokenValid(String token, String email) {
		return extractEmail(token).equals(email) && !isTokenExpired(token);
	}

	private boolean isTokenExpired(String token) {
		return extractClaims(token).getExpiration().before(new Date());
	}

	public Claims extractClaims(String token) {
		return Jwts.parserBuilder()
				.setSigningKey(getSigningKey())
				.build()
				.parseClaimsJws(token)
				.getBody();
	}
}