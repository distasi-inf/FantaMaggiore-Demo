package it.fantamaggiore.backend.security.model;

import it.fantamaggiore.backend.core.model.User;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "refresh_tokens")
@Data
@NoArgsConstructor
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String token;

    @Column(nullable = false)
    private Instant expiryDate;

    // Ogni utente ha un suo Refresh Token
    @OneToOne
    @JoinColumn(name = "user_id", referencedColumnName = "id")
    private User user;
}