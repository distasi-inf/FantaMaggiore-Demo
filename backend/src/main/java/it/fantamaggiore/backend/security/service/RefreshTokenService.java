package it.fantamaggiore.backend.security.service;

import it.fantamaggiore.backend.core.exceptions.InvalidActionException;
import it.fantamaggiore.backend.core.exceptions.ResourceNotFoundException;
import it.fantamaggiore.backend.core.model.User;
import it.fantamaggiore.backend.core.repository.UserRepository;
import it.fantamaggiore.backend.core.service.UserService;
import it.fantamaggiore.backend.security.model.RefreshToken;
import it.fantamaggiore.backend.security.repository.RefreshTokenRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class RefreshTokenService {

    // Scadenza lunghissima: 30 giorni in millisecondi
    @Value("${fantamaggiore.app.jwtRefreshExpirationMs}")
    private long REFRESH_EXPIRATION;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private UserRepository userRepository;

    @Transactional
    public RefreshToken createRefreshToken(Long userId) {
        // Cerchiamo l'utente
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        // NOVITÀ: Eliminiamo il token esistente se presente per evitare il Duplicate Entry
        deleteRefreshTokenByUserId(userId);
        // Forziamo lo svuotamento della cache di Hibernate per rendere effettiva l'eliminazione subito
        refreshTokenRepository.flush();

        // Ora creiamo il nuovo token
        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setUser(user);
        refreshToken.setExpiryDate(Instant.now().plusMillis(REFRESH_EXPIRATION));
        refreshToken.setToken(UUID.randomUUID().toString());

        return refreshTokenRepository.save(refreshToken);
    }

    @Transactional
    public RefreshToken verifyExpiration(RefreshToken token) {
        if (token.getExpiryDate().compareTo(Instant.now()) < 0) {
            refreshTokenRepository.delete(token);
            throw new InvalidActionException("Refresh token is expired. Please make a new login.");
        }
        return token;
    }

    @Transactional(readOnly = true)
    public RefreshToken findByToken(String token) {
        return refreshTokenRepository.findByToken(token)
                .orElseThrow(() -> new ResourceNotFoundException("Refresh token not found!"));
    }

    @Transactional
    public void deleteRefreshTokenByUserId(Long userId) {
        refreshTokenRepository.deleteByUserId(userId);
    }
}