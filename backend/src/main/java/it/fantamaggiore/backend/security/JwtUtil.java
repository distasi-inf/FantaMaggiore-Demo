package it.fantamaggiore.backend.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Component
public class JwtUtil {
    // 1. Diciamo a Spring di prendere il valore dal file application.properties
    @Value("${jwt.secret}")
    private String secret;

    // 1. INIETTIAMO LA NUOVA SCADENZA DA application.properties
    @Value("${fantamaggiore.app.jwtExpirationMs}")
    private long jwtExpirationMs;

    private Key key;

    // 2. Spring eseguirà questo metodo SUBITO DOPO aver iniettato "secret"
    @PostConstruct
    public void init() {
        this.key = Keys.hmacShaKeyFor(secret.getBytes());
    }

    // --- METODO PER CREARE IL TOKEN ---
    public String generateToken(String email, Long userId, String role) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("id", userId);
        claims.put("role", role);

        return Jwts.builder()
                .setClaims(claims)
                .setSubject(email)
                .setIssuedAt(new Date(System.currentTimeMillis()))
                // 2. USIAMO LA VARIABILE INIETTATA QUI
                .setExpiration(new Date(System.currentTimeMillis() + jwtExpirationMs))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    // --- METODO PER ESTRARRE L'EMAIL DAL TOKEN ---
    public String extractEmail(String token) {
        return getClaims(token).getSubject();
    }

    // --- METODO PER ESTRARRE IL RUOLO DAL TOKEN ---
    public String extractRole(String token) {
        return getClaims(token).get("role", String.class);
    }

    // --- METODO PER ESTRARRE L'ID DELL'UTENTE ---
    public Long extractUserId(String token) {
        return getClaims(token).get("id", Long.class);
    }

    // --- METODO PER LEGGERE TUTTO IL CONTENUTO DEL TOKEN ---
    private Claims getClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(key) // Usa la chiave segreta per aprire il token
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    // --- METODO PER CAPIRE SE IL TOKEN E' VALIDO O SCADUTO ---
    public boolean isTokenValid(String token) {
        try {
            getClaims(token); // Se riesce a leggerlo senza lanciare eccezioni, è valido
            return true;
        } catch (Exception e) {
            return false; // Se è scaduto o manomesso, lancia un'eccezione
        }
    }
}
