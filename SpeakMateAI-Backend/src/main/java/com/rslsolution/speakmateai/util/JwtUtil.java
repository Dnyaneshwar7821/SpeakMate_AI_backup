package com.rslsolution.speakmateai.util;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Collections;
import java.util.Date;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;

@Component
public class JwtUtil {

	private static final Logger log = LoggerFactory.getLogger(JwtUtil.class);

	private static final String INSECURE_DEFAULT_SECRET = "SpeakMateAISecretKeyForJWTAuthentication2026";

	// 30 days in milliseconds for mobile apps: 30 * 24 * 60 * 60 * 1000 = 2,592,000,000 ms
	public static final long MOBILE_JWT_EXPIRATION = 2592000000L;

	@Value("${jwt.secret:}")
	private String secretKey;

	@Value("${jwt.expiration:86400000}")
	private long jwtExpiration = 86400000L;

	@Value("${jwt.mobile.expiration:2592000000}")
	private long mobileJwtExpiration = 2592000000L;

	private Key signingKey;

	private final Set<String> revokedTokens = Collections.newSetFromMap(new ConcurrentHashMap<>());

	@PostConstruct
	public void init() {
		String effectiveSecret = (secretKey != null && !secretKey.isBlank()) ? secretKey.trim() : null;
		if (effectiveSecret == null) {
			String envSecret = System.getenv("JWT_SECRET");
			if (envSecret != null && !envSecret.isBlank()) {
				effectiveSecret = envSecret.trim();
			}
		}

		if (effectiveSecret == null || effectiveSecret.equals(INSECURE_DEFAULT_SECRET)) {
			log.warn("[SECURITY ALERT] JWT_SECRET is unset or using known default secret! Generating secure random 256-bit runtime signing key.");
			this.signingKey = Keys.secretKeyFor(SignatureAlgorithm.HS256);
		} else {
			byte[] secretBytes = effectiveSecret.getBytes(StandardCharsets.UTF_8);
			if (secretBytes.length < 32) {
				log.warn("[SECURITY ALERT] Configured JWT secret is shorter than 256 bits (32 bytes). Generating secure random key.");
				this.signingKey = Keys.secretKeyFor(SignatureAlgorithm.HS256);
			} else {
				this.signingKey = Keys.hmacShaKeyFor(secretBytes);
			}
		}
	}

	public long getExpirationForClient(String clientType) {
		if (clientType != null && clientType.trim().equalsIgnoreCase("MOBILE")) {
			return mobileJwtExpiration > 0 ? mobileJwtExpiration : MOBILE_JWT_EXPIRATION;
		}
		return jwtExpiration; // 24 hours for WEB and default
	}

	private Key getSigningKey() {
		if (signingKey == null) {
			init();
		}
		return signingKey;
	}

	public void revokeToken(String token) {
		if (token != null && !token.isBlank()) {
			revokedTokens.add(token.trim());
		}
	}

	public boolean isTokenRevoked(String token) {
		return token != null && revokedTokens.contains(token.trim());
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
		if (isTokenRevoked(token)) {
			return false;
		}
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