package it.fantamaggiore.backend.core.model;

import it.fantamaggiore.backend.core.model.enums.PlayerRole;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Entity
@Table(name = "players")
@Data
@NoArgsConstructor
public class Player {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String surname;
    private String nickname;
    private String nationality;
    @Column(columnDefinition = "TEXT")
    private String profileImg; // URL dell'immagine su Supabase

    // Statistiche storiche
    private int totalGoal = 0;
    private int totalAssist = 0;
    private int totalOwnGoal = 0;
    private int gamesPlayed = 0;
    private double averageFantaVote = 0.0;

    @Enumerated(EnumType.STRING)
    private PlayerRole role;

    @Column(nullable = false, columnDefinition = "boolean default true")
    private boolean active = true;

    // CHIAVE ESTERNA FISICA verso User
    @OneToOne
    @JoinColumn(name = "user_id", nullable = true)
    @EqualsAndHashCode.Exclude
    @ToString.Exclude
    private User user;
}