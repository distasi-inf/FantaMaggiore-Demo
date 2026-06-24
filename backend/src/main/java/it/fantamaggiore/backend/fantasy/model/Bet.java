package it.fantamaggiore.backend.fantasy.model;

import it.fantamaggiore.backend.core.model.MatchDay;
import it.fantamaggiore.backend.core.model.User;
import it.fantamaggiore.backend.fantasy.model.enums.BetStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "bets")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Bet {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String description;

    @Enumerated(EnumType.STRING)
    private BetStatus status = BetStatus.PENDING;

    @ManyToOne
    @JoinColumn(name = "creator_id", nullable = false)
    private User creator;

    @ManyToOne
    @JoinColumn(name = "matchday_id", nullable = false)
    private MatchDay matchDay;

    @OneToMany(mappedBy = "bet", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<BetPrediction> predictions = new ArrayList<>();
}
