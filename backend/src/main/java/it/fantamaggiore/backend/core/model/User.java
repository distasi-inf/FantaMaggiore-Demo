package it.fantamaggiore.backend.core.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import it.fantamaggiore.backend.core.model.enums.Role;
import it.fantamaggiore.backend.fantasy.model.Formation;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.util.List;

@Entity
@Table(name = "users", uniqueConstraints = {
        @UniqueConstraint(columnNames = "email"),
        @UniqueConstraint(columnNames = "fantasy_team_name"),
        @UniqueConstraint(columnNames = "username")
})
@Data
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String surname;

    @Column(unique = true, nullable = false)
    private String username;

    private String nationality;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(unique = true)
    private String fantasyTeamName;

    @Enumerated(EnumType.STRING)
    private Role role; // ADMIN o USER

    private boolean locked = false;

    private int betPoints = 0;

    private Integer previousPosition = 0;

    // RELAZIONI

    // Un utente ha un solo profilo Player (quello che crea per sé)
    // "mappedBy = user" significa che la chiave esterna fisica sarà nella tabella Player
    @JsonIgnore
    @OneToOne(mappedBy = "user", cascade = CascadeType.ALL)
    private Player player;

    // Un utente può aver schierato molte formazioni nel tempo
    @JsonIgnore
    @OneToMany(mappedBy = "user")
    @EqualsAndHashCode.Exclude
    @ToString.Exclude
    private List<Formation> formations;
}